// src/services/firebase.js
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const env = import.meta.env || {};

// Config de PRODUCAO (site oficial)
const firebaseConfigProd = {
  apiKey: env.VITE_FIREBASE_API_KEY_PROD,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN_PROD,
  projectId: env.VITE_FIREBASE_PROJECT_ID_PROD,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET_PROD,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID_PROD,
  appId: env.VITE_FIREBASE_APP_ID_PROD,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID_PROD,
};

// Config de DESENVOLVIMENTO (localhost)
const firebaseConfigDev = {
  apiKey: env.VITE_FIREBASE_API_KEY_DEV,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN_DEV,
  projectId: env.VITE_FIREBASE_PROJECT_ID_DEV,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET_DEV,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID_DEV,
  appId: env.VITE_FIREBASE_APP_ID_DEV,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID_DEV,
};

const isPrivateIPv4 = (hostname) => {
  if (!hostname) return false;
  if (hostname.startsWith('10.')) return true;
  if (hostname.startsWith('192.168.')) return true;
  if (hostname.startsWith('172.')) {
    const parts = hostname.split('.');
    const second = Number(parts[1] || 0);
    return second >= 16 && second <= 31;
  }
  return false;
};

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.local') ||
    isPrivateIPv4(window.location.hostname));

const firebaseConfig = isLocalhost ? firebaseConfigDev : firebaseConfigProd;

const defaultApp =
  getApps().find((item) => item.name === '[DEFAULT]') || null;
const app = defaultApp || initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const IS_PRODUCTION = !isLocalhost;
export const auth = getAuth(app);
export const storage = getStorage(app);
