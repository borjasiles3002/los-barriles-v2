import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Tarea, ChecklistItem, EstadoTarea, Prioridad } from '../types';

// ─── Crear tarea ──────────────────────────────────────────────────────────────

export async function crearTarea(data: {
  titulo: string;
  descripcion?: string;
  asignadoA: string;
  asignadoANombre: string;
  asignadoPor: string;
  fechaLimite?: string;
  prioridad: Prioridad;
  checklist?: ChecklistItem[];
}): Promise<string> {
  const ref = await addDoc(collection(db, 'tareas'), {
    ...data,
    estado:    'pendiente',
    checklist: data.checklist ?? [],
    creadaEn:  new Date().toISOString(),
  } satisfies Omit<Tarea, 'id' | 'completadaEn'>);
  return ref.id;
}

// ─── Actualizar estado ────────────────────────────────────────────────────────

export async function cambiarEstadoTarea(id: string, estado: EstadoTarea): Promise<void> {
  const updates: Record<string, unknown> = { estado };
  if (estado === 'completada') updates['completadaEn'] = new Date().toISOString();
  await updateDoc(doc(db, 'tareas', id), updates);
}

// ─── Actualizar checklist item ────────────────────────────────────────────────

export async function toggleChecklistItem(
  tareaId: string,
  checklist: ChecklistItem[],
  itemId: string,
): Promise<void> {
  const updated = checklist.map(item =>
    item.id === itemId ? { ...item, completado: !item.completado } : item,
  );
  const allDone = updated.every(i => i.completado);
  const updates: Record<string, unknown> = { checklist: updated };
  if (allDone) {
    updates['estado']       = 'completada';
    updates['completadaEn'] = new Date().toISOString();
  }
  await updateDoc(doc(db, 'tareas', tareaId), updates);
}

// ─── Eliminar tarea ───────────────────────────────────────────────────────────

export async function eliminarTarea(id: string): Promise<void> {
  await deleteDoc(doc(db, 'tareas', id));
}

// ─── Suscripciones ────────────────────────────────────────────────────────────

export function subscribeTareasAsignadas(
  uid: string,
  callback: (tareas: Tarea[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'tareas'),
    where('asignadoA', '==', uid),
    orderBy('creadaEn', 'desc'),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Tarea));
  });
}

export function subscribeTareasPorAsignador(
  uid: string,
  callback: (tareas: Tarea[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'tareas'),
    where('asignadoPor', '==', uid),
    orderBy('creadaEn', 'desc'),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Tarea));
  });
}

export function subscribeTodasTareas(
  callback: (tareas: Tarea[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'tareas'), orderBy('creadaEn', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Tarea));
  });
}

export function subscribeTareasPendientes(
  uid: string,
  callback: (count: number) => void,
): Unsubscribe {
  // Filtramos estado en JS para evitar índice compuesto con !=
  const q = query(collection(db, 'tareas'), where('asignadoA', '==', uid));
  return onSnapshot(q, snap =>
    callback(snap.docs.filter(d => d.data().estado !== 'completada').length),
  );
}
