import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  runTransaction, getDocs, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Pedido, LineaPedido, PedidoEstado, Producto, DestinoProducto, TipoIva } from '../types';
import { round2 } from '../utils/money';

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
// Regla Firestore: TODAS las lecturas (t.get) ANTES de cualquier escritura (t.update/t.set)

export async function agregarProducto(
  pedidoId: string,
  producto: Producto,
  notas = '',
): Promise<void> {
  const pedidoRef = doc(db, 'pedidos', pedidoId);
  const destino: DestinoProducto = producto.destino ?? 'cocina';
  const tipoIva: TipoIva = producto.tipoIva ?? 'reducido';
  const prodRef = producto.controlStock ? doc(db, 'productos', producto.id) : null;

  await runTransaction(db, async (t) => {
    // ── FASE 1: TODAS LAS LECTURAS ────────────────────────────────────────────
    const pedidoSnap = await t.get(pedidoRef);
    const prodSnap   = prodRef ? await t.get(prodRef) : null;

    // ── FASE 2: VALIDACIÓN Y CÁLCULO (solo memoria, sin red) ─────────────────
    if (!pedidoSnap.exists()) throw new Error('Pedido no encontrado');

    const data  = pedidoSnap.data() as Omit<Pedido, 'id'>;
    const lineas: LineaPedido[] = [...(data.lineas ?? [])];

    const idx = lineas.findIndex(
      l => l.productoId === producto.id && (l.notas ?? '') === notas,
    );
    if (idx >= 0) {
      lineas[idx] = { ...lineas[idx], cantidad: lineas[idx].cantidad + 1 };
    } else {
      lineas.push({
        id:          `l-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        productoId:  producto.id,
        nombre:      producto.nombre,
        precio:      producto.precio,
        cantidad:    1,
        estado:      'pendiente',
        destino,
        tipoIva,
        controlStock: producto.controlStock ?? false,
        ...(notas ? { notas } : {}),
      });
    }
    const total = round2(lineas.reduce((s, l) => s + l.precio * l.cantidad, 0));

    // Calcular cambios de stock en memoria
    let prodUpdate: Record<string, unknown> | null = null;
    let nuevoStock = 0;
    if (prodRef && prodSnap?.exists()) {
      const stockActual = (prodSnap.data()['stockActual'] as number) ?? 0;
      if (stockActual <= 0) throw new Error('STOCK_AGOTADO');
      nuevoStock = stockActual - 1;
      prodUpdate = {
        stockActual: nuevoStock,
        ...(nuevoStock === 0 ? { disponible: false } : {}),
      };
    }

    // ── FASE 3: TODAS LAS ESCRITURAS ─────────────────────────────────────────
    t.update(pedidoRef, { lineas, total });

    if (prodRef && prodUpdate) {
      if (nuevoStock === 0) {
        t.set(doc(collection(db, 'notificaciones')), {
          tipo: 'stock_agotado', productoId: producto.id,
          productoNombre: producto.nombre, stockActual: 0,
          leido: false, createdAt: new Date().toISOString(),
        });
      } else if (nuevoStock === 3) {
        t.set(doc(collection(db, 'notificaciones')), {
          tipo: 'stock_bajo', productoId: producto.id,
          productoNombre: producto.nombre, stockActual: nuevoStock,
          leido: false, createdAt: new Date().toISOString(),
        });
      }
      t.update(prodRef, prodUpdate);
    }
  });
}

// ─── Quitar/decrementar producto ─────────────────────────────────────────────

export async function quitarProducto(pedidoId: string, lineaId: string): Promise<void> {
  const pedidoRef = doc(db, 'pedidos', pedidoId);

  await runTransaction(db, async (t) => {
    // ── FASE 1: LECTURA PEDIDO ───────────────────────────────────────────────
    const pedidoSnap = await t.get(pedidoRef);
    if (!pedidoSnap.exists()) return;

    const data = pedidoSnap.data() as Omit<Pedido, 'id'>;
    const lineasOrig: LineaPedido[] = [...(data.lineas ?? [])];
    const idx = lineasOrig.findIndex(l => l.id === lineaId);
    if (idx < 0) return;

    // Determinar si se necesita leer el producto (para stock)
    const linea   = lineasOrig[idx];
    const prodRef = linea.controlStock ? doc(db, 'productos', linea.productoId) : null;

    // ── FASE 1b: LECTURA PRODUCTO (si procede) — ANTES de cualquier escritura ─
    const prodSnap = prodRef ? await t.get(prodRef) : null;

    // ── FASE 2: CÁLCULO EN MEMORIA ───────────────────────────────────────────
    let lineas = lineasOrig;
    if (lineas[idx].cantidad > 1) {
      lineas = lineas.map((l, i) =>
        i === idx ? { ...l, cantidad: l.cantidad - 1 } : l,
      );
    } else {
      lineas = lineas.filter(l => l.id !== lineaId);
    }
    const total = round2(lineas.reduce((s, l) => s + l.precio * l.cantidad, 0));

    let prodUpdate: Record<string, unknown> | null = null;
    if (prodRef && prodSnap?.exists()) {
      const stockActual = (prodSnap.data()['stockActual'] as number) ?? 0;
      const nuevoStock  = stockActual + 1;
      prodUpdate = {
        stockActual: nuevoStock,
        ...(stockActual === 0 ? { disponible: true } : {}),
      };
    }

    // ── FASE 3: TODAS LAS ESCRITURAS ─────────────────────────────────────────
    t.update(pedidoRef, { lineas, total });
    if (prodRef && prodUpdate) {
      t.update(prodRef, prodUpdate);
    }
  });
}

// ─── Asignar cliente a pedido ────────────────────────────────────────────────

export async function asignarClienteAPedido(
  pedidoId: string,
  clienteId: string,
  clienteNombre: string,
): Promise<void> {
  await updateDoc(doc(db, 'pedidos', pedidoId), { clienteId, clienteNombre });
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
    // ── FASE 1: LECTURA ──────────────────────────────────────────────────────
    const snap = await t.get(pedidoRef);
    if (!snap.exists()) return;

    // ── FASE 2: CÁLCULO ──────────────────────────────────────────────────────
    const data  = snap.data() as Omit<Pedido, 'id'>;
    const lineas = data.lineas.map(l =>
      l.id === lineaId ? { ...l, estado: 'listo' as const } : l,
    );

    const lineasCocina = lineas.filter(
      l => l.destino === 'cocina' || l.destino === 'ambos' || !l.destino,
    );
    const todasListas = lineasCocina.length > 0
      && lineasCocina.every(l => l.estado === 'listo' || l.estado === 'servido');

    const updates: Record<string, unknown> = { lineas };
    if (todasListas && data.estado === 'en_cocina') {
      updates['estado'] = 'listo';
    }

    // ── FASE 3: ESCRITURAS ───────────────────────────────────────────────────
    if (todasListas && data.estado === 'en_cocina') {
      t.set(doc(collection(db, 'notificaciones')), {
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

// ─── Actualizar nota de una línea ────────────────────────────────────────────

export async function actualizarNotaLinea(
  pedidoId: string,
  lineaId: string,
  notas: string,
): Promise<void> {
  const pedidoRef = doc(db, 'pedidos', pedidoId);
  await runTransaction(db, async (t) => {
    // ── FASE 1: LECTURA ──────────────────────────────────────────────────────
    const snap = await t.get(pedidoRef);
    if (!snap.exists()) return;

    // ── FASE 2: CÁLCULO ──────────────────────────────────────────────────────
    const data  = snap.data() as Omit<Pedido, 'id'>;
    const lineas = data.lineas.map(l =>
      l.id === lineaId
        ? { ...l, ...(notas ? { notas } : { notas: undefined }) }
        : l,
    );

    // ── FASE 3: ESCRITURA ────────────────────────────────────────────────────
    t.update(pedidoRef, { lineas });
  });
}

// ─── Sala: marcar línea como servida ────────────────────────────────────────

export async function marcarLineaServida(pedidoId: string, lineaId: string): Promise<void> {
  const pedidoRef = doc(db, 'pedidos', pedidoId);
  await runTransaction(db, async (t) => {
    // ── FASE 1: LECTURA ──────────────────────────────────────────────────────
    const snap = await t.get(pedidoRef);
    if (!snap.exists()) return;

    // ── FASE 2: CÁLCULO ──────────────────────────────────────────────────────
    const data  = snap.data() as Omit<Pedido, 'id'>;
    const lineas = data.lineas.map(l =>
      l.id === lineaId ? { ...l, estado: 'servido' as const } : l,
    );

    // ── FASE 3: ESCRITURA ────────────────────────────────────────────────────
    t.update(pedidoRef, { lineas });
  });
}

// ─── Eliminar mesa ────────────────────────────────────────────────────────────

export async function eliminarMesa(mesaId: string): Promise<void> {
  await deleteDoc(doc(db, 'mesas', mesaId));
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
