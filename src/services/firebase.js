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

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

const firebaseConfig = isLocalhost ? firebaseConfigDev : firebaseConfigProd;

const defaultApp =
  getApps().find((item) => item.name === '[DEFAULT]') || null;
const app = defaultApp || initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const IS_PRODUCTION = !isLocalhost;
export const auth = getAuth(app);
export const storage = getStorage(app);

const firebaseConfigSlitter = {
  apiKey: env.VITE_SLITTER_API_KEY,
  authDomain: env.VITE_SLITTER_AUTH_DOMAIN,
  projectId: env.VITE_SLITTER_PROJECT_ID,
  storageBucket: env.VITE_SLITTER_STORAGE_BUCKET,
  messagingSenderId: env.VITE_SLITTER_MESSAGING_SENDER_ID,
  appId: env.VITE_SLITTER_APP_ID,
  measurementId: env.VITE_SLITTER_MEASUREMENT_ID,
};

const slitterApp =
  getApps().find((item) => item.name === 'slitter-app') ||
  initializeApp(firebaseConfigSlitter, 'slitter-app');

// Slitter: somente leitura (saldo de perfis).
export const dbSlitterReadOnly = getFirestore(slitterApp);
