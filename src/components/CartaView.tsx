import React, { useState } from 'react';
import { useCarta } from '../hooks/useCarta';
import {
  addCategoria, updateCategoria, deleteCategoria,
  addProducto, updateProducto, deleteProducto,
  toggleProductoDisponible,
} from '../services/carta.service';
import type { Categoria, Producto } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

// ─── Categoria form ────────────────────────────────────────────────────────────

function CategoriaForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<Categoria>;
  onSave: (nombre: string, orden: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [orden, setOrden]   = useState(initial?.orden ?? 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await onSave(nombre, orden); } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-wrap">
      <div className="flex-1 min-w-32">
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          placeholder="Nombre categoría"
          required
          className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>
      <div className="w-20">
        <input
          type="number"
          value={orden}
          onChange={e => setOrden(Number(e.target.value))}
          placeholder="Orden"
          className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold rounded-xl text-sm"
      >
        {loading ? '...' : 'Guardar'}
      </button>
      <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm">
        Cancelar
      </button>
    </form>
  );
}

// ─── Producto form ─────────────────────────────────────────────────────────────

function ProductoForm({
  initial,
  categorias,
  onSave,
  onCancel,
}: {
  initial?: Partial<Producto>;
  categorias: Categoria[];
  onSave: (data: Omit<Producto, 'id'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [nombre, setNombre]         = useState(initial?.nombre ?? '');
  const [precio, setPrecio]         = useState(initial?.precio?.toString() ?? '');
  const [descripcion, setDesc]      = useState(initial?.descripcion ?? '');
  const [categoriaId, setCatId]     = useState(initial?.categoriaId ?? categorias[0]?.id ?? '');
  const [disponible, setDisponible] = useState(initial?.disponible ?? true);
  const [loading, setLoading]       = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({ nombre, precio: parseFloat(precio), descripcion, categoriaId, disponible });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-slate-900 rounded-xl border border-slate-600">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-slate-400 text-xs mb-1">Nombre</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} required
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Precio (€)</label>
          <input type="number" step="0.01" min="0" value={precio} onChange={e => setPrecio(e.target.value)} required
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div>
          <label className="block text-slate-400 text-xs mb-1">Categoría</label>
          <select value={categoriaId} onChange={e => setCatId(e.target.value)} required
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500">
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-slate-400 text-xs mb-1">Descripción (opcional)</label>
          <input value={descripcion} onChange={e => setDesc(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="disp" checked={disponible} onChange={e => setDisponible(e.target.checked)}
            className="rounded" />
          <label htmlFor="disp" className="text-slate-300 text-sm">Disponible</label>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={loading}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold rounded-xl text-sm">
          {loading ? '...' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 bg-slate-700 text-white rounded-xl text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── CartaView ─────────────────────────────────────────────────────────────────

export const CartaView: React.FC = () => {
  const { categorias, productos, loading } = useCarta();
  const [activeCat, setActiveCat]           = useState<string>('');
  const [addingCat, setAddingCat]           = useState(false);
  const [editingCat, setEditingCat]         = useState<Categoria | null>(null);
  const [addingProd, setAddingProd]         = useState(false);
  const [editingProd, setEditingProd]       = useState<Producto | null>(null);

  const currentCat = activeCat || categorias[0]?.id || '';
  const filteredProds = productos.filter(p => p.categoriaId === currentCat);

  const handleSaveCat = async (nombre: string, orden: number) => {
    if (editingCat) {
      await updateCategoria(editingCat.id, { nombre, orden });
      setEditingCat(null);
    } else {
      await addCategoria({ nombre, orden });
      setAddingCat(false);
    }
  };

  const handleDeleteCat = async (cat: Categoria) => {
    if (!window.confirm(`¿Eliminar categoría "${cat.nombre}"?`)) return;
    await deleteCategoria(cat.id);
  };

  const handleSaveProd = async (data: Omit<Producto, 'id'>) => {
    if (editingProd) {
      await updateProducto(editingProd.id, data);
      setEditingProd(null);
    } else {
      await addProducto(data);
      setAddingProd(false);
    }
  };

  const handleDeleteProd = async (prod: Producto) => {
    if (!window.confirm(`¿Eliminar "${prod.nombre}"?`)) return;
    await deleteProducto(prod.id);
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen bg-slate-900">
      <LoadingSpinner size={10} />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <h1 className="text-white font-black text-2xl">Gestión de carta</h1>

        {/* Categorías */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-white font-bold">Categorías</h2>
            <button
              onClick={() => { setAddingCat(true); setEditingCat(null); }}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs"
            >
              + Nueva
            </button>
          </div>

          <div className="p-4 space-y-2">
            {addingCat && (
              <CategoriaForm
                onSave={handleSaveCat}
                onCancel={() => setAddingCat(false)}
              />
            )}

            {categorias.map(cat => (
              <div key={cat.id}>
                {editingCat?.id === cat.id ? (
                  <CategoriaForm
                    initial={cat}
                    onSave={handleSaveCat}
                    onCancel={() => setEditingCat(null)}
                  />
                ) : (
                  <div
                    className={`flex items-center justify-between px-4 py-2.5 rounded-xl cursor-pointer transition-colors ${
                      currentCat === cat.id ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-slate-700/50 hover:bg-slate-700'
                    }`}
                    onClick={() => setActiveCat(cat.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-400 text-xs font-mono w-6 text-center">{cat.orden}</span>
                      <span className="text-white font-bold text-sm">{cat.nombre}</span>
                      <span className="text-slate-500 text-xs">
                        {productos.filter(p => p.categoriaId === cat.id).length} productos
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={e => { e.stopPropagation(); setEditingCat(cat); setAddingCat(false); }}
                        className="text-xs px-2.5 py-1 bg-slate-600 hover:bg-blue-700 text-white rounded-lg"
                      >
                        Editar
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteCat(cat); }}
                        className="text-xs px-2.5 py-1 bg-slate-600 hover:bg-red-700 text-white rounded-lg"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Productos */}
        {currentCat && (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-white font-bold">
                Productos — {categorias.find(c => c.id === currentCat)?.nombre}
              </h2>
              <button
                onClick={() => { setAddingProd(true); setEditingProd(null); }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs"
              >
                + Nuevo
              </button>
            </div>

            <div className="p-4 space-y-2">
              {addingProd && (
                <ProductoForm
                  categorias={categorias}
                  initial={{ categoriaId: currentCat }}
                  onSave={handleSaveProd}
                  onCancel={() => setAddingProd(false)}
                />
              )}

              {filteredProds.length === 0 && !addingProd && (
                <p className="text-slate-500 text-sm text-center py-4">Sin productos en esta categoría</p>
              )}

              {filteredProds.map(prod => (
                <div key={prod.id}>
                  {editingProd?.id === prod.id ? (
                    <ProductoForm
                      initial={prod}
                      categorias={categorias}
                      onSave={handleSaveProd}
                      onCancel={() => setEditingProd(null)}
                    />
                  ) : (
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      prod.disponible ? 'bg-slate-700/50' : 'bg-slate-700/20 opacity-60'
                    }`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{prod.nombre}</span>
                          {!prod.disponible && (
                            <span className="text-[10px] bg-red-900 text-red-400 px-2 py-0.5 rounded-full font-bold uppercase">
                              No disponible
                            </span>
                          )}
                        </div>
                        {prod.descripcion && (
                          <p className="text-slate-400 text-xs truncate">{prod.descripcion}</p>
                        )}
                      </div>
                      <span className="text-amber-400 font-black shrink-0">{prod.precio.toFixed(2)}€</span>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => toggleProductoDisponible(prod.id, prod.disponible)}
                          className={`text-xs px-2 py-1 rounded-lg font-bold ${
                            prod.disponible
                              ? 'bg-slate-600 hover:bg-slate-500 text-white'
                              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                          }`}
                        >
                          {prod.disponible ? 'Ocultar' : 'Activar'}
                        </button>
                        <button
                          onClick={() => { setEditingProd(prod); setAddingProd(false); }}
                          className="text-xs px-2 py-1 bg-slate-600 hover:bg-blue-700 text-white rounded-lg"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteProd(prod)}
                          className="text-xs px-2 py-1 bg-slate-600 hover:bg-red-700 text-white rounded-lg"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
