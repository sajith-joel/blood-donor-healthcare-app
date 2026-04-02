import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDIT5M4E3rZHSubXFR0nxxg4V6ee1jvu_M",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "blood-donor-app-7b2b8.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "blood-donor-app-7b2b8",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "blood-donor-app-7b2b8.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "477753052987",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:477753052987:web:ea3c1dfafd8ebd03e7711e",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;