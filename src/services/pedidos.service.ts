import {
  collection, doc, addDoc, updateDoc,
  runTransaction, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Pedido, LineaPedido, PedidoEstado, Producto, DestinoProducto } from '../types';

// ─── Abrir mesa ─────────────────────────────────────────────────────────────

export async function abrirMesa(
  mesaId: string,
  mesaNombre: string,
  camareroId: string,
  camareroNombre: string,
  comensales = 1,
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
    comensales,
  });

  return pedidoRef.id;
}

// ─── Añadir producto ─────────────────────────────────────────────────────────

export async function agregarProducto(
  pedidoId: string,
  producto: Producto,
  notas = '',
): Promise<void> {
  const pedidoRef = doc(db, 'pedidos', pedidoId);
  const destino: DestinoProducto = producto.destino ?? 'cocina';

  await runTransaction(db, async (t) => {
    const snap = await t.get(pedidoRef);
    if (!snap.exists()) throw new Error('Pedido no encontrado');

    const data   = snap.data() as Omit<Pedido, 'id'>;
    const lineas: LineaPedido[] = [...(data.lineas ?? [])];

    // Agrupar por productoId + notas (notas diferentes = líneas distintas)
    const idx = lineas.findIndex(l => l.productoId === producto.id && (l.notas ?? '') === notas);
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
        destino,
        notas:      notas || undefined,
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

// ─── Pedir cuenta ────────────────────────────────────────────────────────────

export async function pedirCuenta(
  pedidoId: string,
  mesaId: string,
  mesaNombre: string,
): Promise<void> {
  await updateDoc(doc(db, 'pedidos', pedidoId), { estado: 'cuenta_pedida' as PedidoEstado });
  await updateDoc(doc(db, 'mesas', mesaId), { estado: 'cuenta_pedida' });

  await addDoc(collection(db, 'notificaciones'), {
    tipo:       'cuenta_pedida',
    mesaId,
    pedidoId,
    mesaNombre,
    leido:      false,
    createdAt:  new Date().toISOString(),
  });
}

// ─── Actualizar estado de la mesa ────────────────────────────────────────────

export async function actualizarEstadoMesa(
  mesaId: string,
  estado: 'libre' | 'ocupada' | 'cuenta_pedida',
  pedidoActivo: string | null = null,
): Promise<void> {
  await updateDoc(doc(db, 'mesas', mesaId), { estado, pedidoActivo });
}

// ─── Actualizar posición de mesa en el mapa sala ─────────────────────────────

export async function actualizarPosicionMesa(
  mesaId: string,
  posX: number,
  posY: number,
): Promise<void> {
  await updateDoc(doc(db, 'mesas', mesaId), { posX, posY });
}

// ─── Actualizar nombre de mesa ───────────────────────────────────────────────

export async function actualizarNombreMesa(mesaId: string, nombre: string): Promise<void> {
  await updateDoc(doc(db, 'mesas', mesaId), { nombre });
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
    comensales:   null,
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

    // Notificar solo cuando TODAS las líneas de cocina (y ambos) están listas
    const lineasCocina = lineas.filter(
      l => l.destino === 'cocina' || l.destino === 'ambos' || !l.destino,
    );
    const todasCocinaListas = lineasCocina.length > 0 && lineasCocina.every(l => l.estado === 'listo');
    const updates: Record<string, unknown> = { lineas };

    if (todasCocinaListas && data.estado === 'en_cocina') {
      updates['estado'] = 'listo';
      const notifRef = doc(collection(db, 'notificaciones'));
      t.set(notifRef, {
        tipo:       'pedido_listo',
        mesaId:     data.mesaId,
        pedidoId,
        mesaNombre: data.mesaNombre,
        leido:      false,
        createdAt:  new Date().toISOString(),
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
