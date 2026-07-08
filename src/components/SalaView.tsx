import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMesas } from '../hooks/useMesas';
import { usePedidos } from '../hooks/usePedidos';
import {
  actualizarPosicionMesa, actualizarNombreMesa,
  pedirCuenta, marcarLineaServida, eliminarMesa,
} from '../services/pedidos.service';
import { getTrabajadorPorPin } from '../services/personal.service';
import { addDoc, collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { FullScreenLoader } from './ui/LoadingSpinner';
import { useReservasHoy } from '../hooks/useReservas';
import type { Mesa, Pedido, LineaPedido } from '../types';

// ─── Reloj ────────────────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setTime(`${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`);
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-white text-3xl font-black tabular-nums">{time}</span>;
}

// ─── Colores por estado ───────────────────────────────────────────────────────

function mesaStyle(mesa: Mesa, pedido: Pedido | undefined) {
  const elapsed = pedido
    ? Math.floor((Date.now() - new Date(pedido.createdAt).getTime()) / 60000)
    : 0;

  const hasBebidas = pedido?.lineas.some(
    l => (l.destino === 'barra' || l.destino === 'ambos') && l.estado !== 'listo' && l.estado !== 'servido',
  ) ?? false;

  if (mesa.estado === 'libre')
    return { border: 'border-slate-600', bg: 'bg-slate-800/70', dot: 'bg-slate-500', label: 'Libre', labelColor: 'text-slate-500' };
  if (mesa.estado === 'cuenta_pedida')
    return { border: 'border-red-500', bg: 'bg-red-900/40', dot: 'bg-red-400 animate-pulse', label: '💳 Cuenta', labelColor: 'text-red-300' };
  if (hasBebidas)
    return { border: 'border-blue-400', bg: 'bg-blue-900/30', dot: 'bg-blue-400 animate-pulse', label: '🍺 Bebidas', labelColor: 'text-blue-300' };
  if (pedido?.estado === 'listo')
    return { border: 'border-emerald-400', bg: 'bg-emerald-900/30', dot: 'bg-emerald-400', label: '🍽️ Listo', labelColor: 'text-emerald-300' };
  if (elapsed > 30)
    return { border: 'border-red-400', bg: 'bg-red-900/20', dot: 'bg-red-400 animate-pulse', label: `${elapsed}m ⚠`, labelColor: 'text-red-300' };
  return { border: 'border-amber-500', bg: 'bg-amber-900/20', dot: 'bg-amber-400 animate-pulse', label: pedido?.estado === 'en_cocina' ? '🍳 Cocina' : 'Ocupada', labelColor: 'text-amber-300' };
}

// ─── Panel detalle pedido ─────────────────────────────────────────────────────

function lineaEstadoStyle(linea: LineaPedido) {
  if (linea.estado === 'servido')
    return { row: 'opacity-40', name: 'line-through text-slate-500', badge: 'bg-slate-600', icon: '' };
  if (linea.estado === 'listo')
    return { row: '', name: 'text-emerald-300 font-bold', badge: 'bg-emerald-700', icon: '✓ ' };
  if (linea.estado === 'en_preparacion')
    return { row: '', name: 'text-amber-300', badge: 'bg-amber-700', icon: '⏳ ' };
  return { row: '', name: 'text-white', badge: 'bg-slate-700', icon: '' };
}

