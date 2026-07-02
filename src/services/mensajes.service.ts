import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Conversacion, Mensaje } from '../types';

// ─── Obtener o crear conversación entre dos usuarios ──────────────────────────

export async function getOCrearConversacion(
  uid1: string, nombre1: string,
  uid2: string, nombre2: string,
): Promise<string> {
  const [a, b]    = [uid1, uid2].sort();
  const convId    = `${a}_${b}`;
  const ref       = doc(db, 'conversaciones', convId);
  const snap      = await getDocs(
    query(collection(db, 'conversaciones'), where('participantes', 'array-contains', uid1)),
  );

  const existe = snap.docs.find(d => {
    const p = d.data()['participantes'] as string[];
    return p.includes(uid2);
  });
  if (existe) return existe.id;

  // Intentar update; si no existe, crear con setDoc
  try {
    await updateDoc(ref, {});
  } catch {
    // Documento no existe → crearlo
    const batch = writeBatch(db);
    batch.set(ref, {
      participantes: [uid1, uid2],
      participantesNombres: { [uid1]: nombre1, [uid2]: nombre2 },
      noLeidos: { [uid1]: 0, [uid2]: 0 },
    } satisfies Omit<Conversacion, 'id' | 'ultimoMensaje' | 'ultimaFecha'>);
    await batch.commit();
  }

  return convId;
}

// ─── Enviar mensaje ───────────────────────────────────────────────────────────

export async function enviarMensaje(
  conversacionId: string,
  de: string,
  para: string,
  texto: string,
  tareaId?: string,
): Promise<void> {
  const ts = new Date().toISOString();

  await addDoc(collection(db, 'mensajes'), {
    conversacionId, de, para, texto,
    timestamp: ts,
    leido: false,
    ...(tareaId ? { tareaId } : {}),
  } satisfies Omit<Mensaje, 'id'>);

  const batch = writeBatch(db);
  const convRef = doc(db, 'conversaciones', conversacionId);
  batch.update(convRef, {
    ultimoMensaje: texto,
    ultimaFecha:   ts,
    [`noLeidos.${para}`]: (await getDocs(
      query(collection(db, 'mensajes'),
        where('conversacionId', '==', conversacionId),
        where('para', '==', para),
        where('leido', '==', false),
      ),
    )).size + 1,
  });
  await batch.commit();
}

// ─── Marcar mensajes como leídos ─────────────────────────────────────────────

export async function marcarLeidos(conversacionId: string, uid: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'mensajes'),
      where('conversacionId', '==', conversacionId),
      where('para', '==', uid),
      where('leido', '==', false),
    ),
  );
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { leido: true }));
  batch.update(doc(db, 'conversaciones', conversacionId), {
    [`noLeidos.${uid}`]: 0,
  });
  await batch.commit();
}

// ─── Suscripciones ────────────────────────────────────────────────────────────

export function subscribeConversaciones(
  uid: string,
  callback: (convs: Conversacion[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'conversaciones'),
    where('participantes', 'array-contains', uid),
    orderBy('ultimaFecha', 'desc'),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Conversacion));
  });
}

export function subscribeMensajes(
  conversacionId: string,
  callback: (msgs: Mensaje[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'mensajes'),
    where('conversacionId', '==', conversacionId),
    orderBy('timestamp', 'asc'),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Mensaje));
  });
}

export function subscribeTotalNoLeidos(
  uid: string,
  callback: (count: number) => void,
): Unsubscribe {
  const q = query(collection(db, 'conversaciones'), where('participantes', 'array-contains', uid));
  return onSnapshot(q, snap => {
    const total = snap.docs.reduce((acc, d) => {
      const noLeidos = d.data()['noLeidos'] as Record<string, number> | undefined;
      return acc + (noLeidos?.[uid] ?? 0);
    }, 0);
    callback(total);
  });
}
