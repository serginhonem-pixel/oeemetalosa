// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // Se for usar banco de dados
// import { getAuth } from "firebase/auth"; // Se for ter login

const firebaseConfig = {
  apiKey: "AIzaSyDwk...", // Copie EXATAMENTE como está na sua imagem
  authDomain: "oeemetalosa.firebaseapp.com",
  projectId: "oeemetalosa",
  storageBucket: "oeemetalosa.firebasestorage.app",
  messagingSenderId: "794264676568",
  appId: "1:794264676568:web:...",
  measurementId: "G-P42PSYYWDE"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta o banco de dados para usar no resto do app
export const db = getFirestore(app);
// export const auth = getAuth(app);