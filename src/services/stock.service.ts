import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, onSnapshot, runTransaction, addDoc,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Producto, StockDiario, StockItem, StockMovimiento, FacturaProducto } from '../types';

// ═══════════════════════════════════════════════════════════════
// SECCIÓN 1 — INVENTARIO DE MATERIAS PRIMAS (/stock/)
// ═══════════════════════════════════════════════════════════════

export function useStockSubscription(
  callback: (items: StockItem[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'stock'), orderBy('nombre', 'asc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as StockItem));
  });
}

export async function ajustarStock(
  id: string, delta: number, motivo: string,
): Promise<void> {
  const ref  = doc(db, 'stock', id);
  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const data    = snap.data() as Omit<StockItem, 'id'>;
    const nueva   = Math.max(0, data.cantidad + delta);
    t.update(ref, { cantidad: nueva, ultimaActualizacion: new Date().toISOString() });
    const movRef = doc(collection(db, `stock/${id}/movimientos`));
    t.set(movRef, {
      tipo:      delta > 0 ? 'entrada' : 'salida',
      cantidad:  Math.abs(delta),
      motivo,
      fecha:     new Date().toISOString(),
    } satisfies Omit<StockMovimiento, 'id' | 'facturaId'>);
  });
}

export async function updateStockMinimo(id: string, minimo: number): Promise<void> {
  await updateDoc(doc(db, 'stock', id), { stockMinimo: minimo });
}

export async function getMovimientos(id: string): Promise<StockMovimiento[]> {
  const snap = await getDocs(
    query(
      collection(db, `stock/${id}/movimientos`),
      orderBy('fecha', 'desc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as StockMovimiento);
}

export async function findStockByName(nombre: string): Promise<StockItem | null> {
  const snap = await getDocs(
    query(collection(db, 'stock'), where('nombre', '==', nombre)),
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as StockItem;
}

export async function updateStockFromFactura(
  productos: FacturaProducto[],
  facturaId: string,
  proveedor = '',
): Promise<void> {
  for (const prod of productos) {
    const snap = await getDocs(
      query(collection(db, 'stock'), where('nombre', '==', prod.nombre)),
    );
    if (snap.empty) {
      // Create new stock item
      await addDoc(collection(db, 'stock'), {
        nombre:              prod.nombre,
        cantidad:            prod.cantidad,
        unidad:              prod.unidad,
        stockMinimo:         0,
        ultimoPrecio:        prod.precio_unidad,
        proveedor,
        ultimaActualizacion: new Date().toISOString(),
      } satisfies Omit<StockItem, 'id'>);
    } else {
      const ref  = snap.docs[0].ref;
      const data = snap.docs[0].data() as Omit<StockItem, 'id'>;
      await updateDoc(ref, {
        cantidad:            data.cantidad + prod.cantidad,
        ultimoPrecio:        prod.precio_unidad,
        ultimaActualizacion: new Date().toISOString(),
      });
      await addDoc(collection(db, `stock/${snap.docs[0].id}/movimientos`), {
        tipo:      'entrada',
        cantidad:  prod.cantidad,
        motivo:    'Factura de proveedor',
        fecha:     new Date().toISOString(),
        facturaId,
      } satisfies Omit<StockMovimiento, 'id'>);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// SECCIÓN 2 — STOCK DIARIO DE CARTA (/productos/)
// ═══════════════════════════════════════════════════════════════

function hoyStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function ayerStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function guardarApertura(
  items: { productoId: string; nombre: string; inicial: number; controlStock: boolean }[],
): Promise<void> {
  const hoy  = hoyStr();
  const mapa: StockDiario['items'] = {};

  const batch: Promise<void>[] = items.map(item => {
    if (item.controlStock) {
      mapa[item.productoId] = {
        productoId: item.productoId,
        nombre:     item.nombre,
        inicial:    item.inicial,
      };
    }
    return updateDoc(doc(db, 'productos', item.productoId), {
      controlStock: item.controlStock,
      stockActual:  item.controlStock ? item.inicial : null,
      disponible:   item.controlStock ? item.inicial > 0 : true,
    });
  });

  await setDoc(doc(db, 'stockDiario', hoy), {
    fecha: hoy,
    items: mapa,
  } satisfies Omit<StockDiario, 'id'>);

  await Promise.all(batch);
}

export async function getStockDiario(fecha: string): Promise<StockDiario | null> {
  const snap = await getDoc(doc(db, 'stockDiario', fecha));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StockDiario;
}

export async function getStockAyer(): Promise<StockDiario | null> {
  return getStockDiario(ayerStr());
}

// Ajuste rápido de stock de un PRODUCTO DE CARTA
export async function ajustarStockProducto(productoId: string, delta: number): Promise<void> {
  const ref  = doc(db, 'productos', productoId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const actual = (snap.data()['stockActual'] as number) ?? 0;
  const nuevo  = Math.max(0, actual + delta);
  await updateDoc(ref, {
    stockActual: nuevo,
    disponible:  nuevo > 0,
  });
}

export function subscribeProductosStock(
  callback: (productos: Producto[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'productos'), where('controlStock', '==', true));
  return onSnapshot(q, snap => {
    const data = snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as Producto)
      .sort((a, b) => (a.stockActual ?? 0) - (b.stockActual ?? 0));
    callback(data);
  });
}

export async function getResumenStockCierre(): Promise<
  { nombre: string; inicial: number; actual: number; vendidos: number }[]
> {
  const diario = await getStockDiario(hoyStr());
  if (!diario) return [];
  const productoIds = Object.keys(diario.items);
  if (productoIds.length === 0) return [];
  const snaps = await getDocs(
    query(collection(db, 'productos'), where('controlStock', '==', true)),
  );
  const prodMap = new Map(snaps.docs.map(d => [d.id, d.data() as Omit<Producto, 'id'>]));
  return productoIds.map(pid => {
    const item   = diario.items[pid];
    const actual = (prodMap.get(pid)?.stockActual ?? 0);
    return {
      nombre:   item.nombre,
      inicial:  item.inicial,
      actual,
      vendidos: Math.max(0, item.inicial - actual),
    };
  });
}
