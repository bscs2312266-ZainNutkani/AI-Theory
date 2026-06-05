/**
 * Reflection Agent - Phase 5 Implementation
 * Implements the reflectionFlow from the MirrorMind ReAct pipeline.
 *
 * Responsibilities:
 *  1. computeEffectivenessScore - sentiment delta between consecutive sessions (0-1)
 *  2. computeReflectionNotice   - pattern-based notice cards for dashboard/history
 *  3. getSessionReflection      - inline comparison shown at check-in start
 *  4. getWeeklyAlertSummary     - weekly parent alert logic (G2 trigger)
 *
 * Per Phase 1 spec: no biometric data is accessed or stored. Only sentiment labels,
 * advice IDs, and timestamps are consumed. All computation is client-side.
 */

const MOOD_VALUES = {
  happy:   2,
  neutral: 1,
  tired:   0,
  sad:    -1,
  anxious:-2,
};

const MOOD_LABELS = {
  happy: 'happy', neutral: 'calm', sad: 'sad', anxious: 'anxious', tired: 'tired',
};

/**
 * computeEffectivenessScore - compares previous session sentiment to current (0-1 score).
 * Score > 0.5 = improvement, ~0.5 = stable, < 0.5 = decline.
 */
export function computeEffectivenessScore(prevLabel, currLabel) {
  const prev = MOOD_VALUES[prevLabel] ?? 0;
  const curr = MOOD_VALUES[currLabel] ?? 0;
  const delta = curr - prev;
  return parseFloat(Math.max(0, Math.min(1, (delta + 4) / 8)).toFixed(2));
}

/**
 * computeReflectionNotice - generates a context-aware notice card for the dashboard.
 * Returns null if no meaningful pattern is detected.
 */
export function computeReflectionNotice(sessions) {
  if (!sessions || sessions.length < 2) return null;

  const labels   = sessions.slice(0, 7).map(s => s.sentimentLabel);
  const negative = new Set(['sad', 'anxious', 'tired']);

  // G2: Safety trigger - 3 consecutive negative sessions
  const lastThree = labels.slice(0, 3);
  if (lastThree.length === 3 && lastThree.every(l => negative.has(l))) {
    return {
      icon:  '⚠',
      title: 'WELLBEING NOTICE',
      text:  "Three difficult check-ins in a row. That takes courage to keep showing up. Please talk to a parent or trusted adult.",
      color: '#FF6B6B',
      type:  'g2_alert',
    };
  }

  // Strong positive streak (4 of last 5 positive)
  const lastFive = labels.slice(0, 5);
  const posCount = lastFive.filter(l => ['happy', 'neutral'].includes(l)).length;
  if (posCount >= 4 && sessions.length >= 4) {
    return {
      icon:  '✦',
      title: 'POSITIVE STREAK',
      text:  "The Reflection Agent noticed a real positive trend in your recent sessions. You're building emotional resilience. That's a big deal.",
      color: '#4CAF50',
      type:  'positive_streak',
    };
  }

  // Improvement from last session
  if (labels.length >= 2) {
    const prevVal = MOOD_VALUES[labels[1]] ?? 0;
    const currVal = MOOD_VALUES[labels[0]] ?? 0;
    if (currVal > prevVal + 0.5) {
      return {
        icon:  '↑',
        title: 'MOOD IMPROVED',
        text:  "Your Reflection Agent noticed your mood lifted since last check-in. Small shifts add up over time.",
        color: '#00D4FF',
        type:  'improvement',
      };
    }
  }

  // Milestone: 14 sessions
  if (sessions.length >= 14) {
    return {
      icon:  '◈',
      title: 'TWO WEEKS STRONG',
      text:  "14 check-ins completed. That level of self-awareness is genuinely rare.",
      color: '#FFD700',
      type:  'milestone',
    };
  }

  // Milestone: 7 sessions
  if (sessions.length >= 7) {
    return {
      icon:  '◎',
      title: 'ONE WEEK MILESTONE',
      text:  "A full week of check-ins! Consistency like this is the foundation of emotional growth.",
      color: '#FFD700',
      type:  'milestone',
    };
  }

  // Mixed pattern
  const hasPos = labels.some(l => ['happy', 'neutral'].includes(l));
  const hasNeg = labels.some(l => negative.has(l));
  if (hasPos && hasNeg) {
    return {
      icon:  '◑',
      title: 'MIXED WEEK',
      text:  "Your moods have been varied recently, and that's completely normal. The Reflection Agent is building your pattern profile.",
      color: '#CE93D8',
      type:  'mixed',
    };
  }

  return null;
}

