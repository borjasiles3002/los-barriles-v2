import React from 'react';
import { useMesas } from '../hooks/useMesas';
import { usePedidos } from '../hooks/usePedidos';
import { FullScreenLoader } from './ui/LoadingSpinner';
import type { Mesa, Pedido } from '../types';

function SalaMesaCard({ mesa, pedido }: { mesa: Mesa; pedido?: Pedido }) {
  const elapsed = pedido
    ? Math.floor((Date.now() - new Date(pedido.createdAt).getTime()) / 60000)
    : 0;

  const stateConfig = {
    libre: {
      border: 'border-slate-600',
      bg:     'bg-slate-800/50',
      dot:    'bg-slate-500',
      label:  'Libre',
    },
    ocupada: {
      border: 'border-blue-500',
      bg:     'bg-blue-900/30',
      dot:    'bg-blue-400 animate-pulse',
      label:  pedido?.estado === 'listo' ? '🍽️ Listo' : pedido?.estado === 'en_cocina' ? '🍳 Cocina' : 'Ocupada',
    },
    cuenta_pedida: {
      border: 'border-red-500',
      bg:     'bg-red-900/30',
      dot:    'bg-red-400 animate-pulse',
      label:  '💳 Cuenta',
    },
  }[mesa.estado];

  const isUrgent = elapsed > 45 && mesa.estado !== 'libre';
  const isReady  = pedido?.estado === 'listo';

  return (
    <div
      className={`rounded-2xl border-2 p-4 flex flex-col gap-3 transition-all ${stateConfig.bg} ${
        isUrgent ? 'border-red-400 shadow-red-500/30 shadow-lg' :
        isReady  ? 'border-emerald-400 shadow-emerald-500/20 shadow-lg' :
        stateConfig.border
      }`}
    >
      {/* Mesa name */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-black text-xl">{mesa.nombre}</h3>
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${stateConfig.dot}`} />
        </div>
      </div>

      {/* Status + elapsed */}
      <div className="flex items-end justify-between">
        <span className={`text-xs font-bold uppercase tracking-wide ${
          isReady  ? 'text-emerald-400' :
          isUrgent ? 'text-red-400' :
          mesa.estado === 'cuenta_pedida' ? 'text-red-300' :
          mesa.estado === 'ocupada'       ? 'text-blue-300' :
          'text-slate-500'
        }`}>
          {stateConfig.label}
        </span>

        {pedido && mesa.estado !== 'libre' && (
          <span className={`text-sm font-black font-mono ${isUrgent ? 'text-red-400' : 'text-slate-400'}`}>
            {elapsed}m
          </span>
        )}
      </div>

      {/* Total if occupied */}
      {pedido && mesa.estado !== 'libre' && pedido.total > 0 && (
        <span className="text-amber-400 font-black text-lg">{pedido.total.toFixed(2)}€</span>
      )}
    </div>
  );
}

export const SalaView: React.FC = () => {
  const { mesas, loading: mLoading } = useMesas();
  const { pedidos, loading: pLoading } = usePedidos(['abierto', 'en_cocina', 'listo', 'cuenta_pedida']);

  const loading = mLoading || pLoading;
  if (loading) return <FullScreenLoader />;

  const pedidoByMesa: Record<string, Pedido> = {};
  pedidos.forEach(p => { pedidoByMesa[p.mesaId] = p; });

  const libres       = mesas.filter(m => m.estado === 'libre').length;
  const ocupadas     = mesas.filter(m => m.estado === 'ocupada').length;
  const cuentas      = mesas.filter(m => m.estado === 'cuenta_pedida').length;
  const listas       = pedidos.filter(p => p.estado === 'listo').length;

  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const mins  = now.getMinutes().toString().padStart(2, '0');

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Status bar */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-white font-black text-xl tracking-widest uppercase">🍺 Los Barriles — Sala</h1>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Stat label="Libres"       value={libres}   color="text-slate-400" />
            <Stat label="Ocupadas"     value={ocupadas}  color="text-blue-400" />
            <Stat label="Cuentas"      value={cuentas}  color="text-red-400" />
            <Stat label="Listas ↑"     value={listas}   color="text-emerald-400" />
            <span className="text-slate-400 font-mono text-lg">{hours}:{mins}</span>
          </div>
        </div>
      </div>

      {/* Mesa grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3">
          {mesas.map(mesa => (
            <SalaMesaCard
              key={mesa.id}
              mesa={mesa}
              pedido={pedidoByMesa[mesa.id]}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`font-black text-xl ${color}`}>{value}</p>
      <p className="text-slate-500 text-xs uppercase">{label}</p>
    </div>
  );
}
