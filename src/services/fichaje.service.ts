import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Fichaje, Turno } from '../types';

function hoyStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function horaStr(): string {
  return new Date().toTimeString().slice(0, 5);
}

// ─── Obtener turno abierto del día ────────────────────────────────────────────

export async function getTurnoAbierto(usuarioId: string): Promise<Turno | null> {
  // Un solo where para evitar índice compuesto; filtramos fecha y completo en JS
  const snap = await getDocs(
    query(
      collection(db, 'turnos'),
      where('usuarioId', '==', usuarioId),
      where('fecha', '==', hoyStr()),
    ),
  );
  const abierto = snap.docs.find(d => d.data().completo === false);
  if (!abierto) return null;
  return { id: abierto.id, ...abierto.data() } as Turno;
}

// ─── Registrar entrada ────────────────────────────────────────────────────────

export async function registrarEntrada(usuarioId: string, nombre: string): Promise<void> {
  // Verificar que no hay turno abierto antes de crear uno nuevo
  const turnoExistente = await getTurnoAbierto(usuarioId);
  if (turnoExistente) throw new Error('Ya tienes un turno abierto. Ficha la salida primero.');

  const ahora = new Date().toISOString();
  const fecha = hoyStr();
  const hora  = horaStr();

  // Fichaje
  await addDoc(collection(db, 'fichajes'), {
    usuarioId, nombre,
    tipo:      'entrada',
    timestamp: ahora,
    fecha,
    hora,
  } satisfies Omit<Fichaje, 'id'>);

  // Turno abierto
  await addDoc(collection(db, 'turnos'), {
    usuarioId, nombre, fecha,
    entrada:  ahora,
    completo: false,
  } satisfies Omit<Turno, 'id' | 'salida' | 'horasTrabajadas' | 'incidencia'>);
}

// ─── Registrar salida ─────────────────────────────────────────────────────────

export async function registrarSalida(
  usuarioId: string,
  nombre: string,
  turnoId: string,
  entradaISO: string,
): Promise<number> {
  const ahora          = new Date().toISOString();
  const fecha          = hoyStr();
  const hora           = horaStr();
  const horasTrabajadas = (new Date(ahora).getTime() - new Date(entradaISO).getTime()) / 3_600_000;

  // Fichaje
  await addDoc(collection(db, 'fichajes'), {
    usuarioId, nombre,
    tipo:      'salida',
    timestamp: ahora,
    fecha,
    hora,
  } satisfies Omit<Fichaje, 'id'>);

  // Cerrar turno
  await updateDoc(doc(db, 'turnos', turnoId), {
    salida:  ahora,
    horasTrabajadas: Math.round(horasTrabajadas * 100) / 100,
    completo: true,
  });

  return horasTrabajadas;
}

// ─── Turnos por trabajador y período ─────────────────────────────────────────

export async function getTurnosPorPeriodo(
  usuarioId: string,
  desde: string,
  hasta: string,
): Promise<Turno[]> {
  const snap = await getDocs(
    query(
      collection(db, 'turnos'),
      where('usuarioId', '==', usuarioId),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Turno)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ─── Todos los turnos del período (todos los trabajadores) ───────────────────

export async function getAllTurnosPeriodo(desde: string, hasta: string): Promise<Turno[]> {
  const snap = await getDocs(
    query(
      collection(db, 'turnos'),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Turno)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ─── Turnos abiertos (sin salida) ────────────────────────────────────────────

export function subscribeTurnosAbiertos(
  callback: (turnos: Turno[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'turnos'),
    where('completo', '==', false),
    orderBy('entrada', 'desc'),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Turno));
  });
}
