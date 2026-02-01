import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { documents, lots, stages, precincts } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
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
const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

// Convert PDF page to high-res PNG base64 (600 DPI equivalent for survey plans)
async function pdfPageToImage(pdfBuffer: Buffer, pageNum: number = 1, scale: number = 4.0): Promise<string> {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  
  const pdfData = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNum);
  
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

// Get total pages in PDF
async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const pdfData = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

interface ExtractedLot {
  lotNumber: string;
  area?: string;
  frontage?: string;
  depth?: string;
  streetName?: string;
}

interface ExistingLot {
  id: number;
  lotNumber: string;
  area: string | null;
  frontage: string | null;
  depth: string | null;
  streetName: string | null;
}

export const POST: RequestHandler = async ({ request }) => {
  const { documentId, model = 'gemini', entityType, entityId } = await request.json();
  
  // Get document
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  
  if (!doc) {
    return json({ error: 'Document not found' }, { status: 404 });
  }
  
  // Get existing lots to compare against
  let existingLots: ExistingLot[] = [];
  
  if (entityType === 'precinct' && entityId) {
    // Get all lots from all stages in this precinct
    const precinctStages = await db.select().from(stages).where(eq(stages.precinctId, entityId));
    
    for (const stage of precinctStages) {
      const stageLots = await db.select().from(lots).where(eq(lots.stageId, stage.id));
      existingLots = [...existingLots, ...stageLots.map(l => ({
        id: l.id,
        lotNumber: l.lotNumber,
        area: l.area?.toString() || null,
        frontage: l.frontage?.toString() || null,
        depth: l.depth?.toString() || null,
        streetName: l.streetName || null
      }))];
    }
  } else if (entityType === 'stage' && entityId) {
    const stageLots = await db.select().from(lots).where(eq(lots.stageId, entityId));
    existingLots = stageLots.map(l => ({
      id: l.id,
      lotNumber: l.lotNumber,
      area: l.area?.toString() || null,
      frontage: l.frontage?.toString() || null,
      depth: l.depth?.toString() || null,
      streetName: l.streetName || null
    }));
  }
  
  if (existingLots.length === 0) {
    return json({ error: 'No existing lots to compare against. Extract from Permit Plan first.' }, { status: 400 });
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
      // Legacy: Read from local filesystem
      const filepath = path.join(UPLOAD_DIR, doc.filename);
      fileBuffer = await readFile(filepath);
    }
  } catch (e: any) {
    console.error('File read error:', e);
    return json({ error: `Could not read file: ${e.message}` }, { status: 500 });
  }
  
  // Extract lot numbers to look for
  const lotNumbersList = existingLots.map(l => l.lotNumber).join(', ');
  
  // Build extraction prompt for Plan of Subdivision (POS) - the authoritative survey document
  const prompt = `You are analyzing a PLAN OF SUBDIVISION (POS) - a survey-grade document prepared by a licensed surveyor.

POS CHARACTERISTICS:
- PS number (e.g., PS 9xxxxxx) once lodged/created
- Every lot labeled (Lot 1, Lot 2, Lot 101, etc.)
- Lot areas (almost always) in m² or ha for large parcels
- Boundary dimensions (lengths) on most/all lot boundaries
- Bearings and survey control references may appear
- Road reserves, easements (E-1, E-2), restrictions, reserves, common property
- Title block, scale, north point, sheet numbering
- May be multiple sheets

TARGET LOT NUMBERS TO FIND: ${lotNumbersList}

EXTRACT FOR EACH LOT:
1. **Lot Number**: Exact as shown (normalize "Lot 101" = "101")
2. **Area**: In m² (POS is authoritative - record exact value). Convert ha×10000 to m².
3. **Frontage**: Boundary length(s) abutting road reserve
   - CORNER LOTS: Primary frontage (longest road boundary) AND secondary frontage
   - Sum multiple segments if frontage is split
4. **Depth**: Distance from frontage to rear boundary
   - For irregular lots: max perpendicular distance from frontage to rear
5. **Street Name**: Road the primary frontage faces

WHAT TO LOOK FOR:
- Lot labels inside polygons: "Lot 101", "101", "L101"
- Area text near lot: "500 m²", "500sqm", "0.050 ha"
- Dimension numbers along boundary lines: "15.00", "32.50" (usually aligned with boundary or with dimension ticks)
- Road reserve labels to identify which boundary is frontage

PITFALLS:
- POS is the SOURCE OF TRUTH for areas and boundary lengths - use exact values
- Multi-sheet plans: lots may be on different pages
- Don't confuse easement dimensions with lot boundaries
- Corner lots have TWO frontages - capture both
- Battle-axe lots: frontage is the narrow access leg width

Return ONLY valid JSON:
{"lotsFound": [{"lotNumber": "101", "area": "450.5", "frontage": "15.00", "frontageSecondary": "12.00", "depth": "30.00", "streetName": "Main St", "confidence": "high", "notes": ""}], "summary": "Found X lots on this page"}`;

  const googleApiKey = env.GOOGLE_API_KEY;
  const xaiApiKey = env.XAI_API_KEY;
  const groqApiKey = env.GROQ_API_KEY;
  
  if (!googleApiKey && !xaiApiKey && !groqApiKey) {
    return json({ error: 'No API keys configured (need GOOGLE_API_KEY, XAI_API_KEY, or GROQ_API_KEY)' }, { status: 500 });
  }
  
  // Process PDF pages
  let allExtractedLots: ExtractedLot[] = [];
  
  if (doc.mimeType === 'application/pdf') {
    try {
      const pageCount = await getPdfPageCount(fileBuffer);
      console.log(`Processing ${pageCount} pages for cross-reference...`);
      
      // Process each page (limit to first 10 pages for performance)
      const maxPages = Math.min(pageCount, 10);
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        console.log(`Processing page ${pageNum}/${maxPages}...`);
        
        const imageBase64 = await pdfPageToImage(fileBuffer, pageNum, 4.0); // 600 DPI equivalent
        let content = '';
        
        // Use xAI Grok if explicitly selected
        if (model === 'grok' && xaiApiKey) {
          const grokResponse = await fetch(XAI_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${xaiApiKey}`
            },
            body: JSON.stringify({
              model: 'grok-2-vision-1212',
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
                ]
              }],
              temperature: 0.2,
              max_completion_tokens: 4096
            })
          });
          
          if (grokResponse.ok) {
            const grokResult = await grokResponse.json();
            content = grokResult.choices?.[0]?.message?.content || '';
          }
        }
        
        // Use Groq if explicitly selected
        if (!content && model === 'groq' && groqApiKey) {
          const groqResponse = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqApiKey}`
            },
            body: JSON.stringify({
              model: 'meta-llama/llama-4-scout-17b-16e-instruct',
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
                ]
              }],
              temperature: 0.2,
              max_completion_tokens: 4096
            })
          });
          
          if (groqResponse.ok) {
            const groqResult = await groqResponse.json();
            content = groqResult.choices?.[0]?.message?.content || '';
          }
        }
        
        // Use Gemini if selected (or as fallback)
        if (!content && googleApiKey && (model === 'gemini' || (!xaiApiKey && !groqApiKey))) {
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
              generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
            })
          });
          
          if (geminiResponse.ok) {
            const geminiResult = await geminiResponse.json();
            content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }
        }
        
        if (content) {
          try {
            // Parse JSON from response
            let jsonStr = content.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1');
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonStr = jsonMatch[0];
            }
            jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
            
            const parsed = JSON.parse(jsonStr);
            if (parsed.lotsFound) {
              allExtractedLots = [...allExtractedLots, ...parsed.lotsFound];
            }
          } catch (e) {
            console.error(`Parse error on page ${pageNum}:`, e);
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
    let content = '';
    
    // Use xAI Grok if explicitly selected
    if (model === 'grok' && xaiApiKey) {
      const grokResponse = await fetch(XAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${xaiApiKey}`
        },
        body: JSON.stringify({
          model: 'grok-2-vision-1212',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${doc.mimeType};base64,${imageBase64}` } }
            ]
          }],
          temperature: 0.2,
          max_completion_tokens: 4096
        })
      });
      
      if (grokResponse.ok) {
        const grokResult = await grokResponse.json();
        content = grokResult.choices?.[0]?.message?.content || '';
      }
    }
    
    // Use Groq if explicitly selected
    if (!content && model === 'groq' && groqApiKey) {
      const groqResponse = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${groqApiKey}`
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${doc.mimeType};base64,${imageBase64}` } }
            ]
          }],
          temperature: 0.2,
          max_completion_tokens: 4096
        })
      });
      
      if (groqResponse.ok) {
        const groqResult = await groqResponse.json();
        content = groqResult.choices?.[0]?.message?.content || '';
      }
    }
    
    // Use Gemini if selected (or as fallback)
    if (!content && googleApiKey && (model === 'gemini' || (!xaiApiKey && !groqApiKey))) {
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
        })
      });
      
      if (geminiResponse.ok) {
        const geminiResult = await geminiResponse.json();
        content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
    }
    
    if (content) {
      try {
        let jsonStr = content.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1');
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
        
        const parsed = JSON.parse(jsonStr);
        if (parsed.lotsFound) {
          allExtractedLots = parsed.lotsFound;
        }
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
  }
  
  // De-duplicate extracted lots (keep last occurrence)
  const uniqueLots = new Map<string, ExtractedLot>();
  for (const lot of allExtractedLots) {
    uniqueLots.set(lot.lotNumber, lot);
  }
  
  // Compare extracted lots with existing lots
  const matches: any[] = [];
  
  for (const existing of existingLots) {
    const extracted = uniqueLots.get(existing.lotNumber);
    
    if (extracted) {
      // Check for discrepancies
      const discrepancies: { field: string; existing: string; extracted: string }[] = [];
      
      const parseNum = (val: any) => parseFloat(String(val || '0').replace(/[^\d.]/g, '')) || 0;
      
      if (extracted.area && Math.abs(parseNum(extracted.area) - parseNum(existing.area)) > 0.5) {
        discrepancies.push({ field: 'area', existing: existing.area || '', extracted: extracted.area });
      }
      if (extracted.frontage && Math.abs(parseNum(extracted.frontage) - parseNum(existing.frontage)) > 0.1) {
        discrepancies.push({ field: 'frontage', existing: existing.frontage || '', extracted: extracted.frontage });
      }
      if (extracted.depth && Math.abs(parseNum(extracted.depth) - parseNum(existing.depth)) > 0.1) {
        discrepancies.push({ field: 'depth', existing: existing.depth || '', extracted: extracted.depth });
      }
      
      matches.push({
        lotNumber: existing.lotNumber,
        lotId: existing.id,
        hasDiscrepancy: discrepancies.length > 0,
        discrepancies,
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
        }
      });
    }
  }
  
  // Build corrections from discrepancies
  const corrections = [];
  for (const match of matches) {
    for (const disc of match.discrepancies) {
      corrections.push({
        lotNumber: match.lotNumber,
        lotId: match.lotId,
        field: disc.field,
        currentValue: disc.existing,
        correctValue: disc.extracted,
        confidence: 0.85
      });
    }
  }
  
  return json({
    matches,
    corrections,
    lotsFound: Array.from(uniqueLots.values()),
    summary: `Cross-referenced ${matches.length} lots, ${corrections.length} discrepancies found`
  });
};
