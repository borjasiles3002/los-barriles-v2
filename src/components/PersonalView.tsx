import { useState } from 'react';
import type { AppUser, Role } from '../types';
import { usePersonal } from '../hooks/usePersonal';
import {
  crearTrabajador,
  actualizarTrabajador,
  desactivarTrabajador,
  activarTrabajador,
} from '../services/personal.service';

const ROLES: { value: Role; label: string }[] = [
  { value: 'gerente',  label: 'Gerente'  },
  { value: 'manager',  label: 'Manager'  },
  { value: 'camarero', label: 'Camarero' },
  { value: 'barman',   label: 'Barman'   },
  { value: 'cocinero', label: 'Cocinero' },
];

const ROL_COLOR: Record<Role, string> = {
  gerente:  'bg-purple-900 text-purple-300',
  admin:    'bg-purple-900 text-purple-300',
  manager:  'bg-blue-900 text-blue-300',
  camarero: 'bg-amber-900 text-amber-300',
  barman:   'bg-cyan-900 text-cyan-300',
  cocinero: 'bg-orange-900 text-orange-300',
};

interface Form {
  nombre:    string;
  apellidos: string;
  email:     string;
  telefono:  string;
  role:      Role;
  password:  string;
  pin:       string;
}

const FORM_EMPTY: Form = {
  nombre: '', apellidos: '', email: '', telefono: '',
  role: 'camarero', password: '', pin: '',
};

export function PersonalView() {
  const { personal, loading } = usePersonal();
  const [modal,     setModal]     = useState<'crear' | 'editar' | null>(null);
  const [form,      setForm]      = useState<Form>(FORM_EMPTY);
  const [editId,    setEditId]    = useState<string>('');
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState('');
  const [filtro,    setFiltro]    = useState<'todos' | 'activos' | 'inactivos'>('activos');

  const personal_filtrado = personal.filter(p => {
    if (filtro === 'activos')   return p.activo !== false;
    if (filtro === 'inactivos') return p.activo === false;
    return true;
  });

  const abrirCrear = () => {
    setForm(FORM_EMPTY);
    setError('');
    setModal('crear');
  };

  const abrirEditar = (p: AppUser) => {
    setForm({
      nombre:    p.nombre,
      apellidos: p.apellidos ?? '',
      email:     p.email,
      telefono:  p.telefono ?? '',
      role:      p.role,
      password:  '',
      pin:       '',
    });
    setEditId(p.uid);
    setError('');
    setModal('editar');
  };

  const handleGuardar = async () => {
    if (!form.nombre || !form.email) { setError('Nombre y email son obligatorios.'); return; }
    if (modal === 'crear' && (!form.password || !form.pin)) {
      setError('Contraseña y PIN son obligatorios para nuevos trabajadores.');
      return;
    }
    if (form.pin && !/^\d{4}$/.test(form.pin)) {
      setError('El PIN debe tener exactamente 4 dígitos.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      if (modal === 'crear') {
        await crearTrabajador({
          email:     form.email,
          password:  form.password,
          nombre:    form.nombre,
          apellidos: form.apellidos,
          telefono:  form.telefono,
          role:      form.role,
          pin:       form.pin,
        });
      } else {
        const updates: Parameters<typeof actualizarTrabajador>[1] = {
          nombre:    form.nombre,
          apellidos: form.apellidos,
          telefono:  form.telefono,
          role:      form.role,
        };
        if (form.pin) updates.pin = form.pin;
        await actualizarTrabajador(editId, updates);
      }
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    }
    setGuardando(false);
  };

  const toggleActivo = async (p: AppUser) => {
    if (p.activo === false) await activarTrabajador(p.uid);
    else await desactivarTrabajador(p.uid);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">Cargando personal…</div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Personal</h1>
        <button
          onClick={abrirCrear}
          className="px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold hover:bg-amber-400 transition"
        >
          + Añadir trabajador
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        {(['activos', 'inactivos', 'todos'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
              filtro === f
                ? 'bg-amber-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {personal_filtrado.length === 0 && (
          <p className="text-slate-400 text-center py-12">No hay trabajadores en esta vista.</p>
        )}
        {personal_filtrado.map(p => (
          <div
            key={p.uid}
            className={`bg-slate-800 rounded-xl p-4 flex items-center gap-4 ${
              p.activo === false ? 'opacity-50' : ''
            }`}
          >
            {/* Avatar */}
            <div className="w-11 h-11 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {p.avatar ?? p.nombre[0]}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold">
                  {p.nombre} {p.apellidos}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROL_COLOR[p.role] ?? 'bg-slate-700 text-slate-300'}`}>
                  {p.role}
                </span>
                {p.activo === false && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-300">inactivo</span>
                )}
              </div>
              <p className="text-slate-400 text-sm truncate">{p.email}</p>
              {p.telefono && <p className="text-slate-500 text-xs">{p.telefono}</p>}
            </div>
            {/* Acciones */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => abrirEditar(p)}
                className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition"
              >
                Editar
              </button>
              <button
                onClick={() => void toggleActivo(p)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  p.activo === false
                    ? 'bg-emerald-800 text-emerald-300 hover:bg-emerald-700'
                    : 'bg-red-900 text-red-300 hover:bg-red-800'
                }`}
              >
                {p.activo === false ? 'Activar' : 'Desactivar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal crear/editar */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">
              {modal === 'crear' ? 'Nuevo trabajador' : 'Editar trabajador'}
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Nombre *" value={form.nombre} onChange={v => setForm(f => ({ ...f, nombre: v }))} />
                <Input label="Apellidos" value={form.apellidos} onChange={v => setForm(f => ({ ...f, apellidos: v }))} />
              </div>
              <Input label="Email *" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} disabled={modal === 'editar'} />
              <Input label="Teléfono" type="tel" value={form.telefono} onChange={v => setForm(f => ({ ...f, telefono: v }))} />
              <div>
                <label className="block text-slate-400 text-sm mb-1">Rol</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              {modal === 'crear' && (
                <Input label="Contraseña *" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} />
              )}
              <Input
                label={modal === 'crear' ? 'PIN 4 dígitos *' : 'Nuevo PIN (dejar vacío para no cambiar)'}
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={form.pin}
                onChange={v => setForm(f => ({ ...f, pin: v.replace(/\D/g, '').slice(0, 4) }))}
              />
            </div>
            {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleGuardar()}
                disabled={guardando}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-400 transition disabled:opacity-60"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({
  label, value, onChange, type = 'text', disabled = false, inputMode, maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-slate-400 text-sm mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm disabled:opacity-50"
      />
    </div>
  );
}
