import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDIT5M4E3rZHSubXFR0nxxg4V6ee1jvu_M",
  authDomain: "blood-donor-app-7b2b8.firebaseapp.com",
  projectId: "blood-donor-app-7b2b8",
  storageBucket: "blood-donor-app-7b2b8.firebasestorage.app",
  messagingSenderId: "477753052987",
  appId: "1:477753052987:web:ea3c1dfafd8ebd03e7711e"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;