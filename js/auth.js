// ============================================================
// AUTH — inicio/cierre de sesión y resolución de rol de usuario
// ------------------------------------------------------------
// El rol (administrador | socio) se guarda en Firestore, en la
// colección "usuarios", con el UID de Firebase Auth como ID de
// documento. Ejemplo de documento:
//   usuarios/{uid}  ->  { nombre: "Juan Pérez", rol: "administrador" }
// El primer usuario creado en Firebase Authentication debe tener
// su documento correspondiente creado a mano en Firestore la
// primera vez (rol: "administrador").
// ============================================================

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export let currentUser = null;   // { uid, email }
export let currentProfile = null; // { nombre, rol }

export function isAdmin() {
  return currentProfile?.rol === "administrador";
}

export async function login(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
}

async function loadProfile(uid) {
  const snap = await getDoc(doc(db, "usuarios", uid));
  if (snap.exists()) {
    currentProfile = snap.data();
  } else {
    // Sin documento de perfil: se trata como socio (solo lectura) por seguridad.
    currentProfile = { nombre: "Usuario", rol: "socio" };
  }
}

// onReady(callback) — se llama cada vez que cambia el estado de sesión.
// callback recibe (user, profile) o (null, null) si no hay sesión.
export function onAuthReady(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = { uid: user.uid, email: user.email };
      await loadProfile(user.uid);
    } else {
      currentUser = null;
      currentProfile = null;
    }
    callback(currentUser, currentProfile);
  });
}
