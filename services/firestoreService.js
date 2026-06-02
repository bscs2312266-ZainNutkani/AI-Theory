import { db } from './firebase';
import {
  doc, setDoc, getDoc, collection, addDoc,
  query, orderBy, limit, getDocs, updateDoc,
  increment, serverTimestamp,
} from 'firebase/firestore';

// Create user profile on first login
export async function ensureUserProfile(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      consentStatus: 'granted',
      sessionCount: 0,
      alertsEnabled: true,
      alertStatus: 'normal',
      createdAt: serverTimestamp(),
    });
  }
}

// Load recent session history
export async function loadSessionHistory(uid, count = 5) {
  const q = query(
    collection(db, 'users', uid, 'sessions'),
    orderBy('timestamp', 'desc'),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// Save a completed session
export async function logSession(uid, sentimentLabel, adviceText) {
  // Ensure user profile exists before writing session
  await ensureUserProfile(uid);
  await addDoc(collection(db, 'users', uid, 'sessions'), {
    sentimentLabel,
    adviceText,
    effectivenessFlag: false,
    timestamp: serverTimestamp(),
  });
  await setDoc(doc(db, 'users', uid), {
    sessionCount: increment(1),
  }, { merge: true });
}

// Check if last 3 sessions were all negative (G2 alert trigger)
export async function checkNegativeTrend(uid) {
  const sessions = await loadSessionHistory(uid, 3);
  if (sessions.length < 3) return false;
  const negative = new Set(['sad', 'anxious', 'tired']);
  return sessions.every(s => negative.has(s.sentimentLabel));
}
