import { useState } from 'react';
import type { AppUser } from '../types';
import { actualizarTrabajador } from '../services/personal.service';

interface Props {
  user: AppUser;
  onUpdate: (u: AppUser) => void;
}

const ROL_LABEL: Record<string, string> = {
  gerente:  'Gerente',
  admin:    'Admin',
  manager:  'Manager',
  camarero: 'Camarero',
  barman:   'Barman',
  cocinero: 'Cocinero',
};

export function PerfilView({ user, onUpdate }: Props) {
  const [editando, setEditando] = useState(false);
  const [telefono, setTelefono] = useState(user.telefono ?? '');
  const [pin,      setPin]      = useState('');
  const [pinConf,  setPinConf]  = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensaje,   setMensaje]  = useState('');

  const handleGuardar = async () => {
    if (pin && !/^\d{4}$/.test(pin)) {
      setMensaje('El PIN debe tener 4 dígitos numéricos.'); return;
    }
    if (pin && pin !== pinConf) {
      setMensaje('Los PINs no coinciden.'); return;
    }
    setGuardando(true);
    setMensaje('');
    try {
      const updates: Parameters<typeof actualizarTrabajador>[1] = { telefono };
      if (pin) updates.pin = pin;
      await actualizarTrabajador(user.uid, updates);
      onUpdate({ ...user, telefono });
      setPin(''); setPinConf('');
      setMensaje('Perfil actualizado.');
      setEditando(false);
    } catch {
      setMensaje('Error al guardar. Inténtalo de nuevo.');
    }
    setGuardando(false);
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold text-white mb-6">Mi Perfil</h1>

      <div className="bg-slate-800 rounded-2xl p-6">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold text-2xl">
            {user.avatar ?? user.nombre[0]}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">
              {user.nombre} {user.apellidos}
            </h2>
            <span className="text-sm text-slate-400">{ROL_LABEL[user.role] ?? user.role}</span>
          </div>
        </div>

        {/* Datos */}
        <div className="space-y-3">
          <Campo label="Email" value={user.email} />
          {!editando ? (
            <>
              <Campo label="Teléfono" value={user.telefono ?? '—'} />
              <Campo label="Fecha de alta" value={user.fechaAlta ? new Date(user.fechaAlta).toLocaleDateString('es-ES') : '—'} />
              <Campo label="PIN" value="••••" />
            </>
          ) : (
            <>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Nuevo PIN (dejar vacío para no cambiar)</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                  placeholder="4 dígitos"
                />
              </div>
              {pin && (
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Confirmar PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinConf}
                    onChange={e => setPinConf(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm"
                    placeholder="Repite el PIN"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {mensaje && (
          <p className={`mt-3 text-sm ${mensaje.includes('Error') || mensaje.includes('no coinciden') || mensaje.includes('dígitos') ? 'text-red-400' : 'text-emerald-400'}`}>
            {mensaje}
          </p>
        )}

        <div className="flex gap-3 mt-5">
          {!editando ? (
            <button
              onClick={() => { setEditando(true); setMensaje(''); }}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-400 transition"
            >
              Editar perfil
            </button>
          ) : (
            <>
              <button
                onClick={() => { setEditando(false); setMensaje(''); setPin(''); setPinConf(''); }}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-400 text-sm">{label}</p>
      <p className="text-white">{value}</p>
    </div>
  );
}
