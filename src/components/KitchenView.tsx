import React, { useState } from 'react';
import { usePedidos } from '../hooks/usePedidos';
import { marcarLineaLista, cambiarEstadoPedido } from '../services/pedidos.service';
import { FullScreenLoader } from './ui/LoadingSpinner';
import type { Pedido, LineaEstado } from '../types';

const LINE_COLORS: Record<LineaEstado, string> = {
  pendiente:       'bg-slate-800 border-slate-600',
  en_preparacion:  'bg-yellow-900/40 border-yellow-600',
  listo:           'bg-emerald-900/40 border-emerald-600 opacity-60',
};

const LINE_STATUS_LABELS: Record<LineaEstado, string> = {
  pendiente:       'Pendiente',
  en_preparacion:  'En prep.',
  listo:           '✓ Listo',
};

function OrderCard({ pedido }: { pedido: Pedido }) {
  const [loading, setLoading] = useState(false);
  const elapsed = Math.floor(
    (Date.now() - new Date(pedido.createdAt).getTime()) / 60000,
  );
  const allReady = pedido.lineas.every(l => l.estado === 'listo');

  const handleMarkLine = async (lineaId: string) => {
    try {
      await marcarLineaLista(pedido.id, lineaId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await cambiarEstadoPedido(pedido.id, 'listo');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 overflow-hidden shadow-xl w-80 shrink-0 ${
        elapsed > 15
          ? 'border-red-500 bg-red-950/40'
          : pedido.estado === 'listo'
          ? 'border-emerald-500 bg-emerald-950/40'
          : 'border-slate-600 bg-slate-800'
      }`}
    >
      {/* Header */}
      <div className={`px-4 py-3 flex justify-between items-center border-b ${
        pedido.estado === 'listo' ? 'border-emerald-700 bg-emerald-900/50' : 'border-slate-700 bg-slate-900/60'
      }`}>
        <h3 className="text-white font-black text-xl">{pedido.mesaNombre}</h3>
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold text-sm ${elapsed > 15 ? 'text-red-400' : 'text-slate-300'}`}>
            {elapsed}m
          </span>
          {pedido.estado === 'listo' && (
            <span className="text-emerald-400 text-sm font-bold">✓ Listo</span>
          )}
        </div>
      </div>

      {/* Line items */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {pedido.lineas.map(linea => (
          <div
            key={linea.id}
            className={`flex items-center gap-3 rounded-xl p-3 border ${LINE_COLORS[linea.estado]}`}
          >
            <span className={`font-black text-sm px-2.5 py-1 rounded-lg ${
              linea.estado === 'listo'    ? 'bg-emerald-500 text-white'   :
              linea.estado === 'en_preparacion' ? 'bg-yellow-400 text-black' :
              'bg-red-800 text-white'
            }`}>
              {linea.cantidad}×
            </span>

            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm ${linea.estado === 'listo' ? 'line-through text-slate-400' : 'text-white'}`}>
                {linea.nombre}
              </p>
              <p className={`text-[10px] font-bold uppercase ${
                linea.estado === 'listo' ? 'text-emerald-400' :
                linea.estado === 'en_preparacion' ? 'text-yellow-400' :
                'text-slate-400'
              }`}>
                {LINE_STATUS_LABELS[linea.estado]}
              </p>
            </div>

            {linea.estado !== 'listo' && pedido.estado !== 'listo' && (
              <button
                onClick={() => handleMarkLine(linea.id)}
                className="shrink-0 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg transition-colors"
              >
                Listo
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      {pedido.estado !== 'listo' && (
        <div className="p-3 border-t border-slate-700 bg-slate-900/60">
          <button
            onClick={handleComplete}
            disabled={!allReady || loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-black text-sm rounded-xl uppercase tracking-wide transition-colors"
          >
            {loading ? '...' : allReady ? '✓ Pedido completo' : 'Marcar líneas como listas'}
          </button>
        </div>
      )}
    </div>
  );
}

export const KitchenView: React.FC = () => {
  const { pedidos, loading } = usePedidos(['en_cocina', 'listo']);

  if (loading) return <FullScreenLoader />;

  const activePedidos = pedidos.filter(p => p.estado !== 'cerrado');

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">🍳</span>
        <div>
          <h1 className="text-white font-black text-lg">Cocina</h1>
          <p className="text-slate-400 text-xs">
            {activePedidos.length === 0
              ? 'Sin comandas activas'
              : `${activePedidos.length} comanda${activePedidos.length > 1 ? 's' : ''} activa${activePedidos.length > 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Orders horizontal scroll */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {activePedidos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
            <span className="text-5xl">✅</span>
            <p className="font-bold text-lg">Sin comandas activas</p>
            <p className="text-sm">Las nuevas comandas aparecerán aquí</p>
          </div>
        ) : (
          <div className="flex gap-4 h-full pb-2">
            {activePedidos.map(pedido => (
              <OrderCard key={pedido.id} pedido={pedido} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
