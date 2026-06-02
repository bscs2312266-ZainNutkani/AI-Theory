import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get these values from:
// console.firebase.google.com -> mirrormind-hassan -> Project Settings -> Your apps -> Web app
// If no web app exists, click "Add app" -> Web -> register it -> copy the config below
const firebaseConfig = {
  apiKey: "AIzaSyAnODAc0K6h9CouW7iJ_mgL2Ed-dKY_2uM",
  authDomain: "mirrormind-hassan.firebaseapp.com",
  projectId: "mirrormind-hassan",
  storageBucket: "mirrormind-hassan.firebasestorage.app",
  messagingSenderId: "547473564290",
  appId: "1:547473564290:web:6ff45141e5a97a54fc4a9b",
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});
export const db = getFirestore(app);
