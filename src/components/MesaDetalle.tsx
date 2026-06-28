import React, { useState } from 'react';
import type { Mesa, Pedido, Producto, Categoria, PedidoEstado } from '../types';
import {
  agregarProducto, quitarProducto,
  cambiarEstadoPedido, cerrarPedido,
  actualizarEstadoMesa,
} from '../services/pedidos.service';
import { LoadingSpinner } from './ui/LoadingSpinner';

interface Props {
  mesa: Mesa;
  pedido: Pedido;
  categorias: Categoria[];
  productos: Producto[];
  onClose: () => void;
}

type Tab = 'pedido' | 'carta';

const ESTADO_LABELS: Record<PedidoEstado, string> = {
  abierto:       'Abierto',
  en_cocina:     'En cocina',
  listo:         'Listo',
  cuenta_pedida: 'Cuenta pedida',
  cerrado:       'Cerrado',
};

const ESTADO_COLORS: Record<PedidoEstado, string> = {
  abierto:       'bg-blue-600',
  en_cocina:     'bg-orange-500',
  listo:         'bg-emerald-500',
  cuenta_pedida: 'bg-red-500',
  cerrado:       'bg-slate-500',
};

export const MesaDetalle: React.FC<Props> = ({
  mesa, pedido, categorias, productos, onClose,
}) => {
  const [tab, setTab]                   = useState<Tab>('carta');
  const [activeCat, setActiveCat]       = useState<string>(categorias[0]?.id ?? '');
  const [loadingAction, setLoadingAction] = useState(false);

  const elapsed = Math.floor(
    (Date.now() - new Date(pedido.createdAt).getTime()) / 60000,
  );

  const productosDeCat = productos.filter(
    p => p.categoriaId === activeCat && p.disponible,
  );

  const handleAddProduct = async (prod: Producto) => {
    try {
      await agregarProducto(pedido.id, prod);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveLinea = async (lineaId: string) => {
    try {
      await quitarProducto(pedido.id, lineaId);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEstadoAction = async (
    nuevoEstado: PedidoEstado,
    mesaEstado?: 'libre' | 'ocupada' | 'cuenta_pedida',
  ) => {
    setLoadingAction(true);
    try {
      if (nuevoEstado === 'cerrado') {
        await cerrarPedido(pedido.id, mesa.id);
        onClose();
        return;
      }
      await cambiarEstadoPedido(pedido.id, nuevoEstado);
      if (mesaEstado) {
        await actualizarEstadoMesa(mesa.id, mesaEstado, pedido.id);
      }
      if (nuevoEstado === 'cuenta_pedida') onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      {/* ── Header ── */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 shrink-0">
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="text-white font-black text-lg leading-none">{mesa.nombre}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white ${ESTADO_COLORS[pedido.estado]}`}>
              {ESTADO_LABELS[pedido.estado]}
            </span>
            <span className="text-slate-400 text-xs">{elapsed}m</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-amber-400 font-black text-2xl">{pedido.total.toFixed(2)}€</p>
          <p className="text-slate-500 text-xs">{pedido.lineas.reduce((s, l) => s + l.cantidad, 0)} art.</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-slate-700 shrink-0 bg-slate-800">
        {(['carta', 'pedido'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${
              tab === t
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {t === 'carta' ? 'Carta' : `Pedido (${pedido.lineas.length})`}
          </button>
        ))}
      </div>

      {/* ── Carta tab ── */}
      {tab === 'carta' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Category scroll */}
          <div className="flex overflow-x-auto gap-2 px-3 py-2 shrink-0 bg-slate-800/50 border-b border-slate-700 scrollbar-hide">
            {categorias.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors shrink-0 ${
                  activeCat === cat.id
                    ? 'bg-amber-500 text-black'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {cat.nombre}
              </button>
            ))}
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto p-3 pb-6">
            {productosDeCat.length === 0 ? (
              <p className="text-slate-500 text-center mt-12">Sin productos en esta categoría</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productosDeCat.map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => handleAddProduct(prod)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-amber-500 rounded-xl p-3 text-left transition-all active:scale-95 flex flex-col gap-1"
                  >
                    <span className="text-white font-bold text-sm leading-tight line-clamp-2">
                      {prod.nombre}
                    </span>
                    <span className="text-amber-400 font-black text-base mt-auto">
                      {prod.precio.toFixed(2)}€
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pedido tab ── */}
      {tab === 'pedido' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {pedido.lineas.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <span className="text-4xl mb-2">🛒</span>
                <p className="font-bold">Comanda vacía</p>
                <p className="text-sm">Añade productos desde la carta</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {pedido.lineas.map(linea => (
                  <li
                    key={linea.id}
                    className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{linea.nombre}</p>
                      <p className="text-slate-400 text-xs">{linea.precio.toFixed(2)}€ / ud</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRemoveLinea(linea.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-red-600 text-white transition-colors text-lg leading-none"
                      >
                        −
                      </button>
                      <span className="text-white font-black text-base w-5 text-center">
                        {linea.cantidad}
                      </span>
                      <button
                        onClick={() => handleAddProduct(productos.find(p => p.id === linea.productoId)!)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-emerald-600 text-white transition-colors text-lg leading-none"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-amber-400 font-black text-sm shrink-0 w-16 text-right">
                      {(linea.precio * linea.cantidad).toFixed(2)}€
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Total + action buttons */}
          <div className="shrink-0 bg-slate-800 border-t border-slate-700 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-bold uppercase text-sm">Total</span>
              <span className="text-amber-400 font-black text-3xl">{pedido.total.toFixed(2)}€</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Enviar a cocina */}
              {pedido.estado === 'abierto' && (
                <button
                  onClick={() => handleEstadoAction('en_cocina')}
                  disabled={loadingAction || pedido.lineas.length === 0}
                  className="col-span-2 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loadingAction ? <LoadingSpinner size={5} /> : '🍳 Enviar a cocina'}
                </button>
              )}

              {/* Pedir cuenta */}
              {(pedido.estado === 'en_cocina' || pedido.estado === 'listo') && (
                <button
                  onClick={() => handleEstadoAction('cuenta_pedida', 'cuenta_pedida')}
                  disabled={loadingAction}
                  className="py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black rounded-xl transition-colors"
                >
                  💳 Pedir cuenta
                </button>
              )}

              {/* Cobrar */}
              {(pedido.estado === 'listo' || pedido.estado === 'cuenta_pedida' || pedido.estado === 'abierto') && (
                <button
                  onClick={() => handleEstadoAction('cerrado')}
                  disabled={loadingAction || pedido.lineas.length === 0}
                  className={`py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl transition-colors flex items-center justify-center gap-2 ${
                    pedido.estado === 'abierto' ? '' : 'col-span-1'
                  }`}
                >
                  {loadingAction ? <LoadingSpinner size={5} /> : '✅ Cobrar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
