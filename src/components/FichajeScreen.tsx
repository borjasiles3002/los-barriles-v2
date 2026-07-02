import { useState, useEffect } from 'react';
import type { AppUser, Turno } from '../types';
import { subscribePersonal } from '../services/personal.service';
import { subscribeTurnosAbiertos, registrarEntrada, registrarSalida } from '../services/fichaje.service';

const WORKER_ROLES = new Set(['camarero', 'cocinero', 'barman']);

type Feedback = { nombre: string; tipo: 'entrada' | 'salida' | 'error'; horas?: number; msg?: string };

export function FichajeScreen() {
  const [trabajadores, setTrabajadores] = useState<AppUser[]>([]);
  const [turnosAbiertos, setTurnosAbiertos] = useState<Turno[]>([]);
  const [confirmando, setConfirmando] = useState<{ user: AppUser; turno: Turno } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [cargando, setCargando] = useState<string | null>(null); // uid en proceso
  const [hora, setHora] = useState('');

  // Reloj
  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Suscripción trabajadores activos
  useEffect(() => subscribePersonal(all => {
    setTrabajadores(all.filter(u => u.activo !== false && WORKER_ROLES.has(u.role)));
  }), []);

  // Suscripción turnos abiertos
  useEffect(() => subscribeTurnosAbiertos(setTurnosAbiertos), []);

  // Auto-dismiss feedback tras 3s
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(id);
  }, [feedback]);

  const turnoDeUsuario = (uid: string) =>
    turnosAbiertos.find(t => t.usuarioId === uid) ?? null;

  const handleTap = async (user: AppUser) => {
    if (cargando) return;
    const turno = turnoDeUsuario(user.uid);
    if (turno) {
      // Tiene turno abierto → pedir confirmación de salida
      setConfirmando({ user, turno });
    } else {
      // Sin turno → registrar entrada directamente
      setCargando(user.uid);
      try {
        await registrarEntrada(user.uid, user.nombre);
        setFeedback({ nombre: user.nombre, tipo: 'entrada' });
      } catch (e) {
        setFeedback({ nombre: user.nombre, tipo: 'error', msg: e instanceof Error ? e.message : 'Error' });
      } finally {
        setCargando(null);
      }
    }
  };

  const confirmarSalida = async () => {
    if (!confirmando || cargando) return;
    const { user, turno } = confirmando;
    setConfirmando(null);
    setCargando(user.uid);
    try {
      const horas = await registrarSalida(user.uid, user.nombre, turno.id, turno.entrada);
      setFeedback({ nombre: user.nombre, tipo: 'salida', horas });
    } catch {
      setFeedback({ nombre: user.nombre, tipo: 'error', msg: 'Error al registrar salida.' });
    } finally {
      setCargando(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 select-none flex flex-col">

      {/* Header */}
      <div className="text-center pt-8 pb-4 px-4">
        <div className="text-5xl font-mono font-black text-white tracking-tight">{hora}</div>
        <div className="text-slate-400 text-base mt-1 capitalize">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={`mx-4 mb-4 rounded-2xl p-4 text-center transition-all ${
          feedback.tipo === 'entrada' ? 'bg-emerald-500/20 border border-emerald-500/40' :
          feedback.tipo === 'salida'  ? 'bg-blue-500/20 border border-blue-500/40' :
                                        'bg-red-500/20 border border-red-500/40'
        }`}>
          <div className="text-3xl mb-1">
            {feedback.tipo === 'entrada' ? '✅' : feedback.tipo === 'salida' ? '👋' : '❌'}
          </div>
          <p className="text-white font-black text-lg">{feedback.nombre}</p>
          {feedback.tipo === 'entrada' && <p className="text-emerald-400 font-semibold">Entrada registrada</p>}
          {feedback.tipo === 'salida'  && (
            <p className="text-blue-400 font-semibold">
              Salida · {feedback.horas?.toFixed(1)}h trabajadas
            </p>
          )}
          {feedback.tipo === 'error'   && <p className="text-red-400 text-sm">{feedback.msg}</p>}
        </div>
      )}

      {/* Grid de trabajadores */}
      <div className="flex-1 px-4 pb-6">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-3">
          Toca tu nombre para fichar
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {trabajadores.map(user => {
            const turno = turnoDeUsuario(user.uid);
            const enCurso = cargando === user.uid;
            return (
              <button
                key={user.uid}
                onClick={() => void handleTap(user)}
                disabled={!!cargando}
                className={`rounded-2xl p-4 text-left transition-all active:scale-95 disabled:opacity-60 ${
                  turno
                    ? 'bg-emerald-600 hover:bg-emerald-500 border-2 border-emerald-400'
                    : 'bg-slate-700 hover:bg-slate-600 border-2 border-slate-600'
                }`}
              >
                <div className="text-2xl mb-2">
                  {enCurso ? '⏳' : turno ? '🟢' : '⚪'}
                </div>
                <p className="text-white font-black text-base leading-tight">{user.nombre}</p>
                {turno ? (
                  <p className="text-emerald-200 text-xs mt-1">
                    Desde {new Date(turno.entrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                ) : (
                  <p className="text-slate-400 text-xs mt-1">Sin fichar</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal confirmación salida */}
      {confirmando && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-xs border border-slate-600 shadow-2xl text-center">
            <div className="text-5xl mb-3">🏁</div>
            <p className="text-white font-black text-xl mb-1">{confirmando.user.nombre}</p>
            <p className="text-slate-400 text-sm mb-1">
              Entrada a las {new Date(confirmando.turno.entrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-slate-300 text-sm mb-6">¿Confirmas la salida?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmando(null)}
                className="flex-1 py-3 rounded-xl bg-slate-600 text-white font-semibold hover:bg-slate-500 active:scale-95 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirmarSalida()}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black hover:bg-red-500 active:scale-95 transition"
              >
                Salida
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-slate-700 text-xs text-center pb-4">Los Barriles</p>
    </div>
  );
}
