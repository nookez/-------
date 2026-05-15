import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc, // <--- เพิ่มตรงนี้
  arrayUnion,
  arrayRemove,
  increment,
  query,
  orderBy,
  where,
  getCountFromServer,
  startAfter,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, uploadBytes, getDownloadURL, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBPp9C2vft_c3Xv5QL7lvuDbiS9f0UvSjk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'find-b3bfe.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'find-b3bfe',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'find-b3bfe.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '144229969193',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:144229969193:web:0fa2e8e1c42dd8cac95b38',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-1EY8SF8MN6',
};

const app = initializeApp(firebaseConfig);
const analytics = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ? getAnalytics(app) : null;
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Use Storage emulator in development to avoid CORS / billing issues
if (import.meta.env.DEV) {
  try {
    connectStorageEmulator(storage, 'localhost', 9199);
    // eslint-disable-next-line no-console
    console.info('Connected to Storage emulator at localhost:9199');
  } catch (e) {
    // ignore if emulator not available
  }
}

export {
  app,
  analytics,
  auth,
  db,
  storage,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  collection,
  addDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc, // <--- เพิ่มตรงนี้ในรายการ export
  arrayUnion,
  arrayRemove,
  increment,
  where,
  getCountFromServer,
  query,
  orderBy,
  startAfter,
  limit,
  onSnapshot,
  getDocs,
  serverTimestamp,
  Timestamp,
  ref,
  uploadBytesResumable,
  uploadBytes,
  getDownloadURL,
};
export type { User };