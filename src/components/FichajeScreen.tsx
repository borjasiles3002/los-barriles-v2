import { useState, useEffect } from 'react';
import type { AppUser, Turno } from '../types';
import { subscribePersonal } from '../services/personal.service';
import { subscribeTurnosAbiertos, registrarEntrada, registrarSalida } from '../services/fichaje.service';
import { hashPin } from '../utils/crypto';

const WORKER_ROLES = new Set(['camarero', 'cocinero', 'barman']);

type FaseModal = 'pin' | 'ok' | 'error';

interface ModalState {
  user: AppUser;
  turno: Turno | null;
  fase: FaseModal;
  pin: string;
  mensaje: string;
}

export function FichajeScreen() {
  const [trabajadores,  setTrabajadores]  = useState<AppUser[]>([]);
  const [turnosAbiertos, setTurnosAbiertos] = useState<Turno[]>([]);
  const [modal,         setModal]         = useState<ModalState | null>(null);
  const [cargando,      setCargando]      = useState(false);
  const [hora,          setHora]          = useState('');

  // Reloj
  useEffect(() => {
    const tick = () => setHora(
      new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
    );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Trabajadores activos con rol de trabajador
  useEffect(() => subscribePersonal(all => {
    setTrabajadores(
      all
        .filter(u => u.activo !== false && WORKER_ROLES.has(u.role))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
  }), []);

  // Turnos abiertos en tiempo real
  useEffect(() => subscribeTurnosAbiertos(setTurnosAbiertos), []);

  // Auto-cerrar modal ok/error tras 3s
  useEffect(() => {
    if (!modal || modal.fase === 'pin') return;
    const id = setTimeout(() => setModal(null), 3000);
    return () => clearTimeout(id);
  }, [modal?.fase]);

  const turnoDeUsuario = (uid: string) =>
    turnosAbiertos.find(t => t.usuarioId === uid) ?? null;

  const abrirModal = (user: AppUser) => {
    setModal({ user, turno: turnoDeUsuario(user.uid), fase: 'pin', pin: '', mensaje: '' });
  };

  // Confirmar PIN con user/turno/pin pasados directamente para evitar closures obsoletas
  const confirmarPin = async (user: AppUser, turno: Turno | null, pin: string) => {
    if (pin.length !== 4 || cargando) return;
    setCargando(true);
    try {
      const computed = await hashPin(pin);
      if (computed !== (user as AppUser & { pinHash?: string }).pinHash) {
        setModal(m => m ? { ...m, fase: 'error', mensaje: 'PIN incorrecto', pin: '' } : m);
        return;
      }

      if (turno) {
        const horas = await registrarSalida(user.uid, user.nombre, turno.id, turno.entrada);
        const h   = Math.floor(horas);
        const min = Math.round((horas - h) * 60);
        setModal(m => m ? {
          ...m, fase: 'ok',
          mensaje: `¡Hasta mañana, ${user.nombre}! Has trabajado ${h}h ${min}min`,
        } : m);
      } else {
        await registrarEntrada(user.uid, user.nombre);
        const ahora = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        setModal(m => m ? {
          ...m, fase: 'ok',
          mensaje: `¡Bienvenido, ${user.nombre}! Entrada ${ahora}`,
        } : m);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error de conexión';
      setModal(m => m ? { ...m, fase: 'error', mensaje: msg, pin: '' } : m);
    } finally {
      setCargando(false);
    }
  };

  const handleDigit = (d: string) => {
    if (!modal || modal.fase !== 'pin' || cargando || modal.pin.length >= 4) return;
    const newPin = modal.pin + d;
    setModal(m => m ? { ...m, pin: newPin } : m);
    // Auto-submit al completar los 4 dígitos
    if (newPin.length === 4) {
      void confirmarPin(modal.user, modal.turno, newPin);
    }
  };

  const handleBorrar = () => {
    if (!modal || cargando) return;
    setModal(m => m ? { ...m, pin: m.pin.slice(0, -1) } : m);
  };

  return (
    <div className="min-h-screen bg-slate-900 select-none flex flex-col">

      {/* Header */}
      <div className="text-center pt-8 pb-5 px-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 mb-3">
          <span className="text-2xl">🍺</span>
        </div>
        <h1 className="text-slate-200 font-black text-lg uppercase tracking-widest">Los Barriles</h1>
        <div className="text-5xl font-mono font-black text-white tracking-tight mt-3 tabular-nums">{hora}</div>
        <div className="text-slate-400 text-sm mt-1 capitalize">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Grid de trabajadores */}
      <div className="flex-1 px-4 pb-8">
        {trabajadores.length === 0 ? (
          <p className="text-slate-600 text-center py-12">Cargando trabajadores…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {trabajadores.map(user => {
              const turno = turnoDeUsuario(user.uid);
              return (
                <button
                  key={user.uid}
                  onClick={() => abrirModal(user)}
                  className="bg-slate-800 border-2 border-slate-700 hover:border-slate-500 rounded-2xl p-4 flex flex-col gap-2 active:scale-95 transition-all text-left"
                >
                  <p className="text-white font-black text-base leading-tight">{user.nombre}</p>
                  {turno ? (
                    <p className="text-emerald-400 text-xs">
                      Desde {new Date(turno.entrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  ) : (
                    <p className="text-slate-500 text-xs">Sin fichar</p>
                  )}
                  <div className={`w-full py-2.5 rounded-xl text-xs font-black uppercase text-center mt-auto ${
                    turno
                      ? 'bg-red-600 hover:bg-red-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}>
                    {turno ? '🔴 Fichar salida' : '🟢 Fichar entrada'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal PIN */}
      {modal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-xs border border-slate-600 shadow-2xl">

            {/* Estado OK */}
            {modal.fase === 'ok' && (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">✅</div>
                <p className="text-white font-bold text-base">{modal.mensaje}</p>
              </div>
            )}

            {/* Estado Error */}
            {modal.fase === 'error' && (
              <div className="text-center py-4">
                <div className="text-5xl mb-3">❌</div>
                <p className="text-red-400 font-bold text-base">{modal.mensaje}</p>
                <button
                  onClick={() => setModal(m => m ? { ...m, fase: 'pin', pin: '', mensaje: '' } : m)}
                  className="mt-4 text-slate-400 hover:text-white text-sm"
                >
                  Intentar de nuevo
                </button>
              </div>
            )}

            {/* Estado PIN */}
            {modal.fase === 'pin' && (
              <>
                <div className="text-center mb-5">
                  <p className="text-white font-black text-xl">{modal.user.nombre}</p>
                  <p className={`text-sm font-bold mt-1 ${
                    modal.turno ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {modal.turno ? '🔴 Fichar salida' : '🟢 Fichar entrada'}
                  </p>
                  <p className="text-slate-400 text-xs mt-4 mb-3">Introduce tu PIN</p>

                  {/* Puntos PIN */}
                  <div className="flex justify-center gap-4">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className={`w-4 h-4 rounded-full transition-all duration-150 ${
                        i < modal.pin.length ? 'bg-amber-400 scale-110' : 'bg-slate-600'
                      }`} />
                    ))}
                  </div>
                </div>

                {/* Teclado numérico */}
                <div className="grid grid-cols-3 gap-2">
                  {['1','2','3','4','5','6','7','8','9'].map(d => (
                    <button key={d} onClick={() => handleDigit(d)}
                      className="aspect-square rounded-xl bg-slate-700 text-white text-2xl font-semibold hover:bg-slate-600 active:scale-95 active:bg-amber-600 transition">
                      {d}
                    </button>
                  ))}
                  <button
                    onClick={() => setModal(null)}
                    className="aspect-square rounded-xl bg-slate-700 text-slate-400 text-sm font-bold hover:bg-slate-600 active:scale-95 transition"
                  >
                    ✕
                  </button>
                  <button onClick={() => handleDigit('0')}
                    className="aspect-square rounded-xl bg-slate-700 text-white text-2xl font-semibold hover:bg-slate-600 active:scale-95 active:bg-amber-600 transition">
                    0
                  </button>
                  <button onClick={handleBorrar}
                    className="aspect-square rounded-xl bg-slate-700 text-slate-400 text-xl hover:bg-slate-600 active:scale-95 transition">
                    ⌫
                  </button>
                </div>

                {cargando && (
                  <p className="text-center text-slate-400 text-sm mt-4">Verificando…</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <p className="text-slate-700 text-xs text-center pb-4">Los Barriles · Control de fichaje</p>
    </div>
  );
}
