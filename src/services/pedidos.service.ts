import {
  collection, doc, addDoc, updateDoc,
  runTransaction, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Pedido, LineaPedido, PedidoEstado, Producto } from '../types';

// ─── Abrir mesa ─────────────────────────────────────────────────────────────

export async function abrirMesa(
  mesaId: string,
  mesaNombre: string,
  camareroId: string,
  camareroNombre: string,
): Promise<string> {
  const pedidoRef = await addDoc(collection(db, 'pedidos'), {
    mesaId,
    mesaNombre,
    estado: 'abierto' as PedidoEstado,
    lineas: [],
    total: 0,
    createdAt: new Date().toISOString(),
    camareroId,
    camareroNombre,
  });

  await updateDoc(doc(db, 'mesas', mesaId), {
    estado: 'ocupada',
    pedidoActivo: pedidoRef.id,
  });

  return pedidoRef.id;
}

// ─── Añadir producto ─────────────────────────────────────────────────────────

export async function agregarProducto(pedidoId: string, producto: Producto): Promise<void> {
  const pedidoRef = doc(db, 'pedidos', pedidoId);

  await runTransaction(db, async (t) => {
    const snap = await t.get(pedidoRef);
    if (!snap.exists()) throw new Error('Pedido no encontrado');

    const data = snap.data() as Omit<Pedido, 'id'>;
    const lineas: LineaPedido[] = [...(data.lineas ?? [])];

    const idx = lineas.findIndex(l => l.productoId === producto.id);
    if (idx >= 0) {
      lineas[idx] = { ...lineas[idx], cantidad: lineas[idx].cantidad + 1 };
    } else {
      lineas.push({
        id:         `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productoId: producto.id,
        nombre:     producto.nombre,
        precio:     producto.precio,
        cantidad:   1,
        estado:     'pendiente',
      });
    }

    const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
    t.update(pedidoRef, { lineas, total });
  });
}

// ─── Quitar/decrementar producto ─────────────────────────────────────────────

export async function quitarProducto(pedidoId: string, lineaId: string): Promise<void> {
  const pedidoRef = doc(db, 'pedidos', pedidoId);

  await runTransaction(db, async (t) => {
    const snap = await t.get(pedidoRef);
    if (!snap.exists()) return;

    const data = snap.data() as Omit<Pedido, 'id'>;
    let lineas: LineaPedido[] = [...(data.lineas ?? [])];
    const idx = lineas.findIndex(l => l.id === lineaId);
    if (idx < 0) return;

    if (lineas[idx].cantidad > 1) {
      lineas[idx] = { ...lineas[idx], cantidad: lineas[idx].cantidad - 1 };
    } else {
      lineas = lineas.filter(l => l.id !== lineaId);
    }

    const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
    t.update(pedidoRef, { lineas, total });
  });
}

// ─── Cambiar estado del pedido ───────────────────────────────────────────────

export async function cambiarEstadoPedido(
  pedidoId: string,
  estado: PedidoEstado,
): Promise<void> {
  const updates: Partial<Pedido> = { estado };
  if (estado === 'cerrado') updates.closedAt = new Date().toISOString();
  await updateDoc(doc(db, 'pedidos', pedidoId), updates);
}

// ─── Actualizar estado de la mesa ────────────────────────────────────────────

export async function actualizarEstadoMesa(
  mesaId: string,
  estado: 'libre' | 'ocupada' | 'cuenta_pedida',
  pedidoActivo: string | null = null,
): Promise<void> {
  await updateDoc(doc(db, 'mesas', mesaId), { estado, pedidoActivo });
}

// ─── Cerrar pedido y liberar mesa ────────────────────────────────────────────

export async function cerrarPedido(pedidoId: string, mesaId: string): Promise<void> {
  await updateDoc(doc(db, 'pedidos', pedidoId), {
    estado: 'cerrado' as PedidoEstado,
    closedAt: new Date().toISOString(),
  });
  await updateDoc(doc(db, 'mesas', mesaId), {
    estado: 'libre',
    pedidoActivo: null,
  });
}

// ─── Cocina: marcar línea como lista ─────────────────────────────────────────

export async function marcarLineaLista(pedidoId: string, lineaId: string): Promise<void> {
  const pedidoRef = doc(db, 'pedidos', pedidoId);

  await runTransaction(db, async (t) => {
    const snap = await t.get(pedidoRef);
    if (!snap.exists()) return;

    const data = snap.data() as Omit<Pedido, 'id'>;
    const lineas = data.lineas.map(l =>
      l.id === lineaId ? { ...l, estado: 'listo' as const } : l,
    );

    const todasListas = lineas.every(l => l.estado === 'listo');
    const updates: Record<string, unknown> = { lineas };

    if (todasListas && data.estado === 'en_cocina') {
      updates['estado'] = 'listo';
      // Create kitchen-ready notification
      const notifRef = doc(collection(db, 'notificaciones'));
      t.set(notifRef, {
        tipo:        'pedido_listo',
        mesaId:      data.mesaId,
        pedidoId,
        mesaNombre:  data.mesaNombre,
        leido:       false,
        createdAt:   new Date().toISOString(),
      });
    }

    t.update(pedidoRef, updates);
  });
}

// ─── Marcar notificación como leída ──────────────────────────────────────────

export async function marcarNotificacionLeida(notifId: string): Promise<void> {
  await updateDoc(doc(db, 'notificaciones', notifId), { leido: true });
}

export async function marcarTodasLeidas(notifIds: string[]): Promise<void> {
  await Promise.all(notifIds.map(id => updateDoc(doc(db, 'notificaciones', id), { leido: true })));
}

// ─── Obtener pedidos cerrados de hoy ─────────────────────────────────────────

export async function getPedidosCerradosHoy(): Promise<Pedido[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const snap = await getDocs(
    query(collection(db, 'pedidos'), where('estado', '==', 'cerrado')),
  );
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }) as Pedido)
    .filter(p => p.closedAt && p.closedAt >= todayISO)
    .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''));
}
