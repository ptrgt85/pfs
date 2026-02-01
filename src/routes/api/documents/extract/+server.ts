import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { documents } from '$lib/db/schema';
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
const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

// Get PDF page count
async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  const pdfData = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  return pdf.numPages;
}

// Convert PDF page to high-res PNG base64 (600 DPI equivalent for engineering drawings)
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
  const page = await pdf.getPage(pageNum);
  
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');
  
  await page.render({
    canvasContext: context as any,
    viewport: viewport
  }).promise;
  
  // Convert to PNG base64
  const pngBuffer = canvas.toBuffer('image/png');
  return pngBuffer.toString('base64');
}

interface ExtractedLot {
  lotNumber: string;
  area?: string;
  frontage?: string;
  depth?: string;
  streetName?: string;
  address?: string;
  status?: string;
}

interface ExtractedStage {
  stageName: string;
  stageNumber?: string;
  lots: ExtractedLot[];
}

interface ExtractionResult {
  lots?: ExtractedLot[];
  stages?: ExtractedStage[];
  rawText?: string;
  summary?: string;
}

// Extract from PDF directly using Gemini (works without canvas)
async function extractFromPdfWithGemini(pdfBuffer: Buffer, extractionType: 'stage' | 'precinct', hints: string = ''): Promise<ExtractionResult> {
  const googleApiKey = env.GOOGLE_API_KEY;
  if (!googleApiKey) {
    return { lots: [], summary: 'GOOGLE_API_KEY required for PDF extraction on serverless' };
  }
  
  const pdfBase64 = pdfBuffer.toString('base64');
  
  const stagePrompt = `You are analyzing a PERMIT PLAN or PLAN OF SUBDIVISION PDF. Extract ALL lot information visible.

WHAT TO LOOK FOR:
- Lot labels: "Lot 101", "101", "L101"
- Area text: "500 m²", "500sqm", "0.050 ha" (convert ha to m² by multiplying by 10000)
- Boundary lengths/dimensions
- Road names to identify frontage side
- Stage boundary lines and labels

MEASUREMENT DEFINITIONS:
- **Lot Number**: Exact identifier as shown
- **Area**: Total lot area in m². Record the number only.
- **Frontage**: The lot boundary that abuts a road reserve.
- **Depth**: Distance from frontage to rear boundary.
- **Street Name**: The road the primary frontage faces.

Return ONLY valid JSON, no markdown:
{"lots": [{"lotNumber": "101", "area": "450", "frontage": "15", "depth": "30", "streetName": "Main St"}], "summary": "Found X lots"}`;

  const precinctPrompt = `You are analyzing a PERMIT PLAN PDF showing a MULTI-STAGE SUBDIVISION.

WHAT TO EXTRACT:
1. **Stage Information**: Stage names/numbers ("Stage 1", "Stage 61A")
2. **For EACH lot within each stage**:
   - Lot Number, Area (m²), Frontage (m), Depth (m), Street Name

CRITICAL: Extract EVERY individual lot with its data. Do NOT just list stage summaries.

Return ONLY valid JSON:
{"stages": [{"stageName": "Stage 1", "stageNumber": "1", "lots": [{"lotNumber": "101", "area": "450", "frontage": "15", "depth": "30", "streetName": "Main St"}]}], "summary": "X stages, Y total lots"}`;

  let prompt = extractionType === 'precinct' ? precinctPrompt : stagePrompt;
  if (hints && hints.trim()) {
    prompt = `USER CONTEXT: ${hints}\n\n${prompt}`;
  }

  console.log('Sending PDF directly to Gemini (canvas not available)...');
  
  const geminiResponse = await fetch(`${GEMINI_URL}?key=${googleApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 32768 }
    })
  });
  
  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    console.error('Gemini PDF API error:', geminiResponse.status, errorText);
    return { lots: [], summary: `Gemini API error: ${geminiResponse.status}` };
  }
  
  const geminiResult = await geminiResponse.json();
  const content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Parse JSON from response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      parsed.summary = (parsed.summary || '') + ' [Gemini PDF direct]';
      return parsed;
    }
  } catch (e) {
    console.error('Failed to parse Gemini response:', e);
  }
  
  return { lots: [], summary: 'Failed to parse extraction result' };
}

async function extractWithAI(imageBase64: string, mimeType: string, extractionType: 'stage' | 'precinct' = 'stage', model: string = 'gemini', continueFrom: string[] = [], excludeStages: string[] = [], hints: string = ''): Promise<ExtractionResult> {
  const googleApiKey = env.GOOGLE_API_KEY;
  const xaiApiKey = env.XAI_API_KEY;
  const openaiApiKey = env.OPENAI_API_KEY;
  
  console.log('API Keys available:', { 
    google: !!googleApiKey, 
    xai: !!xaiApiKey, 
    openai: !!openaiApiKey,
    selectedModel: model 
  });
  
  if (!googleApiKey && !xaiApiKey && !openaiApiKey) {
    return { lots: [], summary: 'No API keys set (need GOOGLE_API_KEY, XAI_API_KEY, or OPENAI_API_KEY)' };
  }

  const stagePrompt = `You are analyzing a PERMIT PLAN or PLAN OF SUBDIVISION image. Extract ALL lot information visible.

DOCUMENT TYPES:
- **Permit Plans**: Show intended layout, staging, lot outlines. May have approximate dimensions.
- **Plan of Subdivision (POS)**: Survey-grade document with PS number, precise areas and boundary dimensions.

WHAT TO LOOK FOR:
- Lot labels: "Lot 101", "101", "L101" inside polygon boundaries
- Area text: "500 m²", "500sqm", "0.050 ha" (convert ha to m² by multiplying by 10000)
- Boundary lengths: numbers adjacent to boundary lines (e.g., "15.00", "32.50")
- Road names / road reserve outlines to identify frontage side
- Stage boundary lines and labels (Stage 1, Stage 2...)

MEASUREMENT DEFINITIONS:
- **Lot Number**: Exact identifier as shown ("Lot 101", "101", "6101")
- **Area**: Total lot area in m². Record the number only.
- **Frontage**: The lot boundary (or sum of boundaries) that abuts a road reserve.
  - For CORNER LOTS: Primary frontage = longest road-abutting boundary; note secondary frontage separately.
- **Depth**: Distance from frontage to rear boundary.
  - For IRREGULAR LOTS: Use maximum perpendicular distance from frontage to rear.
  - For BATTLE-AXE/HANDLE LOTS: Depth may not be meaningful; note as "handle lot".
- **Street Name**: The road the primary frontage faces.

PITFALLS TO AVOID:
- Don't collapse corner lot's two frontages into one number
- Battle-axe lots have narrow access legs; treat carefully
- Areas may be "approx." on permit plans

Return ONLY valid JSON, no markdown:
{"lots": [{"lotNumber": "101", "area": "450", "frontage": "15", "frontageSecondary": "", "depth": "30", "streetName": "Main St", "notes": ""}], "summary": "Found X lots"}`;

  const precinctPrompt = `You are analyzing a PERMIT PLAN (endorsed planning document) showing a MULTI-STAGE SUBDIVISION.

DOCUMENT CHARACTERISTICS:
- Site/subdivision layout ("Proposed Subdivision Plan", "Plan of Development", "Masterplan", "Staging Plan")
- Lot outlines (polylines), lot numbers, sometimes lot areas
- Road names, road reserves, reserves, common property
- Stage boundary lines and labels (Stage 1, Stage 2...)
- Legend, north point, scale bar, drawing number, revision

WHAT TO EXTRACT:
1. **Stage Information**: Stage names/numbers ("Stage 1", "Stage 61A", "61A")
2. **For EACH lot within each stage**:
   - Lot Number: Exact as shown ("Lot 101", "101", "6101")
   - Area: In m² (convert ha×10000). May be approximate on permit plans.
   - Frontage: Boundary abutting road reserve (meters)
     - CORNER LOTS: Record primary (longest road boundary) AND secondary frontage
   - Depth: Perpendicular distance from frontage to rear (meters)
     - IRREGULAR LOTS: Use max perpendicular depth
   - Street Name: Road the primary frontage faces

FRONTAGE & DEPTH RULES:
- Frontage = lot boundary that abuts a road reserve
- Depth = distance from road boundary back to rear boundary
- For irregular lots: depth = maximum perpendicular distance from frontage to rear
- Battle-axe/handle lots: frontage is the narrow access leg width; note in comments

LOOK FOR:
- Lot labels inside polygons: "Lot 101", "101", "L101"
- Area text: "500 m²", "500sqm", "0.050 ha"
- Dimension numbers along boundary lines: "15.00", "32.50"
- Road reserve labels to identify frontage side

PITFALLS:
- Permit plans may omit areas or show "approx." values
- Don't miss lots on other parts of the plan
- Corner lots have TWO frontages - capture both
- Multi-sheet plans may have lots on different pages

IMPORTANT: If there is more data visible that you cannot include due to response limits, add this to your response:
"hasMore": true, "remainingStages": ["Stage X", "Stage Y"], "estimatedRemainingLots": 50

CRITICAL: You MUST extract EVERY individual lot with its data. Do NOT just list stage summaries - extract the actual lot numbers, areas, and dimensions for each lot visible in the image. If you cannot read a value, use "unknown" but still include the lot entry.

Return ONLY valid JSON:
{"stages": [{"stageName": "Stage 1", "stageNumber": "1", "lots": [{"lotNumber": "101", "area": "450", "frontage": "15", "frontageSecondary": "12", "depth": "30", "streetName": "Main St", "notes": "corner lot"}, {"lotNumber": "102", "area": "380", "frontage": "12", "depth": "32", "streetName": "Main St"}]}], "summary": "X stages, Y total lots", "hasMore": false}`;

  // Build the prompt with continuation instructions if needed
  let prompt = extractionType === 'precinct' ? precinctPrompt : stagePrompt;
  
  // Add user-provided hints to improve extraction accuracy
  if (hints && hints.trim()) {
    prompt = `USER-PROVIDED CONTEXT (use this to improve extraction accuracy):
${hints.trim()}

IMPORTANT: Use the above context to:
- Identify the correct stage names and numbers
- Understand the lot numbering pattern (e.g., if lots start with stage number)
- Focus on the specific stages and streets mentioned
- Validate your extraction against this context

` + prompt;
    console.log(`Using extraction hints: ${hints.substring(0, 100)}...`);
  }
  
  if (continueFrom.length > 0) {
    prompt = `CONTINUATION REQUEST: You previously extracted some stages. Now extract ONLY these remaining stages: ${continueFrom.join(', ')}.
DO NOT extract stages: ${excludeStages.join(', ')} (already extracted).

` + prompt;
    console.log(`Continuation mode: focusing on ${continueFrom.join(', ')}, excluding ${excludeStages.join(', ')}`);
  }
  let content = '';

  let usedModel = '';
  
  try {
    // GEMINI - Use if explicitly selected OR as first fallback
    if (model === 'gemini' && googleApiKey) {
      console.log('Using Gemini for extraction (user selected)...');
      usedModel = 'Gemini 2.0 Flash';
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 32768 }
        })
      });
      
      if (geminiResponse.ok) {
        const geminiResult = await geminiResponse.json();
        content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log('Gemini extraction successful');
      } else {
        const errorText = await geminiResponse.text();
        console.error('Gemini API error:', geminiResponse.status, errorText);
        return { lots: [], summary: `Gemini API error: ${geminiResponse.status}. Check GOOGLE_API_KEY.` };
      }
    }
    
    // OPENAI - Use if explicitly selected
    if (!content && model === 'openai' && openaiApiKey) {
      console.log('Using OpenAI for extraction (user selected)...');
      usedModel = 'GPT-5 Mini (OpenAI)';
      const openaiResponse = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          }],
          max_completion_tokens: 16384
        })
      });

      if (openaiResponse.ok) {
        const openaiResult = await openaiResponse.json();
        content = openaiResult.choices?.[0]?.message?.content || '';
        console.log('OpenAI extraction successful');
      } else {
        const errorText = await openaiResponse.text();
        console.error('OpenAI API error:', openaiResponse.status, errorText);
        // Parse and show the actual error message from OpenAI
        try {
          const errorJson = JSON.parse(errorText);
          const errorMsg = errorJson.error?.message || errorText;
          return { lots: [], summary: `OpenAI error: ${errorMsg}` };
        } catch {
          return { lots: [], summary: `OpenAI API error: ${openaiResponse.status}. ${errorText}` };
        }
      }
    }
    
    // GROK (xAI) - Use if explicitly selected
    if (!content && model === 'grok' && xaiApiKey) {
      console.log('Using xAI Grok for extraction (user selected)...');
      usedModel = 'Grok 2 Vision (xAI)';
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
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
            ]
          }],
          max_completion_tokens: 16384
        })
      });

      if (grokResponse.ok) {
        const grokResult = await grokResponse.json();
        content = grokResult.choices?.[0]?.message?.content || '';
        console.log('Grok extraction successful');
      } else {
        const errorText = await grokResponse.text();
        console.error('Grok API error:', errorText);
        return { lots: [], summary: `Grok API error: ${grokResponse.status}. Check XAI_API_KEY.` };
      }
    }
    
    // FALLBACK - If selected model's API key is missing, try any available
    if (!content) {
      console.log(`Selected model '${model}' not available (API key missing), trying fallbacks...`);
      
      // Try Gemini as fallback
      if (googleApiKey) {
        console.log('Falling back to Gemini...');
        usedModel = 'Gemini 2.0 Flash (fallback)';
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
            generationConfig: { temperature: 0.1, maxOutputTokens: 32768 }
          })
        });
        
        if (geminiResponse.ok) {
          const geminiResult = await geminiResponse.json();
          content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
          console.log('Gemini fallback extraction successful');
        }
      }
      
      // Try OpenAI as fallback
      if (!content && openaiApiKey) {
        console.log('Falling back to OpenAI...');
        usedModel = 'GPT-5 Mini (OpenAI fallback)';
        const openaiResponse = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-5-mini',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
              ]
            }],
            temperature: 0.3,
            max_tokens: 16384
          })
        });

        if (openaiResponse.ok) {
          const openaiResult = await openaiResponse.json();
          content = openaiResult.choices?.[0]?.message?.content || '';
          console.log('OpenAI fallback extraction successful');
        }
      }
    }
    
    if (!content) {
      return { lots: [], summary: `No response from AI models. Selected: ${model}. Check API keys in .env file.` };
    }
    
    console.log('AI response:', content);
    
    // Clean the response - remove markdown code blocks and text prefixes
    let jsonStr = content;
    
    // Remove markdown code blocks (```json ... ``` or ``` ... ```)
    jsonStr = jsonStr.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1');
    
    // Find the JSON object - look for outermost { }
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    // Fix common JSON issues - trailing commas, etc.
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
    
    try {
      const parsed = JSON.parse(jsonStr);
      // Debug: Log the parsed structure
      console.log('Parsed extraction result:', JSON.stringify({
        stagesCount: parsed.stages?.length,
        stages: parsed.stages?.map((s: any) => ({ 
          name: s.stageName, 
          lotsCount: s.lots?.length || 0 
        })),
        summary: parsed.summary
      }));
      return parsed;
    } catch (parseError) {
      // Try to fix common JSON issues
      console.error('JSON parse error, attempting to fix:', parseError);
      console.error('Attempted to parse:', jsonStr.substring(0, 500));
      
      // Try to extract partial data if JSON is truncated
      const lotsMatch = content.match(/"lots"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
      if (lotsMatch) {
        try {
          // Try to parse individual lot objects
          const lotStrings = lotsMatch[1].match(/\{[^}]+\}/g) || [];
          const lots = lotStrings.map((s: string) => {
            try { return JSON.parse(s); } catch { return null; }
          }).filter(Boolean);
          
          if (lots.length > 0) {
            return { lots, summary: `Extracted ${lots.length} lots (partial recovery)` };
          }
        } catch {}
      }
      
      return { lots: [], summary: `Could not parse AI response. Raw: ${content.substring(0, 200)}...` };
    }
  } catch (error) {
    console.error('Groq extraction error:', error);
    return { lots: [], summary: `Extraction error: ${error}` };
  }
}

// Merge extraction results from multiple pages
function mergeExtractionResults(results: ExtractionResult[], extractionType: string): ExtractionResult {
  if (extractionType === 'precinct') {
    // Merge stages - combine stages with same name, or add new ones
    const stageMap = new Map<string, ExtractedStage>();
    
    for (const result of results) {
      if (result.stages) {
        for (const stage of result.stages) {
          const key = stage.stageName || stage.stageNumber || 'Unknown';
          if (stageMap.has(key)) {
            // Merge lots into existing stage, avoiding duplicates
            const existing = stageMap.get(key)!;
            const existingLotNums = new Set(existing.lots.map(l => l.lotNumber));
            for (const lot of stage.lots) {
              if (!existingLotNums.has(lot.lotNumber)) {
                existing.lots.push(lot);
              }
            }
          } else {
            stageMap.set(key, { ...stage, lots: [...stage.lots] });
          }
        }
      }
    }
    
    const stages = Array.from(stageMap.values());
    const totalLots = stages.reduce((sum, s) => sum + s.lots.length, 0);
    
    return {
      stages,
      summary: `Found ${stages.length} stages with ${totalLots} total lots (from ${results.length} pages)`
    };
  } else {
    // Merge lots - avoid duplicates by lot number
    const lotMap = new Map<string, ExtractedLot>();
    
    for (const result of results) {
      if (result.lots) {
        for (const lot of result.lots) {
          if (!lotMap.has(lot.lotNumber)) {
            lotMap.set(lot.lotNumber, lot);
          }
        }
      }
    }
    
    const lots = Array.from(lotMap.values());
    return {
      lots,
      summary: `Found ${lots.length} lots (from ${results.length} pages)`
    };
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const { documentId, extractionType = 'stage', model = 'gemini', continueFrom = [], excludeStages = [], hints = '' } = await request.json();
  
  // If continuing, modify the prompt to focus on remaining stages
  const isContinuation = continueFrom.length > 0;
  
  // Get document from database
  const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
  
  if (!doc) {
    return json({ error: 'Document not found' }, { status: 404 });
  }
  
  // Read file from Vercel Blob URL
  let fileBuffer;
  try {
    // Check if filename is a URL (Vercel Blob) or local path
    if (doc.filename.startsWith('http://') || doc.filename.startsWith('https://')) {
      // Fetch from Vercel Blob
      console.log('Fetching file from Vercel Blob:', doc.filename);
      const response = await fetch(doc.filename);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      console.log('File fetched successfully, size:', fileBuffer.length);
    } else {
      // Legacy: Read from local filesystem
      const filepath = path.join(UPLOAD_DIR, doc.filename);
      fileBuffer = await readFile(filepath);
    }
  } catch (e: any) {
    console.error('File read error:', e);
    return json({ error: `Could not read file: ${e.message}` }, { status: 500 });
  }
  
  // If PDF, process ALL pages and combine results
  if (doc.mimeType === 'application/pdf') {
    try {
      // Check if canvas is available for PDF-to-image conversion
      if (!createCanvas) {
        // Canvas not available (serverless) - send PDF directly to Gemini
        console.log('Canvas not available - using Gemini PDF direct extraction');
        const extractedData = await extractFromPdfWithGemini(fileBuffer, extractionType, hints);
        
        // Update document with extracted data
        await db.update(documents)
          .set({ 
            extractedData: JSON.stringify(extractedData),
            aiProcessed: new Date()
          })
          .where(eq(documents.id, documentId));
        
        return json({ ...extractedData, pageCount: 1 });
      }
      
      const pageCount = await getPdfPageCount(fileBuffer);
      console.log(`PDF has ${pageCount} pages. Processing all pages for extraction...`);
      
      const allResults: ExtractionResult[] = [];
      
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        console.log(`Processing page ${pageNum}/${pageCount}...`);
        const base64 = await pdfPageToImage(fileBuffer, pageNum, 4.0);
        if (!base64) {
          console.log('Failed to convert PDF page to image');
          continue;
        }
        const pageResult = await extractWithAI(base64, 'image/png', extractionType, model, continueFrom, excludeStages, hints);
        
        // Only add if we got meaningful results
        if ((pageResult.lots && pageResult.lots.length > 0) || 
            (pageResult.stages && pageResult.stages.length > 0)) {
          allResults.push(pageResult);
          console.log(`Page ${pageNum}: Found ${pageResult.lots?.length || 0} lots, ${pageResult.stages?.length || 0} stages`);
        } else {
          console.log(`Page ${pageNum}: No data found`);
        }
      }
      
      // Merge all results
      const extractedData = allResults.length > 0 
        ? mergeExtractionResults(allResults, extractionType)
        : { lots: [], stages: [], summary: 'No data found in document' };
      
      console.log(`Extraction complete: ${extractedData.summary}`);
      
      // Update document with extracted data
      await db.update(documents)
        .set({ 
          extractedData: JSON.stringify(extractedData),
          aiProcessed: new Date()
        })
        .where(eq(documents.id, documentId));
      
      return json({ ...extractedData, pageCount });
      
    } catch (e) {
      console.error('PDF extraction error:', e);
      return json({ error: 'Could not process PDF for analysis' }, { status: 500 });
    }
  } else {
    // Single image - process directly
    const base64 = fileBuffer.toString('base64');
    const extractedData = await extractWithAI(base64, doc.mimeType, extractionType, model, continueFrom, excludeStages, hints);
    
    // Update document with extracted data
    await db.update(documents)
      .set({ 
        extractedData: JSON.stringify(extractedData),
        aiProcessed: new Date()
      })
      .where(eq(documents.id, documentId));
    
    return json({ ...extractedData, pageCount: 1 });
  }
};
