// API key stored in config.js (gitignored)
import { GEMINI_API_KEY } from '../config.js';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const STATIC_FALLBACK = {
  happy: 'Keep up the great energy and share your good mood with someone you care about today.',
  neutral: 'Take five minutes to do something small that you enjoy.',
  sad: 'Try writing down one small good thing that happened today, no matter how small it seems.',
  anxious: 'Take three slow deep breaths and remind yourself that you are doing your best.',
  tired: 'Rest is important. Try stepping away from the screen for ten minutes.',
};

// Detect mood from a base64 photo using Gemini Vision
export async function detectMoodFromPhoto(base64Image) {
  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image,
              }
            },
            {
              text: `You are analyzing a selfie photo for an emotional wellness app.
Look carefully at the person's face and eyes in this photo.

Classify their current emotional state as EXACTLY ONE of these five words:
happy, neutral, sad, tired, anxious

Important guidelines:
- If they are smiling or look cheerful: happy
- If their expression is relaxed/blank: neutral
- If they look downcast, frowning, or upset: sad
- If their eyes look heavy, droopy, or they look exhausted: tired
- If they look tense, worried, or scared: anxious
- Reply with ONE WORD ONLY from the list above. Nothing else.`
            }
          ]
        }],
        generationConfig: { temperature: 0.0, maxOutputTokens: 5 },
      }),
    });

    const data = await response.json();

    // Log for debugging
    console.log('Vision API response:', JSON.stringify(data));

    // Check for API errors
    if (data.error) {
      console.log('Vision API error:', data.error.message);
      // Show error so we can debug
      throw new Error('Gemini Vision error: ' + data.error.message);
    }

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase().replace(/[^a-z]/g, '');
    console.log('Detected mood raw:', raw);

    const valid = ['happy', 'neutral', 'sad', 'tired', 'anxious'];
    if (valid.includes(raw)) return raw;

    // Try to extract from longer response
    for (const mood of valid) {
      if (raw && raw.includes(mood)) return mood;
    }

    return 'neutral';
  } catch (e) {
    console.log('Vision detection error:', e.message);
    return 'neutral';
  }
}

// Generate advice using Gemini text
export async function generateAdvice(sentimentLabel, recentHistory = []) {
  const historyNote = recentHistory.length === 0
    ? 'This is the first session for this child.'
    : `Recent sessions (most recent first): ${recentHistory.slice(0, 2).join(', ')}.`;

  const prompt = `You are a supportive companion for a child aged 8 to 14.
The child's mood today is: ${sentimentLabel}.
${historyNote}

Give exactly one short suggestion to help the child feel better or maintain their mood.

Rules:
- One sentence only. No more than 20 words.
- No clinical or medical language.
- No mention of therapy, counseling, or medication.
- Practical and encouraging.
- Suitable for a child aged 8 to 14.`;

  try {
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 80 },
      }),
    });
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) return text;
  } catch (e) {
    // fall through to static fallback
  }
  return STATIC_FALLBACK[sentimentLabel] || STATIC_FALLBACK.neutral;
}
