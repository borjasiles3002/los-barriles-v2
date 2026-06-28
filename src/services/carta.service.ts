import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Categoria, Producto } from '../types';

// ─── Categorías ───────────────────────────────────────────────────────────────

export async function addCategoria(data: Omit<Categoria, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'carta'), data);
  return ref.id;
}

export async function updateCategoria(id: string, data: Partial<Omit<Categoria, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'carta', id), data);
}

export async function deleteCategoria(id: string): Promise<void> {
  const snap = await getDocs(query(collection(db, 'productos'), where('categoriaId', '==', id)));
  await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'carta', id));
}

// ─── Productos ────────────────────────────────────────────────────────────────

export async function addProducto(data: Omit<Producto, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'productos'), data);
  return ref.id;
}

export async function updateProducto(id: string, data: Partial<Omit<Producto, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'productos', id), data);
}

export async function deleteProducto(id: string): Promise<void> {
  await deleteDoc(doc(db, 'productos', id));
}

export async function toggleProductoDisponible(id: string, currentDisponible: boolean): Promise<void> {
  await updateDoc(doc(db, 'productos', id), { disponible: !currentDisponible });
}
