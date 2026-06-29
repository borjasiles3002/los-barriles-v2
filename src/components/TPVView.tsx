import { useState } from 'react';
import type { Mesa } from '../types';
import { useMesas } from '../hooks/useMesas';
import { usePedido } from '../hooks/usePedido';
import { useCarta } from '../hooks/useCarta';
import { useNotificaciones } from '../hooks/useNotificaciones';
import { useAuthContext } from '../contexts/AuthContext';
import { abrirMesa } from '../services/pedidos.service';
import { MesaDetalle } from './MesaDetalle';
import { NotificacionesBanner } from './NotificacionesBanner';
import { Badge } from './ui/Badge';
import { FullScreenLoader } from './ui/LoadingSpinner';

// ─── Mesa card ────────────────────────────────────────────────────────────────

function MesaCard({ mesa, onSelect }: { mesa: Mesa; onSelect: (m: Mesa) => void }) {
  const colorMap = {
    libre:         'bg-slate-700 border-slate-600 text-slate-300',
    ocupada:       'bg-blue-900 border-blue-500 text-white',
    cuenta_pedida: 'bg-red-900 border-red-500 text-white',
  };
  const dotMap = {
    libre:         'bg-slate-500',
    ocupada:       'bg-blue-400 animate-pulse',
    cuenta_pedida: 'bg-red-400 animate-pulse',
  };
  const labelMap = {
    libre:         'Libre',
    ocupada:       'Ocupada',
    cuenta_pedida: 'Cuenta pedida',
  };

  return (
    <button
      onClick={() => onSelect(mesa)}
      className={`relative rounded-2xl border-2 p-4 flex flex-col items-center gap-2 h-24 transition-all active:scale-95 hover:brightness-110 ${colorMap[mesa.estado]}`}
    >
      <span className="font-black text-base leading-tight text-center">{mesa.nombre}</span>
      {mesa.comensales && <span className="text-[10px] opacity-70">{mesa.comensales} com.</span>}
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotMap[mesa.estado]}`} />
        <span className="text-[10px] font-bold uppercase opacity-80">{labelMap[mesa.estado]}</span>
      </div>
    </button>
  );
}

// ─── Modal comensales ─────────────────────────────────────────────────────────

function ComensalesModal({
  mesa,
  onConfirm,
  onCancel,
}: {
  mesa: Mesa;
  onConfirm: (n: number) => void;
  onCancel: () => void;
}) {
  const [n, setN] = useState(2);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
      <div className="w-full bg-slate-800 rounded-t-2xl p-6 space-y-4">
        <h3 className="text-white font-black text-xl text-center">{mesa.nombre}</h3>
        <p className="text-slate-400 text-sm text-center">¿Cuántos comensales?</p>
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => setN(v => Math.max(1, v - 1))}
            className="w-14 h-14 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-90 text-white text-3xl font-black transition-all">
            −
          </button>
          <span className="text-white font-black text-5xl w-16 text-center tabular-nums">{n}</span>
          <button onClick={() => setN(v => v + 1)}
            className="w-14 h-14 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-90 text-white text-3xl font-black transition-all">
            +
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(v => (
            <button key={v} onClick={() => setN(v)}
              className={`py-2 rounded-xl text-sm font-bold transition-colors ${n === v ? 'bg-amber-500 text-black' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
              {v}
            </button>
          ))}
        </div>
        <button onClick={() => onConfirm(n)}
          className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black text-lg rounded-xl transition-all">
          Abrir mesa
        </button>
        <button onClick={onCancel}
          className="w-full py-2 text-slate-400 hover:text-white font-bold transition-colors text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Wrapper pedido ───────────────────────────────────────────────────────────

function MesaDetalleWrapper({ mesa, onClose }: { mesa: Mesa; onClose: () => void }) {
  const { pedido, loading }        = usePedido(mesa.pedidoActivo ?? null);
  const { categorias, productos }  = useCarta();

  if (loading) return <FullScreenLoader message="Cargando pedido..." />;
  if (!pedido) return null;

  return (
    <MesaDetalle
      mesa={mesa}
      pedido={pedido}
      categorias={categorias}
      productos={productos}
      onClose={onClose}
    />
  );
}

// ─── TPV View ─────────────────────────────────────────────────────────────────

export function TPVView() {
  const { user }            = useAuthContext();
  const { mesas, loading }  = useMesas();
  const { notificaciones }  = useNotificaciones();

  const [selectedMesa, setSelectedMesa]         = useState<Mesa | null>(null);
  const [openingMesa, setOpeningMesa]           = useState<string | null>(null);
  const [comensalesModal, setComensalesModal]   = useState<Mesa | null>(null);

  if (loading) return <FullScreenLoader />;

  const handleMesaSelect = (mesa: Mesa) => {
    if (mesa.estado === 'libre') {
      setComensalesModal(mesa);
    } else {
      setSelectedMesa(mesa);
    }
  };

  const handleOpenMesa = async (comensales: number) => {
    if (!comensalesModal) return;
    const mesa = comensalesModal;
    setComensalesModal(null);
    setOpeningMesa(mesa.id);
    try {
      await abrirMesa(mesa.id, mesa.nombre, user?.uid ?? '', user?.nombre ?? '', comensales);
      setSelectedMesa({ ...mesa, estado: 'ocupada', comensales });
    } catch (e) {
      console.error(e);
    } finally {
      setOpeningMesa(null);
    }
  };

  const liveMesa   = selectedMesa ? mesas.find(m => m.id === selectedMesa.id) ?? selectedMesa : null;
  const showDetail = liveMesa && liveMesa.estado !== 'libre' && liveMesa.pedidoActivo;

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      {/* Modal comensales */}
      {comensalesModal && (
        <ComensalesModal
          mesa={comensalesModal}
          onConfirm={handleOpenMesa}
          onCancel={() => setComensalesModal(null)}
        />
      )}

      {/* Top bar */}
      <div className="shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-white font-black text-lg">🍺 Los Barriles</h1>
          <p className="text-slate-400 text-xs">{user?.nombre}</p>
        </div>
        <div className="relative">
          <button className="p-2 rounded-lg bg-slate-700 text-slate-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          <Badge count={notificaciones.length} />
        </div>
      </div>

      {/* Notificaciones */}
      <NotificacionesBanner notificaciones={notificaciones} />

      {/* Grid mesas */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {mesas.map(mesa => (
            <div key={mesa.id} className="relative">
              <MesaCard mesa={mesa} onSelect={handleMesaSelect} />
              {openingMesa === mesa.id && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detalle de mesa */}
      {showDetail && liveMesa && (
        <MesaDetalleWrapper mesa={liveMesa} onClose={() => setSelectedMesa(null)} />
      )}
    </div>
  );
}
