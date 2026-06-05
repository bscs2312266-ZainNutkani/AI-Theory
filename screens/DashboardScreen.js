import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Dimensions, StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { loadSessionHistory, getUserProfile } from '../services/firestoreService';
import { computeReflectionNotice } from '../agents/reflectionAgent';
import { C, MOOD, HERO_DEFAULT, TYPE, S, SHADOW } from '../theme';

const { width } = Dimensions.get('window');
const CARD_W = (width - S.screenPad * 2 - S.cardGap) / 2;

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 21) return 'Good evening';
  return 'Good night';
}

function isToday(ts) {
  if (!ts) return false;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function computeStreak(sessions) {
  if (!sessions.length) return 0;
  let streak = 0;
  const seen = new Set();
  const today = new Date(); today.setHours(0,0,0,0);
  for (const s of sessions) {
    const d = s.timestamp?.toDate ? s.timestamp.toDate() : new Date();
    d.setHours(0,0,0,0);
    const key = d.toDateString();
    if (!seen.has(key)) {
      seen.add(key);
      const exp = new Date(today); exp.setDate(today.getDate() - streak);
      if (d.getTime() === exp.getTime()) streak++; else break;
    }
  }
  return streak;
}

// ── Pressable card with spring scale animation ───────────────────────────────
function PressCard({ onPress, style, children }) {
  const scale = useRef(new Animated.Value(1)).current;
  const press   = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 300, friction: 10 }).start();
  const release = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 300, friction: 10 }).start();
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <TouchableOpacity onPress={onPress} onPressIn={press} onPressOut={release} activeOpacity={1}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function DashboardScreen({ uid, navigate }) {
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [notice,  setNotice]  = useState(null);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    let mounted = true;

    async function load() {
      // Load profile separately so a failure doesn't block history
      try {
        const p = await getUserProfile(uid);
        if (mounted) setProfile(p);
      } catch {}

      // Load history separately
      try {
        const raw = await loadSessionHistory(uid, 14);
        // Sanitise — drop any session missing sentimentLabel so bad docs don't crash rendering
        const safeHistory = (Array.isArray(raw) ? raw : [])
          .filter(s => s && typeof s.sentimentLabel === 'string');
        if (!mounted) return;
        setHistory(safeHistory);
        try { setNotice(computeReflectionNotice(safeHistory)); } catch {}
      } catch (e) {
        console.log('History load error:', e.message);
        if (mounted) setHistory([]);
      }
    }

    load();
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
    ]).start();

    return () => { mounted = false; };
  }, [uid]);

  const todaySession  = history.find(s => { try { return isToday(s.timestamp); } catch { return false; } });
  const todayMood     = todaySession ? MOOD[todaySession.sentimentLabel] : null;
  const streak        = (() => { try { return computeStreak(history); } catch { return 0; } })();
  const totalSessions = profile?.sessionCount || history.length;
  const positivePct   = history.length > 0
    ? Math.round(history.filter(s => ['happy','neutral'].includes(s.sentimentLabel)).length / history.length * 100) : 0;
  const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const thisWeekCount = history.filter(s => {
    try {
      const d = s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
      return d >= oneWeekAgo;
    } catch { return false; }
  }).length;
  const last7 = history.slice(0, 7).reverse();

  const heroGrad  = todayMood
    ? [todayMood.gradStart, todayMood.gradEnd]
    : [HERO_DEFAULT.gradStart, HERO_DEFAULT.gradEnd];
  const heroEmoji = todayMood?.emoji || HERO_DEFAULT.emoji;

  const STATS = [
    { value: String(totalSessions),    label: 'Sessions',  icon: '📊', color: C.blue   },
    { value: `${streak}`,              label: 'Day Streak', icon: '🔥', color: C.yellow },
    { value: `${positivePct}%`,        label: 'Positive',  icon: '✨', color: C.success },
    { value: String(thisWeekCount),    label: 'This Week', icon: '📅', color: C.purple  },
  ];

  const NAV_CARDS = [
    { id: 'checkin',  title: 'Daily Scan',    sub: 'AI mood detection',      grad: [C.blue, C.teal]    },
    { id: 'history',  title: 'Your Journal',  sub: 'Check-in history',       grad: [C.purple, C.blue]  },
    { id: 'alerts',   title: 'Family View',   sub: 'Weekly safety report',   grad: [C.yellow, C.orange]},
    { id: 'settings', title: 'Account',       sub: 'Privacy & compliance',   grad: [C.success, C.teal] },
  ];

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.title}>MirrorMind</Text>
        </View>
        <View style={styles.coppaChip}>
          <Text style={styles.coppaText}>COPPA ✓</Text>
        </View>
      </View>

      <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>

        {/* ── Hero Gradient Card ── */}
        <PressCard onPress={() => navigate('checkin')} style={styles.heroWrap}>
          <LinearGradient
            colors={heroGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            {/* Left content */}
            <View style={styles.heroLeft}>
              <View style={styles.heroEyebrowWrap}>
                <Text style={styles.heroEyebrow}>
                  {todayMood ? 'TODAY YOU FEEL' : 'DAILY CHECK-IN'}
                </Text>
              </View>
              <Text style={styles.heroMoodName}>
                {todayMood ? todayMood.label : 'How are\nyou today?'}
              </Text>
              <Text style={styles.heroCaption}>
                {todayMood ? todayMood.desc : 'Tap to start your reflection'}
              </Text>
              <View style={styles.heroCta}>
                <Text style={styles.heroCtaText}>
                  {todayMood ? 'Check in again  →' : 'Scan my mood  →'}
                </Text>
              </View>
            </View>

            {/* Right emoji */}
            <View style={styles.heroRight}>
              <Text style={styles.heroEmoji}>{heroEmoji}</Text>
            </View>

            {/* Decorative circles */}
            <View style={[styles.heroBubble, { width: 120, height: 120, top: -20, right: 60, opacity: 0.15 }]} />
            <View style={[styles.heroBubble, { width: 80,  height: 80,  bottom: -10, right: 20, opacity: 0.1  }]} />
          </LinearGradient>
        </PressCard>

        {/* ── 2x2 Stats Grid ── */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, TYPE.sectionHead]}>Your Progress</Text>
        </View>
        <View style={styles.statsGrid}>
          {STATS.map((stat, i) => (
            <View key={i} style={[styles.statCard, SHADOW.sm]}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <Text style={[styles.statNumber, { color: stat.color }]}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Insight Banner ── */}
        {notice && (
          <View style={[styles.insightCard, SHADOW.xs, { borderLeftColor: notice.color }]}>
            <View style={[styles.insightAccent, { backgroundColor: notice.color }]} />
            <View style={styles.insightBody}>
              <View style={styles.insightHeader}>
                <Text style={styles.insightIcon}>{notice.icon}</Text>
                <Text style={[styles.insightTitle, { color: notice.color }]}>{notice.title}</Text>
              </View>
              <Text style={styles.insightText}>{notice.text}</Text>
            </View>
          </View>
        )}

        {/* ── Recent Moods ── */}
        {last7.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, TYPE.sectionHead]}>Recent Moods</Text>
              <TouchableOpacity onPress={() => navigate('history')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodTrailRow}>
              {last7.map((s, i) => {
                const m = MOOD[s.sentimentLabel];
                const d = s.timestamp?.toDate ? s.timestamp.toDate() : new Date();
                const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                return (
                  <View key={i} style={styles.moodBubbleWrap}>
                    <View style={[styles.moodBubble, { backgroundColor: m?.colorLight || C.bgAlt }]}>
                      <Text style={styles.moodBubbleEmoji}>{m?.emoji || '·'}</Text>
                    </View>
                    <Text style={styles.moodBubbleDay}>{days[d.getDay()]}</Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Explore Cards ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, TYPE.sectionHead]}>Explore</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navScrollRow}>
            {NAV_CARDS.map(card => (
              <PressCard key={card.id} onPress={() => navigate(card.id)}>
                <LinearGradient
                  colors={card.grad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.navCard, SHADOW.md]}
                >
                  <Text style={styles.navTitle}>{card.title}</Text>
                  <Text style={styles.navSub}>{card.sub}</Text>
                  <Text style={styles.navArrow}>→</Text>
                </LinearGradient>
              </PressCard>
            ))}
          </ScrollView>
        </View>

        {/* ── Agent attribution ── */}
        <View style={styles.agentRow}>
          {['Sentiment Agent', 'Counseling Agent', 'Reflection Agent'].map((a, i) => (
            <View key={i} style={[styles.agentChip, SHADOW.xs]}>
              <Text style={styles.agentText}>{a}</Text>
            </View>
          ))}
        </View>

      </Animated.View>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.bg },
  scrollContent: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingTop: 60, paddingHorizontal: S.screenPad, paddingBottom: 20,
  },
  greeting: { ...TYPE.caption, color: C.label3, marginBottom: 2 },
  title:    { ...TYPE.screenTitle, color: C.label },
  coppaChip: {
    backgroundColor: '#EBF8F0', borderRadius: S.pillRadius,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#B8E8CE',
    marginTop: 6,
  },
  coppaText: { ...TYPE.micro, color: C.success },

  // Hero card
  heroWrap: { marginHorizontal: S.screenPad, marginBottom: S.sectionGap },
  heroCard: {
    borderRadius: S.cardRadiusLg, padding: 24,
    flexDirection: 'row', alignItems: 'center',
    minHeight: 200, overflow: 'hidden',
  },
  heroLeft:  { flex: 1, gap: 8 },
  heroRight: { alignItems: 'center', justifyContent: 'center', paddingLeft: 12 },
  heroEyebrowWrap: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: S.pillRadius,
    paddingHorizontal: 10, paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  heroEyebrow:  { ...TYPE.micro, color: 'rgba(255,255,255,0.9)', letterSpacing: 0.8 },
  heroMoodName: { ...TYPE.heroTitle, color: '#fff' },
  heroCaption:  { ...TYPE.caption, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  heroCta: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: S.pillRadius,
    paddingHorizontal: 14, paddingVertical: 7,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  heroCtaText:  { ...TYPE.caption, color: '#fff', fontWeight: '600' },
  heroEmoji:    { fontSize: 64 },
  heroBubble: {
    position: 'absolute', borderRadius: 999,
    backgroundColor: '#fff',
  },

  // Stats
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: S.screenPad, marginBottom: 14 },
  sectionTitle:{ color: C.label },
  seeAll:      { ...TYPE.caption, color: C.accent, fontWeight: '600' },
  statsGrid:   { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: S.screenPad, gap: S.cardGap, marginBottom: S.sectionGap },
  statCard: {
    width: CARD_W, backgroundColor: C.surface,
    borderRadius: S.cardRadius, padding: 18,
    gap: 4,
  },
  statIcon:   { fontSize: 22, marginBottom: 4 },
  statNumber: { ...TYPE.statNumber },
  statLabel:  { ...TYPE.micro, color: C.label3 },

  // Insight banner — iOS notification card style
  insightCard: {
    marginHorizontal: S.screenPad, marginBottom: S.sectionGap,
    backgroundColor: C.surface, borderRadius: S.cardRadius,
    flexDirection: 'row', overflow: 'hidden',
  },
  insightAccent: { width: 4 },
  insightBody:   { flex: 1, padding: 16, gap: 6 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insightIcon:   { fontSize: 16 },
  insightTitle:  { ...TYPE.micro, fontWeight: '700' },
  insightText:   { ...TYPE.caption, color: C.label2, lineHeight: 18 },

  // Mood trail
  section:       { marginBottom: S.sectionGap },
  moodTrailRow:  { paddingHorizontal: S.screenPad, gap: 10 },
  moodBubbleWrap:{ alignItems: 'center', gap: 5 },
  moodBubble: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  moodBubbleEmoji: { fontSize: 30 },
  moodBubbleDay:   { ...TYPE.micro, color: C.label4, fontSize: 10 },

  // Horizontal nav cards
  navScrollRow: { paddingHorizontal: S.screenPad, gap: S.cardGap },
  navCard: {
    width: 160, height: 120, borderRadius: S.cardRadius, padding: 18,
    justifyContent: 'space-between',
  },
  navTitle: { ...TYPE.cardTitle, color: '#fff' },
  navSub:   { ...TYPE.caption, color: 'rgba(255,255,255,0.8)' },
  navArrow: { fontSize: 16, color: '#fff', fontWeight: '700', alignSelf: 'flex-end' },

  // Agent tags
  agentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: S.screenPad, justifyContent: 'center', marginBottom: 8 },
  agentChip: { backgroundColor: C.surface, borderRadius: S.pillRadius, paddingHorizontal: 12, paddingVertical: 4 },
  agentText: { ...TYPE.micro, color: C.label4, fontSize: 9 },
});
