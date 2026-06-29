import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useIngresosHoy } from '../hooks/useIngresos';
import {
  getDatosSemanales, getDatosMensuales,
  getObjetivo, saveObjetivo,
} from '../services/informes.service';
import type { DatosSemanales, DatosMensuales } from '../services/informes.service';
import { getISOWeek, monthKey } from '../utils/dates';

const PIE_COLORS: Record<string, string> = {
  efectivo:   '#10b981',
  tarjeta:    '#3b82f6',
  bizum:      '#8b5cf6',
  invitacion: '#f59e0b',
  otros:      '#6b7280',
};

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', bizum: 'Bizum',
  invitacion: 'Invitación', otros: 'Otros',
};

function KpiCard({ label, value, sub, color = 'text-amber-400' }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3">
      <p className="text-slate-400 text-xs font-bold uppercase">{label}</p>
      <p className={`font-black text-2xl ${color}`}>{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

export function DashboardView() {
  const { ingresos, loading: loadingHoy } = useIngresosHoy();
  const [semanal,      setSemanal]      = useState<DatosSemanales | null>(null);
  const [mensual,      setMensual]      = useState<DatosMensuales | null>(null);
  const [objetivo,     setObjetivo]     = useState(0);
  const [editingObj,   setEditingObj]   = useState(false);
  const [objInput,     setObjInput]     = useState('');
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [updatedAt,    setUpdatedAt]    = useState('');

  const loadCharts = async () => {
    setLoadingCharts(true);
    try {
      const now  = new Date();
      const sem  = getISOWeek(now);
      const año  = now.getFullYear();
      const mes  = monthKey(now);
      const [s, m, obj] = await Promise.all([
        getDatosSemanales(sem, año),
        getDatosMensuales(mes),
        getObjetivo(mes),
      ]);
      setSemanal(s);
      setMensual(m);
      setObjetivo(obj);
      setObjInput(obj > 0 ? obj.toString() : '');
      setUpdatedAt(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCharts(false);
    }
  };

  useEffect(() => { loadCharts(); }, []);

  const totalHoy     = ingresos.reduce((s, i) => s + i.total, 0);
  const ticketsHoy   = ingresos.length;
  const ticketMedio  = ticketsHoy > 0 ? totalHoy / ticketsHoy : 0;
  const totalMes     = mensual?.totalIngresos ?? 0;
  const progreso     = objetivo > 0 ? Math.min(100, (totalMes / objetivo) * 100) : 0;

  // Ventas por hora hoy
  const horasMap: Record<string, number> = {};
  for (const ing of ingresos) {
    const h = (ing.hora ?? '').slice(0, 2) + ':00';
    horasMap[h] = (horasMap[h] ?? 0) + ing.total;
  }
  const ventasPorHora = Object.entries(horasMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hora, total]) => ({ hora, total: Math.round(total * 100) / 100 }));

  // Métodos de pago hoy
  const metodosMap: Record<string, number> = {};
  for (const ing of ingresos) {
    metodosMap[ing.metodoPago] = (metodosMap[ing.metodoPago] ?? 0) + ing.total;
  }
  const metodosData = Object.entries(metodosMap).map(([name, value]) => ({
    name: METODO_LABEL[name] ?? name,
    value: Math.round(value * 100) / 100,
    fill: PIE_COLORS[name] ?? '#6b7280',
  }));

  const handleSaveObjetivo = async () => {
    const val = parseFloat(objInput);
    if (isNaN(val) || val <= 0) return;
    await saveObjetivo(monthKey(new Date()), val);
    setObjetivo(val);
    setEditingObj(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">📊 Dashboard</h1>
          {updatedAt && <p className="text-slate-500 text-xs">Actualizado {updatedAt}</p>}
        </div>
        <button
          onClick={loadCharts}
          disabled={loadingCharts}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg text-sm font-bold transition-colors"
        >
          {loadingCharts ? '...' : '↻ Refresh'}
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            label="Ventas hoy"
            value={loadingHoy ? '...' : `${totalHoy.toFixed(2)}€`}
            sub={`${ticketsHoy} pedidos`}
          />
          <KpiCard
            label="Ticket medio"
            value={loadingHoy ? '...' : `${ticketMedio.toFixed(2)}€`}
            sub="hoy"
          />
          <KpiCard
            label="Ventas mes"
            value={loadingCharts ? '...' : `${totalMes.toFixed(2)}€`}
            color="text-emerald-400"
            sub={mensual ? `${mensual.numeroPedidos} pedidos` : ''}
          />
          <KpiCard
            label="Gastos mes"
            value={loadingCharts ? '...' : `${(mensual?.totalGastos ?? 0).toFixed(2)}€`}
            color="text-red-400"
            sub={`Beneficio: ${((mensual?.beneficio) ?? 0).toFixed(2)}€`}
          />
        </div>

        {/* Objetivo mensual */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-sm font-bold uppercase">Objetivo mensual</p>
            <button
              onClick={() => setEditingObj(e => !e)}
              className="text-amber-400 text-xs font-bold"
            >
              {editingObj ? 'Cancelar' : 'Editar'}
            </button>
          </div>
          {editingObj ? (
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                step="100"
                value={objInput}
                onChange={e => setObjInput(e.target.value)}
                placeholder="Objetivo en €"
                className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleSaveObjetivo}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm transition-colors"
              >
                OK
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between mb-1">
                <p className="text-amber-400 font-black text-lg">{totalMes.toFixed(0)}€</p>
                <p className="text-slate-400 text-sm">/ {objetivo > 0 ? `${objetivo.toFixed(0)}€` : 'sin objetivo'}</p>
              </div>
              {objetivo > 0 && (
                <>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${progreso >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${progreso}%` }}
                    />
                  </div>
                  <p className="text-slate-500 text-xs mt-1">{progreso.toFixed(1)}% del objetivo</p>
                </>
              )}
            </>
          )}
        </div>

        {/* Ventas por hora */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-300 font-bold text-sm mb-3">Ventas por hora (hoy)</p>
          {ventasPorHora.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">Sin ventas hoy</p>
          ) : (
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventasPorHora} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hora" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v) => [`${(v as number).toFixed(2)}€`, 'Total']}
                  />
                  <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Ventas por día esta semana */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-300 font-bold text-sm mb-3">Ventas por día (esta semana)</p>
          {loadingCharts || !semanal ? (
            <p className="text-slate-500 text-sm text-center py-4">Cargando...</p>
          ) : (
            <div style={{ height: 160 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={semanal.porDia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="dia" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v) => [`${(v as number).toFixed(2)}€`, 'Total']}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Ingresos vs Gastos este mes */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-300 font-bold text-sm mb-3">Ingresos vs Gastos (este mes)</p>
          {loadingCharts || !mensual ? (
            <p className="text-slate-500 text-sm text-center py-4">Cargando...</p>
          ) : (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={mensual.porDia}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="dia" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={4} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v) => `${(v as number).toFixed(2)}€`}
                  />
                  <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="gastos"   name="Gastos"   fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Métodos de pago hoy */}
        {metodosData.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-300 font-bold text-sm mb-3">Métodos de pago (hoy)</p>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metodosData}
                    cx="50%"
                    cy="50%"
                    outerRadius={65}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {metodosData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v) => `${(v as number).toFixed(2)}€`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {metodosData.map(m => (
                <div key={m.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: m.fill }} />
                  <span className="text-slate-400 text-xs">{m.name}: <span className="text-white font-bold">{m.value.toFixed(2)}€</span></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top 5 productos hoy */}
        {ingresos.length > 0 && (() => {
          const prods: Record<string, number> = {};
          for (const ing of ingresos) {
            for (const l of ing.lineas) {
              prods[l.nombre] = (prods[l.nombre] ?? 0) + l.precio * l.cantidad;
            }
          }
          const top5 = Object.entries(prods)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5);
          if (top5.length === 0) return null;
          return (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-300 font-bold text-sm mb-3">Top productos hoy</p>
              <ul className="space-y-2">
                {top5.map(([nombre, total], i) => (
                  <li key={nombre} className="flex items-center gap-3">
                    <span className="text-slate-500 text-sm w-4 shrink-0">{i + 1}</span>
                    <span className="text-white text-sm flex-1 truncate">{nombre}</span>
                    <span className="text-amber-400 font-bold text-sm">{total.toFixed(2)}€</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
