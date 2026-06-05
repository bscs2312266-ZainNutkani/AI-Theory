import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Animated, StatusBar, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { deleteAllUserData } from '../services/firestoreService';
import { C, TYPE, S, SHADOW } from '../theme';
import { getParentEmail, setParentEmail, removeParentEmail, sendParentAlertEmail } from '../services/emailService';

export default function SettingsScreen({ uid, userEmail, onLogout }) {
  const [deleting, setDeleting]             = useState(false);
  const [parentEmail, setParentEmailState]  = useState('');
  const [savedEmail, setSavedEmail]         = useState('');
  const [savingEmail, setSavingEmail]       = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();
    // Load stored parent email
    getParentEmail().then(e => {
      if (e) { setParentEmailState(e); setSavedEmail(e); }
    });
  }, []);

  async function handleSaveParentEmail() {
    if (!parentEmail.trim() || !parentEmail.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setSavingEmail(true);
    const ok = await setParentEmail(parentEmail.trim());
    if (ok) { setSavedEmail(parentEmail.trim()); Alert.alert('Saved', 'Parent email saved. They will be notified if a safety alert triggers.'); }
    else { Alert.alert('Error', 'Could not save. Please try again.'); }
    setSavingEmail(false);
  }

  async function handleRemoveParentEmail() {
    await removeParentEmail();
    setParentEmailState(''); setSavedEmail('');
  }

  async function handleTestEmail() {
    if (!savedEmail) { Alert.alert('No email saved', 'Save a parent email first.'); return; }
    Alert.alert('Sending...', `Testing email to ${savedEmail}`);
    const result = await sendParentAlertEmail({ parentEmail: savedEmail, childEmail: userEmail });
    if (result.ok) {
      Alert.alert('Email sent successfully', `Check ${savedEmail} inbox. It may take 1-2 minutes to arrive.`);
    } else {
      Alert.alert(
        'Email failed',
        `Status: ${result.status || 'N/A'}\nError: ${result.error || result.body || 'Unknown'}\n\nMake sure the EmailJS template "To Email" field is set to {{to_email}}`
      );
    }
  }

  async function handleSignOut() { await signOut(auth); onLogout(); }

  function handleDeleteData() {
    Alert.alert(
      'Delete All Data',
      'Permanently deletes all check-in history and account data. Cannot be undone.\n\nProvided under COPPA 2025 right-to-erasure.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try { await deleteAllUserData(uid); await signOut(auth); onLogout(); }
          catch { Alert.alert('Error', 'Could not delete. Please try again.'); setDeleting(false); }
        }},
      ]
    );
  }

  const SECTIONS = [
    {
      title: 'COPPA 2025 COMPLIANCE',
      items: [
        { label: 'Biometric data stored', value: 'None (device only)',        color: C.success },
        { label: 'Data on server',        value: 'Labels and timestamps',    color: C.success },
        { label: 'Parental consent',      value: 'Active',                   color: C.success },
        { label: 'Targeted advertising',  value: 'None (prohibited)',        color: C.success },
        { label: 'Data minimisation',     value: 'Enforced at DB layer',     color: C.success },
      ],
    },
    {
      title: 'THREE-AGENT SYSTEM',
      items: [
        { label: 'Sentiment Reflex Agent', value: 'Groq Llama 4 Scout', color: C.blue   },
        { label: 'Counseling Agent',       value: 'Groq Llama 3.1 8B',  color: C.purple },
        { label: 'Reflection Agent',       value: 'On-device (local)',   color: C.yellow },
        { label: 'Database',               value: 'Firebase Firestore',  color: C.success},
      ],
    },
    {
      title: 'PROJECT INFO',
      items: [
        { label: 'Course',     value: 'CSC4101: Artificial Intelligence',  color: null },
        { label: 'University', value: 'SZABIST, Karachi',                  color: null },
        { label: 'Team Lead',  value: 'Zain Nutkani (2312266)',            color: null },
        { label: 'Phase',      value: 'Phases 1 to 5 Complete',            color: C.success },
      ],
    },
  ];

  const avatarLetter = (userEmail || 'U')[0].toUpperCase();

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      contentContainerStyle={{ paddingBottom: 52 }}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSub}>Account & compliance</Text>
      </View>

      {/* Profile card */}
      <LinearGradient
        colors={[C.blue, C.teal]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.profileCard, SHADOW.md]}
      >
        <View style={styles.avatarWrap}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileEmail}>{userEmail || 'Not signed in'}</Text>
          <Text style={styles.profileId}>ID: {uid ? uid.slice(0, 16) + '...' : 'N/A'}</Text>
        </View>
      </LinearGradient>

      {/* Info sections */}
      {/* Parent Email Alert Section */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PARENT ALERT EMAIL</Text>
        <View style={[styles.sectionCard, SHADOW.xs]}>
          <View style={styles.emailInfo}>
            <Text style={styles.emailInfoText}>
              When a G2 safety alert triggers (3 consecutive low-mood check-ins), an email is automatically sent to this address.
            </Text>
          </View>
          <View style={styles.emailRow}>
            <TextInput
              style={styles.emailInput}
              placeholder="parent@example.com"
              placeholderTextColor={C.label4}
              value={parentEmail}
              onChangeText={setParentEmailState}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.emailSaveBtn, savingEmail && { opacity: 0.6 }]}
              onPress={handleSaveParentEmail}
              disabled={savingEmail}
              activeOpacity={0.8}
            >
              <Text style={styles.emailSaveBtnText}>{savingEmail ? '...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          {savedEmail ? (
            <View style={styles.savedRow}>
              <View style={styles.savedDot} />
              <Text style={styles.savedText}>{savedEmail}</Text>
              <TouchableOpacity onPress={handleRemoveParentEmail}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Test button */}
          {savedEmail ? (
            <TouchableOpacity style={styles.testEmailBtn} onPress={handleTestEmail} activeOpacity={0.8}>
              <Text style={styles.testEmailText}>Send Test Email Now</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.emailHint}>
          Requires EmailJS setup (free). See services/emailService.js for instructions.
        </Text>
      </View>

      {SECTIONS.map((sec, si) => (
        <View key={si} style={styles.section}>
          <Text style={styles.sectionLabel}>{sec.title}</Text>
          <View style={[styles.sectionCard, SHADOW.xs]}>
            {sec.items.map((item, ii) => (
              <View key={ii} style={[styles.row, ii < sec.items.length - 1 && styles.rowDivider]}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={[styles.rowValue, item.color && { color: item.color, fontWeight: '600' }]}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>ACTIONS</Text>
        <TouchableOpacity style={[styles.signOutBtn, SHADOW.xs]} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteBtn, SHADOW.xs, deleting && { opacity: 0.5 }]}
          onPress={handleDeleteData} disabled={deleting} activeOpacity={0.8}
        >
          <Text style={styles.deleteText}>{deleting ? 'Deleting…' : '⚠  Delete All My Data'}</Text>
          <Text style={styles.deleteSub}>COPPA 2025 right-to-erasure</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>MirrorMind v1.0 · SZABIST CSC4101 Spring 2026</Text>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header:      { paddingTop: 60, paddingHorizontal: S.screenPad, paddingBottom: 22 },
  headerTitle: { ...TYPE.screenTitle, color: C.label },
  headerSub:   { ...TYPE.caption, color: C.label3, marginTop: 4 },

  profileCard: {
    marginHorizontal: S.screenPad, marginBottom: S.sectionGap,
    borderRadius: S.cardRadiusLg, padding: 22,
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  avatarWrap:  { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontSize: 24, fontWeight: '700' },
  profileEmail:{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  profileId:   { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' },

  section:      { marginHorizontal: S.screenPad, marginBottom: S.sectionGap },
  sectionLabel: { ...TYPE.micro, color: C.label3, marginBottom: 10 },
  sectionCard:  { backgroundColor: C.surface, borderRadius: S.cardRadius, overflow: 'hidden' },

  row:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 15, gap: 10 },
  rowDivider:  { borderBottomWidth: 0.5, borderBottomColor: C.sep },
  rowLabel:    { ...TYPE.body, color: C.label2, flex: 1 },
  rowValue:    { ...TYPE.caption, color: C.label3, fontWeight: '500', maxWidth: '55%', textAlign: 'right' },

  signOutBtn:  { backgroundColor: C.surface, borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 10 },
  signOutText: { ...TYPE.cardTitle, color: C.label },

  deleteBtn:   { backgroundColor: C.danger + '10', borderRadius: 16, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: C.danger + '30' },
  deleteText:  { ...TYPE.cardTitle, color: C.danger, marginBottom: 3 },
  deleteSub:   { ...TYPE.micro, color: C.danger + '80', fontSize: 10 },

  version: { ...TYPE.micro, color: C.label4, textAlign: 'center', marginTop: 4, fontSize: 10 },

  // Parent email
  emailInfo:    { padding: 14, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: C.sep },
  emailInfoText:{ ...TYPE.caption, color: C.label2, lineHeight: 17 },
  emailRow:     { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  emailInput: {
    flex: 1, backgroundColor: C.bgAlt, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, color: C.label, borderWidth: 1, borderColor: C.sep,
  },
  emailSaveBtn:     { backgroundColor: C.label, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, alignItems: 'center', minWidth: 64 },
  emailSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  savedRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 12 },
  savedDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  savedText: { ...TYPE.caption, color: C.label2, flex: 1 },
  removeText:{ ...TYPE.caption, color: C.danger, fontWeight: '600' },
  emailHint:    { ...TYPE.micro, color: C.label4, fontSize: 10, marginTop: 6, paddingHorizontal: 2 },
  testEmailBtn: { margin: 12, marginTop: 4, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  testEmailText:{ color: '#fff', fontSize: 14, fontWeight: '700' },
});
