import React from 'react';
import type { Notificacion } from '../types';
import { marcarTodasLeidas } from '../services/pedidos.service';

interface Props {
  notificaciones: Notificacion[];
}

export const NotificacionesBanner: React.FC<Props> = ({ notificaciones }) => {
  if (notificaciones.length === 0) return null;

  const handleDismiss = () => {
    marcarTodasLeidas(notificaciones.map(n => n.id)).catch(console.error);
  };

  return (
    <div className="bg-emerald-600 border-b border-emerald-500 px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">🍽️</span>
        <div>
          <p className="text-white font-bold text-sm">
            {notificaciones.length === 1
              ? `¡Pedido listo para ${notificaciones[0].mesaNombre}!`
              : `${notificaciones.length} pedidos listos para servir`}
          </p>
          {notificaciones.length <= 3 && (
            <p className="text-emerald-200 text-xs">
              {notificaciones.map(n => n.mesaNombre).join(', ')}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shrink-0"
      >
        Entendido
      </button>
    </div>
  );
};
