import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { useReservasMes, useReservasDia } from '../hooks/useReservas';
import {
  crearReserva, actualizarReserva, cambiarEstadoReserva,
  getConfigReservas,
} from '../services/reservas.service';
import { buscarClientes } from '../services/clientes.service';
import { todayStr, dateToStr, MESES_ES } from '../utils/dates';
import type { Reserva, EstadoReserva, OrigenReserva, ZonaReserva, ConfigReservas, Cliente } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_HEADERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const TIME_SLOTS: string[] = (() => {
  const s: string[] = [];
  for (let h = 10; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      s.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  s.push('00:00');
  return s;
})();

const ESTADO_CFG: Record<EstadoReserva, { label: string; bg: string; text: string }> = {
  pendiente:  { label: 'Pendiente',  bg: 'bg-slate-600',   text: 'text-slate-200'   },
  confirmada: { label: 'Confirmada', bg: 'bg-blue-600',    text: 'text-blue-100'    },
  sentada:    { label: 'Sentada',    bg: 'bg-emerald-600', text: 'text-emerald-100' },
  completada: { label: 'Completada', bg: 'bg-slate-700',   text: 'text-slate-400'   },
  no_show:    { label: 'No show',    bg: 'bg-red-700',     text: 'text-red-200'     },
  cancelada:  { label: 'Cancelada',  bg: 'bg-slate-800',   text: 'text-slate-500'   },
};

const DEFAULT_CONFIG: ConfigReservas = {
  capacidadComida: 60,
  capacidadCena: 60,
  horaInicioComida: '13:00',
  horaFinComida: '16:00',
  horaInicioCena: '20:00',
  horaFinCena: '23:00',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectService(hora: string, cfg: ConfigReservas): 'comida' | 'cena' | 'otros' {
  if (hora >= cfg.horaInicioComida && hora <= cfg.horaFinComida) return 'comida';
  if (hora >= cfg.horaInicioCena  && hora <= cfg.horaFinCena)   return 'cena';
  return 'otros';
}

function paxForService(
  reservas: Reserva[],
  service: 'comida' | 'cena' | 'otros',
  cfg: ConfigReservas,
): number {
  return reservas
    .filter(r =>
      r.estado !== 'cancelada' &&
      r.estado !== 'no_show' &&
      detectService(r.hora, cfg) === service,
    )
    .reduce((s, r) => s + r.comensales, 0);
}

function buildCalendarDays(year: number, month: number) {
  const firstDay    = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow    = (firstDay.getDay() + 6) % 7;

  const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -i);
    days.push({ date: dateToStr(d), day: d.getDate(), isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      day: d,
      isCurrentMonth: true,
    });
  }
  const remaining = (7 - (days.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month, i);
    days.push({ date: dateToStr(d), day: d.getDate(), isCurrentMonth: false });
  }
  return days;
}

// ─── ReservaCard ─────────────────────────────────────────────────────────────

