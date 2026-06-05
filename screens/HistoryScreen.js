import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, TouchableOpacity, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { loadSessionHistory } from '../services/firestoreService';
import { computeReflectionNotice } from '../agents/reflectionAgent';
import { C, MOOD, TYPE, S, SHADOW } from '../theme';

function formatDate(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date();
  const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date();
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function groupByDate(sessions) {
  const g = {};
  sessions.forEach(s => {
    const l = formatDate(s.timestamp);
    if (!g[l]) g[l] = [];
    g[l].push(s);
  });
  return g;
}

export default function HistoryScreen({ uid, navigate }) {
  const [history, setHistory] = useState([]);
  const [notice, setNotice]   = useState(null);
  const [filter, setFilter]   = useState('all');
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSessionHistory(uid, 30).then(h => { setHistory(h); setNotice(computeReflectionNotice(h)); });
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  const FILTERS = ['all', 'happy', 'neutral', 'sad', 'anxious', 'tired'];
  const filtered = filter === 'all' ? history : history.filter(s => s.sentimentLabel === filter);
  const grouped  = groupByDate(filtered);
  const moodDist = { happy: 0, neutral: 0, sad: 0, anxious: 0, tired: 0 };
  history.forEach(s => { moodDist[s.sentimentLabel] = (moodDist[s.sentimentLabel] || 0) + 1; });

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Journal</Text>
        <Text style={styles.headerSub}>Your mood history</Text>
      </View>

      {/* Mood Distribution mini chart */}
      {history.length > 0 && (
        <View style={[styles.distCard, SHADOW.sm]}>
          <Text style={styles.sectionLabel}>MOOD DISTRIBUTION</Text>
          {Object.entries(moodDist)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .map(([mood, count]) => {
              const cfg = MOOD[mood]; const pct = Math.round(count / history.length * 100);
              return (
                <View key={mood} style={styles.distRow}>
                  <Text style={styles.distEmoji}>{cfg.emoji}</Text>
                  <Text style={[styles.distLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <View style={styles.distTrackBg}>
                    <LinearGradient
                      colors={[cfg.gradStart, cfg.gradEnd]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[styles.distFill, { width: `${pct}%` }]}
                    />
                  </View>
                  <Text style={[styles.distPct, { color: cfg.color }]}>{pct}%</Text>
                </View>
              );
            })}
        </View>
      )}

      {/* Notice */}
      {notice && (
        <View style={[styles.noticeCard, SHADOW.xs, { borderLeftColor: notice.color, backgroundColor: notice.color + '12' }]}>
          <View style={[styles.noticeAccent, { backgroundColor: notice.color }]} />
          <View style={styles.noticeBody}>
            <Text style={[styles.noticeTitle, { color: notice.color }]}>{notice.icon}  {notice.title}</Text>
            <Text style={styles.noticeText}>{notice.text}</Text>
          </View>
        </View>
      )}

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ gap: 8, paddingHorizontal: S.screenPad }}>
        {FILTERS.map(f => {
          const cfg = MOOD[f]; const active = filter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, active && { backgroundColor: cfg?.color || C.accent, borderColor: 'transparent' }]}
              onPress={() => setFilter(f)} activeOpacity={0.75}
            >
              <Text style={[styles.filterText, active && { color: '#fff', fontWeight: '700' }]}>
                {f === 'all' ? 'All moods' : `${cfg?.emoji}  ${cfg?.label}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sessions */}
      {history.length === 0 ? (
        <View style={styles.empty}>
          <LinearGradient colors={[C.blue, C.teal]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyIconWrap}>
            <Text style={{ fontSize: 36 }}>◎</Text>
          </LinearGradient>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Complete your first check-in to start tracking your journey.</Text>
          <TouchableOpacity style={[styles.emptyBtn, SHADOW.sm]} onPress={() => navigate('checkin')}>
            <Text style={styles.emptyBtnText}>Scan Your Today  →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        Object.entries(grouped).map(([dateLabel, sessions]) => (
          <View key={dateLabel} style={styles.dateGroup}>
            <Text style={styles.dateLabel}>{dateLabel}</Text>
            {sessions.map((s, i) => {
              const cfg = MOOD[s.sentimentLabel] || MOOD.neutral;
              const eff = s.effectivenessScore;
              const effColor = eff >= 0.6 ? C.success : eff >= 0.4 ? C.warning : C.danger;
              return (
                <View key={i} style={[styles.sessionCard, SHADOW.xs, { borderLeftColor: cfg.color }]}>
                  <View style={[styles.sessionEmojiWrap, { backgroundColor: cfg.colorLight }]}>
                    <Text style={styles.sessionEmoji}>{cfg.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.sessionTopRow}>
                      <Text style={[styles.sessionMood, { color: cfg.color }]}>{cfg.label}</Text>
                      <Text style={styles.sessionTime}>{formatTime(s.timestamp)}</Text>
                    </View>
                    {s.adviceText && (
                      <Text style={styles.sessionAdvice} numberOfLines={2}>"{s.adviceText}"</Text>
                    )}
                    {eff != null && (
                      <View style={styles.effRow}>
                        <Text style={[styles.effLabel, { color: effColor }]}>Effectiveness</Text>
                        <View style={styles.effTrack}>
                          <View style={[styles.effFill, { width: `${Math.round(eff * 100)}%`, backgroundColor: effColor }]} />
                        </View>
                        <Text style={[styles.effPct, { color: effColor }]}>{Math.round(eff * 100)}%</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header:       { paddingTop: 60, paddingHorizontal: S.screenPad, paddingBottom: 22 },
  headerTitle:  { ...TYPE.screenTitle, color: C.label },
  headerSub:    { ...TYPE.caption, color: C.label3, marginTop: 4 },

  distCard:     { marginHorizontal: S.screenPad, marginBottom: S.sectionGap, backgroundColor: C.surface, borderRadius: S.cardRadius, padding: 20 },
  sectionLabel: { ...TYPE.micro, color: C.label3, marginBottom: 14 },
  distRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  distEmoji:    { fontSize: 16, width: 24 },
  distLabel:    { ...TYPE.caption, fontWeight: '700', width: 56 },
  distTrackBg:  { flex: 1, height: 6, backgroundColor: C.bgAlt, borderRadius: 3, overflow: 'hidden' },
  distFill:     { height: '100%', borderRadius: 3 },
  distPct:      { ...TYPE.caption, fontWeight: '700', width: 32, textAlign: 'right' },

  noticeCard:   { flexDirection: 'row', marginHorizontal: S.screenPad, marginBottom: S.sectionGap, borderRadius: S.cardRadius, overflow: 'hidden', borderLeftWidth: 0 },
  noticeAccent: { width: 4 },
  noticeBody:   { flex: 1, padding: 14, gap: 4 },
  noticeTitle:  { ...TYPE.micro, fontWeight: '700' },
  noticeText:   { ...TYPE.caption, color: C.label2, lineHeight: 17 },

  filterScroll: { marginBottom: S.sectionGap },
  filterPill: {
    borderRadius: S.pillRadius, borderWidth: 1.5, borderColor: C.bgDeep,
    paddingHorizontal: 16, paddingVertical: 9, backgroundColor: C.surface,
  },
  filterText: { ...TYPE.caption, color: C.label2, fontWeight: '500' },

  dateGroup:  { paddingHorizontal: S.screenPad, marginBottom: 4 },
  dateLabel:  { ...TYPE.micro, color: C.label3, marginBottom: 10, marginTop: 20 },

  sessionCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: C.surface, borderRadius: 18, padding: 14,
    marginBottom: 8, borderLeftWidth: 3,
  },
  sessionEmojiWrap: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sessionEmoji:     { fontSize: 26 },
  sessionTopRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  sessionMood:      { ...TYPE.cardTitle, letterSpacing: -0.2 },
  sessionTime:      { ...TYPE.micro, color: C.label4, fontSize: 11 },
  sessionAdvice:    { ...TYPE.caption, color: C.label2, fontStyle: 'italic', lineHeight: 17, marginBottom: 8 },
  effRow:    { flexDirection: 'row', alignItems: 'center', gap: 7 },
  effLabel:  { ...TYPE.micro, fontSize: 9, width: 80 },
  effTrack:  { flex: 1, height: 4, backgroundColor: C.bgAlt, borderRadius: 2, overflow: 'hidden' },
  effFill:   { height: '100%', borderRadius: 2 },
  effPct:    { ...TYPE.micro, width: 28, textAlign: 'right', fontSize: 10 },

  empty:       { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40, gap: 14 },
  emptyIconWrap:{ width: 80, height: 80, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:  { ...TYPE.sectionHead, color: C.label },
  emptySub:    { ...TYPE.body, color: C.label2, textAlign: 'center' },
  emptyBtn:    { backgroundColor: C.label, borderRadius: S.pillRadius, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  emptyBtnText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
});
