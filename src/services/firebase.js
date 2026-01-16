// src/services/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// 🔴 Config de PRODUÇÃO (site oficial)
const firebaseConfigProd = {
  apiKey: 'AIzaSyDwK4oB4tkKhckcGmxnbT6kfWvN5gvtYpc',
  authDomain: 'oeemetalosa.firebaseapp.com',
  projectId: 'oeemetalosa',
  storageBucket: 'oeemetalosa.firebasestorage.app',
  messagingSenderId: '794264676568',
  appId: '1:794264676568:web:24bad76eace9c8adbb8fad',
};

// 🟡 Config de DESENVOLVIMENTO (localhost)
const firebaseConfigDev = {
  apiKey: 'AIzaSyBHjj9mxW2qLoAcfaMHmg52GZKmech5cEE',
  authDomain: 'oeemetalosa-dev.firebaseapp.com',
  projectId: 'oeemetalosa-dev',
  storageBucket: 'oeemetalosa-dev.firebasestorage.app',
  messagingSenderId: '1009402896154',
  appId: '1:1009402896154:web:47d2511e55c807833fd6a3',
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
  apiKey: 'AIzaSyBO4P9ycGOkaJf6HqPf0kQJetbQfHASHXg',
  authDomain: 'slitter-app.firebaseapp.com',
  projectId: 'slitter-app',
  storageBucket: 'slitter-app.firebasestorage.app',
  messagingSenderId: '997319292404',
  appId: '1:997319292404:web:a98408731c254314ccb5a1',
  measurementId: 'G-33PGY02BYY',
};

const slitterApp =
  getApps().find((item) => item.name === 'slitter-app') ||
  initializeApp(firebaseConfigSlitter, 'slitter-app');

// Slitter: somente leitura (saldo de perfis).
export const dbSlitterReadOnly = getFirestore(slitterApp);
    
