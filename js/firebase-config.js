// ============================================================
// CONFIGURACIÓN DE FIREBASE
// ------------------------------------------------------------
// 1. Ve a https://console.firebase.google.com → tu proyecto →
//    ⚙️ Configuración del proyecto → General → "Tus apps" → Web.
// 2. Copia el objeto firebaseConfig que te da Firebase y
//    reemplaza el de abajo.
// 3. Habilita Authentication → Método de acceso → Correo/contraseña.
// 4. Crea Firestore Database (modo producción) y sube
//    firestore.rules (Firestore → Reglas) con el contenido del
//    archivo firestore.rules de este proyecto.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
 apiKey: "AIzaSyBWdKIpCIdgQIXmb3pLL3QkZ7H9KpKzuR0",
  authDomain: "del-horno.firebaseapp.com",
  projectId: "del-horno",
  storageBucket: "del-horno.firebasestorage.app",
  messagingSenderId: "782553370053",
  appId: "1:782553370053:web:35231fe23bc19c1b308fac",
  measurementId: "G-52SHDPLG4V"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence).catch(() => {});
