// Rename this file to config.js and fill in your credentials.
// config.js is gitignored — never commit real API keys.

// Groq API — free at https://console.groq.com > API Keys
const GROQ_API_KEY = 'YOUR_GROQ_API_KEY';

// Gemini API — free at https://aistudio.google.com > Get API Key
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY';

// EmailJS — free at https://emailjs.com (for automatic parent alert emails)
// 1. Email Services > Add Gmail service > copy Service ID
// 2. Email Templates > Create template with {{to_email}}, {{message}}, {{date}} > copy Template ID
// 3. Account > General > copy Public Key and Private Key
// 4. Account > Security > enable "Allow non-browser environments"
export const EMAILJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
export const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
export const EMAILJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';
export const EMAILJS_PRIVATE_KEY = 'YOUR_PRIVATE_KEY';

export { GEMINI_API_KEY, GROQ_API_KEY };
