import React, { useRef, useState } from 'react';
import { useFacturas } from '../hooks/useFacturas';
import { analyzeInvoice } from '../services/gemini.service';
import { procesarFactura } from '../services/facturas.service';
import type { Factura, FacturaProducto } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

// ─── Confirm/edit extracted invoice data ─────────────────────────────────────

function FacturaReview({
  extracted,
  imageFile,
  onSave,
  onCancel,
}: {
  extracted: Omit<Factura, 'id' | 'imagenUrl' | 'procesada' | 'createdAt'>;
  imageFile: File | null;
  onSave: (data: typeof extracted, file: File | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [data, setData]     = useState(extracted);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(data, imageFile); } finally { setSaving(false); }
  };

  const updateProducto = (idx: number, field: keyof FacturaProducto, value: string | number) => {
    setData(prev => ({
      ...prev,
      productos: prev.productos.map((p, i) =>
        i === idx ? { ...p, [field]: value } : p,
      ),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-black text-xl">Revisar factura</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-white px-3 py-1">✕ Cancelar</button>
        </div>

        {/* Header fields */}
        <div className="bg-slate-800 rounded-2xl p-4 space-y-3 border border-slate-700">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Proveedor" value={data.proveedor}
              onChange={v => setData(d => ({ ...d, proveedor: v }))} />
            <Field label="Número factura" value={data.numero_factura}
              onChange={v => setData(d => ({ ...d, numero_factura: v }))} />
            <Field label="Fecha" value={data.fecha} type="date"
              onChange={v => setData(d => ({ ...d, fecha: v }))} />
            <Field label="Total (€)" value={data.total} type="number"
              onChange={v => setData(d => ({ ...d, total: parseFloat(v) || 0 }))} />
          </div>
        </div>

        {/* Productos */}
        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-bold">Productos ({data.productos.length})</h3>
            <button
              onClick={() => setData(d => ({
                ...d,
                productos: [...d.productos, { nombre: '', cantidad: 0, unidad: 'ud', precio_unidad: 0, precio_total: 0 }],
              }))}
              className="px-3 py-1 bg-amber-500 text-black text-xs font-bold rounded-lg"
            >
              + Añadir
            </button>
          </div>
          <div className="space-y-2">
            {data.productos.map((prod, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 items-center">
                <input value={prod.nombre} placeholder="Nombre"
                  onChange={e => updateProducto(i, 'nombre', e.target.value)}
                  className="col-span-2 bg-slate-900 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500" />
                <input value={prod.cantidad} type="number" placeholder="Cant."
                  onChange={e => updateProducto(i, 'cantidad', parseFloat(e.target.value) || 0)}
                  className="bg-slate-900 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500" />
                <input value={prod.unidad} placeholder="Unidad"
                  onChange={e => updateProducto(i, 'unidad', e.target.value)}
                  className="bg-slate-900 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500" />
                <input value={prod.precio_unidad} type="number" placeholder="€/ud"
                  onChange={e => updateProducto(i, 'precio_unidad', parseFloat(e.target.value) || 0)}
                  className="bg-slate-900 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black rounded-xl flex items-center justify-center gap-2"
          >
            {saving ? <LoadingSpinner size={5} /> : '💾 Guardar y actualizar stock'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text',
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-slate-400 text-xs mb-1 uppercase">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-900 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
      />
    </div>
  );
}

// ─── Factura list item ────────────────────────────────────────────────────────

function FacturaItem({ f }: { f: Factura }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700/50 transition-colors"
      >
        <div>
          <p className="text-white font-bold text-sm">{f.proveedor}</p>
          <p className="text-slate-400 text-xs">{f.fecha} · #{f.numero_factura}</p>
        </div>
        <div className="text-right">
          <p className="text-amber-400 font-black">{f.total.toFixed(2)}€</p>
          <p className="text-slate-500 text-xs">{f.productos.length} productos</p>
        </div>
      </button>
      {open && (
        <div className="border-t border-slate-700 px-4 py-3 space-y-1">
          {f.productos.map((p, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-slate-300">{p.nombre} ({p.cantidad}{p.unidad})</span>
              <span className="text-slate-400">{p.precio_total.toFixed(2)}€</span>
            </div>
          ))}
          {f.imagenUrl && (
            <a href={f.imagenUrl} target="_blank" rel="noopener noreferrer"
              className="inline-block mt-2 text-xs text-blue-400 hover:text-blue-300 underline">
              Ver imagen
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export const FacturasView: React.FC = () => {
  const { facturas, loading }             = useFacturas();
  const cameraInputRef                    = useRef<HTMLInputElement>(null);
  const galleryInputRef                   = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing]         = useState(false);
  const [extracted, setExtracted]         = useState<Omit<Factura, 'id' | 'imagenUrl' | 'procesada' | 'createdAt'> | null>(null);
  const [pendingFile, setPendingFile]     = useState<File | null>(null);
  const [error, setError]                 = useState('');
  const [successMsg, setSuccessMsg]       = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setAnalyzing(true);
    try {
      const result = await analyzeInvoice(file);
      setExtracted({
        proveedor:      result.proveedor ?? '',
        fecha:          result.fecha ?? new Date().toISOString().slice(0, 10),
        numero_factura: result.numero_factura ?? '',
        productos:      result.productos ?? [],
        subtotal:       result.subtotal ?? 0,
        iva:            result.iva ?? 0,
        total:          result.total ?? 0,
      });
      setPendingFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al analizar la factura');
    } finally {
      setAnalyzing(false);
      e.target.value = '';
    }
  };

  const handleSave = async (
    data: Omit<Factura, 'id' | 'imagenUrl' | 'procesada' | 'createdAt'>,
    file: File | null,
  ) => {
    await procesarFactura(data, file);
    setExtracted(null);
    setPendingFile(null);
    setSuccessMsg('Factura guardada y stock actualizado correctamente.');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-black text-2xl">Facturas</h1>
            <p className="text-slate-400 text-sm">Escanea facturas con IA · actualiza stock automáticamente</p>
          </div>
        </div>

        {/* Upload area */}
        <div className="border-2 border-dashed border-amber-500/50 rounded-2xl p-6 bg-amber-500/5 space-y-4">
          {analyzing ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <LoadingSpinner size={8} />
              <p className="text-amber-400 font-bold">Analizando factura con IA...</p>
              <p className="text-slate-500 text-xs">Gemini está leyendo los datos de la factura</p>
            </div>
          ) : (
            <>
              <p className="text-white font-bold text-center">Añadir factura de proveedor</p>
              <p className="text-slate-400 text-xs text-center">Gemini extrae proveedor, productos e importes automáticamente</p>
              <div className="grid grid-cols-2 gap-3">
                {/* Botón cámara */}
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-4 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white rounded-xl transition-all border border-slate-600"
                >
                  <span className="text-3xl">📷</span>
                  <span className="font-bold text-sm">Hacer foto</span>
                  <span className="text-slate-400 text-xs">Cámara del dispositivo</span>
                </button>
                {/* Botón galería + PDF */}
                <button
                  onClick={() => galleryInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 py-4 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white rounded-xl transition-all border border-slate-600"
                >
                  <span className="text-3xl">🖼️</span>
                  <span className="font-bold text-sm">Subir de galería</span>
                  <span className="text-slate-400 text-xs">Imagen o PDF</span>
                </button>
              </div>
              {/* Inputs ocultos */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </>
          )}
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-600 rounded-xl p-3">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-900/40 border border-emerald-600 rounded-xl p-3">
            <p className="text-emerald-300 text-sm font-bold">{successMsg}</p>
          </div>
        )}

        {/* Facturas list */}
        <div>
          <h2 className="text-white font-bold mb-3">Facturas recientes</h2>
          {loading ? (
            <div className="flex justify-center py-8"><LoadingSpinner size={8} /></div>
          ) : facturas.length === 0 ? (
            <p className="text-slate-500 text-center py-8">Sin facturas registradas</p>
          ) : (
            <div className="space-y-2">
              {facturas.map(f => <FacturaItem key={f.id} f={f} />)}
            </div>
          )}
        </div>
      </div>

      {/* Review overlay */}
      {extracted && (
        <FacturaReview
          extracted={extracted}
          imageFile={pendingFile}
          onSave={handleSave}
          onCancel={() => { setExtracted(null); setPendingFile(null); }}
        />
      )}
    </div>
  );
};
