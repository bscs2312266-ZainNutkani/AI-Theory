/**
 * Counseling Agent - Phase 5 Implementation
 * Implements counselingFlow: utility-ranked advice selection via Groq Llama.
 * Implements sentimentAnalysisFlow: Groq Llama 4 Scout vision for mood detection.
 */

import { GEMINI_API_KEY, GROQ_API_KEY } from '../config.js';

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// Abort a fetch after ms milliseconds
function fetchWithTimeout(url, options, ms = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// ── Static advice corpus (utility-weighted fallback) ──────────────────────────
const ADVICE_CORPUS = {
  happy: [
    "You're glowing today! Pass some of that energy on. Send a kind message to someone you care about.",
    "Feeling great? Channel it into something creative you've been putting off. Good moods are fuel.",
    "Share what made you happy today with someone at home. Happiness spreads when you let it out.",
    "Great energy! Use it to tackle one thing you've been avoiding. You've got the momentum.",
    "Feeling this good is worth celebrating. Take five minutes to just sit with it. You earned it.",
  ],
  neutral: [
    "A steady mood is actually a superpower. Try one small thing today that makes you smile.",
    "Put on your favourite song and really listen to it. Sometimes that's all a calm day needs.",
    "Take five minutes outside if you can. Fresh air does more than people think.",
    "Write down one thing you're looking forward to this week. Even small things count.",
    "It's a quiet day, perfect for reaching out to someone you haven't talked to in a while.",
  ],
  sad: [
    "Feeling sad is brave. You showed up for your check-in anyway, and that matters. Write one tiny good thing about today.",
    "You don't have to fix it all right now. One small step: drink some water and take three slow breaths.",
    "Is there someone you trust you could talk to today? Even a short conversation helps more than you think.",
    "Being kind to yourself on hard days is a skill. Rest is allowed. You don't have to earn it.",
    "Tomorrow will feel different. For now, is there one thing, even tiny, that would feel comforting right now?",
  ],
  anxious: [
    "Breathe in for 4 counts, hold for 4, out for 4. Do it twice. Your nervous system will thank you.",
    "Write down exactly what's worrying you. Getting it out of your head and onto paper shrinks it.",
    "You're not behind. You're not failing. Focus on just the next five minutes, nothing else.",
    "Anxiety lies. It says everything is urgent. Ask yourself: what actually needs to happen right now?",
    "Find one thing in the room that's solid and touch it. Ground yourself here, in this moment.",
  ],
  tired: [
    "Your body is sending a clear message, so respect it. Even 10 minutes of doing nothing is recovery.",
    "Drink some water, step away from the screen, and take a short walk. Even five minutes resets things.",
    "Being tired isn't weakness. It means you've been doing things. Rest is part of the work.",
    "Try lying down with your eyes closed for just five minutes, no phone. You don't have to sleep.",
    "It's okay to have a slow day. What's one thing you can take off your plate or ask for help with?",
  ],
};

// Utility ranking: avoids repeating recent advice
function selectAdviceFromCorpus(sentimentLabel, recentHistory) {
  const pool = ADVICE_CORPUS[sentimentLabel] || ADVICE_CORPUS.neutral;
  const recentTexts = new Set(recentHistory.slice(0, 3).map(s => s.adviceText));
  const candidates  = pool.filter(a => !recentTexts.has(a));
  const source      = candidates.length > 0 ? candidates : pool;
  return source[Math.floor(Math.random() * source.length)];
}

// ── Sentiment Reflex Agent ────────────────────────────────────────────────────
export async function detectMoodFromPhoto(base64Image) {
  try {
    const res = await fetchWithTimeout(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            {
              type: 'text',
              text: `Study the face in this selfie. Classify the emotion as EXACTLY ONE of: happy, sad, neutral, anxious, tired

- Smile / laughing / bright eyes = happy
- Frown / tears / looking down = sad
- Tense / worried / scared expression = anxious
- Heavy eyelids / droopy / exhausted = tired
- Everything else = neutral

ONE WORD ONLY. No punctuation, no explanation.`,
            },
          ],
        }],
        max_tokens: 5,
        temperature: 0,
      }),
    }, 10000);

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim().toLowerCase().replace(/[^a-z]/g, '');
    const valid = ['happy', 'neutral', 'sad', 'tired', 'anxious'];
    if (valid.includes(text)) return text;
    for (const m of valid) { if (text?.includes(m)) return m; }
  } catch (e) {
    console.log('Vision error:', e.message);
  }

  // Time-of-day contextual fallback
  const h = new Date().getHours();
  if (h >= 5  && h < 9)  return 'tired';
  if (h >= 9  && h < 14) return 'neutral';
  if (h >= 14 && h < 19) return 'happy';
  return 'tired';
}

// ── Counseling Agent ──────────────────────────────────────────────────────────
export async function generateAdvice(sentimentLabel, recentHistory = []) {
  // FIX: map session objects to their labels before joining
  const recentLabels = recentHistory
    .slice(0, 3)
    .map(s => s?.sentimentLabel || s)
    .filter(Boolean);

  const historyNote = recentLabels.length === 0
    ? 'This is their first check-in.'
    : `Their recent moods (newest first): ${recentLabels.join(', ')}.`;

  const prompt = `You are a caring older sibling talking to a child aged 8-14 who just checked their mood.
Their mood right now: ${sentimentLabel}
${historyNote}

Write ONE short, natural suggestion. Rules:
- Sound like a real person, not an app. Warm and direct.
- One sentence only, max 22 words.
- No clinical or medical language. No mention of therapy.
- Age-appropriate. Encouraging but honest.
- Do NOT start with "You" or the child's name.
- Respond with ONLY the advice sentence, nothing else.`;

  // Try Groq with timeout
  try {
    const res = await fetchWithTimeout(GROQ_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        temperature: 0.8,
      }),
    }, 8000);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    // Reject if it looks like an error or refusal
    if (text && text.length > 10 && !text.toLowerCase().includes('cannot') && !text.toLowerCase().includes('unable')) {
      return text;
    }
  } catch (_) {}

  // Try Gemini with timeout
  try {
    const res = await fetchWithTimeout(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 60 },
      }),
    }, 8000);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text && text.length > 10 && !text.toLowerCase().includes('cannot')) {
      return text;
    }
  } catch (_) {}

  // Always-available static fallback
  return selectAdviceFromCorpus(sentimentLabel, recentHistory);
}
