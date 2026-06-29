import { useState, useEffect, useCallback } from 'react';
import type { AppUser } from '../types';
import { getTrabajadorPorPin } from '../services/personal.service';
import {
  getTurnoAbierto,
  registrarEntrada,
  registrarSalida,
} from '../services/fichaje.service';
import type { Turno } from '../types';

type Fase = 'pin' | 'confirmar_salida' | 'ok_entrada' | 'ok_salida' | 'error';

export function FichajeScreen() {
  const [pin,       setPin]       = useState('');
  const [fase,      setFase]      = useState<Fase>('pin');
  const [usuario,   setUsuario]   = useState<AppUser | null>(null);
  const [turno,     setTurno]     = useState<Turno | null>(null);
  const [horas,     setHoras]     = useState<number>(0);
  const [mensaje,   setMensaje]   = useState('');
  const [cargando,  setCargando]  = useState(false);
  const [hora,      setHora]      = useState('');

  // Reloj
  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Resetear tras 4 segundos en estado ok/error
  useEffect(() => {
    if (fase === 'ok_entrada' || fase === 'ok_salida' || fase === 'error') {
      const id = setTimeout(() => {
        setFase('pin');
        setPin('');
        setUsuario(null);
        setTurno(null);
      }, 4000);
      return () => clearTimeout(id);
    }
  }, [fase]);

  const handleDigit = (d: string) => {
    if (cargando) return;
    setPin(prev => prev.length < 4 ? prev + d : prev);
  };

  const handleBorrar = () => setPin(prev => prev.slice(0, -1));

  const procesarPin = useCallback(async () => {
    if (pin.length !== 4 || cargando) return;
    setCargando(true);
    try {
      const user = await getTrabajadorPorPin(pin);
      if (!user) {
        setMensaje('PIN incorrecto');
        setFase('error');
        setCargando(false);
        return;
      }
      setUsuario(user);
      const turnoAbierto = await getTurnoAbierto(user.uid);
      if (turnoAbierto) {
        setTurno(turnoAbierto);
        setFase('confirmar_salida');
      } else {
        await registrarEntrada(user.uid, user.nombre);
        setMensaje(`¡Buenas, ${user.nombre}! Entrada registrada.`);
        setFase('ok_entrada');
      }
    } catch {
      setMensaje('Error de conexión. Inténtalo de nuevo.');
      setFase('error');
    }
    setCargando(false);
  }, [pin, cargando]);

  // Auto-submit al introducir 4 dígitos
  useEffect(() => {
    if (pin.length === 4 && fase === 'pin') {
      void procesarPin();
    }
  }, [pin, fase, procesarPin]);

  const confirmarSalida = async () => {
    if (!usuario || !turno || cargando) return;
    setCargando(true);
    try {
      const horas = await registrarSalida(usuario.uid, usuario.nombre, turno.id, turno.entrada);
      setHoras(horas);
      setFase('ok_salida');
    } catch {
      setMensaje('Error al registrar salida.');
      setFase('error');
    }
    setCargando(false);
  };

  const cancelar = () => {
    setFase('pin');
    setPin('');
    setUsuario(null);
    setTurno(null);
  };

  const entradaStr = turno
    ? new Date(turno.entrada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center select-none">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-5xl font-mono font-bold text-white mb-1">{hora}</div>
        <div className="text-slate-400 text-lg">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <div className="text-xl font-semibold text-slate-200 mt-2">Control de Fichaje</div>
      </div>

      {/* Card */}
      <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">

        {/* ── Estado OK entrada ── */}
        {fase === 'ok_entrada' && (
          <div className="text-center py-4">
            <div className="text-6xl mb-4">✅</div>
            <p className="text-white text-xl font-semibold">{mensaje}</p>
            <p className="text-slate-400 mt-2 text-sm">Redirigiendo…</p>
          </div>
        )}

        {/* ── Estado OK salida ── */}
        {fase === 'ok_salida' && (
          <div className="text-center py-4">
            <div className="text-6xl mb-4">👋</div>
            <p className="text-white text-xl font-semibold">¡Hasta luego, {usuario?.nombre}!</p>
            <p className="text-emerald-400 mt-2 text-lg font-mono">
              {horas.toFixed(2)} horas trabajadas
            </p>
            <p className="text-slate-400 mt-1 text-sm">Salida registrada</p>
          </div>
        )}

        {/* ── Error ── */}
        {fase === 'error' && (
          <div className="text-center py-4">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-red-400 text-xl font-semibold">{mensaje}</p>
          </div>
        )}

        {/* ── Confirmar salida ── */}
        {fase === 'confirmar_salida' && usuario && (
          <div className="text-center">
            <div className="text-4xl mb-3">🏁</div>
            <p className="text-white text-lg font-semibold mb-1">Hola, {usuario.nombre}</p>
            <p className="text-slate-400 text-sm mb-4">
              Entrada registrada a las {entradaStr}. ¿Confirmas salida?
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelar}
                className="flex-1 py-3 rounded-xl bg-slate-600 text-white font-semibold hover:bg-slate-500 active:scale-95 transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => void confirmarSalida()}
                disabled={cargando}
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-500 active:scale-95 transition disabled:opacity-60"
              >
                {cargando ? '…' : 'Confirmar salida'}
              </button>
            </div>
          </div>
        )}

        {/* ── PIN pad ── */}
        {fase === 'pin' && (
          <>
            <p className="text-slate-400 text-center text-sm mb-4">Introduce tu PIN de 4 dígitos</p>

            {/* Puntos PIN */}
            <div className="flex justify-center gap-4 mb-6">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full transition-all duration-150 ${
                    i < pin.length ? 'bg-amber-400 scale-110' : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>

            {/* Teclado numérico */}
            <div className="grid grid-cols-3 gap-3">
              {['1','2','3','4','5','6','7','8','9'].map(d => (
                <button
                  key={d}
                  onClick={() => handleDigit(d)}
                  className="aspect-square rounded-xl bg-slate-700 text-white text-2xl font-semibold hover:bg-slate-600 active:scale-95 active:bg-amber-600 transition"
                >
                  {d}
                </button>
              ))}
              <button
                onClick={handleBorrar}
                className="aspect-square rounded-xl bg-slate-700 text-slate-400 text-xl hover:bg-slate-600 active:scale-95 transition"
              >
                ⌫
              </button>
              <button
                onClick={() => handleDigit('0')}
                className="aspect-square rounded-xl bg-slate-700 text-white text-2xl font-semibold hover:bg-slate-600 active:scale-95 active:bg-amber-600 transition"
              >
                0
              </button>
              <button
                onClick={() => void procesarPin()}
                disabled={pin.length !== 4 || cargando}
                className="aspect-square rounded-xl bg-amber-500 text-white text-xl font-bold hover:bg-amber-400 active:scale-95 transition disabled:opacity-40"
              >
                {cargando ? '…' : '✓'}
              </button>
            </div>
          </>
        )}
      </div>

      <p className="text-slate-600 text-xs mt-6">Los Barriles · Sistema de fichaje</p>
    </div>
  );
}
