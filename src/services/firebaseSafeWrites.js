// src/services/firebaseSafeWrites.js
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, IS_PRODUCTION } from './firebase';

// ADD
export async function safeAddDoc(path, data) {
  if (!IS_PRODUCTION) {
    console.log('[DEV][Firestore] addDoc bloqueado →', path, data);
    // opcional: simular id
    return { id: `dev-${Date.now()}` };
  }
  const colRef = collection(db, path);
  const docRef = await addDoc(colRef, data);
  return docRef;
}

// UPDATE
export async function safeUpdateDoc(path, id, data) {
  if (!IS_PRODUCTION) {
    console.log('[DEV][Firestore] updateDoc bloqueado →', `${path}/${id}`, data);
    return;
  }
  const ref = doc(db, path, id);
  await updateDoc(ref, data);
}

// SET
export async function safeSetDoc(path, id, data, options) {
  if (!IS_PRODUCTION) {
    console.log('[DEV][Firestore] setDoc bloqueado →', `${path}/${id}`, data, options);
    return;
  }
  const ref = doc(db, path, id);
  await setDoc(ref, data, options);
}

// DELETE
export async function safeDeleteDoc(path, id) {
  if (!IS_PRODUCTION) {
    console.log('[DEV][Firestore] deleteDoc bloqueado →', `${path}/${id}`);
    return;
  }
  const ref = doc(db, path, id);
  await deleteDoc(ref);
}