/**
 * getSessionReflection - shown at the start of a new check-in.
 * Compares the last session to the current detected mood.
 */
export function getSessionReflection(prevSession, currentMood) {
  if (!prevSession) return null;
  const score = computeEffectivenessScore(prevSession.sentimentLabel, currentMood);
  const prev  = MOOD_LABELS[prevSession.sentimentLabel] || 'neutral';
  const curr  = MOOD_LABELS[currentMood] || 'neutral';

  if (score > 0.55) {
    return {
      text:  `Last time you felt ${prev}. Today you're feeling ${curr}. That's a genuine lift. The Reflection Agent logged it.`,
      color: '#4CAF50',
      score,
    };
  } else if (score >= 0.45) {
    return {
      text:  `Similar to last check-in (${prev}). Stability is underrated. The Reflection Agent sees consistency here.`,
      color: '#00D4FF',
      score,
    };
  } else {
    return {
      text:  `You felt ${prev} last time. Today feels heavier, and that's okay. Every check-in is valid, no matter what.`,
      color: '#CE93D8',
      score,
    };
  }
}

/**
 * getWeeklyAlertSummary - builds the parent alert payload.
 * Aggregates mood data for the past 7 days and determines alert level.
 */
export function getWeeklyAlertSummary(sessions) {
  if (!sessions || !Array.isArray(sessions)) {
    return {
      thisWeek: [], moodCounts: { happy: 0, neutral: 0, sad: 0, anxious: 0, tired: 0 },
      total: 0, negCount: 0, posCount: 0,
      alertLevel: 'normal',
      alertMessage: 'No check-ins recorded this week.',
      g2Triggered: false, avgEffectiveness: null,
    };
  }

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const thisWeek = sessions.filter(s => {
    const d = s.timestamp?.toDate ? s.timestamp.toDate() : new Date();
    return d >= oneWeekAgo;
  });

  const negative   = new Set(['sad', 'anxious', 'tired']);
  const moodCounts = { happy: 0, neutral: 0, sad: 0, anxious: 0, tired: 0 };
  thisWeek.forEach(s => { moodCounts[s.sentimentLabel] = (moodCounts[s.sentimentLabel] || 0) + 1; });

  const negCount = thisWeek.filter(s => negative.has(s.sentimentLabel)).length;
  const posCount = thisWeek.filter(s => ['happy', 'neutral'].includes(s.sentimentLabel)).length;
  const total    = thisWeek.length;

  const lastThreeLabels = sessions.slice(0, 3).map(s => s.sentimentLabel);
  const g2Triggered = lastThreeLabels.length === 3 && lastThreeLabels.every(l => negative.has(l));

  let alertLevel   = 'normal';
  let alertMessage = "Your child's mood has been stable this week.";

  if (g2Triggered) {
    alertLevel   = 'alerted';
    alertMessage = 'Three consecutive low-mood check-ins detected. We recommend checking in with your child.';
  } else if (total > 0 && negCount / total > 0.6) {
    alertLevel   = 'warning';
    alertMessage = 'More low-mood sessions than usual this week. Your child may benefit from extra attention.';
  } else if (total > 0 && posCount / total >= 0.7) {
    alertLevel   = 'positive';
    alertMessage = 'Your child has had a predominantly positive week. Great emotional trend.';
  }

  const withScores     = sessions.filter(s => typeof s.effectivenessScore === 'number');
  const avgEffectiveness = withScores.length > 0
    ? withScores.reduce((sum, s) => sum + s.effectivenessScore, 0) / withScores.length
    : null;

  return {
    thisWeek, moodCounts, total, negCount, posCount,
    alertLevel, alertMessage, g2Triggered, avgEffectiveness,
  };
}
