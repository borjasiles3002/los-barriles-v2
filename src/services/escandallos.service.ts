import {
  doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Escandallo, EscandallIngrediente } from '../types';
import { crearAlerta } from './alertas.service';

// ─── Calcular coste ───────────────────────────────────────────────────────────

function calcularEscandallo(ingredientes: EscandallIngrediente[], precioVenta: number) {
  const costeTotal  = ingredientes.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
  const margen      = precioVenta - costeTotal;
  const foodCostPct = precioVenta > 0 ? (costeTotal / precioVenta) * 100 : 0;
  return { costeTotal, margen, foodCostPct };
}

// ─── Guardar escandallo ───────────────────────────────────────────────────────

export async function saveEscandallo(
  productoId: string,
  productoNombre: string,
  ingredientes: EscandallIngrediente[],
  precioVenta: number,
): Promise<void> {
  const { costeTotal, margen, foodCostPct } = calcularEscandallo(ingredientes, precioVenta);

  const data: Omit<Escandallo, 'id'> = {
    productoNombre,
    ingredientes,
    costeTotal,
    precioVenta,
    margen,
    foodCostPct,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(doc(db, 'escandallos', productoId), data);

  // Alert if food cost > 40%
  if (foodCostPct > 40) {
    await crearAlerta(
      'food_cost',
      `El food cost de "${productoNombre}" es ${foodCostPct.toFixed(1)}% (por encima del 40% recomendado). Coste: ${costeTotal.toFixed(2)}€, PVP: ${precioVenta.toFixed(2)}€.`,
      { productoId, productoNombre, costeTotal, precioVenta, foodCostPct },
    );
  }
}

// ─── Obtener un escandallo ────────────────────────────────────────────────────

export async function getEscandallo(productoId: string): Promise<Escandallo | null> {
  const snap = await getDoc(doc(db, 'escandallos', productoId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Escandallo;
}

// ─── Eliminar escandallo ──────────────────────────────────────────────────────

export async function deleteEscandallo(productoId: string): Promise<void> {
  await deleteDoc(doc(db, 'escandallos', productoId));
}

// ─── Recalcular escandallos afectados por cambio de precio ───────────────────

export async function recalcularPorCambioPrecio(
  stockId: string,
  nuevoPrecio: number,
): Promise<void> {
  const snap = await getDocs(query(collection(db, 'escandallos'), orderBy('productoNombre')));

  for (const d of snap.docs) {
    const escandallo = { id: d.id, ...d.data() } as Escandallo;
    const afecta = escandallo.ingredientes.some(i => i.stockId === stockId);
    if (!afecta) continue;

    // Update price of affected ingredient
    const ingredientes = escandallo.ingredientes.map(i =>
      i.stockId === stockId ? { ...i, precioUnitario: nuevoPrecio } : i,
    );

    const { costeTotal, margen, foodCostPct } = calcularEscandallo(
      ingredientes,
      escandallo.precioVenta,
    );

    await setDoc(doc(db, 'escandallos', escandallo.id), {
      ...escandallo,
      ingredientes,
      costeTotal,
      margen,
      foodCostPct,
      updatedAt: new Date().toISOString(),
    });

    if (foodCostPct > 40) {
      await crearAlerta(
        'food_cost',
        `Tras la subida de precio de un ingrediente, el food cost de "${escandallo.productoNombre}" ha subido a ${foodCostPct.toFixed(1)}%. Considera revisar el PVP.`,
        { productoId: escandallo.id, foodCostPct, costeTotal, precioVenta: escandallo.precioVenta },
      );
    }
  }
}
