import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import { ensureUserProfile } from './services/firestoreService';
import { C, SHADOW } from './theme';

import AuthScreen        from './screens/AuthScreen';
import DashboardScreen   from './screens/DashboardScreen';
import CheckInScreen     from './screens/CheckInScreen';
import HistoryScreen     from './screens/HistoryScreen';
import ParentAlertScreen from './screens/ParentAlertScreen';
import SettingsScreen    from './screens/SettingsScreen';

// Thin-line tab icons using styled Unicode — matches reference image 4 aesthetic
const TAB_ICONS = {
  dashboard: ({ active, color }) => (
    <View style={[tabIcon.wrap, active && { backgroundColor: C.accentSoft }]}>
      <Text style={[tabIcon.char, { color }]}>⌂</Text>
    </View>
  ),
  checkin: ({ active, color }) => (
    <View style={[tabIcon.wrap, active && { backgroundColor: C.accentSoft }]}>
      <Text style={[tabIcon.char, { color }]}>◎</Text>
    </View>
  ),
  history: ({ active, color }) => (
    <View style={[tabIcon.wrap, active && { backgroundColor: C.accentSoft }]}>
      <Text style={[tabIcon.char, { color }]}>≡</Text>
    </View>
  ),
  alerts: ({ active, color }) => (
    <View style={[tabIcon.wrap, active && { backgroundColor: C.accentSoft }]}>
      <Text style={[tabIcon.char, { color }]}>♡</Text>
    </View>
  ),
  settings: ({ active, color }) => (
    <View style={[tabIcon.wrap, active && { backgroundColor: C.accentSoft }]}>
      <Text style={[tabIcon.char, { color }]}>···</Text>
    </View>
  ),
};

const TABS = [
  { id: 'dashboard', label: 'Home'    },
  { id: 'checkin',   label: 'Scan'    },
  { id: 'history',   label: 'Journal' },
  { id: 'alerts',    label: 'Family'  },
  { id: 'settings',  label: 'More'    },
];

export default function App() {
  const [user, setUser]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [screen, setScreen]         = useState('dashboard');
  const [dashboardKey, setDashboardKey] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathing animation for logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1800, useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();

    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        await ensureUserProfile(u.uid).catch(() => {});
        setUser(u);
      } else {
        setUser(null);
        setScreen('dashboard');
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const navigate = (s) => {
    setScreen(s);
    // Force dashboard to fully remount and reload fresh data every time we navigate to it
    if (s === 'dashboard') setDashboardKey(k => k + 1);
  };
  const handleLogout = () => { setUser(null); setScreen('dashboard'); };

  if (loading) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <LinearGradient
            colors={['#6B9FE4', '#72CFBE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.splashLogo}
          >
            <Text style={styles.splashEmoji}>🪞</Text>
          </LinearGradient>
        </Animated.View>
        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Text style={styles.splashTitle}>MirrorMind</Text>
          <Text style={styles.splashSub}>Your daily reflection companion</Text>
        </Animated.View>
      </View>
    );
  }

  if (!user) return <AuthScreen onLogin={setUser} />;

  const renderScreen = () => {
    switch (screen) {
      case 'dashboard': return <DashboardScreen key={dashboardKey} uid={user.uid} navigate={navigate} />;
      case 'checkin':   return <CheckInScreen   uid={user.uid} navigate={navigate} onLogout={handleLogout} userEmail={user.email} />;
      case 'history':   return <HistoryScreen   uid={user.uid} navigate={navigate} />;
      case 'alerts':    return <ParentAlertScreen uid={user.uid} navigate={navigate} />;
      case 'settings':  return <SettingsScreen  uid={user.uid} navigate={navigate} onLogout={handleLogout} userEmail={user.email} />;
      default:          return <DashboardScreen uid={user.uid} navigate={navigate} />;
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={styles.content}>{renderScreen()}</View>

      {/* iOS-style tab bar — matches reference image 4 */}
      <View style={styles.tabBar}>
        <View style={styles.tabBarLine} />
        {TABS.map(tab => {
          const active = screen === tab.id;
          const color  = active ? C.accent : C.label4;
          const Icon   = TAB_ICONS[tab.id];
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => navigate(tab.id)}
              activeOpacity={0.7}
            >
              <Icon active={active} color={color} />
              <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const tabIcon = StyleSheet.create({
  wrap: { width: 36, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  char: { fontSize: 18, fontWeight: '300' },
});

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: { flex: 1 },

  splash: {
    flex: 1, backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center', gap: 24,
  },
  splashLogo: {
    width: 96, height: 96, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  splashEmoji: { fontSize: 46 },
  splashTitle: {
    color: C.label, fontSize: 36, fontWeight: '700',
    letterSpacing: -1, textAlign: 'center',
  },
  splashSub: {
    color: C.label3, fontSize: 15, fontWeight: '400',
    textAlign: 'center', marginTop: 4,
  },

  // Tab bar — clean, native iOS feel
  tabBar: {
    backgroundColor: C.surface,
    paddingBottom: 24,
    paddingTop: 8,
    flexDirection: 'row',
  },
  tabBarLine: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 0.5, backgroundColor: C.sep,
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingTop: 2,
    minHeight: 44,
  },
  tabLabel: {
    fontSize: 10, fontWeight: '500', letterSpacing: 0.1,
  },
});
