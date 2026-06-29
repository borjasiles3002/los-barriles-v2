import { useState, useEffect, useRef } from 'react';
import type { AppUser } from '../types';
import { useConversaciones, useMensajesConv } from '../hooks/useMensajes';
import { usePersonal } from '../hooks/usePersonal';
import {
  getOCrearConversacion,
  enviarMensaje,
  marcarLeidos,
} from '../services/mensajes.service';

interface Props {
  user: AppUser;
}

export function MensajesView({ user }: Props) {
  const { convs }             = useConversaciones(user.uid);
  const { personal }          = usePersonal();
  const [convId, setConvId]   = useState<string | null>(null);
  const [texto,  setTexto]    = useState('');
  const [enviando, setEnviando] = useState(false);
  const mensajes               = useMensajesConv(convId);
  const bottomRef              = useRef<HTMLDivElement>(null);
  const [nuevoModal, setNuevoModal] = useState(false);

  // Scroll al fondo al llegar mensajes nuevos
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Marcar leídos al abrir conversación
  useEffect(() => {
    if (convId) void marcarLeidos(convId, user.uid);
  }, [convId, mensajes.length]);

  const abrirConv = async (otroUid: string, otroNombre: string) => {
    const id = await getOCrearConversacion(
      user.uid, user.nombre,
      otroUid, otroNombre,
    );
    setConvId(id);
    setNuevoModal(false);
  };

  const handleEnviar = async () => {
    if (!convId || !texto.trim() || enviando) return;
    const conv = convs.find(c => c.id === convId);
    if (!conv) return;
    const para = conv.participantes.find(p => p !== user.uid) ?? '';
    setEnviando(true);
    await enviarMensaje(convId, user.uid, para, texto.trim());
    setTexto('');
    setEnviando(false);
  };

  const convActiva = convs.find(c => c.id === convId);
  const otroNombre = convActiva
    ? Object.entries(convActiva.participantesNombres)
        .find(([uid]) => uid !== user.uid)?.[1] ?? '–'
    : '';

  const otrosPersonal = personal.filter(p => p.uid !== user.uid && p.activo !== false);

  return (
    <div className="flex h-[calc(100vh-120px)] min-h-0">
      {/* ── Sidebar conversaciones ── */}
      <div className="w-64 bg-slate-800 rounded-xl mr-3 flex flex-col flex-shrink-0">
        <div className="flex items-center justify-between p-3 border-b border-slate-700">
          <span className="text-white font-semibold text-sm">Mensajes</span>
          <button
            onClick={() => setNuevoModal(true)}
            className="w-7 h-7 rounded-lg bg-amber-500 text-white font-bold text-sm hover:bg-amber-400 transition"
          >
            +
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {convs.length === 0 && (
            <p className="text-slate-500 text-sm text-center p-4">Sin conversaciones</p>
          )}
          {convs.map(c => {
            const otro  = Object.entries(c.participantesNombres).find(([uid]) => uid !== user.uid);
            const nombre = otro?.[1] ?? '?';
            const noLeidos = c.noLeidos[user.uid] ?? 0;
            return (
              <button
                key={c.id}
                onClick={() => setConvId(c.id)}
                className={`w-full text-left p-3 flex items-center gap-3 hover:bg-slate-700 transition ${
                  convId === c.id ? 'bg-slate-700' : ''
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {nombre[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-medium truncate">{nombre}</span>
                    {noLeidos > 0 && (
                      <span className="bg-amber-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {noLeidos}
                      </span>
                    )}
                  </div>
                  {c.ultimoMensaje && (
                    <p className="text-slate-400 text-xs truncate">{c.ultimoMensaje}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Chat ── */}
      <div className="flex-1 flex flex-col bg-slate-800 rounded-xl min-w-0">
        {!convId ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Selecciona una conversación o inicia una nueva
          </div>
        ) : (
          <>
            {/* Header chat */}
            <div className="p-3 border-b border-slate-700 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold">
                {otroNombre[0]}
              </div>
              <span className="text-white font-semibold">{otroNombre}</span>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {mensajes.map(m => {
                const mio = m.de === user.uid;
                return (
                  <div key={m.id} className={`flex ${mio ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${
                        mio
                          ? 'bg-amber-600 text-white rounded-br-sm'
                          : 'bg-slate-700 text-white rounded-bl-sm'
                      }`}
                    >
                      <p>{m.texto}</p>
                      <p className={`text-xs mt-0.5 ${mio ? 'text-amber-200' : 'text-slate-400'}`}>
                        {new Date(m.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        {mio && <span className="ml-1">{m.leido ? ' ✓✓' : ' ✓'}</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-slate-700 flex gap-2">
              <input
                value={texto}
                onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleEnviar(); } }}
                placeholder="Escribe un mensaje…"
                className="flex-1 bg-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none"
              />
              <button
                onClick={() => void handleEnviar()}
                disabled={!texto.trim() || enviando}
                className="w-10 h-10 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-400 transition disabled:opacity-40"
              >
                ➤
              </button>
            </div>
          </>
        )}
      </div>

      {/* Modal nuevo mensaje */}
      {nuevoModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm">
            <h3 className="text-white font-semibold mb-3">Nueva conversación</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {otrosPersonal.map(p => (
                <button
                  key={p.uid}
                  onClick={() => void abrirConv(p.uid, p.nombre)}
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center text-white font-bold text-sm">
                    {p.nombre[0]}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{p.nombre} {p.apellidos}</p>
                    <p className="text-slate-400 text-xs">{p.role}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setNuevoModal(false)}
              className="mt-4 w-full py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
