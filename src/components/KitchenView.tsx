import { useState, useEffect, useRef } from 'react';
import { usePedidos } from '../hooks/usePedidos';
import { marcarLineaLista, cambiarEstadoPedido } from '../services/pedidos.service';
import { playComandaNueva, playCocinaLista } from '../utils/sounds';
import { FullScreenLoader } from './ui/LoadingSpinner';
import type { Pedido, LineaPedido } from '../types';

// Solo líneas que van a cocina (cocina | ambos | undefined = default cocina)
function esCocina(l: LineaPedido) {
  return !l.destino || l.destino === 'cocina' || l.destino === 'ambos';
}

function tiempoColor(min: number) {
  if (min < 10) return { card: 'border-emerald-600 bg-emerald-950/30', header: 'bg-emerald-900/40 border-emerald-700', time: 'text-emerald-400' };
  if (min < 20) return { card: 'border-amber-500 bg-amber-950/30',   header: 'bg-amber-900/40 border-amber-700',   time: 'text-amber-400' };
  return          { card: 'border-red-500 bg-red-950/40',             header: 'bg-red-900/40 border-red-700',       time: 'text-red-400 animate-pulse' };
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
  return <span className="font-mono text-white text-2xl font-black">{time}</span>;
}

function OrderCard({ pedido }: { pedido: Pedido }) {
  const [loading, setLoading] = useState(false);

  const lineasCocina = pedido.lineas.filter(esCocina);
  const elapsed = Math.floor((Date.now() - new Date(pedido.createdAt).getTime()) / 60000);
  const col = pedido.estado === 'listo'
    ? { card: 'border-emerald-400 bg-emerald-950/40', header: 'bg-emerald-900/50 border-emerald-700', time: 'text-emerald-400' }
    : tiempoColor(elapsed);

  const pendientes = lineasCocina.filter(l => l.estado !== 'listo').length;
  const allReady   = lineasCocina.every(l => l.estado === 'listo');

  const handleMarkLine = async (lineaId: string) => {
    try { await marcarLineaLista(pedido.id, lineaId); }
    catch (e) { console.error(e); }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await cambiarEstadoPedido(pedido.id, 'listo');
      playCocinaLista();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  return (
    <div className={`flex flex-col rounded-2xl border-2 overflow-hidden shadow-xl w-72 shrink-0 ${col.card}`}>
      {/* Header */}
      <div className={`px-4 py-3 flex justify-between items-center border-b ${col.header}`}>
        <div>
          <h3 className="text-white font-black text-2xl leading-none">{pedido.mesaNombre}</h3>
          {pedido.estado === 'listo'
            ? <span className="text-emerald-400 text-xs font-bold uppercase">✓ Todo listo</span>
            : <span className="text-slate-400 text-xs">{pendientes} pendiente{pendientes !== 1 ? 's' : ''}</span>
          }
        </div>
        <div className="text-right">
          <p className={`font-mono font-black text-3xl ${col.time}`}>{elapsed}m</p>
        </div>
      </div>

      {/* Líneas */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-96">
        {lineasCocina.map(linea => (
          <div key={linea.id}
            className={`flex items-center gap-3 rounded-xl p-3 border transition-all ${
              linea.estado === 'listo'
                ? 'bg-slate-800/30 border-slate-700 opacity-50'
                : 'bg-slate-800 border-slate-600'
            }`}
          >
            <span className={`font-black text-sm px-2.5 py-1 rounded-lg min-w-[2rem] text-center ${
              linea.estado === 'listo' ? 'bg-emerald-600 text-white' : 'bg-red-700 text-white'
            }`}>
              {linea.cantidad}×
            </span>
            <div className="flex-1 min-w-0">
              <p className={`font-bold text-sm leading-tight ${linea.estado === 'listo' ? 'line-through text-slate-500' : 'text-white'}`}>
                {linea.nombre}
              </p>
              {linea.notas && (
                <p className="text-amber-400 text-xs font-bold mt-0.5 italic">⚠ {linea.notas}</p>
              )}
            </div>
            {linea.estado !== 'listo' && pedido.estado !== 'listo' && (
              <button
                onClick={() => handleMarkLine(linea.id)}
                className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black rounded-xl transition-all"
              >
                ✓ Listo
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
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 active:scale-95 text-white font-black text-sm rounded-xl uppercase tracking-wide transition-all"
          >
            {loading ? '...' : allReady ? '✅ Todo listo — avisar camarero' : `Faltan ${pendientes} plato${pendientes !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}

export function KitchenView() {
  const { pedidos, loading } = usePedidos(['en_cocina', 'listo']);
  const prevCount = useRef(0);

  // Filtrar: solo pedidos que tienen al menos una línea de cocina pendiente
  const activePedidos = pedidos.filter(p =>
    p.estado !== 'cerrado' && p.lineas.some(esCocina),
  );

  // Sonido cuando llega una comanda nueva
  useEffect(() => {
    if (loading) return;
    if (activePedidos.length > prevCount.current) playComandaNueva();
    prevCount.current = activePedidos.length;
  }, [activePedidos.length, loading]);

  if (loading) return <FullScreenLoader />;

  return (
    <div className="flex flex-col h-screen bg-slate-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🍳</span>
          <div>
            <h1 className="text-white font-black text-xl">Cocina — Los Barriles</h1>
            <p className="text-slate-400 text-sm">
              {activePedidos.length === 0
                ? 'Sin comandas activas'
                : `${activePedidos.length} comanda${activePedidos.length !== 1 ? 's' : ''} activa${activePedidos.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <Clock />
      </div>

      {/* Leyenda de colores */}
      <div className="shrink-0 bg-slate-900/50 border-b border-slate-800 px-6 py-1.5 flex gap-6 text-xs font-bold uppercase">
        <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" />{'<10 min'}</span>
        <span className="flex items-center gap-1.5 text-amber-400"><span className="w-2 h-2 rounded-full bg-amber-500" />10–20 min</span>
        <span className="flex items-center gap-1.5 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />{'>20 min'}</span>
      </div>

      {/* Comandas */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        {activePedidos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-3">
            <span className="text-6xl">✅</span>
            <p className="font-black text-2xl text-slate-400">Sin comandas</p>
            <p className="text-sm">Las nuevas comandas de comida aparecerán aquí</p>
          </div>
        ) : (
          <div className="flex gap-4 h-full pb-2 items-start">
            {activePedidos.map(pedido => (
              <OrderCard key={pedido.id} pedido={pedido} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
