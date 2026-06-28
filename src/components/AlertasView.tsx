import React from 'react';
import { useAlertas } from '../hooks/useAlertas';
import { marcarAlertaLeida, marcarTodasAlertasLeidas } from '../services/alertas.service';
import type { Alerta, AlertaTipo } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

const TIPO_CONFIG: Record<AlertaTipo, { icon: string; color: string; label: string }> = {
  precio_subida: { icon: '📈', color: 'border-orange-500 bg-orange-950/20', label: 'Precio subida' },
  stock_minimo:  { icon: '📦', color: 'border-red-500 bg-red-950/20',    label: 'Stock mínimo' },
  food_cost:     { icon: '🍽️', color: 'border-yellow-500 bg-yellow-950/20', label: 'Food cost alto' },
};

function AlertaCard({ alerta }: { alerta: Alerta }) {
  const cfg = TIPO_CONFIG[alerta.tipo];

  const handleMark = async () => {
    await marcarAlertaLeida(alerta.id).catch(console.error);
  };

  return (
    <div className={`rounded-2xl border p-4 ${cfg.color} ${alerta.leido ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase text-slate-400">{cfg.label}</span>
            <span className="text-xs text-slate-500">
              {new Date(alerta.createdAt).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          <p className="text-white text-sm leading-relaxed">{alerta.mensaje}</p>
        </div>
        {!alerta.leido && (
          <button
            onClick={handleMark}
            className="shrink-0 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg"
          >
            ✓
          </button>
        )}
      </div>
    </div>
  );
}

export const AlertasView: React.FC = () => {
  const { alertas, loading } = useAlertas();
  const sinLeer              = alertas.filter(a => !a.leido).length;

  const handleMarcarTodas = async () => {
    await marcarTodasAlertasLeidas().catch(console.error);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-black text-2xl">Alertas</h1>
            <p className="text-slate-400 text-sm">
              {sinLeer > 0 ? `${sinLeer} sin leer` : 'Todo al día'}
            </p>
          </div>
          {sinLeer > 0 && (
            <button
              onClick={handleMarcarTodas}
              className="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 text-sm rounded-xl hover:bg-slate-700"
            >
              Marcar todas leídas
            </button>
          )}
        </div>

        {/* Filters summary */}
        {alertas.length > 0 && (
          <div className="flex gap-3 flex-wrap">
            {(['precio_subida', 'food_cost', 'stock_minimo'] as AlertaTipo[]).map(tipo => {
              const count = alertas.filter(a => a.tipo === tipo && !a.leido).length;
              if (count === 0) return null;
              const cfg   = TIPO_CONFIG[tipo];
              return (
                <div key={tipo} className={`px-3 py-1 rounded-full border text-xs font-bold ${cfg.color}`}>
                  {cfg.icon} {cfg.label}: {count}
                </div>
              );
            })}
          </div>
        )}

        {/* Alertas list */}
        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner size={8} /></div>
        ) : alertas.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-bold">Sin alertas</p>
            <p className="text-sm">Las alertas de precios y stock aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Unread first */}
            {alertas.filter(a => !a.leido).map(a => <AlertaCard key={a.id} alerta={a} />)}
            {alertas.filter(a => a.leido).length > 0 && (
              <>
                <p className="text-slate-500 text-xs uppercase font-bold pt-2">Leídas</p>
                {alertas.filter(a => a.leido).slice(0, 20).map(a => <AlertaCard key={a.id} alerta={a} />)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
