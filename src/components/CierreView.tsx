import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useIngresosHoy } from '../hooks/useIngresos';
import type { MetodoPago } from '../types';

const METODO_LABEL: Record<MetodoPago, string> = {
  efectivo:   'Efectivo',
  tarjeta:    'Tarjeta',
  bizum:      'Bizum',
  invitacion: 'Invitación',
  otros:      'Otros',
};

const TODOS_METODOS: MetodoPago[] = ['efectivo', 'tarjeta', 'bizum', 'invitacion', 'otros'];

function exportarPDFCierre(datos: {
  fecha: string;
  totalIngresos: number;
  totalGastos: number;
  beneficio: number;
  numeroPedidos: number;
  ticketMedio: number;
  efectivoEsperado: number;
  efectivoReal: number;
  diferencia: number;
  porMetodo: Partial<Record<MetodoPago, number>>;
}) {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Los Barriles', 105, y, { align: 'center' });
  y += 9;

  doc.setFontSize(14);
  doc.text('Cierre de Caja', 105, y, { align: 'center' });
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(datos.fecha, 105, y, { align: 'center' });
  y += 12;

  doc.setDrawColor(150, 150, 150);
  doc.line(20, y, 190, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Resumen del día', 20, y); y += 8;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total ingresos: ${datos.totalIngresos.toFixed(2)}€`, 25, y); y += 6;
  doc.text(`Nº pedidos: ${datos.numeroPedidos}`, 25, y); y += 6;
  doc.text(`Ticket medio: ${datos.ticketMedio.toFixed(2)}€`, 25, y); y += 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Desglose por método de pago', 20, y); y += 8;
  doc.setFont('helvetica', 'normal');
  for (const m of TODOS_METODOS) {
    const v = datos.porMetodo[m] ?? 0;
    if (v > 0) {
      doc.text(`${METODO_LABEL[m]}: ${v.toFixed(2)}€`, 25, y); y += 6;
    }
  }
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Arqueo de caja', 20, y); y += 8;
  doc.setFont('helvetica', 'normal');
  doc.text(`Efectivo esperado: ${datos.efectivoEsperado.toFixed(2)}€`, 25, y); y += 6;
  doc.text(`Efectivo real: ${datos.efectivoReal.toFixed(2)}€`, 25, y); y += 6;

  const diff = datos.diferencia;
  if (diff >= 0) {
    doc.setTextColor(16, 185, 129);
  } else {
    doc.setTextColor(239, 68, 68);
  }
  doc.text(`Diferencia: ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}€`, 25, y);
  doc.setTextColor(0, 0, 0);
  y += 12;

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 105, 285, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.save(`cierre_${datos.fecha}.pdf`);
}

export function CierreView() {
  const { ingresos, loading } = useIngresosHoy();
  const [efectivoReal, setEfectivoReal] = useState('');
  const [cerrando, setCerrando]         = useState(false);
  const [cerradoId, setCerradoId]       = useState<string | null>(null);

  const hoy            = new Date().toISOString().slice(0, 10);
  const totalIngresos  = ingresos.reduce((s, i) => s + i.total, 0);
  const numeroPedidos  = ingresos.length;
  const ticketMedio    = numeroPedidos > 0 ? totalIngresos / numeroPedidos : 0;

  const porMetodo: Partial<Record<MetodoPago, number>> = {};
  for (const ing of ingresos) {
    const m = ing.metodoPago;
    porMetodo[m] = (porMetodo[m] ?? 0) + ing.total;
  }
  const efectivoEsperado = porMetodo.efectivo ?? 0;

  const efectivoRealNum = parseFloat(efectivoReal) || 0;
  const diferencia      = efectivoRealNum - efectivoEsperado;

  const handleCerrar = async () => {
    if (cerradoId) return;
    setCerrando(true);
    try {
      const ref = await addDoc(collection(db, 'cierresCompletos'), {
        fecha:            hoy,
        totalIngresos,
        totalGastos:      0,
        beneficioNeto:    totalIngresos,
        numeroPedidos,
        ticketMedio,
        efectivoEsperado,
        efectivoReal:     efectivoRealNum,
        diferencia,
        ingresosPorMetodo: porMetodo,
        createdAt:        new Date().toISOString(),
      });
      setCerradoId(ref.id);
    } catch (e) {
      console.error(e);
    } finally {
      setCerrando(false);
    }
  };

  const handlePDF = () => {
    exportarPDFCierre({
      fecha: hoy,
      totalIngresos,
      totalGastos:  0,
      beneficio:    totalIngresos,
      numeroPedidos,
      ticketMedio,
      efectivoEsperado,
      efectivoReal: efectivoRealNum,
      diferencia,
      porMetodo,
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-black">💰 Cierre de Caja</h1>
        <p className="text-slate-400 text-sm">{hoy}</p>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <p className="text-slate-500 text-center py-12">Cargando datos del día...</p>
        ) : (
          <>
            {/* KPIs del día */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 col-span-2">
                <p className="text-slate-400 text-xs font-bold uppercase mb-1">Total ingresos del día</p>
                <p className="text-amber-400 font-black text-4xl">{totalIngresos.toFixed(2)}€</p>
                <p className="text-slate-500 text-sm mt-1">
                  {numeroPedidos} pedidos · Ticket medio {ticketMedio.toFixed(2)}€
                </p>
              </div>
              {TODOS_METODOS.filter(m => (porMetodo[m] ?? 0) > 0).map(m => (
                <div key={m} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                  <p className="text-slate-400 text-xs">{METODO_LABEL[m]}</p>
                  <p className="text-white font-black text-xl">{(porMetodo[m] ?? 0).toFixed(2)}€</p>
                </div>
              ))}
            </div>

            {/* Arqueo de caja */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
              <p className="font-bold text-white">Arqueo de caja</p>

              <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                <p className="text-slate-400 text-sm">Efectivo esperado</p>
                <p className="text-white font-bold">{efectivoEsperado.toFixed(2)}€</p>
              </div>

              <div>
                <label className="text-slate-400 text-sm block mb-1">Efectivo real en caja (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={efectivoReal}
                  onChange={e => setEfectivoReal(e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-xl font-black border border-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              {efectivoReal !== '' && (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${
                  diferencia === 0
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : diferencia > 0
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-red-500/10 border-red-500/30'
                }`}>
                  <p className="text-slate-300 text-sm font-bold">Diferencia</p>
                  <p className={`font-black text-xl ${
                    diferencia === 0 ? 'text-emerald-400' : diferencia > 0 ? 'text-blue-400' : 'text-red-400'
                  }`}>
                    {diferencia >= 0 ? '+' : ''}{diferencia.toFixed(2)}€
                    {diferencia > 0 && <span className="text-xs font-normal ml-1">(sobrante)</span>}
                    {diferencia < 0 && <span className="text-xs font-normal ml-1">(faltante)</span>}
                    {diferencia === 0 && <span className="text-xs font-normal ml-1">(cuadrado)</span>}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleCerrar}
                disabled={cerrando || !!cerradoId || numeroPedidos === 0}
                className="py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl transition-colors"
              >
                {cerradoId ? '✅ Cerrado' : cerrando ? 'Guardando...' : '🔒 Cerrar caja'}
              </button>
              <button
                onClick={handlePDF}
                disabled={numeroPedidos === 0}
                className="py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
              >
                📄 Exportar PDF
              </button>
            </div>

            {cerradoId && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                <p className="text-emerald-400 font-bold">Cierre registrado correctamente</p>
                <p className="text-slate-400 text-sm mt-1">ID: {cerradoId}</p>
              </div>
            )}

            {/* Detalle de pedidos */}
            {ingresos.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-700/50">
                  <p className="text-slate-300 font-bold text-sm">Pedidos del día ({ingresos.length})</p>
                </div>
                <ul>
                  {ingresos
                    .slice()
                    .sort((a, b) => b.hora.localeCompare(a.hora))
                    .map(ing => (
                      <li key={ing.id} className="flex items-center gap-3 px-4 py-3 border-t border-slate-700">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold">{ing.mesaNombre}</p>
                          <p className="text-slate-500 text-xs">{ing.hora} · {METODO_LABEL[ing.metodoPago]}</p>
                        </div>
                        <p className="text-amber-400 font-black">{ing.total.toFixed(2)}€</p>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
