import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Ingreso, MetodoPago, LineaPedido } from '../types';

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
  const now      = new Date();
  const subtotal = total / 1.1;
  const iva      = total - subtotal;

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
