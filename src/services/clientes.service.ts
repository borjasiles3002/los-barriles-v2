import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, onSnapshot, runTransaction,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Cliente } from '../types';
import { round2 } from '../utils/money';

// ─── Crear cliente ─────────────────────────────────────────────────────────────

export async function crearCliente(
  data: Omit<Cliente, 'id' | 'totalVisitas' | 'totalGastado' | 'creadoEn'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'clientes'), {
    ...data,
    totalVisitas: 0,
    totalGastado: 0,
    creadoEn: new Date().toISOString(),
  } satisfies Omit<Cliente, 'id'>);
  return ref.id;
}

// ─── Actualizar cliente ────────────────────────────────────────────────────────

export async function actualizarCliente(
  id: string,
  updates: Partial<Omit<Cliente, 'id' | 'creadoEn' | 'totalVisitas' | 'totalGastado'>>,
): Promise<void> {
  await updateDoc(doc(db, 'clientes', id), updates);
}

// ─── Registrar visita (cuando se cobra un pedido con cliente) ─────────────────

export async function registrarVisitaCliente(clienteId: string, total: number): Promise<void> {
  const ref = doc(db, 'clientes', clienteId);
  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Omit<Cliente, 'id'>;
    t.update(ref, {
      totalVisitas: (data.totalVisitas ?? 0) + 1,
      totalGastado: round2((data.totalGastado ?? 0) + total),
      ultimaVisita: new Date().toISOString(),
    });
  });
}

// ─── Buscar clientes ───────────────────────────────────────────────────────────

export async function buscarClientes(termino: string): Promise<Cliente[]> {
  const term = termino.toLowerCase().trim();
  if (!term) return [];

  // Fetch all (small collection in a restaurant) and filter client-side
  const snap = await getDocs(
    query(collection(db, 'clientes'), orderBy('nombre', 'asc')),
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as Cliente)
    .filter(c => {
      const haystack = `${c.nombre} ${c.apellidos} ${c.empresa ?? ''} ${c.nif ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
}

// ─── Obtener cliente ────────────────────────────────────────────────────────────

export async function getCliente(id: string): Promise<Cliente | null> {
  const snap = await getDoc(doc(db, 'clientes', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Cliente;
}

// ─── Suscripción lista de clientes ────────────────────────────────────────────

export function subscribeClientes(
  callback: (clientes: Cliente[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'clientes'), orderBy('nombre', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Cliente));
  });
}

// ─── Facturas emitidas de un cliente ─────────────────────────────────────────

export async function getFacturasCliente(clienteId: string) {
  const snap = await getDocs(
    query(
      collection(db, 'facturas_emitidas'),
      where('clienteId', '==', clienteId),
      orderBy('creadaEn', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
