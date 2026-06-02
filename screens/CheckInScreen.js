import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, ScrollView,
  Animated, Dimensions, StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { logSession, loadSessionHistory, checkNegativeTrend } from '../services/firestoreService';
import { generateAdvice, detectMoodFromPhoto } from '../agents/counselingAgent';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

const { width, height } = Dimensions.get('window');

const MOOD_CONFIG = {
  happy:   { emoji: '😊', label: 'Happy',   color: '#FFD700', desc: 'You are radiating positivity today!' },
  neutral: { emoji: '😐', label: 'Neutral',  color: '#00D4FF', desc: 'A calm and steady state of mind.' },
  sad:     { emoji: '😢', label: 'Sad',      color: '#4FC3F7', desc: 'It is okay to feel this way.' },
  anxious: { emoji: '😰', label: 'Anxious',  color: '#CE93D8', desc: 'Take a breath. You are safe.' },
  tired:   { emoji: '😴', label: 'Tired',    color: '#80CBC4', desc: 'Rest is your superpower.' },
};

function PulseRing({ color }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.3, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.1, duration: 1200, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 1200, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.pulseRing, { borderColor: color, transform: [{ scale: pulse }], opacity }]} />
  );
}

function FloatingOrb({ mood }) {
  const config = MOOD_CONFIG[mood] || MOOD_CONFIG.neutral;
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -12, duration: 2000, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={[styles.orbWrapper, { transform: [{ translateY: float }] }]}>
      <View style={[styles.orbOuter, { borderColor: config.color + '40' }]}>
        <View style={[styles.orbInner, { backgroundColor: config.color + '20', borderColor: config.color }]}>
          <Text style={styles.orbEmoji}>{config.emoji}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

export default function CheckInScreen({ uid, onLogout }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState('idle'); // idle | confirm | result
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [aiSuggested, setAiSuggested] = useState(null);
  const [sentiment, setSentiment] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [showAnxiousDialog, setShowAnxiousDialog] = useState(false);
  const [history, setHistory] = useState([]);
  const cameraRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSessionHistory(uid, 10).then(setHistory);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleCapture() {
    if (!cameraRef.current) return;
    setLoading(true);
    setLoadingText('Scanning your face...');
    Animated.timing(progressAnim, { toValue: 0.5, duration: 1500, useNativeDriver: false }).start();
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.2 });
      setLoadingText('Analysing expression...');
      Animated.timing(progressAnim, { toValue: 0.9, duration: 1000, useNativeDriver: false }).start();
      const label = await detectMoodFromPhoto(photo.base64);
      setAiSuggested(label);
      setSentiment(label);
      setLoading(false);
      progressAnim.setValue(0);
      // Show mood confirmation screen
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setPhase('confirm');
        fadeAnim.setValue(0);
        slideAnim.setValue(30);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]).start();
      });
    } catch (e) {
      Alert.alert('Error', e.message);
      setLoading(false);
      progressAnim.setValue(0);
    }
  }

  async function handleMoodConfirm(chosenMood) {
    setSentiment(chosenMood);
    if (chosenMood === 'sad') {
      setShowAnxiousDialog(true);
      return;
    }
    await finishSession(chosenMood);
  }

  async function finishSession(label) {
    setSentiment(label);
    setPhase('loading');
    setLoadingText('Generating personalised advice...');
    const recentLabels = history.map(s => s.sentimentLabel);
    const adviceText = await generateAdvice(label, recentLabels);
    setAdvice(adviceText);
    await logSession(uid, label, adviceText);
    const shouldAlert = await checkNegativeTrend(uid);
    if (shouldAlert) Alert.alert('Parent Notice', 'Low mood detected for 3 consecutive sessions.');
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setPhase('result');
      fadeAnim.setValue(0);
      slideAnim.setValue(40);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]).start();
    });
    loadSessionHistory(uid, 10).then(setHistory);
  }

  function handleAnxiousResponse(isAnxious) {
    setShowAnxiousDialog(false);
    finishSession(isAnxious ? 'anxious' : 'sad');
  }

  function reset() {
    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setSentiment(null);
      setAdvice(null);
      setAiSuggested(null);
      setPhase('idle');
      progressAnim.setValue(0);
      fadeAnim.setValue(0);
      slideAnim.setValue(50);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    });
  }

  const moodConfig = sentiment ? MOOD_CONFIG[sentiment] : MOOD_CONFIG.neutral;

  if (!permission) return <View style={[styles.container, styles.center]}><ActivityIndicator color="#00D4FF" size="large" /></View>;
  if (!permission.granted) return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.permText}>Camera access required</Text>
      <TouchableOpacity style={[styles.glowBtn, { borderColor: '#00D4FF' }]} onPress={requestPermission}>
        <Text style={[styles.glowBtnText, { color: '#00D4FF' }]}>Grant Permission</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MirrorMind</Text>
          <Text style={styles.headerSub}>EMOTIONAL AI</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={() => signOut(auth).then(onLogout)}>
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
      </View>

      {/* IDLE — Camera */}
      {phase === 'idle' && (
        <Animated.View style={[styles.flex1, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.cameraWrap}>
            <CameraView ref={cameraRef} style={styles.camera} facing="front" />
            <View style={styles.cornerTL} /><View style={styles.cornerTR} />
            <View style={styles.cornerBL} /><View style={styles.cornerBR} />
            {loading && (
              <View style={styles.camOverlay}>
                <ActivityIndicator color="#00D4FF" size="large" />
                <Text style={styles.scanText}>{loadingText}</Text>
                <View style={styles.progTrack}>
                  <Animated.View style={[styles.progFill, {
                    width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                  }]} />
                </View>
              </View>
            )}
          </View>
          <View style={styles.idleBottom}>
            <Text style={styles.question}>How are you feeling tonight?</Text>
            <Text style={styles.questionSub}>AI scans your expression, then you confirm</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={handleCapture} disabled={loading} activeOpacity={0.8}>
              <Text style={styles.scanBtnEmoji}>⚡</Text>
              <Text style={styles.scanBtnText}>Scan My Mood</Text>
            </TouchableOpacity>
            {history.length > 0 && (
              <View style={styles.recentRow}>
                <Text style={styles.recentLabel}>RECENT  </Text>
                {history.slice(0, 7).map((s, i) => (
                  <Text key={i} style={styles.recentEmoji}>{MOOD_CONFIG[s.sentimentLabel]?.emoji || '•'}</Text>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      )}

      {/* CONFIRM — Mood selector */}
      {phase === 'confirm' && (
        <ScrollView contentContainerStyle={styles.confirmContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.confirmTitle}>AI detected your mood as:</Text>

          <View style={[styles.aiDetectedBadge, { borderColor: MOOD_CONFIG[aiSuggested]?.color }]}>
            <Text style={styles.aiDetectedEmoji}>{MOOD_CONFIG[aiSuggested]?.emoji}</Text>
            <Text style={[styles.aiDetectedLabel, { color: MOOD_CONFIG[aiSuggested]?.color }]}>
              {MOOD_CONFIG[aiSuggested]?.label}
            </Text>
            <Text style={styles.aiDetectedSub}>Gemini Vision Result</Text>
          </View>

          <Text style={styles.confirmSubtitle}>How are you actually feeling?</Text>
          <Text style={styles.confirmHint}>Tap any mood to select it</Text>

          <View style={styles.moodGrid}>
            {Object.entries(MOOD_CONFIG).map(([key, cfg]) => {
              const selected = sentiment === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.moodChip,
                    { borderColor: cfg.color, backgroundColor: selected ? cfg.color : '#1e1e4a' },
                  ]}
                  onPress={() => setSentiment(key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.moodChipEmoji}>{cfg.emoji}</Text>
                  <Text style={[styles.moodChipLabel, { color: selected ? '#000' : '#fff' }]}>
                    {cfg.label}
                  </Text>
                  {selected && <Text style={{ color: '#000', fontSize: 16, fontWeight: 'bold' }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: MOOD_CONFIG[sentiment]?.color || '#00D4FF' }]}
            onPress={() => handleMoodConfirm(sentiment)}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmBtnText}>
              Confirm  {MOOD_CONFIG[sentiment]?.emoji}  {MOOD_CONFIG[sentiment]?.label}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* LOADING — Generating advice */}
      {phase === 'loading' && (
        <View style={[styles.flex1, styles.center]}>
          <FloatingOrb mood={sentiment} />
          <ActivityIndicator color={moodConfig.color} size="large" style={{ marginTop: 30 }} />
          <Text style={[styles.scanText, { color: moodConfig.color, marginTop: 16 }]}>{loadingText}</Text>
        </View>
      )}

      {/* RESULT */}
      {phase === 'result' && sentiment && (
        <Animated.ScrollView contentContainerStyle={styles.resultScroll} style={{ opacity: fadeAnim }} showsVerticalScrollIndicator={false}>
          <View style={styles.orbArea}>
            <PulseRing color={moodConfig.color} />
            <FloatingOrb mood={sentiment} />
          </View>

          <Animated.View style={{ transform: [{ translateY: slideAnim }] }}>
            <Text style={[styles.moodBig, { color: moodConfig.color }]}>{moodConfig.label}</Text>
            <Text style={styles.moodDesc}>{moodConfig.desc}</Text>

            {advice && (
              <View style={[styles.advCard, { borderColor: moodConfig.color + '50' }]}>
                <View style={styles.advTop}>
                  <Text style={[styles.advStar, { color: moodConfig.color }]}>✦</Text>
                  <Text style={[styles.advTitle, { color: moodConfig.color }]}>AI RECOMMENDATION</Text>
                </View>
                <Text style={styles.advText}>{advice}</Text>
                <View style={[styles.advLine, { backgroundColor: moodConfig.color + '30' }]} />
                <Text style={styles.advPowered}>Powered by Gemini 1.5 Flash</Text>
              </View>
            )}

            <View style={styles.statsRow}>
              {[
                { val: history.length, lbl: 'Sessions' },
                { val: history.filter(s => s.effectivenessFlag).length, lbl: 'Improved' },
                { val: history.length > 0 ? Math.round(history.filter(s => ['happy','neutral'].includes(s.sentimentLabel)).length / history.length * 100) + '%' : '0%', lbl: 'Positive' },
              ].map((s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <View style={styles.statDivider} />}
                  <View style={styles.statBox}>
                    <Text style={[styles.statVal, { color: moodConfig.color }]}>{s.val}</Text>
                    <Text style={styles.statLbl}>{s.lbl}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {history.length > 0 && (
              <View style={styles.histSec}>
                <Text style={styles.histTitle}>SESSION HISTORY</Text>
                {history.slice(0, 10).map((s, i) => {
                  const c = MOOD_CONFIG[s.sentimentLabel] || MOOD_CONFIG.neutral;
                  return (
                    <View key={i} style={[styles.histCard, { borderLeftColor: c.color }]}>
                      <Text style={styles.histEmoji}>{c.emoji}</Text>
                      <View style={styles.histInfo}>
                        <Text style={[styles.histMood, { color: c.color }]}>{c.label}</Text>
                        <Text style={styles.histAdv} numberOfLines={1}>{s.adviceText}</Text>
                      </View>
                      {s.effectivenessFlag && <Text style={styles.improved}>↑</Text>}
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={[styles.doneBtn, { borderColor: moodConfig.color }]} onPress={reset} activeOpacity={0.8}>
              <Text style={[styles.doneTxt, { color: moodConfig.color }]}>✓  New Session</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.ScrollView>
      )}

      {/* Anxious modal */}
      <Modal visible={showAnxiousDialog} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={styles.modalEmo}>🤔</Text>
            <Text style={styles.modalTitle}>Quick check-in</Text>
            <Text style={styles.modalMsg}>Are you feeling worried or nervous about something?</Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#CE93D8' }]} onPress={() => handleAnxiousResponse(true)}>
              <Text style={styles.modalBtnTxt}>Yes, a bit worried</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#1a1a3e' }]} onPress={() => handleAnxiousResponse(false)}>
              <Text style={[styles.modalBtnTxt, { color: '#888' }]}>No, just sad</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  flex1: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 50, paddingBottom: 14, paddingHorizontal: 20,
    backgroundColor: '#13133a', borderBottomWidth: 1, borderBottomColor: '#2a2a5a',
  },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 },
  headerSub: { color: '#00D4FF', fontSize: 9, letterSpacing: 3, marginTop: 2 },
  logoutBtn: { borderWidth: 1, borderColor: '#222', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  logoutText: { color: '#555', fontSize: 10, letterSpacing: 1 },

  cameraWrap: { width: '100%', height: height * 0.42, position: 'relative' },
  camera: { width: '100%', height: '100%' },
  cornerTL: { position: 'absolute', top: 16, left: 16, width: 28, height: 28, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#00D4FF' },
  cornerTR: { position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#00D4FF' },
  cornerBL: { position: 'absolute', bottom: 16, left: 16, width: 28, height: 28, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#00D4FF' },
  cornerBR: { position: 'absolute', bottom: 16, right: 16, width: 28, height: 28, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#00D4FF' },
  camOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  scanText: { color: '#00D4FF', marginTop: 14, fontSize: 13, letterSpacing: 1 },
  progTrack: { width: '55%', height: 2, backgroundColor: '#111', borderRadius: 1, marginTop: 16, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: '#00D4FF', borderRadius: 1 },

  idleBottom: { flex: 1, padding: 22, justifyContent: 'center' },
  question: { color: '#fff', fontSize: 21, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  questionSub: { color: '#444', fontSize: 12, textAlign: 'center', marginBottom: 24, letterSpacing: 0.5 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#00D4FF', backgroundColor: '#0d1a2e', padding: 18, gap: 10 },
  scanBtnEmoji: { fontSize: 18 },
  scanBtnText: { color: '#00D4FF', fontSize: 17, fontWeight: 'bold', letterSpacing: 1 },
  recentRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  recentLabel: { color: '#333', fontSize: 10, letterSpacing: 2 },
  recentEmoji: { fontSize: 18, marginHorizontal: 3 },

  // Confirm screen
  confirmContainer: { padding: 24, paddingBottom: 40 },
  confirmTitle: { color: '#bbb', fontSize: 14, textAlign: 'center', letterSpacing: 1, marginBottom: 16, marginTop: 8 },
  aiDetectedBadge: {
    backgroundColor: '#1e1e4a', borderRadius: 20, padding: 20,
    alignItems: 'center', borderWidth: 2, marginBottom: 28,
  },
  aiDetectedEmoji: { fontSize: 56, marginBottom: 8 },
  aiDetectedLabel: { fontSize: 26, fontWeight: 'bold', letterSpacing: 2, marginBottom: 4 },
  aiDetectedSub: { color: '#aaa', fontSize: 11, letterSpacing: 1 },
  confirmSubtitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  confirmHint: { color: '#aaa', fontSize: 13, textAlign: 'center', marginBottom: 20 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24, justifyContent: 'center' },
  moodChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 2,
    paddingHorizontal: 18, paddingVertical: 16, minWidth: '46%',
  },
  moodChipEmoji: { fontSize: 26 },
  moodChipLabel: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  moodChipCheck: { fontSize: 16, fontWeight: 'bold' },
  confirmBtn: {
    borderRadius: 14, padding: 18,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 17, fontWeight: 'bold', letterSpacing: 1, color: '#000' },

  // Result
  resultScroll: { padding: 20, paddingBottom: 50 },
  orbArea: { alignItems: 'center', justifyContent: 'center', height: 220, marginBottom: 8 },
  pulseRing: { position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 2 },
  orbWrapper: { alignItems: 'center' },
  orbOuter: { width: 170, height: 170, borderRadius: 85, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  orbInner: { width: 130, height: 130, borderRadius: 65, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  orbEmoji: { fontSize: 56 },
  moodBig: { fontSize: 34, fontWeight: 'bold', textAlign: 'center', letterSpacing: 3, marginBottom: 6 },
  moodDesc: { color: '#555', textAlign: 'center', fontSize: 13, marginBottom: 22, letterSpacing: 0.5 },
  advCard: { backgroundColor: '#0d0d2b', borderRadius: 18, padding: 22, marginBottom: 18, borderWidth: 1 },
  advTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  advStar: { fontSize: 14 },
  advTitle: { fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
  advText: { color: '#ddd', fontSize: 16, lineHeight: 25, textAlign: 'center' },
  advLine: { height: 1, marginVertical: 14 },
  advPowered: { color: '#2a2a4a', fontSize: 10, textAlign: 'center', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', backgroundColor: '#0d0d2b', borderRadius: 14, padding: 18, marginBottom: 18, alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 26, fontWeight: 'bold' },
  statLbl: { color: '#444', fontSize: 10, marginTop: 4, letterSpacing: 1 },
  statDivider: { width: 1, height: 36, backgroundColor: '#1a1a3e' },
  histSec: { marginBottom: 18 },
  histTitle: { color: '#333', fontSize: 10, letterSpacing: 2, marginBottom: 10 },
  histCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0d0d2b', borderRadius: 10, padding: 12, marginBottom: 6, borderLeftWidth: 3 },
  histEmoji: { fontSize: 22, marginRight: 10 },
  histInfo: { flex: 1 },
  histMood: { fontSize: 13, fontWeight: 'bold', marginBottom: 2 },
  histAdv: { color: '#333', fontSize: 11 },
  improved: { color: '#4CAF50', fontSize: 16, fontWeight: 'bold' },
  doneBtn: { borderRadius: 14, padding: 17, alignItems: 'center', borderWidth: 1, backgroundColor: '#0a0a1a' },
  doneTxt: { fontSize: 17, fontWeight: 'bold', letterSpacing: 1 },
  permText: { color: '#888', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  glowBtn: { borderRadius: 12, padding: 14, borderWidth: 1 },
  glowBtnText: { fontSize: 15, fontWeight: 'bold' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'center', padding: 28 },
  modalBox: { backgroundColor: '#0d0d2b', borderRadius: 22, padding: 26, borderWidth: 1, borderColor: '#1a1a3e' },
  modalEmo: { fontSize: 44, textAlign: 'center', marginBottom: 10 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  modalMsg: { color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 22, lineHeight: 21 },
  modalBtn: { borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 8 },
  modalBtnTxt: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
});