function ReservaCard({
  reserva,
  onEdit,
  onEstado,
}: {
  reserva: Reserva;
  onEdit:    (r: Reserva) => void;
  onEstado:  (id: string, estado: EstadoReserva) => void;
}) {
  const ec = ESTADO_CFG[reserva.estado];
  const isCancelled = reserva.estado === 'cancelada' || reserva.estado === 'completada';

  return (
    <div className={`bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-2 ${isCancelled ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-amber-400 font-black text-xl tabular-nums">{reserva.hora}</span>
          <div>
            <p className="text-white font-bold text-base leading-tight">{reserva.nombre}</p>
            <p className="text-slate-400 text-sm">{reserva.comensales} pax · {reserva.telefono}</p>
          </div>
        </div>
        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-lg ${ec.bg} ${ec.text}`}>
          {ec.label}
        </span>
      </div>

      {(reserva.zona || reserva.mesaNombre) && (
        <p className="text-slate-500 text-xs">
          {reserva.zona && `📍 ${reserva.zona.charAt(0).toUpperCase() + reserva.zona.slice(1)}`}
          {reserva.zona && reserva.mesaNombre && ' · '}
          {reserva.mesaNombre && `🪑 ${reserva.mesaNombre}`}
        </p>
      )}

      {reserva.notas && (
        <p className="text-amber-300 text-xs italic">📝 {reserva.notas}</p>
      )}

      {!isCancelled && (
        <div className="flex flex-wrap gap-2 pt-1">
          {reserva.estado !== 'sentada' && reserva.estado !== 'completada' && (
            <button
              onClick={() => onEstado(reserva.id, 'sentada')}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-emerald-100 text-xs font-bold rounded-xl transition-colors"
            >
              ✅ Ha llegado
            </button>
          )}
          {reserva.estado !== 'no_show' && (
            <button
              onClick={() => onEstado(reserva.id, 'no_show')}
              className="px-3 py-1.5 bg-red-800 hover:bg-red-700 text-red-200 text-xs font-bold rounded-xl transition-colors"
            >
              ❌ No show
            </button>
          )}
          <button
            onClick={() => onEdit(reserva)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-xl transition-colors"
          >
            ✏️ Editar
          </button>
          <button
            onClick={() => onEstado(reserva.id, 'cancelada')}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs font-bold rounded-xl transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ReservaFormModal ─────────────────────────────────────────────────────────

function ReservaFormModal({
  editingReserva,
  initialDate,
  config,
  uid,
  onClose,
  onSaved,
}: {
  editingReserva: Reserva | null;
  initialDate: string;
  config: ConfigReservas;
  uid: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nombre:    editingReserva?.nombre   ?? '',
    telefono:  editingReserva?.telefono ?? '',
    email:     editingReserva?.email    ?? '',
    clienteId: editingReserva?.clienteId,
    fecha:     editingReserva?.fecha    ?? initialDate,
    hora:      editingReserva?.hora     ?? '13:00',
    comensales: editingReserva?.comensales ?? 2,
    zona:      (editingReserva?.zona    ?? 'interior') as ZonaReserva,
    notas:     editingReserva?.notas    ?? '',
    origen:    (editingReserva?.origen  ?? 'telefono') as OrigenReserva,
  });

  const [saving,      setSaving]      = useState(false);
  const [sugerencias, setSugerencias] = useState<Cliente[]>([]);
  const [showSug,     setShowSug]     = useState(false);
  const [buscando,    setBuscando]    = useState(false);

  const { reservas: diaReservas } = useReservasDia(form.fecha);

  const service = detectService(form.hora, config);
  const paxActual = useMemo(() => {
    const base = diaReservas.filter(r =>
      r.estado !== 'cancelada' &&
      r.estado !== 'no_show' &&
      detectService(r.hora, config) === service &&
      (editingReserva ? r.id !== editingReserva.id : true),
    ).reduce((s, r) => s + r.comensales, 0);
    return base;
  }, [diaReservas, form.fecha, form.hora, service, editingReserva, config]);

  const capacidad = service === 'comida' ? config.capacidadComida : service === 'cena' ? config.capacidadCena : 999;
  const paxTotal  = paxActual + form.comensales;
  const overCap   = service !== 'otros' && paxTotal > capacidad;

  useEffect(() => {
    if (form.nombre.length < 2) { setSugerencias([]); setShowSug(false); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      const res = await buscarClientes(form.nombre);
      setSugerencias(res);
      setShowSug(res.length > 0);
      setBuscando(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [form.nombre]);

  const seleccionarCliente = (c: Cliente) => {
    setForm(f => ({
      ...f,
      nombre:    c.nombre + (c.apellidos ? ' ' + c.apellidos : ''),
      telefono:  c.telefono ?? '',
      email:     c.email    ?? '',
      clienteId: c.id,
    }));
    setShowSug(false);
    setSugerencias([]);
  };

  const set = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm(f => ({ ...f, [k]: v }));
  }, []);

  const handleGuardar = async (confirmar = false) => {
    if (!form.nombre.trim() || !form.telefono.trim()) {
      alert('Nombre y teléfono son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const estado: EstadoReserva = confirmar ? 'confirmada' : (editingReserva?.estado ?? 'pendiente');
      const payload: Omit<Reserva, 'id'> = {
        nombre:    form.nombre.trim(),
        telefono:  form.telefono.trim(),
        email:     form.email.trim() || undefined,
        clienteId: form.clienteId,
        fecha:     form.fecha,
        hora:      form.hora,
        comensales: form.comensales,
        zona:      form.zona,
        notas:     form.notas.trim() || undefined,
        origen:    form.origen,
        estado,
        creadaPor: uid,
        createdAt: editingReserva?.createdAt ?? new Date().toISOString(),
      };
      if (editingReserva) {
        await actualizarReserva(editingReserva.id, payload);
      } else {
        await crearReserva(payload);
      }
      onSaved();
    } catch (e) {
      console.error(e);
      alert('Error al guardar la reserva');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelarReserva = async () => {
    if (!editingReserva) return;
    if (!window.confirm('¿Cancelar esta reserva?')) return;
    try {
      await cambiarEstadoReserva(editingReserva.id, 'cancelada');
      onSaved();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-slate-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg border border-slate-700 shadow-2xl overflow-y-auto max-h-[95vh]">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-white font-black text-lg">
            {editingReserva ? 'Editar reserva' : 'Nueva reserva'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Nombre con autocomplete */}
          <div className="relative">
            <label className="text-slate-400 text-xs font-bold uppercase block mb-1">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              onBlur={() => setTimeout(() => setShowSug(false), 150)}
              placeholder="Nombre del cliente"
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
            />
            {buscando && (
              <span className="absolute right-3 top-9 text-slate-400 text-xs">...</span>
            )}
            {showSug && (
              <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-slate-700 border border-slate-600 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                {sugerencias.map(c => (
                  <button
                    key={c.id}
                    onMouseDown={() => seleccionarCliente(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-600 transition-colors"
                  >
                    <p className="text-white text-sm font-bold">{c.nombre} {c.apellidos}</p>
                    {c.telefono && <p className="text-slate-400 text-xs">{c.telefono}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Teléfono y email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase block mb-1">Teléfono *</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={e => set('telefono', e.target.value)}
                placeholder="612345678"
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase block mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="opcional"
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase block mb-1">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={e => set('fecha', e.target.value)}
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase block mb-1">Hora</label>
              <select
                value={form.hora}
                onChange={e => set('hora', e.target.value)}
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
              >
                {TIME_SLOTS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Capacidad del servicio */}
          {service !== 'otros' && (
            <div className={`rounded-xl px-3 py-2 text-sm font-bold flex items-center justify-between ${overCap ? 'bg-red-900/40 text-red-300' : 'bg-slate-700/50 text-slate-300'}`}>
              <span>{service === 'comida' ? '🍽️ Comida' : '🌙 Cena'}</span>
              <span>{paxTotal} / {capacidad} pax {overCap && '⚠ SUPERA'}</span>
            </div>
          )}

          {/* Comensales */}
          <div>
            <label className="text-slate-400 text-xs font-bold uppercase block mb-2">Comensales</label>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <button
                  key={n}
                  onClick={() => set('comensales', n)}
                  className={`w-10 h-10 rounded-xl font-black text-sm transition-colors ${
                    form.comensales === n
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {n}
                </button>
              ))}
              <input
                type="number"
                min={1}
                value={form.comensales}
                onChange={e => set('comensales', Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-10 bg-slate-700 text-white text-center rounded-xl text-sm border border-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Zona */}
          <div>
            <label className="text-slate-400 text-xs font-bold uppercase block mb-2">Zona</label>
            <div className="flex gap-2">
              {(['interior', 'terraza', 'barra'] as ZonaReserva[]).map(z => (
                <button
                  key={z}
                  onClick={() => set('zona', z)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                    form.zona === z
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {z.charAt(0).toUpperCase() + z.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Origen */}
          <div>
            <label className="text-slate-400 text-xs font-bold uppercase block mb-2">Origen</label>
            <div className="flex gap-2">
              {([
                { v: 'telefono', l: '📞 Teléfono' },
                { v: 'presencial', l: '🚶 Presencial' },
                { v: 'web', l: '🌐 Web' },
              ] as { v: OrigenReserva; l: string }[]).map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => set('origen', v)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                    form.origen === v
                      ? 'bg-amber-500 text-black'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="text-slate-400 text-xs font-bold uppercase block mb-1">Notas</label>
            <textarea
              value={form.notas}
              onChange={e => set('notas', e.target.value)}
              placeholder="Alergias, preferencias, ocasión especial..."
              rows={2}
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm border border-slate-600 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onClose}
                className="py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleGuardar(false)}
                disabled={saving}
                className="py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? '...' : 'Guardar'}
              </button>
            </div>
            <button
              onClick={() => void handleGuardar(true)}
              disabled={saving}
              className="py-3 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? '...' : '✅ Guardar y confirmar'}
            </button>
            {editingReserva && editingReserva.estado !== 'cancelada' && (
              <button
                onClick={() => void handleCancelarReserva()}
                className="py-2.5 bg-red-900/50 hover:bg-red-800 text-red-300 font-bold rounded-xl transition-colors text-sm"
              >
                🗑 Cancelar esta reserva
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DayView ──────────────────────────────────────────────────────────────────

function DayView({
  fecha,
  config,
  onBack,
  onNueva,
  onEdit,
  onPrevDay,
  onNextDay,
  onToday,
}: {
  fecha:     string;
  config:    ConfigReservas;
  onBack:    () => void;
  onNueva:   () => void;
  onEdit:    (r: Reserva) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday:   () => void;
}) {
  const { reservas, loading } = useReservasDia(fecha);

  const handleEstado = async (id: string, estado: EstadoReserva) => {
    try { await cambiarEstadoReserva(id, estado); }
    catch (e) { console.error(e); }
  };

  const comida = reservas.filter(r => detectService(r.hora, config) === 'comida');
  const cena   = reservas.filter(r => detectService(r.hora, config) === 'cena');
  const otros  = reservas.filter(r => detectService(r.hora, config) === 'otros');

  const paxComida = paxForService(reservas, 'comida', config);
  const paxCena   = paxForService(reservas, 'cena',   config);

  const [d, mes, año] = fecha.split('-').map(Number);
  const dateLabel = `${d} ${MESES_ES[(mes ?? 1) - 1]} ${año}`;

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="text-amber-400 font-bold text-sm hover:text-amber-300">
            ← Mes
          </button>
          <button
            onClick={onToday}
            className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-bold"
          >
            Hoy
          </button>
          <button
            onClick={onNueva}
            className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-black"
          >
            + Nueva
          </button>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={onPrevDay} className="text-slate-400 hover:text-white text-xl px-2">‹</button>
          <h2 className="text-white font-black text-lg">{dateLabel}</h2>
          <button onClick={onNextDay} className="text-slate-400 hover:text-white text-xl px-2">›</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-500">Cargando...</div>
      ) : reservas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
          <span className="text-4xl">📅</span>
          <p className="font-bold">Sin reservas este día</p>
          <button
            onClick={onNueva}
            className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-sm font-black"
          >
            + Nueva reserva
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {comida.length > 0 && (
            <ServiceSection
              title="🍽️ Comida"
              pax={paxComida}
              capacidad={config.capacidadComida}
              reservas={comida}
              onEdit={onEdit}
              onEstado={handleEstado}
            />
          )}
          {cena.length > 0 && (
            <ServiceSection
              title="🌙 Cena"
              pax={paxCena}
              capacidad={config.capacidadCena}
              reservas={cena}
              onEdit={onEdit}
              onEstado={handleEstado}
            />
          )}
          {otros.length > 0 && (
            <ServiceSection
              title="🕐 Otros"
              pax={0}
              capacidad={0}
              reservas={otros}
              onEdit={onEdit}
              onEstado={handleEstado}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ServiceSection({
  title, pax, capacidad, reservas, onEdit, onEstado,
}: {
  title: string;
  pax: number;
  capacidad: number;
  reservas: Reserva[];
  onEdit: (r: Reserva) => void;
  onEstado: (id: string, e: EstadoReserva) => void;
}) {
  const pct = capacidad > 0 ? Math.min(100, (pax / capacidad) * 100) : 0;
  const over = capacidad > 0 && pax > capacidad;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white font-black text-base">{title}</h3>
        {capacidad > 0 && (
          <span className={`text-sm font-bold ${over ? 'text-red-400' : 'text-slate-400'}`}>
            {pax} / {capacidad} pax
          </span>
        )}
      </div>
      {capacidad > 0 && (
        <div className="w-full h-1.5 bg-slate-700 rounded-full mb-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      <div className="space-y-3">
        {reservas.map(r => (
          <ReservaCard key={r.id} reserva={r} onEdit={onEdit} onEstado={onEstado} />
        ))}
      </div>
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────────────

function CalendarView({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  onToday,
  onDayClick,
  reservasMes,
}: {
  year:        number;
  month:       number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday:     () => void;
  onDayClick:  (date: string) => void;
  reservasMes: Reserva[];
}) {
  const days   = buildCalendarDays(year, month);
  const today  = todayStr();

  const countByDate = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of reservasMes) {
      if (r.estado !== 'cancelada' && r.estado !== 'no_show') {
        m[r.fecha] = (m[r.fecha] ?? 0) + 1;
      }
    }
    return m;
  }, [reservasMes]);

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={onPrevMonth} className="text-slate-400 hover:text-white text-2xl px-2 py-1">‹</button>
          <div className="text-center">
            <h2 className="text-white font-black text-xl">
              {MESES_ES[month - 1]} {year}
            </h2>
          </div>
          <button onClick={onNextMonth} className="text-slate-400 hover:text-white text-2xl px-2 py-1">›</button>
        </div>
        <div className="flex justify-center mt-2">
          <button
            onClick={onToday}
            className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-bold"
          >
            Hoy
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Week headers */}
        <div className="grid grid-cols-7 mb-2">
          {WEEK_HEADERS.map(h => (
            <div key={h} className="text-center text-slate-500 text-xs font-bold py-1">{h}</div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(({ date, day, isCurrentMonth }) => {
            const count   = countByDate[date] ?? 0;
            const isToday = date === today;

            return (
              <button
                key={date}
                onClick={() => onDayClick(date)}
                className={`
                  relative aspect-square flex flex-col items-center justify-center rounded-xl transition-colors
                  ${isCurrentMonth ? 'hover:bg-slate-700' : ''}
                  ${isToday ? 'bg-amber-500 text-black' : isCurrentMonth ? 'text-white' : 'text-slate-700'}
                `}
              >
                <span className={`text-sm font-bold ${isToday ? 'text-black' : ''}`}>{day}</span>
                {count > 0 && (
                  <span className={`text-[9px] font-black px-1 rounded-full mt-0.5 ${isToday ? 'bg-black/30 text-black' : 'bg-amber-500 text-black'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── ReservasView (main) ──────────────────────────────────────────────────────

type SubView = 'calendar' | 'day' | 'form';

export function ReservasView() {
  const { user }   = useAuthContext();
  const today      = todayStr();
  const todayDate  = new Date();

  const [subView,         setSubView]         = useState<SubView>('calendar');
  const [calYear,         setCalYear]         = useState(todayDate.getFullYear());
  const [calMonth,        setCalMonth]        = useState(todayDate.getMonth() + 1);
  const [selectedDate,    setSelectedDate]    = useState(today);
  const [editingReserva,  setEditingReserva]  = useState<Reserva | null>(null);
  const [config,          setConfig]          = useState<ConfigReservas>(DEFAULT_CONFIG);

  const { reservas: mesReservas } = useReservasMes(calYear, calMonth);

  useEffect(() => {
    getConfigReservas().then(setConfig).catch(console.error);
  }, []);

  const handlePrevMonth = () => {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  };
  const handleNextMonth = () => {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  };
  const handleToday = () => {
    const n = new Date();
    setCalYear(n.getFullYear());
    setCalMonth(n.getMonth() + 1);
    setSelectedDate(today);
    setSubView('calendar');
  };
  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setSubView('day');
  };
  const handlePrevDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    setSelectedDate(dateToStr(d));
  };
  const handleNextDay = () => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    setSelectedDate(dateToStr(d));
  };
  const handleNueva = () => {
    setEditingReserva(null);
    setSubView('form');
  };
  const handleEdit = (r: Reserva) => {
    setEditingReserva(r);
    setSubView('form');
  };
  const handleFormClose = () => {
    setSubView(editingReserva ? 'day' : 'day');
    setEditingReserva(null);
  };
  const handleFormSaved = () => {
    setEditingReserva(null);
    setSubView('day');
  };

  if (subView === 'form') {
    return (
      <>
        <div className="min-h-screen bg-slate-900" />
        <ReservaFormModal
          editingReserva={editingReserva}
          initialDate={selectedDate}
          config={config}
          uid={user?.uid ?? ''}
          onClose={handleFormClose}
          onSaved={handleFormSaved}
        />
      </>
    );
  }

  if (subView === 'day') {
    return (
      <DayView
        fecha={selectedDate}
        config={config}
        onBack={() => setSubView('calendar')}
        onNueva={handleNueva}
        onEdit={handleEdit}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onToday={handleToday}
      />
    );
  }

  return (
    <CalendarView
      year={calYear}
      month={calMonth}
      onPrevMonth={handlePrevMonth}
      onNextMonth={handleNextMonth}
      onToday={handleToday}
      onDayClick={handleDayClick}
      reservasMes={mesReservas}
    />
  );
}
