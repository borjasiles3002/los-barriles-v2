import {
  collection, doc, addDoc, getDoc, setDoc, updateDoc,
  getDocs, query, where, orderBy, limit, onSnapshot, runTransaction,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import type { Ticket, ConfigTickets, MetodoPago, DestinoProducto } from '../types';
import { encolarImpresion } from './impresion.service';

export async function getSiguienteNumeroTicket(): Promise<string> {
  const counterRef = doc(db, 'contadores', 'tickets');
  let numero = 1;
  await runTransaction(db, async (t) => {
    const snap = await t.get(counterRef);
    if (!snap.exists()) {
      numero = 1;
      t.set(counterRef, { siguiente: 2 });
    } else {
      numero = snap.data()['siguiente'] as number;
      t.update(counterRef, { siguiente: numero + 1 });
    }
  });
  return `T-${new Date().getFullYear()}-${String(numero).padStart(5, '0')}`;
}

export async function crearTicket(params: {
  tipo:        'proforma' | 'ticket' | 'factura';
  pedidoId:    string;
  mesaId:      string;
  mesaNombre:  string;
  lineas:      Ticket['lineas'];
  total:       number;
  iva10?:      number;
  iva21?:      number;
  metodoPago?: MetodoPago;
  entregado?:  number;
  cambio?:     number;
  camarero:    string;
  clienteId?:  string;
}): Promise<Ticket> {
  const numero  = await getSiguienteNumeroTicket();
  const ahora   = new Date();
  const iva10   = params.iva10 ?? Math.round(params.total / 1.1 * 0.1 * 100) / 100;
  const iva21   = params.iva21 ?? 0;
  const subtotal = Math.round((params.total - iva10 - iva21) * 100) / 100;

  const ticket: Omit<Ticket, 'id'> = {
    numero,
    tipo:        params.tipo,
    pedidoId:    params.pedidoId,
    mesaId:      params.mesaId,
    mesaNombre:  params.mesaNombre,
    lineas:      params.lineas,
    subtotal,
    iva10,
    iva21,
    total:       params.total,
    metodoPago:  params.metodoPago,
    entregado:   params.entregado,
    cambio:      params.cambio,
    camarero:    params.camarero,
    clienteId:   params.clienteId,
    fecha:       ahora.toISOString().slice(0, 10),
    hora:        ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    timestamp:   ahora.toISOString(),
    reimpresiones: 0,
  };

  const ref = await addDoc(collection(db, 'tickets'), Object.fromEntries(
    Object.entries(ticket).filter(([, v]) => v !== undefined),
  ));
  return { id: ref.id, ...ticket };
}

export async function reimprimir(ticketId: string): Promise<void> {
  const ref  = doc(db, 'tickets', ticketId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const current = (snap.data()['reimpresiones'] as number) ?? 0;
    await updateDoc(ref, { reimpresiones: current + 1 });
  }
}

export async function reimprimirTicket(ticket: Ticket): Promise<void> {
  await reimprimir(ticket.id);
  await encolarImpresion({
    tipo:        'ticket',
    mesaNombre:  ticket.mesaNombre,
    pedidoId:    ticket.pedidoId,
    lineas:      ticket.lineas.map(l => ({
      id:           l.nombre,
      productoId:   l.nombre,
      nombre:       l.nombre,
      precio:       l.precioUnitario,
      cantidad:     l.cantidad,
      estado:       'servido' as const,
      destino:      l.destino as DestinoProducto,
    })),
    total:       ticket.total,
    numero:      ticket.numero,
    metodoPago:  ticket.metodoPago,
  });
}

export async function getConfigTickets(): Promise<ConfigTickets> {
  const snap = await getDoc(doc(db, 'configuracion', 'tickets'));
  if (!snap.exists()) return { imprimirAlCobrar: true };
  return snap.data() as ConfigTickets;
}

export async function saveConfigTickets(cfg: ConfigTickets): Promise<void> {
  await setDoc(doc(db, 'configuracion', 'tickets'), cfg);
}

export function subscribeTickets(limite: number, callback: (tickets: Ticket[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'tickets'),
    orderBy('timestamp', 'desc'),
    limit(limite),
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Ticket));
  });
}

export async function getTicketsByPeriod(desde: string, hasta: string): Promise<Ticket[]> {
  const snap = await getDocs(query(
    collection(db, 'tickets'),
    where('fecha', '>=', desde),
    where('fecha', '<=', hasta),
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Ticket);
}
