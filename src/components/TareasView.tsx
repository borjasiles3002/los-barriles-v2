import { useState } from 'react';
import type { AppUser, Tarea, Prioridad, ChecklistItem, EstadoTarea } from '../types';
import { useTodasTareas, useTareasAsignadas } from '../hooks/useTareas';
import { usePersonal } from '../hooks/usePersonal';
import { esAdmin } from '../types';
import {
  crearTarea,
  cambiarEstadoTarea,
  toggleChecklistItem,
  eliminarTarea,
} from '../services/tareas.service';

const PRIORIDAD_COLOR: Record<Prioridad, string> = {
  alta:  'bg-red-900 text-red-300',
  media: 'bg-amber-900 text-amber-300',
  baja:  'bg-slate-700 text-slate-300',
};

const ESTADO_COLOR: Record<EstadoTarea, string> = {
  pendiente:   'bg-slate-700 text-slate-300',
  en_progreso: 'bg-blue-900 text-blue-300',
  completada:  'bg-emerald-900 text-emerald-300',
};

const ESTADO_LABEL: Record<EstadoTarea, string> = {
  pendiente:   'Pendiente',
  en_progreso: 'En progreso',
  completada:  'Completada',
};

interface FormTarea {
  titulo:          string;
  descripcion:     string;
  asignadoA:       string;
  asignadoANombre: string;
  fechaLimite:     string;
  prioridad:       Prioridad;
  checklistTexto:  string;
  checklist:       ChecklistItem[];
}

const FORM_EMPTY: FormTarea = {
  titulo: '', descripcion: '', asignadoA: '',
  asignadoANombre: '', fechaLimite: '', prioridad: 'media',
  checklistTexto: '', checklist: [],
};

interface Props {
  user: AppUser;
}

