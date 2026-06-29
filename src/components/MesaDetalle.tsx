import { useState } from 'react';
import type { Mesa, Pedido, Producto, Categoria, PedidoEstado, MetodoPago } from '../types';
import {
  agregarProducto, quitarProducto,
  cambiarEstadoPedido, cerrarPedido,
  pedirCuenta,
} from '../services/pedidos.service';
import { registrarIngreso } from '../services/ingresos.service';
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

const METODOS_PAGO: { key: MetodoPago; label: string; icon: string }[] = [
  { key: 'efectivo',   label: 'Efectivo',   icon: '💵' },
  { key: 'tarjeta',    label: 'Tarjeta',    icon: '💳' },
  { key: 'bizum',      label: 'Bizum',      icon: '📱' },
  { key: 'invitacion', label: 'Invitación', icon: '🎁' },
  { key: 'otros',      label: 'Otros',      icon: '💰' },
];

export function MesaDetalle({ mesa, pedido, categorias, productos, onClose }: Props) {
  const [tab, setTab]                         = useState<Tab>('carta');
  const [activeCat, setActiveCat]             = useState<string>(categorias[0]?.id ?? '');
  const [loadingAction, setLoadingAction]     = useState(false);
  const [showCobroModal, setShowCobroModal]   = useState(false);
  const [notaPendiente, setNotaPendiente]     = useState<string | null>(null); // productoId que espera nota
  const [notaTexto, setNotaTexto]             = useState('');

  const elapsed = Math.floor(
    (Date.now() - new Date(pedido.createdAt).getTime()) / 60000,
  );

  const productosDeCat = productos.filter(
    p => p.categoriaId === activeCat && p.disponible,
  );

  // Líneas separadas por destino
  const lineasBebidas = pedido.lineas.filter(l => l.destino === 'barra' || l.destino === 'ambos');
  const lineasComida  = pedido.lineas.filter(l => !l.destino || l.destino === 'cocina' || l.destino === 'ambos');
  const tieneComida   = lineasComida.length > 0;

  const handleAddProduct = async (prod: Producto, notas = '') => {
    try { await agregarProducto(pedido.id, prod, notas); }
    catch (e) { console.error(e); }
  };

  const handleTapProduct = (prod: Producto) => {
    setNotaPendiente(prod.id);
    setNotaTexto('');
  };

  const handleConfirmNota = async () => {
    const prod = productos.find(p => p.id === notaPendiente);
    if (!prod) return;
    await handleAddProduct(prod, notaTexto.trim());
    setNotaPendiente(null);
    setNotaTexto('');
  };

  const handleAddSinNota = async (prod: Producto) => {
    await handleAddProduct(prod, '');
    setNotaPendiente(null);
  };

  const handleRemoveLinea = async (lineaId: string) => {
    try { await quitarProducto(pedido.id, lineaId); }
    catch (e) { console.error(e); }
  };

  const handleEnviarCocina = async () => {
    setLoadingAction(true);
    try { await cambiarEstadoPedido(pedido.id, 'en_cocina'); }
    catch (e) { console.error(e); }
    finally { setLoadingAction(false); }
  };

  const handlePedirCuenta = async () => {
    setLoadingAction(true);
    try {
      await pedirCuenta(pedido.id, mesa.id, mesa.nombre);
      onClose();
    } catch (e) { console.error(e); }
    finally { setLoadingAction(false); }
  };

  const handleCobrar = async (metodo: MetodoPago) => {
    setLoadingAction(true);
    try {
      await cerrarPedido(pedido.id, mesa.id);
      await registrarIngreso(
        pedido.id, mesa.id, mesa.nombre,
        pedido.lineas, pedido.total, metodo,
        pedido.camareroId ?? '', pedido.camareroNombre ?? '',
      );
      setShowCobroModal(false);
      onClose();
    } catch (e) { console.error(e); }
    finally { setLoadingAction(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">

      {/* ── Modal cobro ── */}
      {showCobroModal && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm">
          <div className="w-full bg-slate-800 rounded-t-2xl p-6 space-y-4">
            <h3 className="text-white font-black text-xl text-center">Forma de pago</h3>
            <p className="text-amber-400 font-black text-3xl text-center">{pedido.total.toFixed(2)}€</p>
            {mesa.comensales && (
              <p className="text-slate-400 text-sm text-center">{mesa.comensales} comensales · {(pedido.total / mesa.comensales).toFixed(2)}€/persona</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {METODOS_PAGO.map(({ key, label, icon }) => (
                <button key={key} onClick={() => handleCobrar(key)} disabled={loadingAction}
                  className="py-4 bg-slate-700 hover:bg-amber-500 hover:text-black disabled:opacity-50 rounded-xl font-bold text-white transition-colors flex flex-col items-center gap-1">
                  <span className="text-2xl">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setShowCobroModal(false)} disabled={loadingAction}
              className="w-full py-3 text-slate-400 hover:text-white font-bold transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Modal nota ── */}
      {notaPendiente && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm"
          onClick={() => setNotaPendiente(null)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 space-y-3"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-black text-lg">
              {productos.find(p => p.id === notaPendiente)?.nombre}
            </h3>
            <input
              autoFocus
              value={notaTexto}
              onChange={e => setNotaTexto(e.target.value)}
              placeholder="Nota especial (sin gluten, poco hecho…)"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { void handleAddSinNota(productos.find(p => p.id === notaPendiente)!); }}
                className="py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl">
                Sin nota
              </button>
              <button onClick={() => { void handleConfirmNota(); }}
                className="py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl">
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={onClose}
          className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700 active:scale-90 transition-all">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h2 className="text-white font-black text-lg leading-none">{mesa.nombre}</h2>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full text-white ${ESTADO_COLORS[pedido.estado]}`}>
              {ESTADO_LABELS[pedido.estado]}
            </span>
            <span className="text-slate-400 text-xs">{elapsed}m</span>
            {mesa.comensales && <span className="text-slate-500 text-xs">{mesa.comensales} com.</span>}
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
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
              tab === t ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-white'
            }`}>
            {t === 'carta' ? 'Carta' : `Pedido (${pedido.lineas.length})`}
          </button>
        ))}
      </div>

      {/* ── Carta ── */}
      {tab === 'carta' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Categorías */}
          <div className="flex overflow-x-auto gap-2 px-3 py-2 shrink-0 bg-slate-800/50 border-b border-slate-700 scrollbar-hide">
            {categorias.map(cat => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors shrink-0 ${
                  activeCat === cat.id ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}>
                {cat.nombre}
              </button>
            ))}
          </div>

          {/* Productos */}
          <div className="flex-1 overflow-y-auto p-3 pb-6">
            {productosDeCat.length === 0 ? (
              <p className="text-slate-500 text-center mt-12">Sin productos disponibles</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {productosDeCat.map(prod => {
                  const esBarra = prod.destino === 'barra' || prod.destino === 'ambos';
                  const qty     = pedido.lineas.filter(l => l.productoId === prod.id).reduce((s, l) => s + l.cantidad, 0);
                  return (
                    <button key={prod.id} onClick={() => handleTapProduct(prod)}
                      className={`border rounded-xl p-3 text-left transition-all active:scale-95 flex flex-col gap-1 relative ${
                        esBarra
                          ? 'bg-blue-950/40 border-blue-700/50 hover:border-blue-400'
                          : 'bg-slate-800 border-slate-600 hover:border-amber-500'
                      }`}>
                      {qty > 0 && (
                        <span className="absolute top-2 right-2 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">
                          {qty}
                        </span>
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wide pr-6 truncate">
                        {esBarra
                          ? <span className="text-blue-400">🍺 Barra</span>
                          : <span className="text-emerald-500">🍳 Cocina</span>}
                      </span>
                      <span className="text-white font-bold text-sm leading-tight line-clamp-2">
                        {prod.nombre}
                      </span>
                      <span className={`font-black text-base mt-auto ${esBarra ? 'text-blue-300' : 'text-amber-400'}`}>
                        {prod.precio.toFixed(2)}€
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Pedido ── */}
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
              <div className="space-y-4">
                {/* Bebidas */}
                {lineasBebidas.length > 0 && (
                  <div>
                    <p className="text-blue-400 text-xs font-bold uppercase mb-2 px-1">🍺 Bebidas (barra)</p>
                    <ul className="space-y-2">
                      {lineasBebidas.map(linea => (
                        <LineaRow key={linea.id} linea={linea} pedidoId={pedido.id}
                          onAdd={() => handleAddProduct(productos.find(p => p.id === linea.productoId)!)}
                          onRemove={() => handleRemoveLinea(linea.id)}
                          colorClass="border-blue-800/50 bg-blue-950/30" />
                      ))}
                    </ul>
                  </div>
                )}

                {/* Comida */}
                {lineasComida.filter(l => l.destino !== 'barra').length > 0 && (
                  <div>
                    <p className="text-emerald-400 text-xs font-bold uppercase mb-2 px-1">🍳 Comida (cocina)</p>
                    <ul className="space-y-2">
                      {lineasComida.filter(l => l.destino !== 'barra').map(linea => (
                        <LineaRow key={linea.id} linea={linea} pedidoId={pedido.id}
                          onAdd={() => handleAddProduct(productos.find(p => p.id === linea.productoId)!)}
                          onRemove={() => handleRemoveLinea(linea.id)}
                          colorClass="border-slate-700 bg-slate-800" />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botones de acción */}
          <div className="shrink-0 bg-slate-800 border-t border-slate-700 p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 font-bold uppercase text-sm">Total</span>
              <span className="text-amber-400 font-black text-3xl">{pedido.total.toFixed(2)}€</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Enviar a cocina — solo si hay comida */}
              {pedido.estado === 'abierto' && tieneComida && (
                <button onClick={handleEnviarCocina}
                  disabled={loadingAction}
                  className="col-span-2 py-3.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 active:scale-95 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 text-base">
                  {loadingAction ? <LoadingSpinner size={5} /> : '🍳 Enviar comida a cocina'}
                </button>
              )}

              {/* Pedir cuenta */}
              {pedido.estado !== 'cuenta_pedida' && pedido.estado !== 'cerrado' && pedido.lineas.length > 0 && (
                <button onClick={handlePedirCuenta}
                  disabled={loadingAction}
                  className="py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 active:scale-95 text-white font-black rounded-xl transition-all">
                  💳 Pedir cuenta
                </button>
              )}

              {/* Cobrar */}
              {pedido.lineas.length > 0 && (
                <button onClick={() => setShowCobroModal(true)}
                  disabled={loadingAction}
                  className={`py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-95 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 ${
                    pedido.estado !== 'cuenta_pedida' && tieneComida && pedido.estado === 'abierto' ? '' : 'col-span-2'
                  }`}>
                  {loadingAction ? <LoadingSpinner size={5} /> : '✅ Cobrar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fila de línea de pedido ──────────────────────────────────────────────────

function LineaRow({ linea, onAdd, onRemove, colorClass }: {
  linea:      import('../types').LineaPedido;
  pedidoId:   string;
  onAdd:      () => void;
  onRemove:   () => void;
  colorClass: string;
}) {
  return (
    <li className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 ${colorClass}`}>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm truncate">{linea.nombre}</p>
        {linea.notas && (
          <p className="text-amber-400 text-xs italic font-bold">⚠ {linea.notas}</p>
        )}
        <p className="text-slate-400 text-xs">{linea.precio.toFixed(2)}€/ud</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onRemove}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-red-600 active:scale-90 text-white transition-all text-xl leading-none">
          −
        </button>
        <span className="text-white font-black text-base w-6 text-center">{linea.cantidad}</span>
        <button onClick={onAdd}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-emerald-600 active:scale-90 text-white transition-all text-xl leading-none">
          +
        </button>
      </div>
      <span className="text-amber-400 font-black text-sm shrink-0 w-16 text-right">
        {(linea.precio * linea.cantidad).toFixed(2)}€
      </span>
    </li>
  );
}
