import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { jsPDF } from 'jspdf';
import {
  getDatosDiarios, getDatosSemanales, getDatosMensuales, getDatosAnuales,
} from '../services/informes.service';
import type {
  DatosDiarios, DatosSemanales, DatosMensuales, DatosAnuales,
} from '../services/informes.service';
import { getISOWeek, monthKey } from '../utils/dates';
import { getTicketsByPeriod, reimprimirTicket } from '../services/tickets.service';
import type { Ticket } from '../types';

type TabInforme = 'diario' | 'semanal' | 'mensual' | 'anual' | 'tickets';
type DatosInforme = DatosDiarios | DatosSemanales | DatosMensuales | DatosAnuales;

const TAB_LABELS: Record<TabInforme, string> = {
  diario:   'Diario',
  semanal:  'Semanal',
  mensual:  'Mensual',
  anual:    'Anual',
  tickets:  'Tickets',
};

function kpiEur(v: number) { return `${v.toFixed(2)}€`; }

function seccionKpis(datos: DatosInforme) {
  const base = 'totalIngresos' in datos ? datos as DatosDiarios : null;
  if (!base) return null;
  const color = base.beneficio >= 0 ? 'text-emerald-400' : 'text-red-400';
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {[
        { l: 'Ingresos',    v: kpiEur(base.totalIngresos),  c: 'text-amber-400' },
        { l: 'Gastos',      v: kpiEur(base.totalGastos),    c: 'text-red-400' },
        { l: 'Beneficio',   v: kpiEur(base.beneficio),      c: color },
        { l: 'Pedidos',     v: String(base.numeroPedidos),  c: 'text-white' },
      ].map(({ l, v, c }) => (
        <div key={l} className="bg-slate-700 rounded-xl p-3">
          <p className="text-slate-400 text-xs">{l}</p>
          <p className={`font-black text-xl ${c}`}>{v}</p>
        </div>
      ))}
    </div>
  );
}

async function generarNarrativa(tipo: TabInforme, datos: DatosInforme): Promise<string> {
  const res = await fetch('/api/gemini', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'informe', tipo, datos }),
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  const json = await res.json() as { narrative?: string };
  return json.narrative ?? 'Sin respuesta';
}

function exportarPDF(tipo: TabInforme, datos: DatosInforme, narrative: string) {
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Los Barriles', 105, y, { align: 'center' });
  y += 8;

  doc.setFontSize(13);
  doc.text(`Informe ${TAB_LABELS[tipo]}`, 105, y, { align: 'center' });
  y += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const periodoStr = (() => {
    if ('fecha'  in datos) return (datos as DatosDiarios).fecha;
    if ('semana' in datos) {
      const s = datos as DatosSemanales;
      return `Semana ${s.semana}/${s.año} (${s.desde} – ${s.hasta})`;
    }
    if ('mes' in datos) return (datos as DatosMensuales).mes;
    return `Año ${(datos as DatosAnuales).año}`;
  })();
  doc.text(periodoStr, 105, y, { align: 'center' });
  y += 12;

  doc.setDrawColor(100, 100, 100);
  doc.line(20, y, 190, y);
  y += 8;

  // KPIs
  const base = datos as DatosDiarios;
  if ('totalIngresos' in datos) {
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen económico', 20, y); y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Ingresos: ${kpiEur(base.totalIngresos)}`, 25, y); y += 6;
    doc.text(`Gastos: ${kpiEur(base.totalGastos)}`, 25, y); y += 6;
    doc.text(`Beneficio estimado: ${kpiEur(base.beneficio)}`, 25, y); y += 6;
    doc.text(`Nº pedidos: ${base.numeroPedidos}  ·  Ticket medio: ${kpiEur(base.ticketMedio)}`, 25, y); y += 10;
  }

  // Top productos
  if ('topProductos' in datos && base.topProductos.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Top productos', 20, y); y += 7;
    doc.setFont('helvetica', 'normal');
    base.topProductos.slice(0, 5).forEach((p, i) => {
      doc.text(`${i + 1}. ${p.nombre} — ${kpiEur(p.total)} (${p.cantidad} uds)`, 25, y); y += 6;
    });
    y += 6;
  }

  // Narrative
  if (narrative) {
    doc.setFont('helvetica', 'bold');
    doc.text('Análisis IA', 20, y); y += 7;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(narrative, 165);
    lines.forEach((line: string) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(line, 20, y); y += 6;
    });
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 105, 285, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  doc.save(`informe_${tipo}_${periodoStr}.pdf`);
}

