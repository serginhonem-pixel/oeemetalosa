// src/services/firebase.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const IS_PRODUCTION = !isLocalhost;
export const auth = getAuth(app);
    
