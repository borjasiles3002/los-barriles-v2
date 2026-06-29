import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getIngresosByFecha } from '../services/ingresos.service';
import { monthKey } from '../utils/dates';
import type { Escandallo } from '../types';

interface RentaRow {
  nombre: string;
  precioVenta: number;
  costeTotal: number;
  margen: number;
  foodCostPct: number;
  unidadesVendidas: number;
  ingresoTotal: number;
  beneficioBruto: number;
}

function mesDesde(mes: string) {
  return `${mes}-01`;
}
function mesHasta(mes: string) {
  const [añoN, mesN] = mes.split('-').map(Number);
  const dias = new Date(añoN, mesN, 0).getDate();
  return `${mes}-${String(dias).padStart(2, '0')}`;
}

export function RentabilidadView() {
  const [mes, setMes]       = useState(monthKey(new Date()));
  const [rows, setRows]     = useState<RentaRow[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = async (m: string) => {
    setLoading(true);
    try {
      const [escSnap, ingresos] = await Promise.all([
        getDocs(collection(db, 'escandallos')),
        getIngresosByFecha(mesDesde(m), mesHasta(m)),
      ]);

      const escandallos = escSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Escandallo);

      const ventasPorProducto: Record<string, { cantidad: number; total: number }> = {};
      for (const ing of ingresos) {
        for (const linea of ing.lineas) {
          if (!ventasPorProducto[linea.productoId]) {
            ventasPorProducto[linea.productoId] = { cantidad: 0, total: 0 };
          }
          ventasPorProducto[linea.productoId].cantidad += linea.cantidad;
          ventasPorProducto[linea.productoId].total   += linea.precio * linea.cantidad;
        }
      }

      const data: RentaRow[] = escandallos
        .filter(e => ventasPorProducto[e.id])
        .map(e => {
          const ventas = ventasPorProducto[e.id];
          return {
            nombre:           e.productoNombre,
            precioVenta:      e.precioVenta,
            costeTotal:       e.costeTotal,
            margen:           e.margen,
            foodCostPct:      e.foodCostPct,
            unidadesVendidas: ventas.cantidad,
            ingresoTotal:     ventas.total,
            beneficioBruto:   ventas.cantidad * e.margen,
          };
        })
        .sort((a, b) => b.beneficioBruto - a.beneficioBruto);

      setRows(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(mes); }, [mes]);

  const top10Chart = rows.slice(0, 10).map(r => ({
    name: r.nombre.length > 14 ? r.nombre.slice(0, 14) + '…' : r.nombre,
    beneficio: Math.round(r.beneficioBruto * 100) / 100,
  }));

  const totalBeneficio = rows.reduce((s, r) => s + r.beneficioBruto, 0);
  const totalIngreso   = rows.reduce((s, r) => s + r.ingresoTotal,  0);

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-black">🏆 Rentabilidad</h1>
          <p className="text-slate-400 text-xs">Solo platos con escandallo</p>
        </div>
        <input
          type="month"
          value={mes}
          onChange={e => setMes(e.target.value)}
          className="bg-slate-700 text-white rounded-lg px-3 py-1.5 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
        />
      </div>

      <div className="p-4 space-y-4">
        {loading && (
          <div className="text-center py-12">
            <p className="text-slate-500">Calculando rentabilidad...</p>
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-slate-400 font-bold">Sin datos para este período</p>
            <p className="text-slate-500 text-sm mt-1">
              Necesitas escandallos creados y ventas del mes seleccionado
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                <p className="text-slate-400 text-xs">Beneficio bruto total</p>
                <p className="text-emerald-400 font-black text-xl">{totalBeneficio.toFixed(2)}€</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                <p className="text-slate-400 text-xs">Ingresos (platos con esc.)</p>
                <p className="text-amber-400 font-black text-xl">{totalIngreso.toFixed(2)}€</p>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-300 font-bold text-sm mb-3">Top 10 — Beneficio bruto (€)</p>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={top10Chart}
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#d1d5db', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                      formatter={(v) => [`${(v as number).toFixed(2)}€`, 'Beneficio']}
                    />
                    <Bar dataKey="beneficio" fill="#10b981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              <div className="grid grid-cols-5 gap-0 px-4 py-2 bg-slate-700/50 text-xs text-slate-400 font-bold uppercase">
                <span className="col-span-2">Plato</span>
                <span className="text-right">Uds</span>
                <span className="text-right">Margen</span>
                <span className="text-right">Beneficio</span>
              </div>
              {rows.map((r, i) => {
                const fcColor = r.foodCostPct > 40
                  ? 'text-red-400'
                  : r.foodCostPct > 30
                    ? 'text-amber-400'
                    : 'text-emerald-400';
                return (
                  <div
                    key={r.nombre}
                    className={`grid grid-cols-5 gap-0 px-4 py-3 border-t border-slate-700 ${i === 0 ? 'bg-amber-500/5' : ''}`}
                  >
                    <div className="col-span-2 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{r.nombre}</p>
                      <p className={`text-xs ${fcColor}`}>FC: {r.foodCostPct.toFixed(1)}%</p>
                    </div>
                    <p className="text-slate-300 text-sm text-right self-center">{r.unidadesVendidas}</p>
                    <p className="text-slate-300 text-sm text-right self-center">{r.margen.toFixed(2)}€</p>
                    <p className="text-emerald-400 font-bold text-sm text-right self-center">
                      {r.beneficioBruto.toFixed(2)}€
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
