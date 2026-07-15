import { useState } from 'react';
import { agregarProductoManual } from '../services/pedidos.service';
import type { DestinoProducto, TipoIva } from '../types';

export function ProductoLibreModal({ pedidoId, onClose }: { pedidoId: string; onClose: () => void }) {
  const [nombre,  setNombre]  = useState('');
  const [precio,  setPrecio]  = useState('');
  const [destino, setDestino] = useState<DestinoProducto | null>(null);
  const [tipoIva, setTipoIva] = useState<TipoIva>('reducido');
  const [nota,    setNota]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const precioNum = parseFloat(precio.replace(',', '.')) || 0;
  const valid = nombre.trim() !== '' && precioNum > 0 && destino !== null;

  const handleSubmit = async () => {
    if (!valid || !destino) return;
    setLoading(true);
    setError(null);
    try {
      await agregarProductoManual(pedidoId, nombre.trim(), precioNum, destino, tipoIva, nota.trim() || undefined);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al añadir producto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/75" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-t-2xl p-5 w-full max-w-md mx-auto space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-lg">✏️ Producto libre</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none transition-colors">✕</button>
        </div>

        <div className="space-y-1">
          <label className="text-slate-400 text-xs font-bold uppercase">Nombre *</label>
          <input
            autoFocus
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSubmit(); }}
            placeholder="Nombre del producto..."
            className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-1 focus:ring-violet-500 border border-transparent"
          />
        </div>

        <div className="space-y-1">
          <label className="text-slate-400 text-xs font-bold uppercase">Precio *</label>
          <div className="relative">
            <input
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleSubmit(); }}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-1 focus:ring-violet-500 border border-transparent pr-10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-base font-bold">€</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-slate-400 text-xs font-bold uppercase">IVA</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTipoIva('reducido')}
              className={`py-2.5 rounded-xl font-bold text-sm transition-colors ${tipoIva === 'reducido' ? 'bg-violet-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              IVA 10% (reducido)
            </button>
            <button
              onClick={() => setTipoIva('normal')}
              className={`py-2.5 rounded-xl font-bold text-sm transition-colors ${tipoIva === 'normal' ? 'bg-violet-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              IVA 21% (normal)
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-slate-400 text-xs font-bold uppercase">Destino *</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDestino('cocina')}
              className={`py-3 rounded-xl font-bold text-base transition-colors ${destino === 'cocina' ? 'bg-emerald-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              🍳 Cocina
            </button>
            <button
              onClick={() => setDestino('barra')}
              className={`py-3 rounded-xl font-bold text-base transition-colors ${destino === 'barra' ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              🍺 Barra
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-slate-400 text-xs font-bold uppercase">Nota</label>
          <input
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Sin gluten, con extra de..."
            className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 border border-transparent"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm font-semibold text-center">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!valid || loading}
            className="py-3 bg-violet-700 hover:bg-violet-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? '…' : '+ Añadir al pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
