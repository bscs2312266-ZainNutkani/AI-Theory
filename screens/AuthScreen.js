import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, StatusBar, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ensureUserProfile } from '../services/firestoreService';
import { C, SHADOW, TYPE, S } from '../theme';

export default function AuthScreen({ onLogin }) {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  async function handleSubmit() {
    if (!email || !password) { Alert.alert('Missing fields', 'Please enter your email and password.'); return; }
    setLoading(true);
    try {
      let result;
      if (isRegister) {
        result = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
      }
      await ensureUserProfile(result.user.uid);
      onLogin(result.user.uid);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / hero area */}
        <View style={styles.hero}>
          <LinearGradient
            colors={[C.blue, C.teal]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.logoWrap, SHADOW.md]}
          >
            <Text style={styles.logoEmoji}>🪞</Text>
          </LinearGradient>
          <Text style={styles.appName}>MirrorMind</Text>
          <Text style={styles.appTagline}>Your daily reflection companion</Text>
        </View>

        {/* Auth card */}
        <View style={[styles.card, SHADOW.md]}>
          <Text style={styles.cardTitle}>
            {isRegister ? 'Create Account' : 'Welcome back'}
          </Text>
          <Text style={styles.cardSub}>
            {isRegister
              ? 'Start your emotional wellness journey'
              : 'Continue your reflection practice'}
          </Text>

          {/* Email */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor={C.label4}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={C.label4}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Primary button */}
          <TouchableOpacity
            style={[styles.submitBtn, SHADOW.sm, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>
                  {isRegister ? 'Create Account' : 'Sign In'}
                </Text>
            }
          </TouchableOpacity>

          {/* Toggle */}
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setIsRegister(!isRegister)}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>
              {isRegister ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.toggleLink}>
                {isRegister ? 'Sign In' : 'Register'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Features row */}
        <View style={styles.featuresRow}>
          {[
            { icon: '🤖', label: 'AI Mood Scan'  },
            { icon: '🔒', label: 'COPPA 2025'    },
            { icon: '📊', label: 'Daily Insights' },
          ].map((f, i) => (
            <View key={i} style={[styles.featureChip, SHADOW.xs]}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footer}>CSC4101 · SZABIST · Spring 2026</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: S.screenPad, paddingTop: 60, paddingBottom: 32, justifyContent: 'center' },

  // Hero
  hero: { alignItems: 'center', marginBottom: 36 },
  logoWrap: { width: 88, height: 88, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  logoEmoji:  { fontSize: 42 },
  appName:    { ...TYPE.screenTitle, color: C.label, marginBottom: 6 },
  appTagline: { ...TYPE.body, color: C.label3, textAlign: 'center' },

  // Card
  card: {
    backgroundColor: C.surface, borderRadius: S.cardRadiusLg,
    padding: 24, marginBottom: 20,
  },
  cardTitle: { ...TYPE.sectionHead, color: C.label, marginBottom: 4 },
  cardSub:   { ...TYPE.caption, color: C.label3, marginBottom: 24 },

  // Fields
  fieldWrap:  { marginBottom: 16 },
  fieldLabel: { ...TYPE.micro, color: C.label3, marginBottom: 8, letterSpacing: 0.8 },
  input: {
    backgroundColor: C.bgAlt, borderRadius: 14, padding: 14,
    fontSize: 15, color: C.label, fontWeight: '400',
    borderWidth: 1, borderColor: C.sep,
    minHeight: 50,
  },

  // Submit
  submitBtn: {
    backgroundColor: C.label, borderRadius: S.pillRadius,
    paddingVertical: 17, alignItems: 'center',
    marginTop: 6, marginBottom: 20,
    minHeight: 54,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Toggle
  toggleRow:  { alignItems: 'center', paddingVertical: 4 },
  toggleText: { ...TYPE.body, color: C.label3 },
  toggleLink: { color: C.accent, fontWeight: '700' },

  // Features
  featuresRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 24 },
  featureChip: {
    backgroundColor: C.surface, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center', gap: 4,
  },
  featureIcon:  { fontSize: 20 },
  featureLabel: { ...TYPE.micro, color: C.label3, fontSize: 10 },

  footer: { ...TYPE.micro, color: C.labelMuted, textAlign: 'center', fontSize: 10 },
});
