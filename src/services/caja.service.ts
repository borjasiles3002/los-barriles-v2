import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Cierre } from '../types';
import { getPedidosCerradosHoy } from './pedidos.service';
import { round2 } from '../utils/money';

export async function realizarCierreDeCaja(): Promise<Cierre> {
  const pedidos = await getPedidosCerradosHoy();

  if (pedidos.length === 0) {
    throw new Error('No hay pedidos cerrados hoy para realizar el cierre.');
  }

  const total          = round2(pedidos.reduce((s, p) => s + p.total, 0));
  const numeroPedidos  = pedidos.length;
  const ticketMedio    = round2(total / numeroPedidos);
  const fecha          = new Date().toISOString().slice(0, 10);

  const cierre: Omit<Cierre, 'id'> = {
    fecha,
    total,
    numeroPedidos,
    ticketMedio,
    createdAt:   new Date().toISOString(),
    pedidosIds:  pedidos.map(p => p.id),
  };

  const ref = await addDoc(collection(db, 'cierres'), cierre);
  return { id: ref.id, ...cierre };
}
