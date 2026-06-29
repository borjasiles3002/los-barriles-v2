import { useState, useEffect } from 'react';
import type { Turno, AppUser } from '../types';
import { usePersonal } from '../hooks/usePersonal';
import { getTurnosPorPeriodo, getAllTurnosPeriodo } from '../services/fichaje.service';

function semanaActual(): { desde: string; hasta: string } {
  const hoy   = new Date();
  const dia   = hoy.getDay(); // 0=dom
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((dia === 0 ? 7 : dia) - 1));
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return {
    desde: lunes.toISOString().slice(0, 10),
    hasta: domingo.toISOString().slice(0, 10),
  };
}

function mesActual(): { desde: string; hasta: string } {
  const hoy     = new Date();
  const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const ultimo  = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return {
    desde: primero.toISOString().slice(0, 10),
    hasta: ultimo.toISOString().slice(0, 10),
  };
}

function formatHoras(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h ${mm.toString().padStart(2, '0')}m`;
}

function formatFecha(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function HorasView() {
  const { personal } = usePersonal();
  const [filtroUid,  setFiltroUid]  = useState<string>('todos');
  const [periodo,    setPeriodo]    = useState<'semana' | 'mes' | 'custom'>('semana');
  const [desde,      setDesde]      = useState(semanaActual().desde);
  const [hasta,      setHasta]      = useState(semanaActual().hasta);
  const [turnos,     setTurnos]     = useState<Turno[]>([]);
  const [cargando,   setCargando]   = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      let data: Turno[];
      if (filtroUid === 'todos') {
        data = await getAllTurnosPeriodo(desde, hasta);
      } else {
        data = await getTurnosPorPeriodo(filtroUid, desde, hasta);
      }
      setTurnos(data.filter(t => t.completo));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (periodo === 'semana') {
      const { desde: d, hasta: h } = semanaActual();
      setDesde(d); setHasta(h);
    } else if (periodo === 'mes') {
      const { desde: d, hasta: h } = mesActual();
      setDesde(d); setHasta(h);
    }
  }, [periodo]);

  useEffect(() => { void cargar(); }, [desde, hasta, filtroUid]);

  // Agrupación por trabajador
  const resumen: Record<string, { nombre: string; total: number; turnos: Turno[] }> = {};
  turnos.forEach(t => {
    if (!resumen[t.usuarioId]) resumen[t.usuarioId] = { nombre: t.nombre, total: 0, turnos: [] };
    resumen[t.usuarioId].total  += t.horasTrabajadas ?? 0;
    resumen[t.usuarioId].turnos.push(t);
  });

  const exportarPDF = async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Control de Horas - Los Barriles', 14, 20);
    doc.setFontSize(11);
    doc.text(`Período: ${desde} → ${hasta}`, 14, 30);

    let y = 42;
    Object.values(resumen).forEach(({ nombre, total, turnos: ts }) => {
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(`${nombre} — ${formatHoras(total)}`, 14, y);
      y += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      ts.forEach(t => {
        const salida = t.salida ? formatHora(t.salida) : '-';
        doc.text(
          `  ${formatFecha(t.fecha)}   Entrada ${formatHora(t.entrada)}  Salida ${salida}  (${formatHoras(t.horasTrabajadas ?? 0)})`,
          14, y,
        );
        y += 6;
        if (y > 280) { doc.addPage(); y = 20; }
      });
      y += 4;
    });

    doc.save(`horas_${desde}_${hasta}.pdf`);
  };

  const trabajadoresFiltro: (AppUser & { label: string })[] = [
    { uid: 'todos', email: '', role: 'camarero', nombre: 'Todos los trabajadores', label: 'Todos' },
    ...personal.map(p => ({ ...p, label: `${p.nombre} ${p.apellidos ?? ''}` })),
  ];

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Control de Horas</h1>
        <button
          onClick={() => void exportarPDF()}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition text-sm"
        >
          Exportar PDF
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-end">
        {/* Período preset */}
        <div>
          <p className="text-slate-400 text-sm mb-1">Período</p>
          <div className="flex gap-2">
            {(['semana', 'mes', 'custom'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                  periodo === p ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mes' : 'Personalizado'}
              </button>
            ))}
          </div>
        </div>

        {/* Fechas custom */}
        {periodo === 'custom' && (
          <div className="flex gap-2 items-end">
            <div>
              <p className="text-slate-400 text-sm mb-1">Desde</p>
              <input
                type="date"
                value={desde}
                onChange={e => setDesde(e.target.value)}
                className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="text-slate-400 text-sm mb-1">Hasta</p>
              <input
                type="date"
                value={hasta}
                onChange={e => setHasta(e.target.value)}
                className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        {/* Trabajador */}
        <div>
          <p className="text-slate-400 text-sm mb-1">Trabajador</p>
          <select
            value={filtroUid}
            onChange={e => setFiltroUid(e.target.value)}
            className="bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
          >
            {trabajadoresFiltro.map(t => (
              <option key={t.uid} value={t.uid}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Resultados */}
      {cargando ? (
        <div className="text-slate-400 text-center py-12">Cargando…</div>
      ) : turnos.length === 0 ? (
        <div className="text-slate-400 text-center py-12">No hay turnos en este período.</div>
      ) : (
        <div className="space-y-4">
          {Object.values(resumen).map(({ nombre, total, turnos: ts }) => (
            <div key={nombre} className="bg-slate-800 rounded-xl overflow-hidden">
              {/* Cabecera trabajador */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-700">
                <span className="font-semibold text-white">{nombre}</span>
                <span className="text-emerald-400 font-mono font-bold">{formatHoras(total)}</span>
              </div>
              {/* Turnos */}
              <div className="divide-y divide-slate-700">
                {ts.map(t => (
                  <div key={t.id} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                    <span className="text-slate-400 w-28 flex-shrink-0">{formatFecha(t.fecha)}</span>
                    <span className="text-white">
                      {formatHora(t.entrada)} → {t.salida ? formatHora(t.salida) : '–'}
                    </span>
                    <span className="ml-auto text-amber-400 font-mono">
                      {formatHoras(t.horasTrabajadas ?? 0)}
                    </span>
                    {t.incidencia && (
                      <span className="text-red-400 text-xs">{t.incidencia}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
