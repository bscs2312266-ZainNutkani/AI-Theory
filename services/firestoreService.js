import { db } from './firebase';
import {
  doc, setDoc, getDoc, collection,
  addDoc, getDocs, updateDoc,
  increment, serverTimestamp, deleteDoc, writeBatch,
} from 'firebase/firestore';

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function ensureUserProfile(uid) {
  const ref  = doc(db, `users/${uid}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      consentStatus: 'granted',
      sessionCount:  0,
      alertsEnabled: true,
      alertStatus:   'normal',
      createdAt:     serverTimestamp(),
    });
  }
}

export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, `users/${uid}`));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    console.log('getUserProfile error:', e.message);
    return null;
  }
}

export async function updateAlertStatus(uid, status) {
  await setDoc(doc(db, `users/${uid}`), { alertStatus: status }, { merge: true });
}

// ─── Session History ──────────────────────────────────────────────────────────

export async function loadSessionHistory(uid, count = 10) {
  try {
    const snap = await getDocs(collection(db, `users/${uid}/sessions`));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.sentimentLabel && d.timestamp != null)
      .sort((a, b) => {
        const ta = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
        const tb = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
        return tb - ta;
      })
      .slice(0, count);
  } catch (e) {
    console.log('loadSessionHistory error:', e.message);
    return [];
  }
}

export async function logSession(uid, sentimentLabel, adviceText, effectivenessScore = null) {
  await ensureUserProfile(uid);

  const ref = await addDoc(collection(db, `users/${uid}/sessions`), {
    sentimentLabel,
    adviceText,
    timestamp: serverTimestamp(),
    effectivenessScore,
  });

  await setDoc(doc(db, `users/${uid}`), {
    sessionCount:  increment(1),
    lastSessionAt: serverTimestamp(),
    lastSentiment: sentimentLabel,
  }, { merge: true });

  return ref.id;
}

export async function updateSessionEffectiveness(uid, sessionId, score) {
  if (!sessionId) return;
  await updateDoc(doc(db, `users/${uid}/sessions/${sessionId}`), { effectivenessScore: score });
}

// ─── Trend Detection ──────────────────────────────────────────────────────────

export async function checkNegativeTrend(uid) {
  try {
    const sessions = await loadSessionHistory(uid, 3);
    if (sessions.length < 3) return false;
    const negative   = new Set(['sad', 'anxious', 'tired']);
    const triggered  = sessions.every(s => negative.has(s.sentimentLabel));
    if (triggered) await updateAlertStatus(uid, 'alerted');
    return triggered;
  } catch {
    return false;
  }
}

// ─── Weekly Data ──────────────────────────────────────────────────────────────

export async function getWeeklyData(uid) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  oneWeekAgo.setHours(0, 0, 0, 0);
  const sessions = await loadSessionHistory(uid, 50);
  return sessions.filter(s => {
    try {
      const d = s.timestamp?.toDate ? s.timestamp.toDate() : new Date();
      return d >= oneWeekAgo;
    } catch { return false; }
  });
}

// ─── COPPA 2025 Right to Erasure ─────────────────────────────────────────────

export async function deleteAllUserData(uid) {
  const batch    = writeBatch(db);
  const sessions = await loadSessionHistory(uid, 500);
  sessions.forEach(s => batch.delete(doc(db, `users/${uid}/sessions/${s.id}`)));
  batch.delete(doc(db, `users/${uid}`));
  await batch.commit();
}
