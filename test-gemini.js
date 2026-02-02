import { config } from 'dotenv';
config();

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

if (!GOOGLE_API_KEY) {
  console.error('❌ GOOGLE_API_KEY not set in .env file');
  process.exit(1);
}

console.log('🔑 API Key found:', GOOGLE_API_KEY.substring(0, 10) + '...');
console.log('🧪 Testing gemini-3-flash-preview...');

const response = await fetch(`${GEMINI_URL}?key=${GOOGLE_API_KEY}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      parts: [{ text: 'Say "Hello, Gemini 3 Flash is working!"' }]
    }]
  })
});

if (response.ok) {
  const result = await response.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log('✅ API Response:', text);
  console.log('🎉 Gemini 3 Flash is working correctly!');
} else {
  const error = await response.text();
  console.error('❌ API Error:', response.status, error);
}
