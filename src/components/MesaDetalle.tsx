import { useState } from 'react';
import type { Mesa, Pedido, Producto, Categoria, PedidoEstado, MetodoPago, Cliente } from '../types';
import {
  agregarProducto, quitarProducto,
  cambiarEstadoPedido, cerrarPedido,
  pedirCuenta, asignarClienteAPedido, actualizarNotaLinea,
} from '../services/pedidos.service';
import { registrarIngreso } from '../services/ingresos.service';
import { buscarClientes, crearCliente, registrarVisitaCliente } from '../services/clientes.service';
import {
  emitirFactura, generarPDFFactura, generarPDFTicket, getConfigRestaurante,
} from '../services/facturasEmitidas.service';
import { StockBadge } from './AperturaView';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { encolarImpresion } from '../services/impresion.service';

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
  const [addingProd,   setAddingProd]         = useState<string | null>(null);
  const [errorToast,   setErrorToast]         = useState<string | null>(null);
  const [showCobroModal, setShowCobroModal]         = useState(false);
  const [emitirFacturaFlag, setEmitirFacturaFlag]   = useState(false);
  const [imprimirTicketTPV, setImprimirTicketTPV]   = useState(true);
  const [editarNota, setEditarNota]           = useState<{ lineaId: string; nombre: string; notaActual: string } | null>(null);
  const [notaTexto, setNotaTexto]             = useState('');
  // Cliente
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteBusqueda,  setClienteBusqueda]  = useState('');
  const [clienteResultados, setClienteResultados] = useState<Cliente[]>([]);
  const [clienteBuscando,  setClienteBuscando]  = useState(false);
  const [clienteAsignado,  setClienteAsignado]  = useState<Cliente | null>(null);
  const [showNuevoCliente, setShowNuevoCliente] = useState(false);
  const [nuevoClienteForm, setNuevoClienteForm] = useState({ nombre: '', apellidos: '', nif: '', email: '' });

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
    setAddingProd(prod.id);
    try {
      await agregarProducto(pedido.id, prod, notas);
      if (prod.destino === 'barra' || prod.destino === 'ambos') {
        void encolarImpresion({
          tipo: 'barra', mesaNombre: mesa.nombre, pedidoId: pedido.id,
          lineas: [{
            id: `p-${Date.now()}`, productoId: prod.id, nombre: prod.nombre,
            precio: prod.precio, cantidad: 1, estado: 'pendiente',
            destino: prod.destino, tipoIva: prod.tipoIva ?? 'reducido',
            ...(notas ? { notas } : {}),
          }],
        });
      }
    } catch (e) {
      console.error('[handleAddProduct]', e);
      const msg = e instanceof Error ? e.message : 'Error al añadir';
      setErrorToast(msg === 'STOCK_AGOTADO' ? 'Stock agotado' : msg);
      setTimeout(() => setErrorToast(null), 3000);
    } finally {
      setAddingProd(null);
    }
  };

  const handleEditarNota = (lineaId: string, nombre: string, notaActual: string) => {
    setEditarNota({ lineaId, nombre, notaActual });
    setNotaTexto(notaActual);
  };

  const handleSaveNota = async () => {
    if (!editarNota) return;
    try { await actualizarNotaLinea(pedido.id, editarNota.lineaId, notaTexto.trim()); }
    catch (e) { console.error(e); }
    setEditarNota(null);
    setNotaTexto('');
  };

  const handleRemoveLinea = async (lineaId: string) => {
    try { await quitarProducto(pedido.id, lineaId); }
    catch (e) { console.error(e); }
  };

  const handleEnviarCocina = async () => {
    setLoadingAction(true);
    try {
      await cambiarEstadoPedido(pedido.id, 'en_cocina');
      const lineasCocina = pedido.lineas.filter(
        l => l.destino === 'cocina' || l.destino === 'ambos' || !l.destino,
      );
      if (lineasCocina.length > 0) {
        void encolarImpresion({ tipo: 'cocina', mesaNombre: mesa.nombre, pedidoId: pedido.id, lineas: lineasCocina });
      }
    } catch (e) { console.error(e); }
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

  const handleBuscarCliente = async () => {
    if (!clienteBusqueda.trim()) return;
    setClienteBuscando(true);
    const res = await buscarClientes(clienteBusqueda);
    setClienteResultados(res);
    setClienteBuscando(false);
  };

  const handleAsignarCliente = async (cliente: Cliente) => {
    await asignarClienteAPedido(pedido.id, cliente.id, `${cliente.nombre} ${cliente.apellidos}`);
    setClienteAsignado(cliente);
    setShowClienteModal(false);
  };

  const handleCrearNuevoCliente = async () => {
    if (!nuevoClienteForm.nombre || !nuevoClienteForm.apellidos) return;
    const id = await crearCliente({ ...nuevoClienteForm });
    await handleAsignarCliente({ id, ...nuevoClienteForm, totalVisitas: 0, totalGastado: 0, creadoEn: new Date().toISOString() });
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

      if (clienteAsignado) await registrarVisitaCliente(clienteAsignado.id, pedido.total);

      const config = await getConfigRestaurante();
      if (emitirFacturaFlag && clienteAsignado) {
        const factura = await emitirFactura({
          pedidoId: pedido.id, mesaNombre: mesa.nombre,
          lineas: pedido.lineas, total: pedido.total, cliente: clienteAsignado,
        });
        await generarPDFFactura(factura, config);
      } else {
        await generarPDFTicket(pedido.id, mesa.nombre, pedido.lineas, pedido.total, config);
      }

      if (imprimirTicketTPV) {
        void encolarImpresion({
          tipo: 'ticket', mesaNombre: mesa.nombre,
          pedidoId: pedido.id, lineas: pedido.lineas, total: pedido.total,
        });
      }

      setShowCobroModal(false);
      onClose();
    } catch (e) { console.error(e); }
    finally { setLoadingAction(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">

      {/* ── Toast error añadir producto ── */}
      {errorToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] bg-red-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-xl whitespace-nowrap pointer-events-none">
          ⚠️ {errorToast}
        </div>
      )}

      {/* ── Modal cobro ── */}
      {showCobroModal && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm">
          <div className="w-full bg-slate-800 rounded-t-2xl p-6 space-y-4">
            <h3 className="text-white font-black text-xl text-center">Forma de pago</h3>
            <p className="text-amber-400 font-black text-3xl text-center">{pedido.total.toFixed(2)}€</p>
            {mesa.comensales && (
              <p className="text-slate-400 text-sm text-center">{mesa.comensales} comensales · {(pedido.total / mesa.comensales).toFixed(2)}€/persona</p>
            )}
            {clienteAsignado && (
              <label className="flex items-center gap-3 bg-slate-700 rounded-xl px-4 py-3 cursor-pointer">
                <input type="checkbox" checked={emitirFacturaFlag} onChange={e => setEmitirFacturaFlag(e.target.checked)}
                  className="w-5 h-5 rounded accent-amber-500" />
                <div>
                  <p className="text-white font-semibold text-sm">Emitir factura fiscal</p>
                  <p className="text-slate-400 text-xs">{clienteAsignado.nombre} {clienteAsignado.apellidos}</p>
                </div>
              </label>
            )}
            <label className="flex items-center gap-3 bg-slate-700 rounded-xl px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={imprimirTicketTPV} onChange={e => setImprimirTicketTPV(e.target.checked)}
                className="w-5 h-5 rounded accent-amber-500" />
              <div>
                <p className="text-white font-semibold text-sm">🖨 Imprimir ticket en TPV</p>
                <p className="text-slate-400 text-xs">Envía a la impresora de barra (requiere QZ Tray)</p>
              </div>
            </label>
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

      {/* ── Modal cliente ── */}
      {showClienteModal && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm"
          onClick={() => setShowClienteModal(false)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 space-y-3 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-black text-lg">Asignar cliente</h3>

            {!showNuevoCliente ? (
              <>
                {clienteAsignado && (
                  <div className="flex items-center justify-between bg-blue-900/40 rounded-xl px-3 py-2">
                    <span className="text-blue-300 text-sm">👤 {clienteAsignado.nombre} {clienteAsignado.apellidos}</span>
                    <button onClick={() => { setClienteAsignado(null); setShowClienteModal(false); }}
                      className="text-red-400 text-xs hover:text-red-300">Quitar</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={clienteBusqueda}
                    onChange={e => setClienteBusqueda(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleBuscarCliente(); }}
                    placeholder="Buscar por nombre, empresa o NIF…"
                    className="flex-1 bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none"
                  />
                  <button onClick={() => void handleBuscarCliente()} disabled={clienteBuscando}
                    className="px-4 rounded-xl bg-amber-500 text-white text-sm font-bold">
                    {clienteBuscando ? '…' : 'Buscar'}
                  </button>
                </div>
                <div className="space-y-2">
                  {clienteResultados.map(c => (
                    <button key={c.id} onClick={() => void handleAsignarCliente(c)}
                      className="w-full text-left px-3 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl transition flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {c.nombre[0]}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{c.nombre} {c.apellidos}</p>
                        {c.empresa && <p className="text-slate-400 text-xs">{c.empresa}</p>}
                        {c.nif && <p className="text-slate-500 text-xs">NIF: {c.nif}</p>}
                      </div>
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowNuevoCliente(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition">
                  + Crear cliente nuevo
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-400 text-sm">Datos mínimos del cliente</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['nombre', 'apellidos', 'nif', 'email'] as const).map(k => (
                    <input key={k}
                      value={nuevoClienteForm[k]}
                      onChange={e => setNuevoClienteForm(f => ({ ...f, [k]: e.target.value }))}
                      placeholder={k.charAt(0).toUpperCase() + k.slice(1)}
                      className="bg-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none"
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowNuevoCliente(false)}
                    className="py-3 bg-slate-700 text-white rounded-xl font-bold text-sm">← Volver</button>
                  <button onClick={() => void handleCrearNuevoCliente()}
                    className="py-3 bg-amber-500 text-black rounded-xl font-bold text-sm">Crear y asignar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal editar nota (opcional, se abre desde ✏️ en la línea del pedido) ── */}
      {editarNota && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm"
          onClick={() => setEditarNota(null)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 space-y-3"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-black text-lg">Nota — {editarNota.nombre}</h3>
            <input
              autoFocus
              value={notaTexto}
              onChange={e => setNotaTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleSaveNota(); }}
              placeholder="Sin gluten, poco hecho, sin sal…"
              className="w-full bg-slate-700 border border-slate-600 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setEditarNota(null)}
                className="py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl">
                Cancelar
              </button>
              <button onClick={() => void handleSaveNota()}
                className="py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl">
                Guardar nota
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
            {clienteAsignado ? (
              <button onClick={() => setShowClienteModal(true)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900 text-blue-300 font-bold">
                👤 {clienteAsignado.nombre}
              </button>
            ) : (
              <button onClick={() => setShowClienteModal(true)}
                className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 transition">
                + Cliente
              </button>
            )}
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
          <div className="flex overflow-x-auto gap-2 px-3 py-2 shrink-0 bg-slate-800/50 border-b border-slate-700 scrollbar-hide overscroll-x-contain scroll-smooth">
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
                  const esBarra  = prod.destino === 'barra' || prod.destino === 'ambos';
                  const qty      = pedido.lineas.filter(l => l.productoId === prod.id).reduce((s, l) => s + l.cantidad, 0);
                  const agotado  = prod.controlStock && (prod.stockActual ?? 0) === 0;
                  return (
                    <button key={prod.id}
                      onClick={() => !agotado && void handleAddProduct(prod, '')}
                      disabled={agotado || addingProd === prod.id}
                      className={`border rounded-xl p-3 text-left transition-all flex flex-col gap-1 relative ${
                        agotado
                          ? 'bg-slate-800/30 border-slate-700 opacity-50 cursor-not-allowed'
                          : addingProd === prod.id
                            ? 'scale-95 opacity-70 cursor-wait'
                            : esBarra
                              ? 'bg-blue-950/40 border-blue-700/50 hover:border-blue-400 active:scale-95'
                              : 'bg-slate-800 border-slate-600 hover:border-amber-500 active:scale-95'
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
                      <span className={`font-bold text-sm leading-tight line-clamp-2 ${agotado ? 'line-through text-slate-500' : 'text-white'}`}>
                        {prod.nombre}
                      </span>
                      <span className={`font-black text-base mt-auto ${esBarra ? 'text-blue-300' : 'text-amber-400'}`}>
                        {prod.precio.toFixed(2)}€
                      </span>
                      {prod.controlStock && (
                        <div className="mt-1">
                          <StockBadge stock={prod.stockActual} />
                        </div>
                      )}
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
                          onEditNota={() => handleEditarNota(linea.id, linea.nombre, linea.notas ?? '')}
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
                          onEditNota={() => handleEditarNota(linea.id, linea.nombre, linea.notas ?? '')}
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

function LineaRow({ linea, onAdd, onRemove, onEditNota, colorClass }: {
  linea:       import('../types').LineaPedido;
  pedidoId:    string;
  onAdd:       () => void;
  onRemove:    () => void;
  onEditNota:  () => void;
  colorClass:  string;
}) {
  return (
    <li className={`flex items-center gap-3 border rounded-xl px-3 py-2.5 ${colorClass}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-white font-semibold text-sm truncate">{linea.nombre}</p>
          <button
            onClick={onEditNota}
            className="shrink-0 text-slate-500 hover:text-amber-400 active:scale-90 transition-all p-0.5"
            title="Añadir / editar nota"
          >
            ✏️
          </button>
        </div>
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
