import { useState, useEffect } from 'react';
import { useCarta } from '../hooks/useCarta';
import { guardarApertura, getStockAyer, ajustarStockProducto } from '../services/stock.service';
import type { Producto } from '../types';

interface AperturaItem {
  productoId: string;
  nombre:     string;
  controlStock: boolean;
  cantidad:   number;
}

export function AperturaView() {
  const { productos, categorias, loading } = useCarta();
  const [items,       setItems]      = useState<AperturaItem[]>([]);
  const [guardando,   setGuardando]  = useState(false);
  const [guardado,    setGuardado]   = useState(false);
  const [filtro,      setFiltro]     = useState<'todos' | 'stock'>('todos');

  // Inicializar items cuando carguen los productos
  useEffect(() => {
    if (productos.length > 0 && items.length === 0) {
      setItems(productos.map(p => ({
        productoId:   p.id,
        nombre:       p.nombre,
        controlStock: p.controlStock ?? false,
        cantidad:     p.stockActual ?? 0,
      })));
    }
  }, [productos, items.length]);

  const copiarDeAyer = async () => {
    const ayer = await getStockAyer();
    if (!ayer) { alert('No hay datos de ayer.'); return; }
    setItems(prev => prev.map(item => {
      const ayerItem = ayer.items[item.productoId];
      if (!ayerItem) return item;
      return { ...item, controlStock: true, cantidad: ayerItem.inicial };
    }));
  };

  const toggleControl = (productoId: string) => {
    setItems(prev => prev.map(i =>
      i.productoId === productoId ? { ...i, controlStock: !i.controlStock } : i,
    ));
  };

  const setCantidad = (productoId: string, val: number) => {
    setItems(prev => prev.map(i =>
      i.productoId === productoId ? { ...i, cantidad: Math.max(0, val) } : i,
    ));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      await guardarApertura(items.map(i => ({
        productoId:   i.productoId,
        nombre:       i.nombre,
        inicial:      i.cantidad,
        controlStock: i.controlStock,
      })));
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-400">Cargando carta…</div>;

  const itemsFiltrados = filtro === 'stock'
    ? items.filter(i => i.controlStock)
    : items;

  // Agrupa por categoría
  const prodMap = new Map(productos.map(p => [p.id, p]));
  const grupos = categorias
    .map(cat => ({
      cat,
      items: itemsFiltrados.filter(i => prodMap.get(i.productoId)?.categoriaId === cat.id),
    }))
    .filter(g => g.items.length > 0);

  const controlados = items.filter(i => i.controlStock).length;

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Apertura del día</h1>
          <p className="text-slate-400 text-sm">
            {controlados} producto{controlados !== 1 ? 's' : ''} con control de stock
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void copiarDeAyer()}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition"
          >
            📋 Copiar de ayer
          </button>
          <button
            onClick={() => void handleGuardar()}
            disabled={guardando}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              guardado
                ? 'bg-emerald-600 text-white'
                : 'bg-amber-500 text-white hover:bg-amber-400'
            } disabled:opacity-60`}
          >
            {guardando ? 'Guardando…' : guardado ? '✓ Guardado' : 'Guardar stock del día'}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {(['todos', 'stock'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filtro === f ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {f === 'todos' ? 'Todos los productos' : 'Solo con stock'}
          </button>
        ))}
      </div>

      {/* Lista por categorías */}
      <div className="space-y-4">
        {grupos.map(({ cat, items: catItems }) => (
          <div key={cat.id} className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-700 flex items-center justify-between">
              <span className="font-semibold text-white text-sm">{cat.nombre}</span>
              <button
                onClick={() => {
                  const allOn = catItems.every(i => i.controlStock);
                  setItems(prev => prev.map(i =>
                    catItems.find(ci => ci.productoId === i.productoId)
                      ? { ...i, controlStock: !allOn }
                      : i,
                  ));
                }}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                {catItems.every(i => i.controlStock) ? 'Desactivar todos' : 'Activar todos'}
              </button>
            </div>
            <div className="divide-y divide-slate-700">
              {catItems.map(item => (
                <div key={item.productoId} className="flex items-center gap-4 px-4 py-3">
                  {/* Toggle control */}
                  <button
                    onClick={() => toggleControl(item.productoId)}
                    className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      item.controlStock ? 'bg-amber-500' : 'bg-slate-600'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      item.controlStock ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>

                  {/* Nombre */}
                  <span className={`flex-1 text-sm ${item.controlStock ? 'text-white' : 'text-slate-500'}`}>
                    {item.nombre}
                  </span>

                  {/* Input cantidad */}
                  {item.controlStock ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setCantidad(item.productoId, item.cantidad - 1)}
                        className="w-8 h-8 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition text-lg"
                      >−</button>
                      <input
                        type="number"
                        min="0"
                        value={item.cantidad}
                        onChange={e => setCantidad(item.productoId, Number(e.target.value))}
                        className="w-14 bg-slate-700 text-white text-center rounded-lg py-1.5 text-sm"
                      />
                      <button
                        onClick={() => setCantidad(item.productoId, item.cantidad + 1)}
                        className="w-8 h-8 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition text-lg"
                      >+</button>
                    </div>
                  ) : (
                    <span className="text-slate-600 text-sm w-32 text-right">Sin control</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Acceso rápido durante el servicio */}
      {controlados > 0 && (
        <div className="mt-6 bg-slate-800 rounded-xl p-4">
          <h2 className="text-white font-semibold mb-3 text-sm">Ajuste rápido de stock</h2>
          <StockRapido items={items.filter(i => i.controlStock)} productos={productos} />
        </div>
      )}
    </div>
  );
}

function StockRapido({ items, productos }: { items: AperturaItem[]; productos: Producto[] }) {
  return (
    <div className="space-y-2">
      {items
        .sort((a, b) => a.cantidad - b.cantidad)
        .map(item => {
          const prod = productos.find(p => p.id === item.productoId);
          const stock = prod?.stockActual ?? item.cantidad;
          return (
            <div key={item.productoId} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${stock === 0 ? 'line-through text-slate-500' : 'text-white'}`}>
                  {item.nombre}
                </span>
              </div>
              <StockBadge stock={stock} />
              <div className="flex gap-1.5">
                <button
                  onClick={() => void ajustarStockProducto(item.productoId, 5)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-800 text-emerald-300 text-xs hover:bg-emerald-700 transition"
                >
                  +5
                </button>
                <button
                  onClick={() => void ajustarStockProducto(item.productoId, 1)}
                  className="px-2.5 py-1 rounded-lg bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 transition"
                >
                  +1
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}

export function StockBadge({ stock }: { stock: number | null | undefined }) {
  if (stock == null) return null;
  if (stock === 0) return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 line-through">Agotado</span>
  );
  if (stock === 1) return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300 animate-pulse font-bold">🔴 ÚLTIMO</span>
  );
  if (stock <= 4) return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900 text-amber-300">⚠ Quedan {stock}</span>
  );
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900 text-emerald-400">✓ {stock}</span>
  );
}