export function TareasView({ user: currentUser }: Props) {
  const esGestor     = esAdmin(currentUser.role);
  const { tareas: todasTareas }    = useTodasTareas();
  const { tareas: misTaskas }       = useTareasAsignadas(currentUser.uid);
  const tareas                     = esGestor ? todasTareas : misTaskas;

  const { personal } = usePersonal();
  const [modal,       setModal]       = useState(false);
  const [form,        setForm]        = useState<FormTarea>(FORM_EMPTY);
  const [guardando,   setGuardando]   = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<EstadoTarea | 'todas'>('todas');
  const [detalle,     setDetalle]     = useState<Tarea | null>(null);

  const tareasFiltradas = tareas.filter(t =>
    filtroEstado === 'todas' ? true : t.estado === filtroEstado,
  );

  const handleCrear = async () => {
    if (!form.titulo || !form.asignadoA) return;
    setGuardando(true);
    await crearTarea({
      titulo:          form.titulo,
      descripcion:     form.descripcion || undefined,
      asignadoA:       form.asignadoA,
      asignadoANombre: form.asignadoANombre,
      asignadoPor:     currentUser.uid,
      fechaLimite:     form.fechaLimite || undefined,
      prioridad:       form.prioridad,
      checklist:       form.checklist,
    });
    setModal(false);
    setForm(FORM_EMPTY);
    setGuardando(false);
  };

  const addCheckItem = () => {
    if (!form.checklistTexto.trim()) return;
    const item: ChecklistItem = {
      id: Math.random().toString(36).slice(2),
      texto: form.checklistTexto.trim(),
      completado: false,
    };
    setForm(f => ({ ...f, checklist: [...f.checklist, item], checklistTexto: '' }));
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Tareas</h1>
        {esGestor && (
          <button
            onClick={() => { setForm(FORM_EMPTY); setModal(true); }}
            className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-400 transition"
          >
            + Nueva tarea
          </button>
        )}
      </div>

      {/* Filtro estado */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['todas', 'pendiente', 'en_progreso', 'completada'] as const).map(e => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
              filtroEstado === e ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {e === 'todas' ? 'Todas' : ESTADO_LABEL[e]}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {tareasFiltradas.length === 0 && (
          <p className="text-slate-400 text-center py-12">No hay tareas.</p>
        )}
        {tareasFiltradas.map(t => (
          <div
            key={t.id}
            onClick={() => setDetalle(t)}
            className="bg-slate-800 rounded-xl p-4 cursor-pointer hover:bg-slate-750 transition flex items-start gap-4"
          >
            {/* Completar rápido */}
            <button
              onClick={e => {
                e.stopPropagation();
                void cambiarEstadoTarea(t.id, t.estado === 'completada' ? 'pendiente' : 'completada');
              }}
              className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 transition ${
                t.estado === 'completada'
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-slate-500 hover:border-amber-500'
              }`}
            >
              {t.estado === 'completada' && <span className="text-white text-xs flex items-center justify-center">✓</span>}
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`text-white font-medium ${t.estado === 'completada' ? 'line-through opacity-60' : ''}`}>
                  {t.titulo}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORIDAD_COLOR[t.prioridad]}`}>
                  {t.prioridad}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADO_COLOR[t.estado]}`}>
                  {ESTADO_LABEL[t.estado]}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-slate-400 text-sm">→ {t.asignadoANombre}</span>
                {t.fechaLimite && (
                  <span className={`text-xs ${new Date(t.fechaLimite) < new Date() && t.estado !== 'completada' ? 'text-red-400' : 'text-slate-500'}`}>
                    📅 {t.fechaLimite}
                  </span>
                )}
                {t.checklist.length > 0 && (
                  <span className="text-slate-500 text-xs">
                    {t.checklist.filter(i => i.completado).length}/{t.checklist.length} ✓
                  </span>
                )}
              </div>
            </div>

            {esGestor && (
              <button
                onClick={e => { e.stopPropagation(); void eliminarTarea(t.id); }}
                className="text-slate-500 hover:text-red-400 transition text-lg flex-shrink-0"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-white pr-4">{detalle.titulo}</h2>
              <button onClick={() => setDetalle(null)} className="text-slate-400 hover:text-white text-xl">×</button>
            </div>

            {detalle.descripcion && (
              <p className="text-slate-300 text-sm mb-4">{detalle.descripcion}</p>
            )}

            <div className="flex gap-2 flex-wrap mb-4">
              <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORIDAD_COLOR[detalle.prioridad]}`}>{detalle.prioridad}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">→ {detalle.asignadoANombre}</span>
              {detalle.fechaLimite && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">📅 {detalle.fechaLimite}</span>}
            </div>

            {/* Estado */}
            <div className="mb-4">
              <p className="text-slate-400 text-sm mb-2">Estado</p>
              <div className="flex gap-2">
                {(['pendiente', 'en_progreso', 'completada'] as EstadoTarea[]).map(e => (
                  <button
                    key={e}
                    onClick={() => {
                      void cambiarEstadoTarea(detalle.id, e);
                      setDetalle(prev => prev ? { ...prev, estado: e } : null);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                      detalle.estado === e ? 'bg-amber-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {ESTADO_LABEL[e]}
                  </button>
                ))}
              </div>
            </div>

            {/* Checklist */}
            {detalle.checklist.length > 0 && (
              <div>
                <p className="text-slate-400 text-sm mb-2">Checklist</p>
                <div className="space-y-2">
                  {detalle.checklist.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 cursor-pointer"
                      onClick={() => {
                        void toggleChecklistItem(detalle.id, detalle.checklist, item.id);
                        setDetalle(prev => {
                          if (!prev) return null;
                          const updated = prev.checklist.map(i =>
                            i.id === item.id ? { ...i, completado: !i.completado } : i,
                          );
                          return { ...prev, checklist: updated };
                        });
                      }}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
                        item.completado ? 'bg-emerald-500 border-emerald-500' : 'border-slate-500'
                      }`}>
                        {item.completado && <span className="text-white text-xs">✓</span>}
                      </div>
                      <span className={`text-sm ${item.completado ? 'line-through text-slate-500' : 'text-white'}`}>
                        {item.texto}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal crear tarea */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Nueva tarea</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Título *</label>
                <input
                  value={form.titulo}
                  onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  placeholder="¿Qué hay que hacer?"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Descripción</label>
                <textarea
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm resize-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Asignar a *</label>
                <select
                  value={form.asignadoA}
                  onChange={e => {
                    const p = personal.find(p => p.uid === e.target.value);
                    setForm(f => ({
                      ...f,
                      asignadoA: e.target.value,
                      asignadoANombre: p ? `${p.nombre} ${p.apellidos ?? ''}`.trim() : '',
                    }));
                  }}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Seleccionar…</option>
                  {personal.filter(p => p.activo !== false).map(p => (
                    <option key={p.uid} value={p.uid}>
                      {p.nombre} {p.apellidos ?? ''} ({p.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Prioridad</label>
                  <select
                    value={form.prioridad}
                    onChange={e => setForm(f => ({ ...f, prioridad: e.target.value as Prioridad }))}
                    className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Fecha límite</label>
                  <input
                    type="date"
                    value={form.fechaLimite}
                    onChange={e => setForm(f => ({ ...f, fechaLimite: e.target.value }))}
                    className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Checklist builder */}
              <div>
                <label className="block text-slate-400 text-sm mb-1">Checklist</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={form.checklistTexto}
                    onChange={e => setForm(f => ({ ...f, checklistTexto: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(); } }}
                    placeholder="Añadir ítem…"
                    className="flex-1 bg-slate-700 text-white rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={addCheckItem}
                    className="px-3 rounded-lg bg-slate-600 text-white text-sm hover:bg-slate-500 transition"
                  >
                    +
                  </button>
                </div>
                {form.checklist.map(item => (
                  <div key={item.id} className="flex items-center gap-2 py-1">
                    <span className="text-emerald-400 text-sm">☐</span>
                    <span className="text-white text-sm flex-1">{item.texto}</span>
                    <button
                      onClick={() => setForm(f => ({ ...f, checklist: f.checklist.filter(i => i.id !== item.id) }))}
                      className="text-slate-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleCrear()}
                disabled={guardando || !form.titulo || !form.asignadoA}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-400 transition disabled:opacity-60"
              >
                {guardando ? 'Creando…' : 'Crear tarea'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
