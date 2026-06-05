import AsyncStorage from '@react-native-async-storage/async-storage';

export const PARENT_EMAIL_KEY = '@mirrormind_parent_email';

// Hardcoded credentials — no import needed, no cache issue
const SERVICE_ID   = 'service_700fvp8';
const TEMPLATE_ID  = 'template_mj649al';
const PUBLIC_KEY   = 'synbsOSt_e5RpexPs';
const PRIVATE_KEY  = 'RTn7EYnbQo1u7bRlPEVIi';

export async function getParentEmail() {
  try { return await AsyncStorage.getItem(PARENT_EMAIL_KEY); }
  catch { return null; }
}

export async function setParentEmail(email) {
  try { await AsyncStorage.setItem(PARENT_EMAIL_KEY, email.trim()); return true; }
  catch { return false; }
}

export async function removeParentEmail() {
  try { await AsyncStorage.removeItem(PARENT_EMAIL_KEY); }
  catch {}
}

export function buildMailtoUrl(parentEmail, childEmail) {
  const subject = encodeURIComponent('MirrorMind Safety Alert: Your child needs attention');
  const body = encodeURIComponent(
    `Hello,\n\nMirrorMind has detected 3 consecutive low-mood check-ins ` +
    `(sad, anxious, or tired) for ${childEmail || 'your child'}.\n\n` +
    `Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n\n` +
    `Please check in with your child and offer extra support today.\n\nThe MirrorMind App`
  );
  return `mailto:${parentEmail}?subject=${subject}&body=${body}`;
}

export async function sendParentAlertEmail({ parentEmail, childEmail }) {
  if (!parentEmail) return { ok: false, error: 'No parent email saved' };

  try {
    const payload = {
      service_id:  SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id:     PUBLIC_KEY,
      accessToken: PRIVATE_KEY,
      template_params: {
        to_email:    parentEmail,
        child_email: childEmail || 'your child',
        message:
          'MirrorMind has detected 3 consecutive low-mood check-ins ' +
          '(sad, anxious, or tired). This is a G2 safety alert. ' +
          'Please check in with your child today and offer extra support.',
        date: new Date().toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        }),
      },
    };

    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });

    const text = await res.text();
    console.log('EmailJS response:', res.status, text);
    return { ok: res.ok, status: res.status, body: text };
  } catch (e) {
    console.log('EmailJS fetch error:', e.message);
    return { ok: false, error: e.message };
  }
}
