import { useState, useEffect, useRef } from 'react';
import { usePedidos } from '../hooks/usePedidos';
import { useMesas } from '../hooks/useMesas';
import { useIngresosHoy } from '../hooks/useIngresos';
import { marcarLineaLista } from '../services/pedidos.service';
import { playBebidaNueva, playCuentaPedida } from '../utils/sounds';
import { FullScreenLoader } from './ui/LoadingSpinner';
import type { LineaPedido, Pedido } from '../types';

function esBarra(l: LineaPedido) {
  return l.destino === 'barra' || l.destino === 'ambos';
}

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
  return <span className="font-mono text-white text-2xl font-black tabular-nums">{time}</span>;
}

interface BebidaMesa {
  pedido: Pedido;
  lineas: LineaPedido[];
}

// ─── Panel izquierdo: bebidas pendientes por mesa ────────────────────────────

function PanelBebidas({ bebidas }: { bebidas: BebidaMesa[] }) {
  const [marking, setMarking] = useState<string | null>(null);

  const handleServed = async (pedidoId: string, lineaId: string) => {
    setMarking(lineaId);
    try { await marcarLineaLista(pedidoId, lineaId); }
    catch (e) { console.error(e); }
    finally { setMarking(null); }
  };

  if (bebidas.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-600 gap-3 p-8">
        <span className="text-5xl">✅</span>
        <p className="font-bold text-lg text-slate-500">Sin bebidas pendientes</p>
        <p className="text-sm text-slate-600">Las bebidas pedidas aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-3 p-4">
      {bebidas.map(({ pedido, lineas }) => (
        <div key={pedido.id} className="bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden">
          {/* Mesa header */}
          <div className="px-4 py-2.5 bg-slate-700/60 border-b border-slate-600 flex items-center justify-between">
            <h3 className="text-white font-black text-lg">{pedido.mesaNombre}</h3>
            <span className="text-slate-400 text-xs">
              {pedido.camareroNombre || 'Camarero'}
            </span>
          </div>

          {/* Líneas de bebidas */}
          <div className="p-2 space-y-1.5">
            {lineas.map(linea => (
              <div key={linea.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-blue-950/40 border border-blue-800/50 rounded-xl"
              >
                <span className="font-black text-blue-300 text-sm min-w-[2rem] text-center bg-blue-900/50 px-2 py-0.5 rounded-lg">
                  {linea.cantidad}×
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">{linea.nombre}</p>
                  {linea.notas && (
                    <p className="text-amber-400 text-xs font-bold italic">⚠ {linea.notas}</p>
                  )}
                </div>
                <button
                  onClick={() => handleServed(pedido.id, linea.id)}
                  disabled={marking === linea.id}
                  className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all"
                >
                  {marking === linea.id ? '...' : '✓ Servida'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Panel derecho: resumen de caja ──────────────────────────────────────────

function PanelCaja({ pedidos }: { pedidos: Pedido[] }) {
  const { ingresos } = useIngresosHoy();

  const totalVentas   = ingresos.reduce((s, i) => s + i.total, 0);
  const numPedidos    = ingresos.length;
  const ticketMedio   = numPedidos > 0 ? totalVentas / numPedidos : 0;

  const cuentasPedidas = pedidos.filter(p => p.estado === 'cuenta_pedida');
  const mesasAbiertas  = pedidos.filter(p => p.estado !== 'cerrado').length;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* KPIs del día */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-4">
        <h3 className="text-slate-300 font-bold text-sm uppercase tracking-wide">Resumen hoy</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-700/50 rounded-xl p-3 text-center">
            <p className="text-emerald-400 font-black text-2xl">{totalVentas.toFixed(0)}€</p>
            <p className="text-slate-400 text-xs uppercase">Vendido</p>
          </div>
          <div className="bg-slate-700/50 rounded-xl p-3 text-center">
            <p className="text-amber-400 font-black text-2xl">{numPedidos}</p>
            <p className="text-slate-400 text-xs uppercase">Pedidos</p>
          </div>
          <div className="bg-slate-700/50 rounded-xl p-3 text-center">
            <p className="text-blue-400 font-black text-2xl">{ticketMedio.toFixed(0)}€</p>
            <p className="text-slate-400 text-xs uppercase">Ticket medio</p>
          </div>
          <div className="bg-slate-700/50 rounded-xl p-3 text-center">
            <p className="text-slate-300 font-black text-2xl">{mesasAbiertas}</p>
            <p className="text-slate-400 text-xs uppercase">Mesas abiertas</p>
          </div>
        </div>
      </div>

      {/* Cuentas pedidas */}
      {cuentasPedidas.length > 0 && (
        <div className="bg-red-950/40 border border-red-700 rounded-2xl p-4 space-y-2">
          <h3 className="text-red-400 font-bold text-sm uppercase">
            💳 Cuentas pedidas ({cuentasPedidas.length})
          </h3>
          {cuentasPedidas.map(p => (
            <div key={p.id} className="flex items-center justify-between bg-red-900/30 rounded-xl px-3 py-2">
              <span className="text-white font-bold">{p.mesaNombre}</span>
              <span className="text-amber-400 font-black">{p.total.toFixed(2)}€</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── BarraTPVView ─────────────────────────────────────────────────────────────

export function BarraTPVView() {
  const { pedidos, loading: pLoading } = usePedidos(['abierto', 'en_cocina', 'listo', 'cuenta_pedida']);
  const { mesas, loading: mLoading }   = useMesas();
  const loading                        = pLoading || mLoading;

  const prevBebidas    = useRef(0);
  const prevCuentas    = useRef(0);

  // Agrupar bebidas por mesa
  const bebidas: BebidaMesa[] = pedidos
    .map(p => ({
      pedido: p,
      lineas: p.lineas.filter(l => esBarra(l) && l.estado !== 'listo'),
    }))
    .filter(x => x.lineas.length > 0)
    .sort((a, b) => a.pedido.createdAt.localeCompare(b.pedido.createdAt));

  const totalBebidas = bebidas.reduce((s, b) => s + b.lineas.length, 0);
  const cuentas      = pedidos.filter(p => p.estado === 'cuenta_pedida').length;

  // Sonidos en tiempo real
  useEffect(() => {
    if (loading) return;
    if (totalBebidas > prevBebidas.current) playBebidaNueva();
    if (cuentas > prevCuentas.current) playCuentaPedida();
    prevBebidas.current = totalBebidas;
    prevCuentas.current = cuentas;
  }, [totalBebidas, cuentas, loading]);

  if (loading) return <FullScreenLoader />;

  const mesasAbiertas = mesas.filter(m => m.estado !== 'libre');

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-slate-800 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-3xl">🍺</span>
          <div>
            <h1 className="text-white font-black text-xl">TPV Barra — Los Barriles</h1>
            <p className="text-slate-400 text-sm">{mesasAbiertas.length} mesas activas</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {totalBebidas > 0 && (
            <div className="flex items-center gap-2 bg-orange-500 px-4 py-2 rounded-xl animate-pulse">
              <span className="text-black font-black text-lg">{totalBebidas}</span>
              <span className="text-black font-bold text-sm">bebida{totalBebidas !== 1 ? 's' : ''} pendiente{totalBebidas !== 1 ? 's' : ''}</span>
            </div>
          )}
          {cuentas > 0 && (
            <div className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-xl">
              <span className="text-white font-black text-lg">{cuentas}</span>
              <span className="text-white font-bold text-sm">cuenta{cuentas !== 1 ? 's' : ''}</span>
            </div>
          )}
          <Clock />
        </div>
      </div>

      {/* Cuerpo dividido en dos paneles */}
      <div className="flex-1 flex overflow-hidden">
        {/* Izquierda: bebidas pendientes */}
        <div className="flex-1 flex flex-col border-r border-slate-700 overflow-hidden">
          <div className="shrink-0 px-4 py-3 bg-slate-800/50 border-b border-slate-700 flex items-center gap-3">
            <span className="text-blue-400 text-lg">🍺</span>
            <h2 className="text-white font-bold">Bebidas pendientes</h2>
            {totalBebidas > 0 && (
              <span className="bg-orange-500 text-black font-black text-xs px-2 py-0.5 rounded-full">
                {totalBebidas}
              </span>
            )}
          </div>
          <PanelBebidas bebidas={bebidas} />
        </div>

        {/* Derecha: caja del día */}
        <div className="w-72 xl:w-80 flex flex-col overflow-y-auto bg-slate-900">
          <div className="shrink-0 px-4 py-3 bg-slate-800/50 border-b border-slate-700">
            <h2 className="text-white font-bold">💰 Caja del día</h2>
          </div>
          <PanelCaja pedidos={pedidos} />
        </div>
      </div>
    </div>
  );
}
