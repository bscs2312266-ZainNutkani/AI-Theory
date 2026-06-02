import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './services/firebase';
import AuthScreen from './screens/AuthScreen';
import CheckInScreen from './screens/CheckInScreen';

export default function App() {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setUid(user ? user.uid : null);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8B1A1A" />
      </View>
    );
  }

  if (!uid) {
    return <AuthScreen onLogin={setUid} />;
  }

  return <CheckInScreen uid={uid} onLogout={() => setUid(null)} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
