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
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

// Convert PDF page to high-res PNG base64 (600 DPI equivalent for survey/engineering plans)
async function pdfPageToImage(pdfBuffer: Buffer, pageNum: number = 1, scale: number = 4.0): Promise<string> {
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  
  const pdfData = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;
  
  // Clamp page number to valid range
  const actualPageNum = Math.min(Math.max(1, pageNum), pdf.numPages);
  const page = await pdf.getPage(actualPageNum);
  
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

interface ExistingLot {
  id: number;
  lotNumber: string;
  area?: string;
  frontage?: string;
  depth?: string;
  streetName?: string;
}

interface Correction {
  lotId: number;
  lotNumber: string;
  field: string;
  currentValue: string;
  newValue: string;
  confidence: number;
}

interface CorrectionHistoryItem {
  lotNumber: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface CalibrationFeedback {
  lotNumber: string;
  aiValues: { area: string; frontage: string; depth: string; streetName: string };
  userValues: { area: string; frontage: string; depth: string; streetName: string };
  corrections: { area: boolean; frontage: boolean; depth: boolean; streetName: boolean };
}

export const POST: RequestHandler = async ({ request }) => {
  const { 
    documentId, 
    pageNumber = 1, 
    existingLots = [], 
    correctionHistory = [], 
    capturedImage = null,
    model = 'gemini',  // 'gemini' or 'groq'
    phase = 'calibration',  // legacy - kept for compatibility
    calibrationFeedback = [],
    returnImage = false,  // For visual calibration - return the image
    boxCalibrationFeedback = []  // Visual box calibration data
  } = await request.json();
  
  let imageBase64: string;
  
  // If user provided a captured screenshot, use that instead
  if (capturedImage) {
    console.log('Using user-captured screenshot for verification...');
    imageBase64 = capturedImage;
  } else {
    // Get document and convert PDF page
    const [doc] = await db.select().from(documents).where(eq(documents.id, documentId));
    if (!doc) {
      return json({ error: 'Document not found' }, { status: 404 });
    }
    
    if (doc.mimeType !== 'application/pdf') {
      return json({ error: 'Document must be a PDF or provide a screenshot' }, { status: 400 });
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
    
    try {
      console.log(`Converting PDF page ${pageNumber} to high-DPI image (600 DPI equivalent)...`);
      imageBase64 = await pdfPageToImage(fileBuffer, pageNumber, 4.0); // 600 DPI for survey plans
      console.log('PDF page converted successfully');
    } catch (e) {
      console.error('PDF conversion error:', e);
      return json({ error: 'Could not convert PDF page' }, { status: 500 });
    }
  }
  
  // Build prompt with existing lot data for comparison
  const lotSummary = existingLots.map((lot: ExistingLot) => 
    `Lot ${lot.lotNumber}: area=${lot.area || '?'}, frontage=${lot.frontage || '?'}, depth=${lot.depth || '?'}, street=${lot.streetName || '?'}`
  ).join('\n');
  
  // Build correction history context for AI learning
  let correctionContext = '';
  if (correctionHistory.length > 0) {
    const correctionExamples = correctionHistory.map((c: CorrectionHistoryItem) => 
      `- ${c.field} for Lot ${c.lotNumber}: changed from "${c.oldValue}" to "${c.newValue}"`
    ).join('\n');
    
    correctionContext = `
LEARNING FROM PREVIOUS USER CORRECTIONS:
${correctionExamples}
`;
  }
  
  // Build calibration context if in final phase
  let calibrationContext = '';
  
  // Handle text-based calibration feedback
  if (phase === 'final' && calibrationFeedback.length > 0) {
    const calibrationExamples = calibrationFeedback
      .filter((cf: CalibrationFeedback) => 
        cf.corrections.area || cf.corrections.frontage || cf.corrections.depth || cf.corrections.streetName
      )
      .map((cf: CalibrationFeedback) => {
        const corrections = [];
        if (cf.corrections.area) corrections.push(`area: AI said "${cf.aiValues.area}" but correct is "${cf.userValues.area}"`);
        if (cf.corrections.frontage) corrections.push(`frontage: AI said "${cf.aiValues.frontage}" but correct is "${cf.userValues.frontage}"`);
        if (cf.corrections.depth) corrections.push(`depth: AI said "${cf.aiValues.depth}" but correct is "${cf.userValues.depth}"`);
        if (cf.corrections.streetName) corrections.push(`street: AI said "${cf.aiValues.streetName}" but correct is "${cf.userValues.streetName}"`);
        return `Lot ${cf.lotNumber}: ${corrections.join(', ')}`;
      }).join('\n');
    
    if (calibrationExamples) {
      calibrationContext = `
CRITICAL CALIBRATION - USER VERIFIED THESE SAMPLES AND FOUND ERRORS:
${calibrationExamples}

IMPORTANT: Based on these calibration samples, you likely made SYSTEMATIC ERRORS. 
For example, if you misread frontage as "10" when it was "15" for multiple lots, apply this correction pattern to ALL lots.
Re-examine the image carefully and correct ALL similar errors across all lots.
`;
    }
  }
  
  // Handle visual box calibration feedback - this is more detailed
  if (phase === 'final' && boxCalibrationFeedback.length > 0) {
    const boxExamples: string[] = [];
    const patternAnalysis: { field: string; aiVals: string[]; userVals: string[]; diffs: number[] }[] = [
      { field: 'area', aiVals: [], userVals: [], diffs: [] },
      { field: 'frontage', aiVals: [], userVals: [], diffs: [] },
      { field: 'depth', aiVals: [], userVals: [], diffs: [] }
    ];
    
    boxCalibrationFeedback.forEach((lot: any) => {
      const lotCorrections: string[] = [];
      lot.fields?.forEach((f: any) => {
        if (f.aiValue !== f.userValue && f.userValue) {
          lotCorrections.push(`${f.name}: AI="${f.aiValue}" → Correct="${f.userValue}"`);
          
          // Collect for pattern analysis
          const pattern = patternAnalysis.find(p => p.field === f.name);
          if (pattern) {
            pattern.aiVals.push(f.aiValue);
            pattern.userVals.push(f.userValue);
            const aiNum = parseFloat(f.aiValue) || 0;
            const userNum = parseFloat(f.userValue) || 0;
            if (aiNum && userNum) {
              pattern.diffs.push(userNum - aiNum);
            }
          }
        }
      });
      if (lotCorrections.length > 0) {
        boxExamples.push(`Lot ${lot.lotNumber}: ${lotCorrections.join(', ')}`);
      }
    });
    
    // Detect systematic patterns
    let patternWarnings = '';
    patternAnalysis.forEach(p => {
      if (p.diffs.length >= 2) {
        const avgDiff = p.diffs.reduce((a, b) => a + b, 0) / p.diffs.length;
        const allSameSign = p.diffs.every(d => d > 0) || p.diffs.every(d => d < 0);
        if (allSameSign && Math.abs(avgDiff) > 0.5) {
          patternWarnings += `\n- ${p.field.toUpperCase()}: You consistently ${avgDiff > 0 ? 'UNDERESTIMATED' : 'OVERESTIMATED'} by ~${Math.abs(avgDiff).toFixed(1)}. Add ${avgDiff > 0 ? '+' : ''}${avgDiff.toFixed(1)} to all ${p.field} values.`;
        }
      }
    });
    
    if (boxExamples.length > 0) {
      calibrationContext += `
VISUAL CALIBRATION - USER DREW BOXES AROUND CORRECT VALUES:
${boxExamples.join('\n')}
${patternWarnings ? `\nDETECTED SYSTEMATIC ERRORS:${patternWarnings}` : ''}

CRITICAL: Apply these EXACT corrections to the sample lots, and apply the same patterns to ALL other lots.
For every lot, re-read the values from the image using the calibration as a guide.
`;
    }
  }
  
  let verifyPrompt: string;
  
  if (phase === 'calibration') {
    // First phase: just extract all lots for calibration sampling
    verifyPrompt = `You are analyzing a subdivision plan image. Extract ALL lot information visible.
${correctionContext}

WHAT TO LOOK FOR:
- Lot labels: "Lot 101", "101", "L101" inside polygon boundaries
- Area text: "500 m²", "500sqm", "0.050 ha" (convert ha×10000 to m²)
- Boundary lengths: numbers adjacent to boundary lines (e.g., "15.00", "32.50")
- Road names / road reserve outlines to identify frontage side

MEASUREMENT DEFINITIONS:
- **Lot Number**: Exact identifier as shown ("Lot 101", "101", "6101")
- **Area**: Total lot area in m². Record the number only.
- **Frontage**: The lot boundary (or sum of boundaries) that abuts a road reserve.
  - CORNER LOTS: Primary frontage = longest road-abutting boundary; record secondary separately.
- **Depth**: Distance from frontage to rear boundary.
  - IRREGULAR LOTS: Use maximum perpendicular distance from frontage to rear.
  - BATTLE-AXE/HANDLE LOTS: Note as "handle lot" - depth may not be meaningful.
- **Street Name**: The road the primary frontage faces.

PITFALLS TO AVOID:
- Don't collapse corner lot's two frontages into one number
- Battle-axe lots have narrow access legs; treat carefully
- Dimension numbers are usually aligned with boundary lines or have dimension ticks
- Areas may be approximate on permit plans; POS values are authoritative

Return ONLY valid JSON (no markdown):
{
  "lotsFound": [{"lotNumber": "101", "area": "450", "frontage": "15", "frontageSecondary": "", "depth": "30", "streetName": "Main St", "notes": ""}],
  "summary": "Found X lots on this page"
}`;
  } else {
    // Final phase: use calibration feedback to re-extract with corrections
    verifyPrompt = `Analyze this subdivision plan image VERY CAREFULLY.
${calibrationContext}
${correctionContext}

EXISTING DATABASE VALUES TO VERIFY:
${lotSummary}

YOUR TASK:
1. The calibration above shows EXACTLY what errors you made on sample lots
2. You MUST generate corrections for EVERY lot where the database value differs from what's in the image
3. For the calibrated sample lots, use the EXACT user-provided correct values
4. For all OTHER lots, re-read the image carefully - you likely made the same systematic errors

CRITICAL: Generate a "corrections" entry for EVERY value that needs to change. Compare each database value above against what you see in the image. If they differ, add a correction.

Return ONLY valid JSON (no markdown):
{
  "lotsFound": [{"lotNumber": "1", "area": "450", "frontage": "15", "depth": "30", "streetName": "Main St"}],
  "corrections": [{"lotNumber": "1", "field": "area", "currentValue": "400", "correctValue": "450", "confidence": 0.95}],
  "newLots": [],
  "summary": "Applied calibration: corrected X values across Y lots"
}`;
  }

  const googleApiKey = env.GOOGLE_API_KEY;
  const xaiApiKey = env.XAI_API_KEY;
  const groqApiKey = env.GROQ_API_KEY;
  
  if (!googleApiKey && !xaiApiKey && !groqApiKey) {
    return json({ error: 'No API keys set (need GOOGLE_API_KEY, XAI_API_KEY, or GROQ_API_KEY)' }, { status: 500 });
  }

  let content = '';
  let usedModel = '';
  
  try {
    // Use xAI Grok if explicitly selected
    if (model === 'grok' && xaiApiKey) {
      console.log('Using xAI Grok (user selected)...');
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
              { type: 'text', text: verifyPrompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
            ]
          }],
          temperature: 0.2,
          max_completion_tokens: 8192
        })
      });
      
      if (grokResponse.ok) {
        const grokResult = await grokResponse.json();
        content = grokResult.choices?.[0]?.message?.content || '';
        usedModel = 'Grok 2 Vision (xAI)';
        console.log('Grok extraction successful');
      } else {
        const errorText = await grokResponse.text();
        console.error('Grok API error:', grokResponse.status, errorText);
        return json({ error: `Grok API error: ${grokResponse.status} - ${errorText}` }, { status: 500 });
      }
    }
    
    // Use Groq if explicitly selected
    if (!content && model === 'groq' && groqApiKey) {
      console.log('Using Groq (user selected)...');
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
              { type: 'text', text: verifyPrompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } }
            ]
          }],
          temperature: 0.2,
          max_completion_tokens: 8192
        })
      });
      
      if (groqResponse.ok) {
        const groqResult = await groqResponse.json();
        content = groqResult.choices?.[0]?.message?.content || '';
        usedModel = 'Llama 3.2 90B (Groq)';
        console.log('Groq extraction successful');
      } else {
        const errorText = await groqResponse.text();
        console.error('Groq API error:', groqResponse.status, errorText);
      }
    }
    
    // Use Gemini if selected (or as fallback)
    if (!content && googleApiKey && (model === 'gemini' || (!xaiApiKey && !groqApiKey))) {
      console.log('Using Gemini for extraction...');
      const geminiResponse = await fetch(`${GEMINI_URL}?key=${googleApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: verifyPrompt },
              { inline_data: { mime_type: 'image/png', data: imageBase64 } }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192
          }
        })
      });
      
      if (geminiResponse.ok) {
        const geminiResult = await geminiResponse.json();
        content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
        usedModel = 'Gemini 2.0 Flash';
        console.log('Gemini extraction successful');
      } else {
        const errorText = await geminiResponse.text();
        console.error('Gemini API error:', geminiResponse.status, errorText);
      }
    }
    
    if (!content) {
      return json({ error: 'No response from AI models' }, { status: 500 });
    }
    
    console.log('Verification response:', content);
    
    // Parse response
    let jsonStr = content.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1');
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
    
    try {
      const parsed = JSON.parse(jsonStr);
      
      // Map corrections to include lotId from existing lots
      if (parsed.corrections) {
        parsed.corrections = parsed.corrections.map((c: any) => {
          const existingLot = existingLots.find((l: ExistingLot) => 
            l.lotNumber === c.lotNumber || l.lotNumber === `Lot ${c.lotNumber}`
          );
          return {
            ...c,
            lotId: existingLot?.id,
            newValue: c.correctValue,
            currentValue: c.currentValue || existingLot?.[c.field as keyof ExistingLot] || ''
          };
        }).filter((c: any) => c.lotId); // Only include corrections for existing lots
      }
      
      // Include image for visual calibration if requested
      if (returnImage) {
        parsed.imageBase64 = imageBase64;
      }
      
      // Include which model was used
      parsed.usedModel = usedModel;
      
      return json(parsed);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      const response: any = { 
        error: 'Could not parse AI response',
        raw: content.substring(0, 500),
        corrections: [],
        lotsFound: [],
        newLots: []
      };
      // Still include image for visual calibration even if parse failed
      if (returnImage) {
        response.imageBase64 = imageBase64;
      }
      return json(response);
    }
  } catch (e) {
    console.error('Verification error:', e);
    return json({ error: `Verification failed: ${e}` }, { status: 500 });
  }
};
