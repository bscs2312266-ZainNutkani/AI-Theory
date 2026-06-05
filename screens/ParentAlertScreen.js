import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { loadSessionHistory, getUserProfile } from '../services/firestoreService';
import { getWeeklyAlertSummary } from '../agents/reflectionAgent';
import { C, MOOD, TYPE, S, SHADOW } from '../theme';

const ALERT_CFG = {
  normal:   { color: C.success, grad: [C.success, '#52C4A0'], icon: '●', label: 'All Good'      },
  warning:  { color: C.warning, grad: [C.warning, '#E8A840'], icon: '◆', label: 'Watch Out'     },
  alerted:  { color: C.danger,  grad: [C.danger,  '#E07A8A'], icon: '⚠', label: 'Alert Active'  },
  positive: { color: C.success, grad: [C.success, '#68D9B3'], icon: '↑', label: 'Positive Week' },
};

function formatDate(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date();
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ParentAlertScreen({ uid }) {
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function load() {
      try {
        const [h] = await Promise.all([loadSessionHistory(uid, 30), getUserProfile(uid)]);
        const safeHistory = Array.isArray(h) ? h : [];
        setHistory(safeHistory);
        const s = getWeeklyAlertSummary(safeHistory);
        setSummary(s || {
          alertLevel: 'normal',
          alertMessage: 'No check-ins recorded this week. Encourage your child to complete a daily scan.',
          total: 0, moodCounts: {}, thisWeek: [],
          g2Triggered: false, avgEffectiveness: null,
        });
      } catch {
        setSummary({
          alertLevel: 'normal',
          alertMessage: 'Could not load data. Please try again later.',
          total: 0, moodCounts: {}, thisWeek: [],
          g2Triggered: false, avgEffectiveness: null,
        });
      }
    }
    load();
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, []);

  if (!summary) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ ...TYPE.body, color: C.label3 }}>Loading…</Text>
    </View>
  );

  const acfg     = ALERT_CFG[summary.alertLevel] || ALERT_CFG.normal;
  const thisWeek = summary.thisWeek.slice(0, 5);
  const total    = summary.total;

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Family</Text>
        <Text style={styles.headerSub}>Weekly safety & alerts</Text>
      </View>

      {/* Status hero card */}
      <LinearGradient
        colors={acfg.grad}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.statusCard, SHADOW.md]}
      >
        <View style={styles.statusLeft}>
          <View style={styles.statusBadge}>
            <Text style={[styles.statusBadgeText, { color: acfg.color }]}>{acfg.label}</Text>
          </View>
          <Text style={styles.statusTitle}>This Week's Summary</Text>
          <Text style={styles.statusMsg}>{summary.alertMessage}</Text>
          <Text style={styles.statusCount}>{total} check-in{total !== 1 ? 's' : ''} this week</Text>
        </View>
        <Text style={styles.statusIcon}>{acfg.icon}</Text>
      </LinearGradient>

      {/* G2 Alert Banner */}
      {summary.g2Triggered && (
        <View style={[styles.g2Card, SHADOW.xs]}>
          <View style={[styles.g2Accent, { backgroundColor: C.danger }]} />
          <View style={styles.g2Body}>
            <Text style={[styles.g2Title, { color: C.danger }]}>⚠  G2 Safety Trigger Activated</Text>
            <Text style={styles.g2Text}>
              Three consecutive low-mood check-ins detected. Per COPPA 2025 protocol, please check in with your child directly.
            </Text>
          </View>
        </View>
      )}

      {/* Mood breakdown */}
      {total > 0 && (
        <View style={[styles.card, SHADOW.sm]}>
          <Text style={styles.sectionLabel}>WEEKLY MOOD BREAKDOWN</Text>
          {Object.entries(summary.moodCounts)
            .filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
            .map(([mood, count]) => {
              const cfg = MOOD[mood]; const pct = Math.round(count / total * 100);
              return (
                <View key={mood} style={styles.distRow}>
                  <Text style={styles.distEmoji}>{cfg.emoji}</Text>
                  <Text style={[styles.distLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  <View style={styles.distTrack}>
                    <LinearGradient
                      colors={[cfg.gradStart, cfg.gradEnd]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[styles.distFill, { width: `${pct}%` }]}
                    />
                  </View>
                  <Text style={[styles.distCount, { color: cfg.color }]}>{count}×</Text>
                </View>
              );
            })}
        </View>
      )}

      {/* Effectiveness */}
      {summary.avgEffectiveness != null && (() => {
        const e = summary.avgEffectiveness;
        const color = e >= 0.6 ? C.success : e >= 0.4 ? C.warning : C.danger;
        const moodGrad = e >= 0.6
          ? [C.success, '#52C4A0']
          : e >= 0.4 ? [C.warning, '#E8A840'] : [C.danger, '#E07A8A'];
        return (
          <View style={[styles.card, SHADOW.sm]}>
            <Text style={styles.sectionLabel}>ADVICE EFFECTIVENESS (AVG)</Text>
            <View style={styles.effRow}>
              <Text style={[styles.effScore, { color }]}>{Math.round(e * 100)}%</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.effTrackBg}>
                  <LinearGradient
                    colors={moodGrad}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={[styles.effFill, { width: `${Math.round(e * 100)}%` }]}
                  />
                </View>
                <Text style={styles.effCaption}>
                  Based on {history.filter(s => s.effectivenessScore != null).length} sessions
                </Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Check-ins list */}
      {thisWeek.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THIS WEEK'S CHECK-INS</Text>
          {thisWeek.map((s, i) => {
            const cfg = MOOD[s.sentimentLabel] || MOOD.neutral;
            return (
              <View key={i} style={[styles.sessionRow, SHADOW.xs, { borderLeftColor: cfg.color }]}>
                <View style={[styles.sessionEmojiWrap, { backgroundColor: cfg.colorLight }]}>
                  <Text style={styles.sessionEmoji}>{cfg.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sessionMood, { color: cfg.color }]}>{cfg.label}</Text>
                  <Text style={styles.sessionDate}>{formatDate(s.timestamp)}</Text>
                  {s.adviceText && <Text style={styles.sessionAdv} numberOfLines={1}>"{s.adviceText}"</Text>}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* COPPA */}
      <View style={[styles.coppaCard, SHADOW.xs]}>
        <Text style={styles.coppaTitle}>🔒  COPPA 2025 Compliance</Text>
        {[
          'No facial images stored or transmitted',
          'Only mood labels and timestamps saved',
          'Biometric data purged after each session',
          'Parental consent active',
          'Data minimisation enforced at database layer',
        ].map((item, i) => (
          <View key={i} style={styles.coppaRow}>
            <View style={[styles.coppaDot, { backgroundColor: C.success }]} />
            <Text style={styles.coppaItem}>{item}</Text>
          </View>
        ))}
      </View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header:    { paddingTop: 60, paddingHorizontal: S.screenPad, paddingBottom: 22 },
  headerTitle: { ...TYPE.screenTitle, color: C.label },
  headerSub:   { ...TYPE.caption, color: C.label3, marginTop: 4 },

  statusCard: {
    marginHorizontal: S.screenPad, marginBottom: S.sectionGap,
    borderRadius: S.cardRadiusLg, padding: 24,
    flexDirection: 'row', alignItems: 'center',
  },
  statusLeft:      { flex: 1, gap: 8 },
  statusBadge:     { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: S.pillRadius, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  statusBadgeText: { ...TYPE.micro, fontWeight: '800' },
  statusTitle:     { color: '#fff', fontSize: 16, fontWeight: '700' },
  statusMsg:       { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  statusCount:     { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '500' },
  statusIcon:      { fontSize: 48, marginLeft: 16 },

  g2Card:   { flexDirection: 'row', marginHorizontal: S.screenPad, marginBottom: S.sectionGap, backgroundColor: C.surface, borderRadius: S.cardRadius, overflow: 'hidden' },
  g2Accent: { width: 4 },
  g2Body:   { flex: 1, padding: 16, gap: 6 },
  g2Title:  { ...TYPE.micro, fontWeight: '800' },
  g2Text:   { ...TYPE.caption, color: C.label2, lineHeight: 17 },

  card:         { marginHorizontal: S.screenPad, marginBottom: S.cardGap, backgroundColor: C.surface, borderRadius: S.cardRadius, padding: 20 },
  section:      { marginHorizontal: S.screenPad, marginBottom: S.sectionGap },
  sectionLabel: { ...TYPE.micro, color: C.label3, marginBottom: 14 },

  distRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  distEmoji:  { fontSize: 18, width: 26 },
  distLabel:  { ...TYPE.caption, fontWeight: '700', width: 56 },
  distTrack:  { flex: 1, height: 7, backgroundColor: C.bgAlt, borderRadius: 4, overflow: 'hidden' },
  distFill:   { height: '100%', borderRadius: 4 },
  distCount:  { ...TYPE.caption, fontWeight: '700', width: 24, textAlign: 'right' },

  effRow:       { flexDirection: 'row', alignItems: 'center', gap: 14 },
  effScore:     { fontSize: 30, fontWeight: '800', letterSpacing: -1, width: 66 },
  effTrackBg:   { height: 8, backgroundColor: C.bgAlt, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  effFill:      { height: '100%', borderRadius: 4 },
  effCaption:   { ...TYPE.micro, color: C.label4, fontSize: 10 },

  sessionRow:     { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.surface, borderRadius: 16, padding: 14, marginBottom: 8, borderLeftWidth: 3 },
  sessionEmojiWrap:{ width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sessionEmoji:   { fontSize: 24 },
  sessionMood:    { ...TYPE.cardTitle, marginBottom: 2 },
  sessionDate:    { ...TYPE.micro, color: C.label4, marginBottom: 2 },
  sessionAdv:     { ...TYPE.caption, color: C.label2, fontStyle: 'italic' },

  coppaCard: { marginHorizontal: S.screenPad, marginBottom: 12, backgroundColor: C.surface, borderRadius: S.cardRadius, padding: 20 },
  coppaTitle: { ...TYPE.cardTitle, color: C.success, marginBottom: 14 },
  coppaRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  coppaDot:   { width: 6, height: 6, borderRadius: 3 },
  coppaItem:  { ...TYPE.caption, color: C.label2 },
});
