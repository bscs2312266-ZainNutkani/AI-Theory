import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { ensureUserProfile } from '../services/firestoreService';

export default function AuthScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  async function handleSubmit() {
    if (!email || !password) { Alert.alert('Error', 'Please enter email and password.'); return; }
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
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />
      <View style={styles.logoArea}>
        <View style={styles.logoOrb}>
          <Text style={styles.logoEmoji}>🪞</Text>
        </View>
        <Text style={styles.title}>MirrorMind</Text>
        <Text style={styles.subtitle}>EMOTIONAL INTELLIGENCE AI</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{isRegister ? 'Create Account' : 'Welcome Back'}</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="your@email.com"
            placeholderTextColor="#333"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
        <View style={styles.inputWrap}>
          <Text style={styles.inputLabel}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#333"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>
        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading} activeOpacity={0.8}>
          {loading
            ? <ActivityIndicator color="#0a0a1a" />
            : <Text style={styles.btnText}>{isRegister ? 'CREATE ACCOUNT' : 'LOGIN'}</Text>
          }
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsRegister(!isRegister)} style={styles.toggle}>
          <Text style={styles.toggleText}>
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <Text style={styles.toggleLink}>{isRegister ? 'Login' : 'Register'}</Text>
          </Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.footer}>CSC4101  ·  SZABIST  ·  Spring 2026</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a', justifyContent: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 36 },
  logoOrb: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#0d1a2e', borderWidth: 2, borderColor: '#00D4FF',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoEmoji: { fontSize: 40 },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold', letterSpacing: 2, marginBottom: 4 },
  subtitle: { color: '#00D4FF', fontSize: 9, letterSpacing: 4 },
  card: { backgroundColor: '#0d0d2b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1a1a3e' },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 24, letterSpacing: 1 },
  inputWrap: { marginBottom: 16 },
  inputLabel: { color: '#333', fontSize: 10, letterSpacing: 2, marginBottom: 8 },
  input: { backgroundColor: '#111', borderWidth: 1, borderColor: '#1a1a3e', borderRadius: 12, padding: 14, fontSize: 15, color: '#fff' },
  btn: { backgroundColor: '#00D4FF', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  btnText: { color: '#0a0a1a', fontSize: 14, fontWeight: 'bold', letterSpacing: 2 },
  toggle: { alignItems: 'center' },
  toggleText: { color: '#444', fontSize: 13 },
  toggleLink: { color: '#00D4FF', fontWeight: 'bold' },
  footer: { color: '#222', textAlign: 'center', fontSize: 10, letterSpacing: 1, marginTop: 24 },
});
