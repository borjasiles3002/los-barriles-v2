import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Ingreso, MetodoPago, LineaPedido } from '../types';
import { IVA_RATES } from '../types';
import { round2 } from '../utils/money';

export async function registrarIngreso(
  pedidoId: string,
  mesaId: string,
  mesaNombre: string,
  lineas: LineaPedido[],
  total: number,
  metodoPago: MetodoPago,
  camareroId: string,
  camareroNombre: string,
): Promise<string> {
  const now = new Date();

  // Calcular subtotal e IVA correctamente por tipo de IVA de cada línea
  let subtotalCalc = 0;
  let ivaCalc = 0;
  for (const l of lineas) {
    const rate      = IVA_RATES[l.tipoIva ?? 'reducido'];
    const totalLinea = round2(l.precio * l.cantidad);
    const base       = round2(totalLinea / (1 + rate));
    subtotalCalc    += base;
    ivaCalc         += totalLinea - base;
  }
  const subtotal = round2(subtotalCalc);
  const iva      = round2(ivaCalc);

  const ref = await addDoc(collection(db, 'ingresos'), {
    fecha:          now.toISOString().slice(0, 10),
    hora:           now.toTimeString().slice(0, 5),
    mesaId,
    mesaNombre,
    pedidoId,
    lineas,
    subtotal,
    iva,
    total,
    metodoPago,
    camareroId,
    camareroNombre,
  });
  return ref.id;
}

export async function getIngresosByFecha(desde: string, hasta: string): Promise<Ingreso[]> {
  // Range on same field → no composite index needed
  const snap = await getDocs(
    query(
      collection(db, 'ingresos'),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Ingreso);
}

export async function getIngresosHoy(): Promise<Ingreso[]> {
  const hoy = new Date().toISOString().slice(0, 10);
  return getIngresosByFecha(hoy, hoy);
}
