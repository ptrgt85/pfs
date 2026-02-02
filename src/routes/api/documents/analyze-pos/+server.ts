import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { documents, lots, stages } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import path from 'path';
import { env } from '$env/dynamic/private';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Dynamic canvas import - may not be available on serverless
let createCanvas: any;
try {
  createCanvas = require('canvas').createCanvas;
} catch {
  createCanvas = null;
}

const UPLOAD_DIR = 'static/uploads';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Returns null if canvas is not available (serverless environment)
async function pdfPageToImage(pdfBuffer: Buffer, pageNum: number = 1, scale: number = 4.0): Promise<string | null> {
  if (!createCanvas) {
    console.log('Canvas not available - cannot convert PDF to image');
    return null;
  }
  
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  
  const pdfData = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(Math.min(pageNum, pdf.numPages));
  
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  
  await page.render({
    canvasContext: context as any,
    viewport: viewport
  }).promise;
  
  const pngBuffer = canvas.toBuffer('image/png');
  return pngBuffer.toString('base64');
}

async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const pdfData = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

interface ExtractedLotPOS {
  lotNumber: string;
  area?: string;
  frontage?: string;
  frontageSecondary?: string;
  depth?: string;
  streetName?: string;
  boundaries?: Array<{ length: string; bearing?: string; description?: string }>;
  easements?: Array<{ id: string; type: string; width?: string; purpose?: string; beneficiary?: string }>;
  encumbrances?: Array<{ type: string; description: string; reference?: string }>;
  restrictions?: Array<{ type: string; description: string }>;
  notes?: string;
  confidence?: string;
}

interface ExistingLot {
  id: number;
  lotNumber: string;
  area: string | null;
  frontage: string | null;
  depth: string | null;
  streetName: string | null;
  status: string | null;
}

interface ComparisonResult {
  lotNumber: string;
  lotId: number;
  status: 'match' | 'variance' | 'new_data';
  existing: {
    area: string | null;
    frontage: string | null;
    depth: string | null;
    streetName: string | null;
  };
  extracted: {
    area?: string;
    frontage?: string;
    depth?: string;
    streetName?: string;
  };
  variances: Array<{ field: string; existing: string; extracted: string; difference?: string }>;
  newInfo: {
    boundaries?: Array<{ length: string; bearing?: string; description?: string }>;
    easements?: Array<{ id: string; type: string; width?: string; purpose?: string; beneficiary?: string }>;
    encumbrances?: Array<{ type: string; description: string; reference?: string }>;
    restrictions?: Array<{ type: string; description: string }>;
  };
}

