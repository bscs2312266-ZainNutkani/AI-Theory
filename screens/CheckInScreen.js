/**
 * CheckInScreen — Sentiment Reflex + Counseling + Reflection
 * COPPA 2025: base64 frame discarded immediately after Groq call.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, ScrollView,
  Animated, Dimensions, StatusBar, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  logSession, loadSessionHistory, checkNegativeTrend, getUserProfile,
} from '../services/firestoreService';
import { generateAdvice, detectMoodFromPhoto } from '../agents/counselingAgent';
import { getSessionReflection, computeEffectivenessScore } from '../agents/reflectionAgent';
import { auth } from '../services/firebase';
import { C, MOOD, TYPE, S, SHADOW } from '../theme';
import { getParentEmail, sendParentAlertEmail, buildMailtoUrl } from '../services/emailService';

const { width, height } = Dimensions.get('window');
const TILE_GAP  = 10;
const TILE_SIZE = (width - S.screenPad * 2 - TILE_GAP * 2) / 3;

// ─── G2 Safety Alert Dynamic Island ──────────────────────────────────────────
function G2AlertPill({ visible, emailSent, mailtoUrl, onDismiss }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      tension: 60, friction: 8, useNativeDriver: false,
    }).start();
  }, [visible]);

  const pillW = anim.interpolate({ inputRange: [0, 1], outputRange: [130, width - 32] });
  const pillH = anim.interpolate({ inputRange: [0, 1], outputRange: [36, mailtoUrl && !emailSent ? 92 : 76] });
  const op    = anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 1] });

  function handleSendPress() {
    if (mailtoUrl) {
      Linking.openURL(mailtoUrl).catch(() =>
        Alert.alert('Could not open email app', 'Please email the parent manually.')
      );
      onDismiss();
    }
  }

  const statusText = emailSent
    ? 'Automatic email sent to parent'
    : mailtoUrl
      ? 'Parent saved. Tap below to send alert email.'
      : 'Go to More > set a parent email first';

  return (
    <Animated.View style={[styles.g2Pill, { width: pillW, height: pillH, opacity: op }]}>
      <View style={styles.g2Inner}>
        <View style={[styles.g2IconWrap, emailSent && { backgroundColor: 'rgba(80,200,80,0.25)' }]}>
          <Text style={[styles.g2Icon, emailSent && { color: '#6DDE8A' }]}>
            {emailSent ? '✓' : '⚠'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.g2Title} numberOfLines={1}>Parent Alert Triggered</Text>
          <Text style={styles.g2Sub} numberOfLines={2}>{statusText}</Text>
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          style={styles.g2Close}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.g2CloseText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* "Open Gmail" button — shown when EmailJS is not configured */}
      {mailtoUrl && !emailSent && (
        <TouchableOpacity style={styles.g2SendBtn} onPress={handleSendPress} activeOpacity={0.8}>
          <Text style={styles.g2SendText}>Open Gmail to Send Alert →</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── Dynamic Island simulation ────────────────────────────────────────────────
// Appears as a black expanding pill at the top - simulates iOS Live Activity.
function DynamicIsland({ diPhase, mood }) {
  const diWidth  = useRef(new Animated.Value(120)).current;
  const diHeight = useRef(new Animated.Value(36)).current;
  const diOpacity= useRef(new Animated.Value(0)).current;
  const pulseAnim= useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (diPhase === 'scanning') {
      Animated.parallel([
        Animated.timing(diOpacity, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.spring(diWidth,   { toValue: 170, tension: 70, friction: 8, useNativeDriver: false }),
        Animated.spring(diHeight,  { toValue: 44,  tension: 70, friction: 8, useNativeDriver: false }),
      ]).start();
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])).start();
    } else if (diPhase === 'result') {
      pulseAnim.stopAnimation();
      Animated.parallel([
        Animated.spring(diWidth,  { toValue: 260, tension: 60, friction: 7, useNativeDriver: false }),
        Animated.spring(diHeight, { toValue: 64,  tension: 60, friction: 7, useNativeDriver: false }),
      ]).start(() => {
        setTimeout(() => {
          Animated.parallel([
            Animated.spring(diWidth,   { toValue: 120, tension: 100, friction: 10, useNativeDriver: false }),
            Animated.spring(diHeight,  { toValue: 36,  tension: 100, friction: 10, useNativeDriver: false }),
            Animated.timing(diOpacity, { toValue: 0, duration: 400, delay: 300, useNativeDriver: false }),
          ]).start();
        }, 2200);
      });
    } else {
      Animated.timing(diOpacity, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }
  }, [diPhase]);

  const cfg = MOOD[mood] || MOOD.neutral;
  return (
    <Animated.View style={[styles.diPill, { width: diWidth, height: diHeight, opacity: diOpacity }]}>
      {diPhase === 'scanning' && (
        <View style={styles.diInner}>
          <Animated.View style={[styles.diDot, { opacity: pulseAnim, backgroundColor: cfg.color }]} />
          <Text style={styles.diText}>Scanning…</Text>
        </View>
      )}
      {diPhase === 'result' && mood && (
        <View style={styles.diInner}>
          <Text style={styles.diEmoji}>{cfg.emoji}</Text>
          <View style={styles.diResultText}>
            <Text style={styles.diLabel}>Detected</Text>
            <Text style={[styles.diMood, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}

// ─── Floating orb (result phase) ─────────────────────────────────────────────
function FloatingOrb({ mood }) {
  const cfg   = MOOD[mood] || MOOD.neutral;
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: -12, duration: 2400, useNativeDriver: true }),
      Animated.timing(float, { toValue: 0,   duration: 2400, useNativeDriver: true }),
    ])).start();
  }, []);
  return (
    <Animated.View style={[styles.orbWrap, { transform: [{ translateY: float }] }]}>
      <LinearGradient
        colors={[cfg.gradStart, cfg.gradEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.orb}
      >
        <Text style={styles.orbEmoji}>{cfg.emoji}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

function PulseRing({ color }) {
  const scale = useRef(new Animated.Value(1)).current;
  const op    = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.5, duration: 1600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1,   duration: 1600, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(op, { toValue: 0, duration: 1600, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.4, duration: 1600, useNativeDriver: true }),
      ]),
    ])).start();
  }, []);
  return <Animated.View style={[styles.pulseRing, { borderColor: color, transform: [{ scale }], opacity: op }]} />;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CheckInScreen({ uid, navigate, onLogout, userEmail }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase]         = useState('idle');
  const [loading, setLoading]     = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [aiSuggested, setAiSuggested] = useState(null);
  const [sentiment, setSentiment]     = useState(null);
  const [advice, setAdvice]           = useState(null);
  const [reflection, setReflection]   = useState(null);
  const [showAnxiousDialog, setShowAnxiousDialog] = useState(false);
  const [history, setHistory]         = useState([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [diPhase, setDiPhase]   = useState(null); // 'scanning' | 'result' | null
  const [diMood,  setDiMood]    = useState(null);
  const [showG2,      setShowG2]      = useState(false);
  const [g2EmailSent, setG2EmailSent] = useState(false);
  const [g2MailtoUrl, setG2MailtoUrl] = useState(null);

  const cameraRef    = useRef(null);
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const slideAnim    = useRef(new Animated.Value(30)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const diTimer      = useRef(null);

  useEffect(() => {
    loadSessionHistory(uid, 10).then(setHistory);
    getUserProfile(uid).then(p => { if (p?.sessionCount) setTotalSessions(p.sessionCount); });
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
    ]).start();
    return () => { if (diTimer.current) clearTimeout(diTimer.current); };
  }, []);

  async function handleCapture() {
    if (!cameraRef.current) return;
    setLoading(true);
    setDiPhase('scanning');
    setLoadingText('Reading your expression…');
    Animated.timing(progressAnim, { toValue: 0.4, duration: 1500, useNativeDriver: false }).start();
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.1 });
      setLoadingText('Analysing with Groq Vision…');
      Animated.timing(progressAnim, { toValue: 0.85, duration: 1200, useNativeDriver: false }).start();
      const label = await detectMoodFromPhoto(photo.base64);
      setAiSuggested(label); setSentiment(label);
      setDiMood(label); setDiPhase('result');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (history.length > 0) setReflection(getSessionReflection(history[0], label));
      setLoading(false); progressAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setPhase('confirm'); fadeAnim.setValue(0); slideAnim.setValue(24);
        Animated.parallel([
          Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
        ]).start();
      });
    } catch (e) {
      Alert.alert('Scan Error', e.message);
      setLoading(false); progressAnim.setValue(0); setDiPhase(null);
    }
  }

  async function handleMoodConfirm(m) {
    setSentiment(m);
    if (m === 'sad') { setShowAnxiousDialog(true); return; }
    try {
      await finishSession(m);
    } catch (e) {
      Alert.alert('Something went wrong', 'Could not generate advice. Please check your connection and try again.');
      setPhase('confirm');
    }
  }

  async function finishSession(label) {
    setSentiment(label); setPhase('loading');
    setLoadingText('Counseling Agent crafting advice…');

    // Advice generation — always succeeds (has static fallback)
    const adviceText = await generateAdvice(label, history);
    let eff = null;
    if (history.length > 0) eff = computeEffectivenessScore(history[0].sentimentLabel, label);
    setAdvice(adviceText);

    // Firebase calls wrapped individually — failures don't block the result screen
    try { await logSession(uid, label, adviceText, eff); } catch {}

    let shouldAlert = false;
    try { shouldAlert = await checkNegativeTrend(uid); } catch {}

    if (shouldAlert) {
      let emailSent = false;
      let mailtoUrl = null;
      try {
        const parentEmail = await getParentEmail();
        if (parentEmail) {
          const result = await sendParentAlertEmail({ parentEmail, childEmail: userEmail });
          emailSent = result.ok;
          mailtoUrl = buildMailtoUrl(parentEmail, userEmail);
        }
      } catch {}
      setG2EmailSent(emailSent);
      setG2MailtoUrl(mailtoUrl);
      setShowG2(true);
      setTimeout(() => setShowG2(false), 12000);
    }

    // Always navigate to result
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setPhase('result'); fadeAnim.setValue(0); slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    });

    try { loadSessionHistory(uid, 10).then(setHistory); } catch {}
    try { getUserProfile(uid).then(p => { if (p?.sessionCount) setTotalSessions(p.sessionCount); }); } catch {}
  }

  async function handleAnxiousResponse(isAnxious) {
    setShowAnxiousDialog(false);
    try {
      await finishSession(isAnxious ? 'anxious' : 'sad');
    } catch (e) {
      Alert.alert('Something went wrong', 'Could not generate advice. Please check your connection and try again.');
      setPhase('confirm');
    }
  }

  function handleMoodTap(key) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSentiment(key);
  }

  function reset() {
    setDiPhase(null);
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setSentiment(null); setAdvice(null); setAiSuggested(null);
      setReflection(null); setPhase('idle'); progressAnim.setValue(0);
      fadeAnim.setValue(0); slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 12, useNativeDriver: true }),
      ]).start();
    });
  }

  const moodCfg = sentiment ? MOOD[sentiment] : MOOD.neutral;

  if (!permission) return <View style={[styles.container, styles.center]}><ActivityIndicator color={C.accent} size="large" /></View>;
  if (!permission.granted) return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.permText}>Camera access needed for mood scanning</Text>
      <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
        <Text style={styles.permBtnText}>Grant Camera Access</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Mood scan Dynamic Island */}
      <DynamicIsland diPhase={diPhase} mood={diMood} />

      {/* G2 Safety Alert Dynamic Island */}
      <G2AlertPill
        visible={showG2}
        emailSent={g2EmailSent}
        mailtoUrl={g2MailtoUrl}
        onDismiss={() => setShowG2(false)}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigate('dashboard')}>
          <Text style={styles.backBtnText}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Daily Scan</Text>
          <Text style={styles.headerSub}>Sentiment Reflex Agent</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── IDLE: Camera ── */}
      {phase === 'idle' && (
        <Animated.View style={[styles.flex1, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.cameraCard}>
            <CameraView ref={cameraRef} style={styles.camera} facing="front" />
            <View style={styles.cTL}/><View style={styles.cTR}/>
            <View style={styles.cBL}/><View style={styles.cBR}/>
            {loading && (
              <View style={styles.camOverlay}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={styles.camOverlayText}>{loadingText}</Text>
                <View style={styles.progBar}>
                  <Animated.View style={[styles.progFill, {
                    width: progressAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] }),
                  }]} />
                </View>
              </View>
            )}
          </View>

          <View style={styles.idleBottom}>
            {history.length > 0 && !loading && (
              <View style={[styles.lastChip, SHADOW.xs]}>
                <Text style={styles.lastChipEmoji}>{MOOD[history[0]?.sentimentLabel]?.emoji}</Text>
                <Text style={styles.lastChipText}>Last: {MOOD[history[0]?.sentimentLabel]?.label}</Text>
              </View>
            )}
            <Text style={styles.idleQ}>How are you{'\n'}feeling right now?</Text>
            <Text style={styles.idleSub}>AI reads your expression · you confirm · advice follows</Text>

            <TouchableOpacity
              style={[styles.scanBtn, loading && { opacity: 0.5 }]}
              onPress={handleCapture}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.scanBtnText}>◎  Scan My Mood</Text>
            </TouchableOpacity>

            {history.length > 0 && (
              <View style={styles.recentRow}>
                <Text style={styles.recentLabel}>RECENT  </Text>
                {history.slice(0, 7).map((s, i) => (
                  <Text key={i} style={styles.recentEmoji}>{MOOD[s.sentimentLabel]?.emoji || '·'}</Text>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* ── CONFIRM ── */}
      {phase === 'confirm' && (
        <ScrollView contentContainerStyle={styles.confirmScroll} showsVerticalScrollIndicator={false}>
          {/* AI detected badge */}
          <View style={styles.aiBadgeRow}>
            <View style={[styles.aiBadge, SHADOW.xs]}>
              <View style={[styles.aiBadgeDot, { backgroundColor: MOOD[aiSuggested]?.color }]} />
              <Text style={styles.aiBadgeText}>AI Detected</Text>
            </View>
          </View>

          {/* Hero detected card */}
          <LinearGradient
            colors={[MOOD[aiSuggested]?.gradStart || C.blue, MOOD[aiSuggested]?.gradEnd || C.teal]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.heroDetected, SHADOW.lg]}
          >
            <Text style={styles.heroDetectedEmoji}>{MOOD[aiSuggested]?.emoji}</Text>
            <Text style={styles.heroDetectedLabel}>{MOOD[aiSuggested]?.label}</Text>
            <View style={styles.heroDetectedPill}>
              <Text style={styles.heroDetectedPillText}>Groq Llama 4 Scout · Vision</Text>
            </View>
          </LinearGradient>

          {/* Reflection note */}
          {reflection && (
            <View style={[styles.reflCard, SHADOW.xs, { borderLeftColor: reflection.color }]}>
              <Text style={[styles.reflTitle, { color: reflection.color }]}>Reflection Agent</Text>
              <Text style={styles.reflBody}>{reflection.text}</Text>
              <Text style={[styles.reflScore, { color: reflection.color }]}>Effectiveness: {Math.round(reflection.score * 100)}%</Text>
            </View>
          )}

          <Text style={styles.pickQ}>How do you actually feel?</Text>
          <Text style={styles.pickHint}>Your choice overrides the AI</Text>

          {/* 3-column gradient mood tiles — explicit rows for reliable layout */}
          {[Object.entries(MOOD).slice(0, 3), Object.entries(MOOD).slice(3)].map((row, ri) => (
            <View key={ri} style={styles.moodRow}>
              {row.map(([key, cfg]) => {
                const selected = sentiment === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => handleMoodTap(key)}
                    activeOpacity={0.85}
                    style={[styles.moodTileWrap, selected && styles.moodTileSelected]}
                  >
                    <LinearGradient
                      colors={[cfg.gradStart, cfg.gradEnd]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                      style={styles.moodTile}
                    >
                      {selected && (
                        <View style={styles.moodCheck}>
                          <Text style={styles.moodCheckText}>✓</Text>
                        </View>
                      )}
                      <Text style={styles.moodTileEmoji}>{cfg.emoji}</Text>
                      <Text style={styles.moodTileLabel}>{cfg.label}</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity
            style={[styles.confirmBtn, SHADOW.md]}
            onPress={() => handleMoodConfirm(sentiment)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[moodCfg.gradStart, moodCfg.gradEnd]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.confirmBtnGrad}
            >
              <Text style={styles.confirmBtnText}>
                Confirm  {moodCfg.emoji}  {moodCfg.label}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── LOADING ── */}
      {phase === 'loading' && (
        <View style={[styles.flex1, styles.center]}>
          <FloatingOrb mood={sentiment} />
          <ActivityIndicator color={moodCfg.color} size="large" style={{ marginTop: 28 }} />
          <Text style={[styles.loadingText, { color: moodCfg.color, marginTop: 12 }]}>{loadingText}</Text>
        </View>
      )}

      {/* ── RESULT ── */}
      {phase === 'result' && sentiment && (
        <Animated.ScrollView
          contentContainerStyle={styles.resultScroll}
          style={{ opacity: fadeAnim }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.orbArea}>
            <PulseRing color={moodCfg.color} />
            <FloatingOrb mood={sentiment} />
          </View>

          <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
            <Text style={[styles.resultMood, { color: moodCfg.color }]}>{moodCfg.label}</Text>
            <Text style={styles.resultDesc}>{moodCfg.desc}</Text>

            {advice && (
              <View style={[styles.advCard, SHADOW.sm]}>
                <View style={styles.advHeader}>
                  <View style={[styles.advDot, { backgroundColor: moodCfg.color }]} />
                  <Text style={[styles.advLabel, { color: moodCfg.color }]}>COUNSELING AGENT</Text>
                </View>
                <Text style={styles.advText}>{advice}</Text>
                <View style={[styles.advDivider, { backgroundColor: moodCfg.colorLight }]} />
                <Text style={styles.advPowered}>Powered by Groq Llama · Utility-ranked advice</Text>
              </View>
            )}

            <View style={[styles.statsRow, SHADOW.xs]}>
              {[
                { val: totalSessions || history.length, lbl: 'Sessions' },
                { val: history.filter(s => s.effectivenessScore >= 0.6).length, lbl: 'Effective' },
                { val: history.length > 0
                    ? Math.round(history.filter(s => ['happy','neutral'].includes(s.sentimentLabel)).length / history.length * 100) + '%'
                    : '0%', lbl: 'Positive' },
              ].map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <View style={styles.statDivider} />}
                  <View style={styles.statItem}>
                    <Text style={[styles.statVal, { color: moodCfg.color }]}>{s.val}</Text>
                    <Text style={styles.statLbl}>{s.lbl}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {history.length > 0 && (
              <View style={styles.histSection}>
                <Text style={styles.histSectionTitle}>Recent Sessions</Text>
                {history.slice(0, 5).map((s, i) => {
                  const c = MOOD[s.sentimentLabel] || MOOD.neutral;
                  return (
                    <View key={i} style={[styles.histRow, SHADOW.xs, { borderLeftColor: c.color }]}>
                      <View style={[styles.histEmojiWrap, { backgroundColor: c.colorLight }]}>
                        <Text style={styles.histEmoji}>{c.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.histMood, { color: c.color }]}>{c.label}</Text>
                        <Text style={styles.histAdv} numberOfLines={1}>{s.adviceText}</Text>
                      </View>
                      {s.effectivenessScore >= 0.6 && <Text style={[styles.histUp, { color: C.success }]}>↑</Text>}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.resultActions}>
              <TouchableOpacity style={[styles.resultBtnOutline, { borderColor: moodCfg.color }]} onPress={reset} activeOpacity={0.8}>
                <Text style={[styles.resultBtnOutlineTxt, { color: moodCfg.color }]}>◎  New Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.resultBtnFill, SHADOW.sm]} onPress={() => navigate('dashboard')} activeOpacity={0.8}>
                <Text style={styles.resultBtnFillTxt}>⌂  Home</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.ScrollView>
      )}

      {/* Anxious clarification sheet */}
      <Modal visible={showAnxiousDialog} transparent animationType="slide">
        <View style={styles.sheetBg}>
          <View style={[styles.sheet, SHADOW.lg]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetEmoji}>🤔</Text>
            <Text style={styles.sheetTitle}>Quick check</Text>
            <Text style={styles.sheetMsg}>Are you feeling worried or nervous about something?</Text>
            <TouchableOpacity style={[styles.sheetBtnFill, { backgroundColor: MOOD.anxious.color }, SHADOW.sm]} onPress={() => handleAnxiousResponse(true)}>
              <Text style={styles.sheetBtnFillTxt}>Yes, a bit worried</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetBtnOutline, { borderColor: C.border }]} onPress={() => handleAnxiousResponse(false)}>
              <Text style={styles.sheetBtnOutlineTxt}>No, just sad</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  flex1:     { flex: 1 },
  center:    { justifyContent: 'center', alignItems: 'center' },

  // G2 Alert Dynamic Island
  g2Pill: {
    position: 'absolute', top: 52, alignSelf: 'center',
    backgroundColor: '#2D1010', borderRadius: 30,
    zIndex: 300, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,80,80,0.4)',
  },
  g2Inner:   { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  g2IconWrap:{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,80,80,0.2)', alignItems: 'center', justifyContent: 'center' },
  g2Icon:    { fontSize: 14, color: '#FF6B6B' },
  g2Title:   { color: '#fff', fontSize: 13, fontWeight: '700' },
  g2Sub:     { color: 'rgba(255,180,180,0.8)', fontSize: 11, fontWeight: '400' },
  g2Close:    { padding: 4 },
  g2CloseText:{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },
  g2SendBtn: {
    marginHorizontal: 14, marginBottom: 10,
    backgroundColor: 'rgba(255,100,100,0.25)',
    borderRadius: 12, paddingVertical: 9,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,100,100,0.4)',
  },
  g2SendText: { color: '#FFB3B3', fontSize: 12, fontWeight: '700' },

  // Dynamic Island
  diPill: {
    position: 'absolute', top: 52, alignSelf: 'center',
    backgroundColor: '#1C1C1E', borderRadius: 30,
    zIndex: 200, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  diInner:     { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14 },
  diDot:       { width: 8, height: 8, borderRadius: 4 },
  diText:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  diEmoji:     { fontSize: 22 },
  diResultText:{ gap: 1 },
  diLabel:     { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '500' },
  diMood:      { fontSize: 14, fontWeight: '700' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 54, paddingBottom: 14, paddingHorizontal: S.screenPad,
    backgroundColor: C.bg, borderBottomWidth: 0.5, borderBottomColor: C.sep,
  },
  backBtn:     { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { color: C.label, fontSize: 18, fontWeight: '600' },
  headerTitle: { ...TYPE.cardTitle, color: C.label },
  headerSub:   { ...TYPE.micro, color: C.accent, marginTop: 1 },

  // Camera
  cameraCard: { marginHorizontal: S.screenPad, marginTop: 14, borderRadius: S.cardRadius, overflow: 'hidden', height: height * 0.36 },
  camera:     { width: '100%', height: '100%' },
  cTL: { position: 'absolute', top: 14, left: 14, width: 20, height: 20, borderTopWidth: 2.5, borderLeftWidth: 2.5, borderColor: '#fff', borderRadius: 3 },
  cTR: { position: 'absolute', top: 14, right: 14, width: 20, height: 20, borderTopWidth: 2.5, borderRightWidth: 2.5, borderColor: '#fff', borderRadius: 3 },
  cBL: { position: 'absolute', bottom: 14, left: 14, width: 20, height: 20, borderBottomWidth: 2.5, borderLeftWidth: 2.5, borderColor: '#fff', borderRadius: 3 },
  cBR: { position: 'absolute', bottom: 14, right: 14, width: 20, height: 20, borderBottomWidth: 2.5, borderRightWidth: 2.5, borderColor: '#fff', borderRadius: 3 },
  camOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', gap: 14,
  },
  camOverlayText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  progBar:  { width: '55%', height: 2, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: '#fff', borderRadius: 1 },

  // Idle bottom
  idleBottom:   { flex: 1, paddingHorizontal: S.screenPad, alignItems: 'center', justifyContent: 'center', gap: 0 },
  lastChip:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderRadius: S.pillRadius, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 18 },
  lastChipEmoji:{ fontSize: 16 },
  lastChipText: { ...TYPE.caption, color: C.label2, fontWeight: '500' },
  idleQ:        { ...TYPE.heroTitle, color: C.label, textAlign: 'center', marginBottom: 8 },
  idleSub:      { ...TYPE.caption, color: C.label3, textAlign: 'center', marginBottom: 26 },
  scanBtn: {
    backgroundColor: C.label, borderRadius: S.pillRadius,
    paddingVertical: 18, paddingHorizontal: 36,
    marginBottom: 22,
  },
  scanBtnText:  { color: '#fff', fontSize: 16, fontWeight: '700' },
  recentRow:    { flexDirection: 'row', alignItems: 'center', gap: 3 },
  recentLabel:  { ...TYPE.micro, color: C.label4, fontSize: 9 },
  recentEmoji:  { fontSize: 22 },

  // Confirm
  confirmScroll: { paddingHorizontal: S.screenPad, paddingTop: 20, paddingBottom: 48 },
  aiBadgeRow: { alignItems: 'center', marginBottom: 16 },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface, borderRadius: S.pillRadius,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  aiBadgeDot:  { width: 8, height: 8, borderRadius: 4 },
  aiBadgeText: { ...TYPE.caption, color: C.label2, fontWeight: '600' },
  heroDetected: {
    borderRadius: S.cardRadiusLg, paddingVertical: 44, alignItems: 'center',
    marginBottom: 18, gap: 12,
  },
  heroDetectedEmoji:    { fontSize: 72 },
  heroDetectedLabel:    { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  heroDetectedPill:     { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: S.pillRadius, paddingHorizontal: 14, paddingVertical: 5 },
  heroDetectedPillText: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600' },

  reflCard:    { backgroundColor: C.surface, borderRadius: S.cardRadius, padding: 16, marginBottom: 20, borderLeftWidth: 3, gap: 5 },
  reflTitle:   { ...TYPE.micro, fontWeight: '700' },
  reflBody:    { ...TYPE.caption, color: C.label2, lineHeight: 18 },
  reflScore:   { ...TYPE.micro, fontWeight: '600' },

  pickQ:       { ...TYPE.sectionHead, color: C.label, textAlign: 'center', marginBottom: 5 },
  pickHint:    { ...TYPE.caption, color: C.label3, textAlign: 'center', marginBottom: 20 },

  moodGrid:        { marginBottom: 22 },
  moodRow:         { flexDirection: 'row', gap: TILE_GAP, marginBottom: TILE_GAP },
  moodTileWrap:    { flex: 1, borderRadius: S.cardRadius, overflow: 'hidden', height: TILE_SIZE },
  moodTileSelected:{ opacity: 0.92 },
  moodTile:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, position: 'relative' },
  moodCheck:       { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  moodCheckText:   { color: '#fff', fontSize: 11, fontWeight: '900' },
  moodTileEmoji:   { fontSize: 30 },
  moodTileLabel:   { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '700' },

  confirmBtn:     { borderRadius: S.pillRadius, overflow: 'hidden', marginTop: 4 },
  confirmBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Loading
  loadingText: { fontSize: 13, fontWeight: '600', marginTop: 20 },

  // Result
  orbArea:    { alignItems: 'center', justifyContent: 'center', height: 200, marginBottom: 8 },
  pulseRing:  { position: 'absolute', width: 180, height: 180, borderRadius: 90, borderWidth: 1.5 },
  orbWrap:    { alignItems: 'center', justifyContent: 'center' },
  orb:        { width: 130, height: 130, borderRadius: 65, alignItems: 'center', justifyContent: 'center' },
  orbEmoji:   { fontSize: 54 },

  resultScroll: { padding: S.screenPad, paddingBottom: 48 },
  resultMood:   { fontSize: 36, fontWeight: '800', textAlign: 'center', letterSpacing: -1, marginBottom: 6 },
  resultDesc:   { ...TYPE.body, color: C.label2, textAlign: 'center', marginBottom: 22 },

  advCard:    { backgroundColor: C.surface, borderRadius: S.cardRadius, padding: 22, marginBottom: 16 },
  advHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  advDot:     { width: 8, height: 8, borderRadius: 4 },
  advLabel:   { ...TYPE.micro, fontWeight: '700' },
  advText:    { ...TYPE.body, color: C.label, textAlign: 'center', lineHeight: 24 },
  advDivider: { height: 1, marginVertical: 14 },
  advPowered: { ...TYPE.micro, color: C.label4, textAlign: 'center', fontSize: 9 },

  statsRow:    { flexDirection: 'row', backgroundColor: C.surface, borderRadius: S.cardRadius, padding: 18, marginBottom: 16, alignItems: 'center' },
  statItem:    { flex: 1, alignItems: 'center' },
  statVal:     { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLbl:     { ...TYPE.micro, color: C.label4, marginTop: 3, fontSize: 9 },
  statDivider: { width: 1, height: 34, backgroundColor: C.sep },

  histSection:     { marginBottom: 16 },
  histSectionTitle:{ ...TYPE.micro, color: C.label3, marginBottom: 10 },
  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.surface, borderRadius: 16, padding: 12, marginBottom: 7, borderLeftWidth: 3,
  },
  histEmojiWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  histEmoji:     { fontSize: 22 },
  histMood:      { ...TYPE.caption, fontWeight: '700', marginBottom: 2 },
  histAdv:       { ...TYPE.micro, color: C.label4, fontSize: 10 },
  histUp:        { fontSize: 14, fontWeight: '700' },

  resultActions:       { flexDirection: 'row', gap: 10 },
  resultBtnOutline:    { flex: 1, borderRadius: 16, padding: 15, alignItems: 'center', borderWidth: 1.5, backgroundColor: C.surface },
  resultBtnOutlineTxt: { fontSize: 14, fontWeight: '700' },
  resultBtnFill:       { flex: 1, borderRadius: 16, padding: 15, alignItems: 'center', backgroundColor: C.label },
  resultBtnFillTxt:    { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Sheet modal
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: C.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 28, paddingBottom: 44, alignItems: 'center', gap: 8 },
  sheetHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: C.bgDeep, marginBottom: 12 },
  sheetEmoji:         { fontSize: 46, marginBottom: 4 },
  sheetTitle:         { ...TYPE.sectionHead, color: C.label },
  sheetMsg:           { ...TYPE.body, color: C.label2, textAlign: 'center' },
  sheetBtnFill:       { width: '100%', borderRadius: 18, padding: 17, alignItems: 'center', marginTop: 8 },
  sheetBtnFillTxt:    { color: '#fff', fontSize: 16, fontWeight: '700' },
  sheetBtnOutline:    { width: '100%', borderRadius: 18, padding: 17, alignItems: 'center', borderWidth: 1 },
  sheetBtnOutlineTxt: { color: C.label2, fontSize: 16, fontWeight: '600' },

  permText:    { ...TYPE.body, color: C.label2, textAlign: 'center', paddingHorizontal: 32, marginBottom: 20 },
  permBtn:     { backgroundColor: C.label, borderRadius: 18, padding: 16 },
  permBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
