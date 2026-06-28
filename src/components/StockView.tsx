import React, { useState } from 'react';
import { useStock } from '../hooks/useStock';
import { ajustarStock, updateStockMinimo, getMovimientos } from '../services/stock.service';
import type { StockItem, StockMovimiento } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

// ─── Stock row ────────────────────────────────────────────────────────────────

function StockRow({ item }: { item: StockItem }) {
  const [expanded, setExpanded]       = useState(false);
  const [movimientos, setMovimientos] = useState<StockMovimiento[]>([]);
  const [loadingMov, setLoadingMov]   = useState(false);
  const [editMin, setEditMin]         = useState(false);
  const [minVal, setMinVal]           = useState(item.stockMinimo.toString());
  const [ajuste, setAjuste]           = useState('');
  const [motivo, setMotivo]           = useState('');
  const [saving, setSaving]           = useState(false);

  const bajo = item.cantidad < item.stockMinimo && item.stockMinimo > 0;

  const handleExpand = async () => {
    if (!expanded && movimientos.length === 0) {
      setLoadingMov(true);
      try {
        const data = await getMovimientos(item.id);
        setMovimientos(data as StockMovimiento[]);
      } finally {
        setLoadingMov(false);
      }
    }
    setExpanded(o => !o);
  };

  const handleSaveMin = async () => {
    await updateStockMinimo(item.id, parseFloat(minVal) || 0);
    setEditMin(false);
  };

  const handleAjuste = async () => {
    const delta = parseFloat(ajuste);
    if (!delta || !motivo.trim()) return;
    setSaving(true);
    try {
      await ajustarStock(item.id, delta, motivo);
      setAjuste('');
      setMotivo('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden ${bajo ? 'border-red-500 bg-red-950/20' : 'border-slate-700 bg-slate-800'}`}>
      <button
        onClick={handleExpand}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          {bajo && <span className="text-red-400 text-lg">⚠️</span>}
          <div>
            <p className="text-white font-bold text-sm">{item.nombre}</p>
            <p className="text-slate-400 text-xs">{item.proveedor} · {item.ultimoPrecio.toFixed(2)}€/{item.unidad}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-black text-lg ${bajo ? 'text-red-400' : 'text-white'}`}>
            {item.cantidad} <span className="text-sm font-normal text-slate-400">{item.unidad}</span>
          </p>
          <p className="text-slate-500 text-xs">mín. {item.stockMinimo}{item.unidad}</p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          {/* Edit minimum */}
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-sm">Stock mínimo:</span>
            {editMin ? (
              <>
                <input
                  value={minVal}
                  onChange={e => setMinVal(e.target.value)}
                  type="number"
                  className="w-24 bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1 text-sm"
                />
                <button onClick={handleSaveMin} className="px-3 py-1 bg-amber-500 text-black text-xs font-bold rounded-lg">Guardar</button>
                <button onClick={() => setEditMin(false)} className="px-3 py-1 bg-slate-700 text-white text-xs rounded-lg">✕</button>
              </>
            ) : (
              <>
                <span className="text-white font-bold text-sm">{item.stockMinimo} {item.unidad}</span>
                <button onClick={() => setEditMin(true)} className="px-2 py-0.5 bg-slate-700 text-white text-xs rounded">Editar</button>
              </>
            )}
          </div>

          {/* Adjust stock */}
          <div className="space-y-2">
            <p className="text-slate-400 text-xs uppercase font-bold">Ajuste manual</p>
            <div className="flex gap-2 flex-wrap">
              <input
                value={ajuste}
                onChange={e => setAjuste(e.target.value)}
                type="number"
                placeholder="+5 o -3"
                className="w-28 bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500"
              />
              <input
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Motivo (merma, producción...)"
                className="flex-1 min-w-32 bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleAjuste}
                disabled={saving}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg"
              >
                {saving ? '...' : 'Aplicar'}
              </button>
            </div>
          </div>

          {/* Movements */}
          <div>
            <p className="text-slate-400 text-xs uppercase font-bold mb-2">Últimos movimientos</p>
            {loadingMov ? (
              <LoadingSpinner size={5} />
            ) : movimientos.length === 0 ? (
              <p className="text-slate-500 text-xs">Sin movimientos</p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {movimientos.slice(0, 10).map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className={`font-bold ${m.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}
                    </span>
                    <span className="text-slate-400 flex-1 mx-2 truncate">{m.motivo}</span>
                    <span className="text-slate-500">{new Date(m.fecha).toLocaleDateString('es-ES')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export const StockView: React.FC = () => {
  const { stock, stockBajoMinimo, loading } = useStock();
  const [filter, setFilter]                  = useState<'all' | 'low'>('all');
  const [search, setSearch]                  = useState('');

  const filtered = stock
    .filter(s => filter === 'all' || s.cantidad < s.stockMinimo)
    .filter(s => s.nombre.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-white font-black text-2xl">Stock</h1>
          <p className="text-slate-400 text-sm">{stock.length} ingredientes · {stockBajoMinimo.length} bajo mínimo</p>
        </div>

        {/* Alert banner */}
        {stockBajoMinimo.length > 0 && (
          <div className="bg-red-900/30 border border-red-500 rounded-2xl p-3 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-red-300 font-bold text-sm">{stockBajoMinimo.length} producto{stockBajoMinimo.length > 1 ? 's' : ''} bajo mínimo</p>
              <p className="text-red-400 text-xs">{stockBajoMinimo.slice(0, 3).map(s => s.nombre).join(', ')}{stockBajoMinimo.length > 3 ? '...' : ''}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ingrediente..."
            className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={() => setFilter(f => f === 'all' ? 'low' : 'all')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              filter === 'low'
                ? 'bg-red-600 text-white'
                : 'bg-slate-800 border border-slate-600 text-slate-300'
            }`}
          >
            {filter === 'low' ? '⚠️ Solo bajos' : 'Todos'}
          </button>
        </div>

        {/* Stock list */}
        {loading ? (
          <div className="flex justify-center py-10"><LoadingSpinner size={8} /></div>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 text-center py-10">
            {stock.length === 0 ? 'Sin ingredientes. Importa una factura para empezar.' : 'Sin resultados'}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => <StockRow key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  );
};
