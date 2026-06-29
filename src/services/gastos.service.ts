import { collection, addDoc, deleteDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Gasto, CategoriaGasto } from '../types';

export async function addGasto(
  data: Omit<Gasto, 'id' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'gastos'), {
    ...data,
    createdAt: new Date().toISOString(),
  });
  return ref.id;
}

export async function deleteGasto(gastoId: string): Promise<void> {
  await deleteDoc(doc(db, 'gastos', gastoId));
}

export async function getGastosByFecha(desde: string, hasta: string): Promise<Gasto[]> {
  const snap = await getDocs(
    query(
      collection(db, 'gastos'),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Gasto);
}

export const CATEGORIAS_GASTO: { value: CategoriaGasto; label: string }[] = [
  { value: 'compras',       label: 'Compras / Proveedores' },
  { value: 'personal',      label: 'Personal' },
  { value: 'suministros',   label: 'Suministros' },
  { value: 'alquiler',      label: 'Alquiler' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'marketing',     label: 'Marketing' },
  { value: 'otros',         label: 'Otros' },
];
