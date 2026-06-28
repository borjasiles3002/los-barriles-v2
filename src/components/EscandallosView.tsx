import React, { useState } from 'react';
import { useCarta } from '../hooks/useCarta';
import { useEscandallos } from '../hooks/useEscandallos';
import { useStock } from '../hooks/useStock';
import { saveEscandallo, deleteEscandallo } from '../services/escandallos.service';
import type { Escandallo, EscandallIngrediente, Producto } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

// ─── Food cost color ──────────────────────────────────────────────────────────

function foodCostColor(pct: number): string {
  if (pct <= 28) return 'text-emerald-400';
  if (pct <= 35) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Escandallo editor ────────────────────────────────────────────────────────

function EscandallEditor({
  producto,
  existing,
  onClose,
}: {
  producto: Producto;
  existing: Escandallo | null;
  onClose: () => void;
}) {
  const { stock } = useStock();
  const [ingredientes, setIngredientes] = useState<EscandallIngrediente[]>(
    existing?.ingredientes ?? [],
  );
  const [saving, setSaving] = useState(false);

  const costeTotal  = ingredientes.reduce((s, i) => s + i.cantidad * i.precioUnitario, 0);
  const foodCostPct = producto.precio > 0 ? (costeTotal / producto.precio) * 100 : 0;
  const margen      = producto.precio - costeTotal;

  const addIngrediente = () => {
    const first = stock[0];
    if (!first) return;
    setIngredientes(prev => [
      ...prev,
      { stockId: first.id, nombre: first.nombre, cantidad: 0, unidad: first.unidad, precioUnitario: first.ultimoPrecio },
    ]);
  };

  const updateIngrediente = (idx: number, field: keyof EscandallIngrediente, value: string | number) => {
    setIngredientes(prev => prev.map((ing, i) => {
      if (i !== idx) return ing;
      if (field === 'stockId') {
        const item = stock.find(s => s.id === value);
        if (!item) return ing;
        return { ...ing, stockId: item.id, nombre: item.nombre, unidad: item.unidad, precioUnitario: item.ultimoPrecio };
      }
      return { ...ing, [field]: value };
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveEscandallo(producto.id, producto.nombre, ingredientes, producto.precio);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existing) return;
    if (!window.confirm(`¿Eliminar escandallo de "${producto.nombre}"?`)) return;
    await deleteEscandallo(producto.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 overflow-y-auto p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-black text-xl">{producto.nombre}</h2>
            <p className="text-slate-400 text-sm">PVP: {producto.precio.toFixed(2)}€</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕ Cerrar</button>
        </div>

        {/* Live summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-slate-400 text-xs uppercase">Coste</p>
            <p className="text-white font-black text-lg">{costeTotal.toFixed(2)}€</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-slate-400 text-xs uppercase">Margen</p>
            <p className={`font-black text-lg ${margen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {margen.toFixed(2)}€
            </p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
            <p className="text-slate-400 text-xs uppercase">Food cost</p>
            <p className={`font-black text-lg ${foodCostColor(foodCostPct)}`}>{foodCostPct.toFixed(1)}%</p>
          </div>
        </div>

        {/* Ingredients */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold">Ingredientes</h3>
            <button
              onClick={addIngrediente}
              disabled={stock.length === 0}
              className="px-3 py-1 bg-amber-500 disabled:opacity-40 text-black text-xs font-bold rounded-lg"
            >
              + Añadir
            </button>
          </div>
          {stock.length === 0 && (
            <p className="text-slate-400 text-sm">Importa facturas primero para tener stock disponible.</p>
          )}
          {ingredientes.map((ing, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={ing.stockId}
                onChange={e => updateIngrediente(i, 'stockId', e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500"
              >
                {stock.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <input
                type="number"
                value={ing.cantidad}
                onChange={e => updateIngrediente(i, 'cantidad', parseFloat(e.target.value) || 0)}
                className="w-20 bg-slate-900 border border-slate-600 text-white rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500"
                placeholder="Cant."
              />
              <span className="text-slate-400 text-xs w-8 text-center">{ing.unidad}</span>
              <span className="text-amber-400 text-xs w-16 text-right">
                {(ing.cantidad * ing.precioUnitario).toFixed(2)}€
              </span>
              <button
                onClick={() => setIngredientes(prev => prev.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-300 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black rounded-xl flex items-center justify-center gap-2"
          >
            {saving ? <LoadingSpinner size={5} /> : '💾 Guardar escandallo'}
          </button>
          {existing && (
            <button
              onClick={handleDelete}
              className="px-4 py-3 bg-slate-800 hover:bg-red-900 border border-slate-700 text-red-400 rounded-xl transition-colors"
            >
              Borrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export const EscandallosView: React.FC = () => {
  const { productos, loading: loadingCarta }        = useCarta();
  const { escandallos, loading: loadingEscandallos } = useEscandallos();
  const [editando, setEditando]                      = useState<Producto | null>(null);

  const loading = loadingCarta || loadingEscandallos;

  const escandallById: Record<string, Escandallo> = {};
  escandallos.forEach(e => { escandallById[e.id] = e; });

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <LoadingSpinner size={10} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-white font-black text-2xl">Escandallos</h1>
          <p className="text-slate-400 text-sm">Coste de platos · margen · food cost</p>
        </div>

        {/* Summary KPIs */}
        {escandallos.length > 0 && (() => {
          const avgFoodCost = escandallos.reduce((s, e) => s + e.foodCostPct, 0) / escandallos.length;
          const altos       = escandallos.filter(e => e.foodCostPct > 35).length;
          return (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                <p className="text-slate-400 text-xs uppercase">Escandallos</p>
                <p className="text-white font-black text-xl">{escandallos.length}</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                <p className="text-slate-400 text-xs uppercase">Food cost medio</p>
                <p className={`font-black text-xl ${foodCostColor(avgFoodCost)}`}>{avgFoodCost.toFixed(1)}%</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-center">
                <p className="text-slate-400 text-xs uppercase">Platos &gt;35%</p>
                <p className={`font-black text-xl ${altos > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{altos}</p>
              </div>
            </div>
          );
        })()}

        {/* Products list */}
        <div className="space-y-2">
          {productos.filter(p => p.disponible).map(prod => {
            const esc = escandallById[prod.id];
            return (
              <div
                key={prod.id}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl border cursor-pointer hover:border-amber-500/50 transition-colors ${
                  esc ? 'bg-slate-800 border-slate-700' : 'bg-slate-800/50 border-slate-700/50'
                }`}
                onClick={() => setEditando(prod)}
              >
                <div>
                  <p className="text-white font-bold text-sm">{prod.nombre}</p>
                  <p className="text-slate-400 text-xs">PVP: {prod.precio.toFixed(2)}€</p>
                </div>
                {esc ? (
                  <div className="text-right">
                    <p className={`font-black text-sm ${foodCostColor(esc.foodCostPct)}`}>
                      {esc.foodCostPct.toFixed(1)}% FC
                    </p>
                    <p className="text-slate-400 text-xs">coste {esc.costeTotal.toFixed(2)}€</p>
                  </div>
                ) : (
                  <span className="text-slate-500 text-xs">Sin escandallo →</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {editando && (
        <EscandallEditor
          producto={editando}
          existing={escandallById[editando.id] ?? null}
          onClose={() => setEditando(null)}
        />
      )}
    </div>
  );
};
