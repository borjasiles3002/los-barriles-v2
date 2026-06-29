import { useState, useEffect, useRef, useCallback } from 'react';
import { useMesas } from '../hooks/useMesas';
import { usePedidos } from '../hooks/usePedidos';
import { actualizarPosicionMesa, actualizarNombreMesa } from '../services/pedidos.service';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuthContext } from '../contexts/AuthContext';
import { FullScreenLoader } from './ui/LoadingSpinner';
import type { Mesa, Pedido } from '../types';

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

function mesaStyle(mesa: Mesa, pedido: Pedido | undefined, editMode: boolean) {
  const elapsed = pedido
    ? Math.floor((Date.now() - new Date(pedido.createdAt).getTime()) / 60000)
    : 0;

  const hasBebidas = pedido?.lineas.some(
    l => (l.destino === 'barra' || l.destino === 'ambos') && l.estado !== 'listo',
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

  void editMode;
}

// ─── Tarjeta de mesa ──────────────────────────────────────────────────────────

function MesaCard({
  mesa, pedido, editMode, onRename,
  onPointerDown,
}: {
  mesa: Mesa;
  pedido?: Pedido;
  editMode: boolean;
  onRename: (id: string, nombre: string) => void;
  onPointerDown: (e: React.PointerEvent, mesaId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(mesa.nombre);
  const elapsed = pedido
    ? Math.floor((Date.now() - new Date(pedido.createdAt).getTime()) / 60000)
    : null;

  const st = mesaStyle(mesa, pedido, editMode);

  const handleRename = () => {
    if (draftName.trim() && draftName !== mesa.nombre) {
      onRename(mesa.id, draftName.trim());
    }
    setRenaming(false);
  };

  return (
    <div
      className={`relative rounded-2xl border-2 p-3 flex flex-col gap-1.5 select-none transition-colors ${st.bg} ${st.border} ${editMode ? 'cursor-grab active:cursor-grabbing shadow-2xl' : ''}`}
      style={{ minWidth: 96, minHeight: 80 }}
      onPointerDown={editMode ? e => onPointerDown(e, mesa.id) : undefined}
    >
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
      {mesa.comensales && <span className="text-[10px] text-slate-500">{mesa.comensales} com.</span>}
    </div>
  );
}

// ─── SalaView principal ───────────────────────────────────────────────────────

export function SalaView() {
  const { user }                          = useAuthContext();
  const { mesas, loading: mLoading }     = useMesas();
  const { pedidos, loading: pLoading }   = usePedidos(['abierto', 'en_cocina', 'listo', 'cuenta_pedida']);
  const [editMode, setEditMode]           = useState(false);
  const [positions, setPositions]         = useState<Record<string, { x: number; y: number }>>({});
  const [draggingId, setDraggingId]       = useState<string | null>(null);
  const containerRef                      = useRef<HTMLDivElement>(null);
  const dragOffset                        = useRef({ dx: 0, dy: 0 });

  const canEdit = user?.role === 'admin' || user?.role === 'manager';
  const loading = mLoading || pLoading;

  const pedidoByMesa: Record<string, Pedido> = {};
  pedidos.forEach(p => { pedidoByMesa[p.mesaId] = p; });

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

  // ── Stats ─────────────────────────────────────────────────────────────────
  const libres   = mesas.filter(m => m.estado === 'libre').length;
  const ocupadas = mesas.filter(m => m.estado === 'ocupada').length;
  const cuentas  = mesas.filter(m => m.estado === 'cuenta_pedida').length;
  const listas   = pedidos.filter(p => p.estado === 'listo').length;

  if (loading) return <FullScreenLoader />;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
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
            {canEdit && (
              <div className="flex gap-2">
                {editMode && (
                  <button onClick={handleAddMesa}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl">
                    + Mesa
                  </button>
                )}
                <button
                  onClick={() => setEditMode(v => !v)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${editMode ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                >
                  {editMode ? '✓ Guardar mapa' : '✏️ Editar mapa'}
                </button>
              </div>
            )}
            <Clock />
          </div>
        </div>
      </div>

      {/* Leyenda */}
      {editMode && (
        <div className="shrink-0 bg-amber-900/30 border-b border-amber-700/50 px-4 py-1.5 text-xs text-amber-300 font-bold text-center">
          Modo edición — Arrastra las mesas · Doble clic en el nombre para renombrar
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
                onPointerDown={handlePointerDown}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
