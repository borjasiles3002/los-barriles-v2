import {
  collection, doc, setDoc, updateDoc, getDocs,
  query, where, onSnapshot,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { AppUser, Role } from '../types';
import { hashPin } from '../utils/crypto';

const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY as string;

// ─── Crear trabajador (Auth + Firestore) ─────────────────────────────────────

export async function crearTrabajador(data: {
  email:     string;
  password:  string;
  nombre:    string;
  apellidos: string;
  telefono:  string;
  role:      Role;
  pin:       string;
}): Promise<string> {
  // 1. Crear usuario en Firebase Auth via REST API
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: data.email, password: data.password, returnSecureToken: true }),
    },
  );
  const authData = await authRes.json() as { localId?: string; error?: { message: string } };
  if (!authRes.ok || !authData.localId) {
    throw new Error(authData.error?.message ?? 'Error creando usuario en Auth');
  }
  const uid = authData.localId;

  // 2. Hash del PIN
  const pinHash = await hashPin(data.pin);

  // 3. Documento en Firestore
  await setDoc(doc(db, 'usuarios', uid), {
    uid,
    email:     data.email,
    nombre:    data.nombre,
    apellidos: data.apellidos,
    telefono:  data.telefono,
    role:      data.role,
    pinHash,
    activo:    true,
    fechaAlta: new Date().toISOString(),
    avatar:    (data.nombre[0] + (data.apellidos[0] ?? '')).toUpperCase(),
  } satisfies Omit<AppUser, 'activo'> & { activo: boolean; pinHash: string; avatar: string; fechaAlta: string });

  return uid;
}

// ─── Actualizar trabajador ────────────────────────────────────────────────────

export async function actualizarTrabajador(
  uid: string,
  updates: Partial<Pick<AppUser, 'nombre' | 'apellidos' | 'telefono' | 'role' | 'activo'>> & { pin?: string },
): Promise<void> {
  const data: Record<string, unknown> = { ...updates };
  if (updates.pin) {
    data['pinHash'] = await hashPin(updates.pin);
    delete data['pin'];
  }
  await updateDoc(doc(db, 'usuarios', uid), data);
}

// ─── Desactivar trabajador ────────────────────────────────────────────────────

export async function desactivarTrabajador(uid: string): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid), { activo: false });
}

export async function activarTrabajador(uid: string): Promise<void> {
  await updateDoc(doc(db, 'usuarios', uid), { activo: true });
}

// ─── Suscripción en tiempo real ───────────────────────────────────────────────

export function subscribePersonal(
  callback: (trabajadores: AppUser[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'usuarios'));
  return onSnapshot(q, snap => {
    const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }) as AppUser);
    callback(data);
  });
}

// ─── Obtener trabajador por PIN hash ─────────────────────────────────────────

export async function getTrabajadorPorPin(pin: string): Promise<AppUser | null> {
  const pinHash = await hashPin(pin);
  // pinHash es suficientemente selectivo; comprobamos activo en JS
  const snap = await getDocs(
    query(collection(db, 'usuarios'), where('pinHash', '==', pinHash)),
  );
  const doc = snap.docs.find(d => d.data().activo !== false);
  if (!doc) return null;
  return { uid: doc.id, ...doc.data() } as AppUser;
}
