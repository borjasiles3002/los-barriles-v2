import {
  collection, doc, addDoc, updateDoc, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Alerta, AlertaTipo } from '../types';

export async function crearAlerta(
  tipo: AlertaTipo,
  mensaje: string,
  datos: Record<string, unknown>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'alertas'), {
    tipo,
    mensaje,
    datos,
    leido: false,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function marcarAlertaLeida(alertaId: string): Promise<void> {
  await updateDoc(doc(db, 'alertas', alertaId), { leido: true });
}

export async function marcarTodasAlertasLeidas(): Promise<void> {
  const snap = await getDocs(query(collection(db, 'alertas'), where('leido', '==', false)));
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { leido: true })));
}

export type { Alerta };
