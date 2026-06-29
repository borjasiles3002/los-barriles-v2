import React, { useState } from 'react';
import { useGastos } from '../hooks/useGastos';
import { addGasto, deleteGasto, CATEGORIAS_GASTO } from '../services/gastos.service';
import type { CategoriaGasto } from '../types';

function mesDesde(mes: string) {
  return `${mes}-01`;
}
function mesHasta(mes: string) {
  const [añoN, mesN] = mes.split('-').map(Number);
  const dias = new Date(añoN, mesN, 0).getDate();
  return `${mes}-${String(dias).padStart(2, '0')}`;
}

const hoyStr = () => new Date().toISOString().slice(0, 10);
const mesStr = () => new Date().toISOString().slice(0, 7);

interface FormState {
  fecha: string;
  descripcion: string;
  categoria: CategoriaGasto;
  importe: string;
  proveedor: string;
}

const INIT: FormState = {
  fecha:       hoyStr(),
  descripcion: '',
  categoria:   'otros',
  importe:     '',
  proveedor:   '',
};

export function GastosView() {
  const [mes, setMes]           = useState(mesStr());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<FormState>(INIT);
  const [saving, setSaving]     = useState(false);

  const { gastos, loading } = useGastos(mesDesde(mes), mesHasta(mes));

  const totalMes = gastos.reduce((s, g) => s + g.importe, 0);

  const porCategoria: Record<string, number> = {};
  for (const g of gastos) {
    porCategoria[g.categoria] = (porCategoria[g.categoria] ?? 0) + g.importe;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.descripcion.trim() || !form.importe) return;
    setSaving(true);
    try {
      await addGasto({
        fecha:       form.fecha,
        descripcion: form.descripcion.trim(),
        categoria:   form.categoria,
        importe:     parseFloat(form.importe),
        proveedor:   form.proveedor.trim() || undefined,
      });
      setForm(INIT);
      setShowForm(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try { await deleteGasto(id); } catch (e) { console.error(e); }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black">💸 Gastos</h1>
          <button
            onClick={() => setShowForm(s => !s)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-colors"
          >
            + Añadir
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="bg-slate-700 text-white rounded-lg px-3 py-1.5 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
          />
          <div className="text-right ml-auto">
            <p className="text-xs text-slate-400">Total mes</p>
            <p className="text-red-400 font-black text-xl">-{totalMes.toFixed(2)}€</p>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="m-4 bg-slate-800 rounded-xl p-4 space-y-3 border border-slate-700">
          <h3 className="font-bold text-amber-400">Nuevo gasto</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Importe (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={form.importe}
                onChange={e => setForm(f => ({ ...f, importe: e.target.value }))}
                required
                className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Descripción</label>
            <input
              type="text"
              placeholder="Ej: Factura electricidad, Nómina cocinero..."
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              required
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Categoría</label>
              <select
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaGasto }))}
                className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
              >
                {CATEGORIAS_GASTO.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Proveedor (opcional)</label>
              <input
                type="text"
                placeholder="Nombre proveedor"
                value={form.proveedor}
                onChange={e => setForm(f => ({ ...f, proveedor: e.target.value }))}
                className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold rounded-xl text-sm transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar gasto'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Resumen por categoría */}
      {gastos.length > 0 && (
        <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
          {Object.entries(porCategoria)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, total]) => {
              const label = CATEGORIAS_GASTO.find(c => c.value === cat)?.label ?? cat;
              return (
                <div key={cat} className="bg-slate-800 rounded-xl p-3 border border-slate-700">
                  <p className="text-slate-400 text-xs truncate">{label}</p>
                  <p className="text-red-400 font-black text-lg">{total.toFixed(2)}€</p>
                  <p className="text-slate-500 text-xs">
                    {totalMes > 0 ? ((total / totalMes) * 100).toFixed(0) : 0}%
                  </p>
                </div>
              );
            })}
        </div>
      )}

      {/* Lista */}
      <div className="p-4 space-y-2 pb-24">
        {loading && (
          <p className="text-slate-500 text-center py-8">Cargando gastos...</p>
        )}
        {!loading && gastos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💸</p>
            <p className="text-slate-400 font-bold">Sin gastos registrados este mes</p>
            <p className="text-slate-500 text-sm mt-1">Las facturas de proveedores se añaden automáticamente</p>
          </div>
        )}
        {gastos.map(g => {
          const label = CATEGORIAS_GASTO.find(c => c.value === g.categoria)?.label ?? g.categoria;
          return (
            <div
              key={g.id}
              className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{g.descripcion}</p>
                <p className="text-slate-400 text-xs">
                  {g.fecha} · {label}
                  {g.proveedor ? ` · ${g.proveedor}` : ''}
                  {g.facturaId ? ' · 🧾 Auto' : ''}
                </p>
              </div>
              <p className="text-red-400 font-black text-lg shrink-0">
                -{g.importe.toFixed(2)}€
              </p>
              {!g.facturaId && (
                <button
                  onClick={() => handleDelete(g.id)}
                  className="text-slate-600 hover:text-red-400 transition-colors shrink-0"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
