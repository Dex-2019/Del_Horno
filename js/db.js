// ============================================================
// DB — helpers genéricos de Firestore usados por todos los módulos
// ============================================================

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export async function listAll(col, orderField = null, dir = "desc") {
  const ref = collection(db, col);
  const q = orderField ? query(ref, orderBy(orderField, dir)) : ref;
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function listWhere(col, field, op, value, orderField = null, dir = "desc") {
  const ref = collection(db, col);
  const clauses = [where(field, op, value)];
  const q = orderField ? query(ref, ...clauses, orderBy(orderField, dir)) : query(ref, ...clauses);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getOne(col, id) {
  const snap = await getDoc(doc(db, col, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createDoc(col, data) {
  const ref = await addDoc(collection(db, col), {
    ...data,
    creadoEn: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDocById(col, id, data) {
  await updateDoc(doc(db, col, id), { ...data, actualizadoEn: serverTimestamp() });
}

export async function deleteDocById(col, id) {
  await deleteDoc(doc(db, col, id));
}