function PedidoDetailPanel({ mesa, onClose }: { mesa: Mesa; onClose: () => void }) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [now, setNow]       = useState(Date.now());

  useEffect(() => {
    if (!mesa.pedidoActivo) return;
    const unsub = onSnapshot(doc(db, 'pedidos', mesa.pedidoActivo), (snap) => {
      setPedido(snap.exists() ? ({ id: snap.id, ...snap.data() } as Pedido) : null);
    });
    return unsub;
  }, [mesa.pedidoActivo]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const elapsed = pedido
    ? Math.floor((now - new Date(pedido.createdAt).getTime()) / 60000)
    : 0;

  const handleServido = async (lineaId: string) => {
    if (!pedido) return;
    try { await marcarLineaServida(pedido.id, lineaId); }
    catch (e) { console.error(e); }
  };

  const handlePedirCuenta = async () => {
    if (!pedido) return;
    try { await pedirCuenta(pedido.id, mesa.id, mesa.nombre); }
    catch (e) { console.error(e); }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-80 md:w-96 bg-slate-900 border-l border-slate-700 z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-slate-800 flex justify-between items-start">
          <div>
            <h2 className="text-white font-black text-xl">{mesa.nombre}</h2>
            {mesa.comensales != null && mesa.comensales > 0 && (
              <p className="text-slate-400 text-sm">{mesa.comensales} comensales</p>
            )}
            {mesa.estado === 'libre' ? (
              <p className="text-slate-500 text-sm mt-1">Mesa libre</p>
            ) : (
              <p className="text-amber-400 text-sm font-bold mt-1">{elapsed} min abierta</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl font-bold p-1 rounded-lg hover:bg-slate-700 transition-colors shrink-0 ml-2"
          >
            ✕
          </button>
        </div>

        {mesa.estado === 'libre' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
            <span className="text-4xl">🪑</span>
            <p className="text-lg font-bold">Mesa libre</p>
            <p className="text-sm text-center px-4">Abre la mesa desde el TPV para comenzar un pedido</p>
          </div>
        ) : (
          <>
            {/* Líneas del pedido */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {!pedido ? (
                <p className="text-slate-500 text-center py-8">Cargando pedido...</p>
              ) : pedido.lineas.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Sin productos</p>
              ) : (
                pedido.lineas.map(linea => {
                  const st = lineaEstadoStyle(linea);
                  return (
                    <div
                      key={linea.id}
                      className={`flex items-center gap-2 p-3 rounded-xl bg-slate-800 border border-slate-700 transition-all ${st.row}`}
                    >
                      <span className={`text-xs font-black px-2 py-1 rounded-lg min-w-[2rem] text-center text-white shrink-0 ${st.badge}`}>
                        {linea.cantidad}×
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-tight ${st.name}`}>
                          {st.icon}{linea.nombre}
                        </p>
                        {linea.notas && (
                          <p className="text-amber-400 text-xs italic mt-0.5">⚠ {linea.notas}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <p className="text-slate-400 text-xs">{(linea.precio * linea.cantidad).toFixed(2)}€</p>
                        {linea.estado === 'listo' && (
                          <button
                            onClick={() => handleServido(linea.id)}
                            className="text-[10px] px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg font-bold transition-all"
                          >
                            Servido
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700 bg-slate-800/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase text-sm">Total</span>
                <span className="text-white font-black text-xl">{pedido?.total?.toFixed(2) ?? '0.00'}€</span>
              </div>
              {pedido?.estado === 'cuenta_pedida' ? (
                <div className="w-full py-3 bg-red-900/40 border border-red-600 text-red-300 font-bold text-center rounded-xl text-sm">
                  💳 Cuenta pedida
                </div>
              ) : (
                <button
                  onClick={handlePedirCuenta}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black rounded-xl transition-all"
                >
                  💳 Pedir cuenta
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Tarjeta de mesa ──────────────────────────────────────────────────────────

function MesaCard({
  mesa, pedido, editMode, onRename, onDelete, onClick,
  onPointerDown, tieneReserva, reservaNombre,
}: {
  mesa: Mesa;
  pedido?: Pedido;
  editMode: boolean;
  onRename: (id: string, nombre: string) => void;
  onDelete: (id: string) => void;
  onClick: (mesa: Mesa) => void;
  onPointerDown: (e: React.PointerEvent, mesaId: string) => void;
  tieneReserva?: boolean;
  reservaNombre?: string;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(mesa.nombre);
  const elapsed = pedido
    ? Math.floor((Date.now() - new Date(pedido.createdAt).getTime()) / 60000)
    : null;

  const st = mesaStyle(mesa, pedido);

  const handleRename = () => {
    if (draftName.trim() && draftName !== mesa.nombre) {
      onRename(mesa.id, draftName.trim());
    }
    setRenaming(false);
  };

  const showReservaBorder = tieneReserva && mesa.estado === 'libre';

  return (
    <div
      className={`relative rounded-2xl border-2 p-3 flex flex-col gap-1.5 select-none transition-colors ${st.bg} ${showReservaBorder ? 'border-yellow-400' : st.border} ${editMode ? 'cursor-grab active:cursor-grabbing shadow-2xl' : 'cursor-pointer hover:opacity-90'}`}
      style={{ minWidth: 96, minHeight: 80 }}
      onPointerDown={editMode ? e => onPointerDown(e, mesa.id) : undefined}
      onClick={!editMode ? () => onClick(mesa) : undefined}
    >
      {/* Botón eliminar (solo en modo edición) */}
      {editMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(mesa.id); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute -top-2 -right-2 w-5 h-5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg z-10 transition-colors"
          title={`Eliminar ${mesa.nombre}`}
        >
          ✕
        </button>
      )}

      {editMode && renaming ? (
        <input
          autoFocus
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          className="bg-slate-700 text-white text-sm font-bold rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      ) : (
        <p
          className="text-white font-black text-base leading-tight"
          onDoubleClick={editMode ? (e) => { e.stopPropagation(); setRenaming(true); } : undefined}
        >
          {mesa.nombre}
        </p>
      )}
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
        <span className={`text-[10px] font-bold uppercase truncate ${st.labelColor}`}>{st.label}</span>
      </div>
      {elapsed !== null && mesa.estado !== 'libre' && (
        <span className="text-xs font-mono text-slate-400">{elapsed}m · {pedido?.total?.toFixed(2) ?? '0.00'}€</span>
      )}
      {mesa.comensales != null && mesa.comensales > 0 && (
        <span className="text-[10px] text-slate-500">{mesa.comensales} com.</span>
      )}
      {showReservaBorder && reservaNombre && (
        <span className="text-[10px] text-yellow-400 font-bold truncate">📅 {reservaNombre}</span>
      )}
    </div>
  );
}

// ─── PIN modal para desbloquear edición ──────────────────────────────────────

function PinEditModal({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const [pin, setPin]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (pin.length !== 4) { setError('El PIN debe tener 4 dígitos'); return; }
    setLoading(true);
    setError('');
    try {
      const user = await getTrabajadorPorPin(pin);
      if (!user || !['gerente', 'admin', 'manager'].includes(user.role)) {
        setError('PIN incorrecto o sin permisos de edición');
        setPin('');
      } else {
        onSuccess();
      }
    } catch {
      setError('Error al verificar PIN. Comprueba la conexión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl p-6 w-72 shadow-2xl border border-slate-700 space-y-4">
        <div className="text-center">
          <span className="text-4xl">🔐</span>
          <h2 className="text-white font-black text-lg mt-2">PIN de gerencia</h2>
          <p className="text-slate-400 text-xs mt-1">Introduce el PIN de gerente o manager</p>
        </div>
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') void handleVerify(); }}
          placeholder="● ● ● ●"
          className="w-full text-center text-3xl tracking-[1rem] bg-slate-700 text-white rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {error && <p className="text-red-400 text-xs text-center font-semibold">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose}
            className="py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition">
            Cancelar
          </button>
          <button onClick={() => void handleVerify()} disabled={loading || pin.length !== 4}
            className="py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl transition disabled:opacity-50">
            {loading ? '…' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SalaView principal ───────────────────────────────────────────────────────

export function SalaView() {
  const { mesas, loading: mLoading }     = useMesas();
  const { pedidos, loading: pLoading }   = usePedidos(['abierto', 'en_cocina', 'listo', 'cuenta_pedida']);
  const { reservas: reservasHoy }        = useReservasHoy();
  const [editMode, setEditMode]           = useState(false);
  const [showPinModal, setShowPinModal]   = useState(false);
  const [positions, setPositions]         = useState<Record<string, { x: number; y: number }>>({});
  const [draggingId, setDraggingId]       = useState<string | null>(null);
  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null);
  const containerRef                      = useRef<HTMLDivElement>(null);
  const dragOffset                        = useRef({ dx: 0, dy: 0 });
  const loading = mLoading || pLoading;

  const mesasConReservaProxima = useMemo(() => {
    const now  = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    const map  = new Map<string, string>();
    for (const r of reservasHoy) {
      if (!r.mesaId) continue;
      if (r.estado !== 'pendiente' && r.estado !== 'confirmada') continue;
      const [hh, mm] = r.hora.split(':').map(Number);
      const rM = (hh ?? 0) * 60 + (mm ?? 0);
      if (rM >= nowM && rM - nowM <= 60) {
        map.set(r.mesaId, r.nombre);
      }
    }
    return map;
  }, [reservasHoy]);

  const pedidoByMesa: Record<string, Pedido> = {};
  pedidos.forEach(p => { pedidoByMesa[p.mesaId] = p; });

  // Mesa seleccionada siempre sincronizada con datos en vivo
  const selectedMesa = selectedMesaId ? (mesas.find(m => m.id === selectedMesaId) ?? null) : null;

  // Inicializar posiciones desde Firestore
  useEffect(() => {
    const initial: Record<string, { x: number; y: number }> = {};
    mesas.forEach((m, i) => {
      initial[m.id] = { x: m.posX ?? (i % 6) * 16 + 1, y: m.posY ?? Math.floor(i / 6) * 22 + 3 };
    });
    setPositions(initial);
  }, [mesas]);

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent, mesaId: string) => {
    if (!editMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect  = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pos   = positions[mesaId] ?? { x: 0, y: 0 };
    const pxX   = (pos.x / 100) * rect.width;
    const pxY   = (pos.y / 100) * rect.height;
    dragOffset.current = {
      dx: e.clientX - rect.left - pxX,
      dy: e.clientY - rect.top  - pxY,
    };
    setDraggingId(mesaId);
  }, [editMode, positions]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingId || !editMode) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rawX = e.clientX - rect.left - dragOffset.current.dx;
    const rawY = e.clientY - rect.top  - dragOffset.current.dy;
    const x    = Math.max(0, Math.min(93, (rawX / rect.width)  * 100));
    const y    = Math.max(0, Math.min(90, (rawY / rect.height) * 100));
    setPositions(p => ({ ...p, [draggingId]: { x, y } }));
  }, [draggingId, editMode]);

  const handlePointerUp = useCallback(async () => {
    if (!draggingId) return;
    const pos = positions[draggingId];
    if (pos) {
      try { await actualizarPosicionMesa(draggingId, pos.x, pos.y); }
      catch (e) { console.error(e); }
    }
    setDraggingId(null);
  }, [draggingId, positions]);

  const handleRename = async (mesaId: string, nombre: string) => {
    try { await actualizarNombreMesa(mesaId, nombre); }
    catch (e) { console.error(e); }
  };

  const handleAddMesa = async () => {
    const nombre = prompt('Nombre de la nueva mesa:', `Mesa ${mesas.length + 1}`);
    if (!nombre) return;
    try {
      await addDoc(collection(db, 'mesas'), {
        numero: mesas.length + 1,
        nombre,
        estado: 'libre',
        pedidoActivo: null,
        posX: 50,
        posY: 50,
      });
    } catch (e) { console.error(e); }
  };

  const handleDeleteMesa = async (mesaId: string) => {
    const mesa = mesas.find(m => m.id === mesaId);
    if (!mesa) return;
    if (mesa.estado !== 'libre') {
      alert(`${mesa.nombre} tiene un pedido activo. Cierra el pedido antes de eliminarla.`);
      return;
    }
    if (!window.confirm(`¿Eliminar ${mesa.nombre}?`)) return;
    try { await eliminarMesa(mesaId); }
    catch (e) { console.error(e); }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const libres   = mesas.filter(m => m.estado === 'libre').length;
  const ocupadas = mesas.filter(m => m.estado === 'ocupada').length;
  const cuentas  = mesas.filter(m => m.estado === 'cuenta_pedida').length;
  const listas   = pedidos.filter(p => p.estado === 'listo').length;

  if (loading) return <FullScreenLoader />;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* PIN modal edición */}
      {showPinModal && (
        <PinEditModal
          onSuccess={() => { setShowPinModal(false); setEditMode(true); }}
          onClose={() => setShowPinModal(false)}
        />
      )}

      {/* Header */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-700 px-4 md:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-8">
            <h1 className="text-white font-black text-base md:text-xl tracking-wide uppercase hidden sm:block">
              🍺 Los Barriles — Sala
            </h1>
            <div className="flex gap-3 md:gap-6 text-xs md:text-sm">
              {[
                { label: 'Libres',   v: libres,   c: 'text-slate-400' },
                { label: 'Ocupadas', v: ocupadas,  c: 'text-amber-400' },
                { label: 'Cuentas',  v: cuentas,  c: 'text-red-400' },
                { label: 'Listas',   v: listas,   c: 'text-emerald-400' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`font-black text-lg md:text-2xl ${s.c}`}>{s.v}</p>
                  <p className="text-slate-500 text-[10px] md:text-xs uppercase">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {editMode ? (
              <div className="flex gap-2">
                <button onClick={handleAddMesa}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl">
                  ＋ Mesa
                </button>
                <button onClick={() => setEditMode(false)}
                  className="px-3 py-1.5 bg-amber-500 text-black text-xs font-black rounded-xl">
                  ✓ Guardar y salir
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPinModal(true)}
                className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-700/60 text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                title="Editar mapa (requiere PIN de gerencia)"
              >
                🔧 Editar
              </button>
            )}
            <Clock />
          </div>
        </div>
      </div>

      {/* Leyenda modo edición */}
      {editMode && (
        <div className="shrink-0 bg-amber-900/30 border-b border-amber-700/50 px-4 py-1.5 text-xs text-amber-300 font-bold text-center">
          Modo edición — Arrastra las mesas · Doble clic para renombrar · ✕ para eliminar
        </div>
      )}

      {/* Mapa de mesas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden p-2"
        onPointerMove={editMode ? handlePointerMove : undefined}
        onPointerUp={editMode ? handlePointerUp : undefined}
        onPointerLeave={editMode ? handlePointerUp : undefined}
      >
        {mesas.map(mesa => {
          const pos = positions[mesa.id] ?? { x: 0, y: 0 };
          return (
            <div
              key={mesa.id}
              style={{
                position: 'absolute',
                left:      `${pos.x}%`,
                top:       `${pos.y}%`,
                zIndex:    draggingId === mesa.id ? 50 : 1,
                transform: draggingId === mesa.id ? 'scale(1.08)' : 'scale(1)',
                transition: draggingId === mesa.id ? 'none' : 'left 0.15s, top 0.15s, transform 0.1s',
              }}
            >
              <MesaCard
                mesa={mesa}
                pedido={pedidoByMesa[mesa.id]}
                editMode={editMode}
                onRename={handleRename}
                onDelete={handleDeleteMesa}
                onClick={(m) => setSelectedMesaId(m.id)}
                onPointerDown={handlePointerDown}
                tieneReserva={mesasConReservaProxima.has(mesa.id)}
                reservaNombre={mesasConReservaProxima.get(mesa.id)}
              />
            </div>
          );
        })}
      </div>

      {/* Panel detalle pedido */}
      {selectedMesa && (
        <PedidoDetailPanel
          mesa={selectedMesa}
          onClose={() => setSelectedMesaId(null)}
        />
      )}
    </div>
  );
}