function calcularParejas(tickets: Ticket[]): { par: string; count: number; pct: number }[] {
  const pares: Record<string, number> = {};
  tickets.forEach(t => {
    const nombres = [...new Set(t.lineas.map(l => l.nombre))];
    for (let i = 0; i < nombres.length; i++) {
      for (let j = i + 1; j < nombres.length; j++) {
        const key = [nombres[i], nombres[j]].sort().join(' + ');
        pares[key] = (pares[key] ?? 0) + 1;
      }
    }
  });
  return Object.entries(pares)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([par, count]) => ({ par, count, pct: Math.round(count / Math.max(tickets.length, 1) * 100) }));
}

function TicketsAnalisis() {
  const [periodo,    setPeriodo]    = useState<'hoy' | 'semana' | 'mes'>('mes');
  const [tickets,    setTickets]    = useState<Ticket[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [narrativa,  setNarrativa]  = useState('');
  const [loadingIA,  setLoadingIA]  = useState(false);

  const cargarTickets = async () => {
    setLoading(true);
    const ahora = new Date();
    const hasta = ahora.toISOString().slice(0, 10);
    let desde: string;
    if (periodo === 'hoy') {
      desde = hasta;
    } else if (periodo === 'semana') {
      const d = new Date(ahora); d.setDate(d.getDate() - 7);
      desde = d.toISOString().slice(0, 10);
    } else {
      const d = new Date(ahora); d.setDate(d.getDate() - 30);
      desde = d.toISOString().slice(0, 10);
    }
    try {
      const ts = await getTicketsByPeriod(desde, hasta);
      setTickets(ts);
    } finally { setLoading(false); }
  };

  useEffect(() => { void cargarTickets(); }, [periodo]);

  const ticketMedio      = tickets.length > 0 ? tickets.reduce((s, t) => s + t.total, 0) / tickets.length : 0;
  const totalFacturado   = tickets.reduce((s, t) => s + t.total, 0);
  const distribucion     = [
    { label: '0–20€',   count: tickets.filter(t => t.total < 20).length },
    { label: '20–40€',  count: tickets.filter(t => t.total >= 20 && t.total < 40).length },
    { label: '40–60€',  count: tickets.filter(t => t.total >= 40 && t.total < 60).length },
    { label: '+60€',    count: tickets.filter(t => t.total >= 60).length },
  ];
  const maxDist          = Math.max(...distribucion.map(d => d.count), 1);
  const topParejas       = calcularParejas(tickets);
  const comida           = tickets.filter(t => { const h = parseInt(t.hora.split(':')[0]); return h >= 12 && h < 17; });
  const cena             = tickets.filter(t => { const h = parseInt(t.hora.split(':')[0]); return h >= 19; });
  const ticketMedioComida = comida.length > 0 ? comida.reduce((s, t) => s + t.total, 0) / comida.length : 0;
  const ticketMedioCena   = cena.length  > 0 ? cena.reduce((s, t) => s + t.total, 0) / cena.length   : 0;

  const handleAnalizar = async () => {
    setLoadingIA(true);
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'informe', tipo: 'tickets',
          datos: {
            periodo, totalTickets: tickets.length, ticketMedio: Math.round(ticketMedio * 100) / 100,
            distribucion, topParejas, totalFacturado: Math.round(totalFacturado * 100) / 100,
            comparativaServicio: {
              comida: { tickets: comida.length, ticketMedio: Math.round(ticketMedioComida * 100) / 100 },
              cena:   { tickets: cena.length,   ticketMedio: Math.round(ticketMedioCena * 100) / 100 },
            },
          },
        }),
      });
      const json = await res.json() as { narrative?: string };
      setNarrativa(json.narrative ?? '');
    } catch (e) { console.error(e); }
    finally { setLoadingIA(false); }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando tickets...</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
        <p className="text-slate-400 text-sm font-bold">Período</p>
        <div className="flex gap-2">
          {(['hoy', 'semana', 'mes'] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                periodo === p ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}>
              {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Última semana' : 'Últimos 30 días'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { l: 'Tickets',    v: String(tickets.length),         c: 'text-white' },
          { l: 'Ticket medio', v: kpiEur(ticketMedio),          c: 'text-amber-400' },
          { l: 'Facturado',  v: kpiEur(totalFacturado),         c: 'text-emerald-400' },
        ].map(({ l, v, c }) => (
          <div key={l} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
            <p className="text-slate-400 text-xs">{l}</p>
            <p className={`font-black text-lg ${c}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-slate-300 font-bold text-sm mb-3">Distribución por importe</p>
        <div className="space-y-2">
          {distribucion.map(d => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="text-slate-400 text-xs w-16 shrink-0">{d.label}</span>
              <div className="flex-1 bg-slate-700 rounded-full h-2.5">
                <div
                  className="bg-amber-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.round(d.count / maxDist * 100)}%` }}
                />
              </div>
              <span className="text-white text-xs w-6 text-right">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {topParejas.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-300 font-bold text-sm mb-3">Top combinaciones de productos</p>
          <ul className="space-y-2">
            {topParejas.map((p, i) => (
              <li key={p.par} className="flex items-center gap-2">
                <span className="text-slate-500 text-sm w-4">{i + 1}</span>
                <span className="text-white text-xs flex-1 truncate">{p.par}</span>
                <span className="text-amber-400 font-bold text-xs">{p.count}× ({p.pct}%)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <p className="text-slate-300 font-bold text-sm mb-3">Comida vs Cena</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <p className="text-slate-400 text-xs mb-1">Comida (12–17h)</p>
            <p className="text-amber-400 font-black text-xl">{kpiEur(ticketMedioComida)}</p>
            <p className="text-slate-500 text-xs">{comida.length} tickets</p>
          </div>
          <div className="text-center">
            <p className="text-slate-400 text-xs mb-1">Cena (19h+)</p>
            <p className="text-amber-400 font-black text-xl">{kpiEur(ticketMedioCena)}</p>
            <p className="text-slate-500 text-xs">{cena.length} tickets</p>
          </div>
        </div>
      </div>

      {tickets.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-300 font-bold text-sm mb-3">Últimos tickets</p>
          <div className="space-y-2">
            {tickets.slice(0, 10).map(t => (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{t.mesaNombre}</p>
                  <p className="text-slate-500 text-[10px]">{t.numero} · {t.hora}</p>
                </div>
                <span className="text-amber-400 font-bold text-sm shrink-0">{kpiEur(t.total)}</span>
                <button
                  onClick={() => void reimprimirTicket(t)}
                  title="Reimprimir"
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs transition-colors shrink-0"
                >
                  Reimprimir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => void handleAnalizar()}
        disabled={loadingIA || tickets.length === 0}
        className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black rounded-xl transition-colors"
      >
        {loadingIA ? 'Analizando con IA...' : 'Analizar con IA'}
      </button>

      {narrativa && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-amber-400 font-bold text-sm mb-3">Análisis IA</p>
          <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{narrativa}</p>
        </div>
      )}
    </div>
  );
}

export function InformesView() {
  const [tab, setTab]                     = useState<TabInforme>('diario');
  const [fechaDiario, setFechaDiario]     = useState(new Date().toISOString().slice(0, 10));
  const [fechaSemanal, setFechaSemanal]   = useState(new Date().toISOString().slice(0, 10));
  const [mesMensual, setMesMensual]       = useState(monthKey(new Date()));
  const [añoAnual, setAñoAnual]           = useState(new Date().getFullYear());
  const [datos, setDatos]                 = useState<DatosInforme | null>(null);
  const [narrative, setNarrative]         = useState('');
  const [loadingDatos, setLoadingDatos]   = useState(false);
  const [loadingNarr, setLoadingNarr]     = useState(false);
  const [error, setError]                 = useState('');

  const handleGenerar = async () => {
    if (tab === 'tickets') return;
    setLoadingDatos(true);
    setNarrative('');
    setError('');
    setDatos(null);
    try {
      let d: DatosInforme;
      if (tab === 'diario') {
        d = await getDatosDiarios(fechaDiario);
      } else if (tab === 'semanal') {
        const date = new Date(fechaSemanal + 'T12:00:00');
        d = await getDatosSemanales(getISOWeek(date), date.getFullYear());
      } else if (tab === 'mensual') {
        d = await getDatosMensuales(mesMensual);
      } else {
        d = await getDatosAnuales(añoAnual);
      }
      setDatos(d);
      setLoadingDatos(false);

      // Generate AI narrative
      setLoadingNarr(true);
      const narr = await generarNarrativa(tab, d);
      setNarrative(narr);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoadingDatos(false);
      setLoadingNarr(false);
    }
  };

  const chartData = (() => {
    if (!datos) return [];
    if (tab === 'diario') return (datos as DatosDiarios).ventasPorHora.map(v => ({ name: v.hora, total: v.total }));
    if (tab === 'semanal') return (datos as DatosSemanales).porDia.map(v => ({ name: v.dia, total: v.total, gastos: v.gastos }));
    if (tab === 'mensual') return (datos as DatosMensuales).porDia.map(v => ({ name: String(v.dia), total: v.ingresos, gastos: v.gastos }));
    return (datos as DatosAnuales).porMes.map(v => ({ name: v.mes, total: v.ingresos, gastos: v.gastos }));
  })();

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-black mb-3">📈 Informes IA</h1>
        {/* Tabs */}
        <div className="flex gap-1">
          {(Object.keys(TAB_LABELS) as TabInforme[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setDatos(null); setNarrative(''); }}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                tab === t ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {tab === 'tickets' ? (
        <TicketsAnalisis />
      ) : (
      <div className="p-4 space-y-4">
        {/* Period selector */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-slate-400 text-sm font-bold">Período</p>
          {tab === 'diario' && (
            <input type="date" value={fechaDiario} onChange={e => setFechaDiario(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-amber-500" />
          )}
          {tab === 'semanal' && (
            <div>
              <label className="text-xs text-slate-500 block mb-1">Cualquier día de la semana</label>
              <input type="date" value={fechaSemanal} onChange={e => setFechaSemanal(e.target.value)}
                className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-amber-500" />
            </div>
          )}
          {tab === 'mensual' && (
            <input type="month" value={mesMensual} onChange={e => setMesMensual(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-amber-500" />
          )}
          {tab === 'anual' && (
            <input type="number" min="2020" max="2099" value={añoAnual}
              onChange={e => setAñoAnual(parseInt(e.target.value))}
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-amber-500" />
          )}
          <button
            onClick={handleGenerar}
            disabled={loadingDatos || loadingNarr}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-black rounded-xl transition-colors"
          >
            {loadingDatos ? 'Cargando datos...' : loadingNarr ? 'Generando análisis IA...' : 'Generar informe'}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        {/* Results */}
        {datos && (
          <>
            {seccionKpis(datos)}

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p className="text-slate-300 font-bold text-sm mb-3">
                  {tab === 'diario' ? 'Ventas por hora' : tab === 'anual' ? 'Por mes' : 'Por día'}
                </p>
                <div style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }}
                        interval={tab === 'mensual' ? 4 : 0} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                        formatter={(v) => `${(v as number).toFixed(2)}€`}
                      />
                      {tab !== 'diario' && <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />}
                      <Bar dataKey="total" name="Ingresos" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                      {tab !== 'diario' && (
                        <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[3, 3, 0, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top productos */}
            {'topProductos' in datos && (datos as DatosDiarios).topProductos.length > 0 && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <p className="text-slate-300 font-bold text-sm mb-3">Top productos</p>
                <ul className="space-y-2">
                  {(datos as DatosDiarios).topProductos.slice(0, 7).map((p, i) => (
                    <li key={p.nombre} className="flex items-center gap-2">
                      <span className="text-slate-500 text-sm w-4">{i + 1}</span>
                      <span className="text-white text-sm flex-1 truncate">{p.nombre}</span>
                      <span className="text-slate-400 text-xs">{p.cantidad}×</span>
                      <span className="text-amber-400 font-bold text-sm">{p.total.toFixed(2)}€</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {'productosManales' in datos && (datos as DatosDiarios).productosManales.length > 0 && (
              <div className="bg-slate-800 border border-violet-700/50 rounded-xl p-4">
                <p className="text-violet-300 font-bold text-sm mb-3">✏️ Productos fuera de carta ({(datos as DatosDiarios).productosManales.length})</p>
                <div className="space-y-2">
                  {(datos as DatosDiarios).productosManales.map((p, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 text-sm border-b border-slate-700 pb-2 last:border-0 last:pb-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold truncate">{p.nombre}</p>
                        <p className="text-slate-400 text-xs">{p.mesa} · {p.camarero}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-amber-400 font-bold">{(p.precio * p.cantidad).toFixed(2)}€</p>
                        <p className="text-slate-500 text-xs">{p.cantidad}× {p.precio.toFixed(2)}€</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gemini narrative */}
            {loadingNarr && (
              <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-4 text-center">
                <p className="text-amber-400 text-sm font-bold">Generando análisis con Gemini...</p>
              </div>
            )}
            {narrative && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-amber-400 font-bold text-sm flex items-center gap-2">
                    🤖 Análisis IA
                  </p>
                  <button
                    onClick={() => exportarPDF(tab, datos, narrative)}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-colors"
                  >
                    📄 PDF
                  </button>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{narrative}</p>
              </div>
            )}
          </>
        )}
      </div>
      )}
    </div>
  );
}
