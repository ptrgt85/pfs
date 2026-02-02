import { json, type RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const XAI_URL = 'https://api.x.ai/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

export const POST: RequestHandler = async ({ request }) => {
  const { imageBase64, fieldType } = await request.json();
  
  if (!imageBase64) {
    return json({ error: 'No image provided' }, { status: 400 });
  }
  
  const googleApiKey = env.GOOGLE_API_KEY;
  const xaiApiKey = env.XAI_API_KEY;
  const groqApiKey = env.GROQ_API_KEY;
  
  if (!googleApiKey && !xaiApiKey && !groqApiKey) {
    return json({ error: 'No API keys set (need GOOGLE_API_KEY, XAI_API_KEY, or GROQ_API_KEY)' }, { status: 500 });
  }
  
  // Build prompt based on field type
  let prompt = 'Extract the text/number from this image region. ';
  
  switch (fieldType) {
    case 'area':
      prompt += 'This should be an area measurement (likely in square meters or sqm). Return ONLY the numeric value with unit if shown (e.g., "450 sqm" or "450").';
      break;
    case 'frontage':
      prompt += 'This should be a frontage measurement (width in meters). Return ONLY the numeric value (e.g., "15" or "15.5m").';
      break;
    case 'depth':
      prompt += 'This should be a depth measurement (length in meters). Return ONLY the numeric value (e.g., "30" or "30.2m").';
      break;
    default:
      prompt += 'Return ONLY the text or number visible in this region.';
  }
  
  prompt += ' Do not include any explanation, just the value.';
  
  let content = '';
  
  try {
    // Try Gemini first (better for OCR)
    if (googleApiKey) {
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
          generationConfig: { temperature: 0.1, maxOutputTokens: 50 }
        })
      });
      
      if (geminiResponse.ok) {
        const geminiResult = await geminiResponse.json();
        content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      }
    }
    
    // Fallback to xAI Grok
    if (!content && xaiApiKey) {
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
          max_tokens: 50,
          temperature: 0.1
        })
      });
      
      if (grokResponse.ok) {
        const grokResult = await grokResponse.json();
        content = grokResult.choices?.[0]?.message?.content?.trim() || '';
      } else {
        const errorText = await grokResponse.text();
        console.error('Groq OCR error:', errorText);
        return json({ error: 'OCR failed' }, { status: 500 });
      }
    }
    
    if (!content) {
      return json({ error: 'No OCR result' }, { status: 500 });
    }
    
    console.log(`OCR result for ${fieldType}:`, content);
    
    // Clean up the result - extract just the value
    let value = content;
    
    // Remove common prefixes
    value = value.replace(/^(the |value is |it shows |this is |area:|frontage:|depth:)/i, '');
    value = value.trim();
    
    // If it looks like a number with optional unit, extract it
    const numMatch = value.match(/[\d.,]+\s*(?:sqm|sq\.?\s*m|m²|m|meters?)?/i);
    if (numMatch) {
      value = numMatch[0].trim();
    }
    
    return json({ value, raw: content });
  } catch (e) {
    console.error('OCR error:', e);
    return json({ error: `OCR failed: ${e}` }, { status: 500 });
  }
};
