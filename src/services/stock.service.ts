import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs,
  query, where, orderBy, runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { StockItem, FacturaProducto } from '../types';
import { crearAlerta } from './alertas.service';

// ─── Buscar stock por nombre ──────────────────────────────────────────────────

export async function findStockByName(nombre: string): Promise<StockItem | null> {
  const snap = await getDocs(
    query(collection(db, 'stock'), where('nombre', '==', nombre.trim())),
  );
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as StockItem;
}

// ─── Crear o actualizar stock desde factura ───────────────────────────────────

export async function updateStockFromFactura(
  productos: FacturaProducto[],
  facturaId: string,
  proveedor: string,
): Promise<void> {
  for (const prod of productos) {
    const nombre = prod.nombre.trim();
    if (!nombre) continue;

    const existing = await findStockByName(nombre);

    if (existing) {
      const precioAnterior = existing.ultimoPrecio;
      const precioNuevo    = prod.precio_unidad;

      // Atomic update via transaction
      await runTransaction(db, async (t) => {
        const ref  = doc(db, 'stock', existing.id);
        const snap = await t.get(ref);
        if (!snap.exists()) return;
        const data = snap.data() as Omit<StockItem, 'id'>;
        t.update(ref, {
          cantidad:            data.cantidad + prod.cantidad,
          ultimoPrecio:        precioNuevo,
          proveedor,
          ultimaActualizacion: new Date().toISOString(),
        });
      });

      // Add movement
      await addDoc(collection(db, 'stock', existing.id, 'movimientos'), {
        tipo:      'entrada',
        cantidad:  prod.cantidad,
        motivo:    `Factura ${facturaId} — ${proveedor}`,
        fecha:     new Date().toISOString(),
        facturaId,
      });

      // Price increase alert
      if (precioAnterior > 0 && precioNuevo > precioAnterior) {
        const subidaPct = ((precioNuevo - precioAnterior) / precioAnterior) * 100;
        const mensaje = `${nombre} ha subido un ${subidaPct.toFixed(1)}% respecto a tu última compra a ${proveedor} (${precioAnterior.toFixed(2)}€ → ${precioNuevo.toFixed(2)}€/${prod.unidad}). Considera revisar el precio de los platos que lo usan.`;
        await crearAlerta('precio_subida', mensaje, {
          producto:       nombre,
          proveedor,
          precioAnterior,
          precioNuevo,
          subidaPct,
          facturaId,
        });
      }
    } else {
      // Create new stock item
      const newRef = await addDoc(collection(db, 'stock'), {
        nombre,
        cantidad:            prod.cantidad,
        unidad:              prod.unidad || 'ud',
        stockMinimo:         0,
        ultimoPrecio:        prod.precio_unidad,
        proveedor,
        ultimaActualizacion: new Date().toISOString(),
      });

      await addDoc(collection(db, 'stock', newRef.id, 'movimientos'), {
        tipo:      'entrada',
        cantidad:  prod.cantidad,
        motivo:    `Factura ${facturaId} — ${proveedor} (primer registro)`,
        fecha:     new Date().toISOString(),
        facturaId,
      });
    }
  }
}

// ─── Actualizar stock mínimo ──────────────────────────────────────────────────

export async function updateStockMinimo(stockId: string, stockMinimo: number): Promise<void> {
  await updateDoc(doc(db, 'stock', stockId), { stockMinimo });
}

// ─── Ajuste manual de stock ───────────────────────────────────────────────────

export async function ajustarStock(
  stockId: string,
  delta: number,
  motivo: string,
): Promise<void> {
  const stockRef = doc(db, 'stock', stockId);
  await runTransaction(db, async (t) => {
    const snap = await t.get(stockRef);
    if (!snap.exists()) throw new Error('Stock item not found');
    const data = snap.data() as Omit<StockItem, 'id'>;
    const nueva = Math.max(0, data.cantidad + delta);
    t.update(stockRef, { cantidad: nueva, ultimaActualizacion: new Date().toISOString() });
  });

  await addDoc(collection(db, 'stock', stockId, 'movimientos'), {
    tipo:     delta >= 0 ? 'entrada' : 'salida',
    cantidad: Math.abs(delta),
    motivo,
    fecha:    new Date().toISOString(),
  });
}

// ─── Obtener movimientos de un stock item ─────────────────────────────────────

export async function getMovimientos(stockId: string) {
  const snap = await getDocs(
    query(collection(db, 'stock', stockId, 'movimientos'), orderBy('fecha', 'desc')),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Actualizar precio (trigger desde escandallo) ────────────────────────────

export async function getStockById(stockId: string): Promise<StockItem | null> {
  const snap = await getDoc(doc(db, 'stock', stockId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StockItem;
}

// ─── Obtener todo el stock ────────────────────────────────────────────────────

export async function getAllStock(): Promise<StockItem[]> {
  const snap = await getDocs(query(collection(db, 'stock'), orderBy('nombre')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as StockItem);
}
