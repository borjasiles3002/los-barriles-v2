import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, getDoc, setDoc,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Reserva, ConfigReservas } from '../types';

const DEFAULT_CONFIG: ConfigReservas = {
  capacidadComida: 60,
  capacidadCena: 60,
  horaInicioComida: '13:00',
  horaFinComida: '16:00',
  horaInicioCena: '20:00',
  horaFinCena: '23:00',
};

export async function crearReserva(data: Omit<Reserva, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'reservas'), data);
  await addDoc(collection(db, 'notificaciones'), {
    tipo: 'nueva_reserva',
    mensaje: `Nueva reserva: ${data.nombre} — ${data.fecha} ${data.hora} (${data.comensales} pax)`,
    leido: false,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function actualizarReserva(
  id: string,
  updates: Partial<Omit<Reserva, 'id'>>,
): Promise<void> {
  await updateDoc(doc(db, 'reservas', id), updates as Record<string, unknown>);
}

export async function cambiarEstadoReserva(
  id: string,
  estado: Reserva['estado'],
): Promise<void> {
  await updateDoc(doc(db, 'reservas', id), { estado });
}

export async function eliminarReserva(id: string): Promise<void> {
  await deleteDoc(doc(db, 'reservas', id));
}

export function subscribeReservasPorFecha(
  fecha: string,
  callback: (reservas: Reserva[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'reservas'), where('fecha', '==', fecha));
  return onSnapshot(q, snap => {
    const data = snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as Reserva)
      .sort((a, b) => a.hora.localeCompare(b.hora));
    callback(data);
  });
}

export function subscribeReservasMes(
  desde: string,
  hasta: string,
  callback: (reservas: Reserva[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'reservas'),
    where('fecha', '>=', desde),
    where('fecha', '<=', hasta),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Reserva));
  });
}

export async function getConfigReservas(): Promise<ConfigReservas> {
  const snap = await getDoc(doc(db, 'configuracion', 'reservas'));
  if (!snap.exists()) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...snap.data() } as ConfigReservas;
}

export async function saveConfigReservas(config: ConfigReservas): Promise<void> {
  await setDoc(doc(db, 'configuracion', 'reservas'), config, { merge: true });
}