export const POST: RequestHandler = async ({ request }) => {
  const { documentId, model = 'gemini', stageId } = await request.json();
  
  // Get document
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  
  if (!doc) {
    return json({ error: 'Document not found' }, { status: 404 });
  }
  
  // Get existing lots from the stage
  let existingLots: ExistingLot[] = [];
  
  if (stageId) {
    const stageLots = await db.select().from(lots).where(eq(lots.stageId, stageId));
    existingLots = stageLots.map(l => ({
      id: l.id,
      lotNumber: l.lotNumber,
      area: l.area?.toString() || null,
      frontage: l.frontage?.toString() || null,
      depth: l.depth?.toString() || null,
      streetName: l.streetName || null,
      status: l.status || null
    }));
  }
  
  // Read file from Vercel Blob URL or local path
  let fileBuffer;
  try {
    if (doc.filename.startsWith('http://') || doc.filename.startsWith('https://')) {
      // Fetch from Vercel Blob
      console.log('Fetching file from Vercel Blob:', doc.filename);
      const response = await fetch(doc.filename);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      // Legacy: Local filesystem - won't work on serverless
      if (!createCanvas) {
        return json({ error: 'This document was uploaded before cloud storage was enabled. Please delete and re-upload the document.' }, { status: 400 });
      }
      const filepath = path.join(UPLOAD_DIR, doc.filename);
      fileBuffer = await readFile(filepath);
    }
  } catch (e: any) {
    console.error('File read error:', e);
    return json({ error: `Could not read file: ${e.message}` }, { status: 500 });
  }
  
  const lotNumbersList = existingLots.length > 0 
    ? existingLots.map(l => l.lotNumber).join(', ')
    : 'Extract all lots found';
  
  // Enhanced prompt for Plan of Subdivision analysis with easements and encumbrances
  const prompt = `You are analyzing a PLAN OF SUBDIVISION (POS) - a survey-grade legal document.

DOCUMENT TYPE: Plan of Subdivision (PS number e.g., PS 9xxxxxx)
This is the AUTHORITATIVE source for lot boundaries, areas, and encumbrances.

TARGET LOTS: ${lotNumbersList}

EXTRACT FOR EACH LOT:

1. **BOUNDARIES & DIMENSIONS**:
   - Lot Number: Exact as shown
   - Area: In m² (convert ha×10000). THIS IS AUTHORITATIVE.
   - Frontage: Primary road boundary length (meters)
   - Frontage Secondary: For corner lots, the secondary road boundary
   - Depth: Distance from frontage to rear (max perpendicular for irregular lots)
   - Street Name: Road the primary frontage faces
   - All boundary lengths with bearings if shown

2. **EASEMENTS** (Critical - look for E-1, E-2, etc.):
   - Easement ID: E-1, E-2, etc.
   - Type: drainage, sewerage, electricity, carriageway, pedestrian access, etc.
   - Width: e.g., "2.0m wide", "3.0m wide"
   - Purpose: What the easement is for
   - Beneficiary: Who benefits (council, electricity company, lot owner, etc.)
   - Which lots are affected

3. **ENCUMBRANCES & RESTRICTIONS**:
   - Restrictive covenants (building envelopes, materials, heights)
   - Section 173 agreements
   - Caveats
   - Building exclusion zones
   - Any notations affecting the lot

4. **OTHER IMPACTS**:
   - Common property boundaries
   - Reserve land
   - Drainage reserves
   - Public open space contributions
   - Any notes or annotations affecting the lot

WHERE TO LOOK:
- Lot polygons with labels inside
- Area text: "450 m²", "0.045 ha"
- Boundary dimensions along lines: "15.00", "32.50"
- Easement hatching (diagonal lines) with labels E-1, E-2
- Legend/schedule of easements
- Notes section
- Title block annotations

Return ONLY valid JSON:
{
  "psNumber": "PS 9xxxxxx",
  "lotsAnalyzed": [
    {
      "lotNumber": "101",
      "area": "450.5",
      "frontage": "15.00",
      "frontageSecondary": "12.00",
      "depth": "30.00",
      "streetName": "Main Street",
      "boundaries": [
        {"length": "15.00", "bearing": "N45°30'E", "description": "front boundary to Main Street"},
        {"length": "30.00", "bearing": "S45°30'E", "description": "side boundary"}
      ],
      "easements": [
        {"id": "E-1", "type": "drainage", "width": "2.0m", "purpose": "stormwater drainage", "beneficiary": "Council"},
        {"id": "E-2", "type": "sewerage", "width": "3.0m", "purpose": "sewer main", "beneficiary": "Water Authority"}
      ],
      "encumbrances": [
        {"type": "restriction", "description": "Building envelope - setback 6m from front boundary"}
      ],
      "restrictions": [
        {"type": "covenant", "description": "Single dwelling only"}
      ],
      "notes": "Corner lot",
      "confidence": "high"
    }
  ],
  "generalEasements": [
    {"id": "E-1", "type": "drainage", "width": "2.0m", "affectedLots": ["101", "102", "103"]}
  ],
  "summary": "Analyzed X lots, found Y easements affecting Z lots"
}`;

  const googleApiKey = env.GOOGLE_API_KEY;
  
  if (!googleApiKey) {
    return json({ error: 'GOOGLE_API_KEY not configured' }, { status: 500 });
  }
  
  let allExtractedLots: ExtractedLotPOS[] = [];
  let psNumber = '';
  let generalEasements: any[] = [];
  
  // Process PDF pages
  if (doc.mimeType === 'application/pdf') {
    try {
      const pageCount = await getPdfPageCount(fileBuffer);
      console.log(`Analyzing ${pageCount} pages for POS data...`);
      
      const maxPages = Math.min(pageCount, 10);
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        console.log(`Processing page ${pageNum}/${maxPages}...`);
        
        const imageBase64 = await pdfPageToImage(fileBuffer, pageNum, 4.0);
        if (!imageBase64) {
          return json({ error: 'POS analysis requires canvas (not available on serverless). Please use the Extract feature which supports serverless PDF processing.' }, { status: 400 });
        }
        
        const geminiResponse = await fetch(`${GEMINI_URL}?key=${googleApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: 'image/png', data: imageBase64 } }
              ]
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
          })
        });
        
        if (geminiResponse.ok) {
          const geminiResult = await geminiResponse.json();
          const content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          if (content) {
            try {
              let jsonStr = content.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1');
              const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                jsonStr = jsonMatch[0];
              }
              jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
              
              const parsed = JSON.parse(jsonStr);
              if (parsed.lotsAnalyzed) {
                allExtractedLots = [...allExtractedLots, ...parsed.lotsAnalyzed];
              }
              if (parsed.psNumber && !psNumber) {
                psNumber = parsed.psNumber;
              }
              if (parsed.generalEasements) {
                generalEasements = [...generalEasements, ...parsed.generalEasements];
              }
            } catch (e) {
              console.error(`Parse error on page ${pageNum}:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.error('PDF processing error:', e);
      return json({ error: `PDF processing error: ${e}` }, { status: 500 });
    }
  } else {
    // Single image
    const imageBase64 = fileBuffer.toString('base64');
    
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${googleApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: doc.mimeType, data: imageBase64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 }
      })
    });
    
    if (geminiResponse.ok) {
      const geminiResult = await geminiResponse.json();
      const content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (content) {
        try {
          let jsonStr = content.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1');
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonStr = jsonMatch[0];
          }
          jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
          
          const parsed = JSON.parse(jsonStr);
          if (parsed.lotsAnalyzed) {
            allExtractedLots = parsed.lotsAnalyzed;
          }
          if (parsed.psNumber) {
            psNumber = parsed.psNumber;
          }
          if (parsed.generalEasements) {
            generalEasements = parsed.generalEasements;
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  }
  
  // De-duplicate extracted lots
  const uniqueLots = new Map<string, ExtractedLotPOS>();
  for (const lot of allExtractedLots) {
    const existing = uniqueLots.get(lot.lotNumber);
    if (!existing || (lot.easements && lot.easements.length > (existing.easements?.length || 0))) {
      uniqueLots.set(lot.lotNumber, lot);
    }
  }
  
  // Compare with existing lots and build comparison results
  const comparisons: ComparisonResult[] = [];
  const parseNum = (val: any) => parseFloat(String(val || '0').replace(/[^\d.-]/g, '')) || 0;
  
  for (const existing of existingLots) {
    const extracted = uniqueLots.get(existing.lotNumber);
    
    if (extracted) {
      const variances: ComparisonResult['variances'] = [];
      
      // Check area variance
      const existingArea = parseNum(existing.area);
      const extractedArea = parseNum(extracted.area);
      if (extracted.area && Math.abs(extractedArea - existingArea) > 0.5) {
        variances.push({
          field: 'area',
          existing: existing.area || '-',
          extracted: extracted.area,
          difference: `${extractedArea > existingArea ? '+' : ''}${(extractedArea - existingArea).toFixed(1)} m²`
        });
      }
      
      // Check frontage variance
      const existingFrontage = parseNum(existing.frontage);
      const extractedFrontage = parseNum(extracted.frontage);
      if (extracted.frontage && Math.abs(extractedFrontage - existingFrontage) > 0.1) {
        variances.push({
          field: 'frontage',
          existing: existing.frontage || '-',
          extracted: extracted.frontage,
          difference: `${extractedFrontage > existingFrontage ? '+' : ''}${(extractedFrontage - existingFrontage).toFixed(2)}m`
        });
      }
      
      // Check depth variance
      const existingDepth = parseNum(existing.depth);
      const extractedDepth = parseNum(extracted.depth);
      if (extracted.depth && Math.abs(extractedDepth - existingDepth) > 0.1) {
        variances.push({
          field: 'depth',
          existing: existing.depth || '-',
          extracted: extracted.depth,
          difference: `${extractedDepth > existingDepth ? '+' : ''}${(extractedDepth - existingDepth).toFixed(2)}m`
        });
      }
      
      // Determine status
      let status: ComparisonResult['status'] = 'match';
      if (variances.length > 0) {
        status = 'variance';
      }
      
      // Check for new information (easements, etc.)
      const hasNewInfo = (extracted.easements && extracted.easements.length > 0) ||
                         (extracted.encumbrances && extracted.encumbrances.length > 0) ||
                         (extracted.restrictions && extracted.restrictions.length > 0) ||
                         (extracted.boundaries && extracted.boundaries.length > 0);
      
      if (hasNewInfo && variances.length === 0) {
        status = 'new_data';
      }
      
      comparisons.push({
        lotNumber: existing.lotNumber,
        lotId: existing.id,
        status,
        existing: {
          area: existing.area,
          frontage: existing.frontage,
          depth: existing.depth,
          streetName: existing.streetName
        },
        extracted: {
          area: extracted.area,
          frontage: extracted.frontage,
          depth: extracted.depth,
          streetName: extracted.streetName
        },
        variances,
        newInfo: {
          boundaries: extracted.boundaries,
          easements: extracted.easements,
          encumbrances: extracted.encumbrances,
          restrictions: extracted.restrictions
        }
      });
      
      // Remove from map so we can track unmatched lots
      uniqueLots.delete(existing.lotNumber);
    } else {
      // Existing lot not found in POS
      comparisons.push({
        lotNumber: existing.lotNumber,
        lotId: existing.id,
        status: 'match',
        existing: {
          area: existing.area,
          frontage: existing.frontage,
          depth: existing.depth,
          streetName: existing.streetName
        },
        extracted: {},
        variances: [],
        newInfo: {}
      });
    }
  }
  
  // Any remaining lots in uniqueLots are new lots found in POS but not in database
  const newLotsFound = Array.from(uniqueLots.values());
  
  // Build corrections array for easy application
  const corrections = [];
  for (const comp of comparisons) {
    for (const variance of comp.variances) {
      corrections.push({
        lotNumber: comp.lotNumber,
        lotId: comp.lotId,
        field: variance.field,
        currentValue: variance.existing,
        newValue: variance.extracted,
        difference: variance.difference
      });
    }
  }
  
  // Summary stats
  const matchCount = comparisons.filter(c => c.status === 'match').length;
  const varianceCount = comparisons.filter(c => c.status === 'variance').length;
  const newDataCount = comparisons.filter(c => c.status === 'new_data').length;
  const lotsWithEasements = comparisons.filter(c => c.newInfo.easements && c.newInfo.easements.length > 0).length;
  
  return json({
    psNumber,
    comparisons,
    corrections,
    newLotsFound,
    generalEasements,
    summary: {
      totalLots: comparisons.length,
      matches: matchCount,
      variances: varianceCount,
      newData: newDataCount,
      lotsWithEasements,
      totalCorrections: corrections.length
    },
    message: `Analyzed ${comparisons.length} lots: ${matchCount} match, ${varianceCount} have variances, ${lotsWithEasements} have easements`
  });
};
