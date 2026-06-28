import React, { useEffect, useRef, useState } from 'react';
import { chatWithAssistant } from '../services/gemini.service';
import type { RestaurantContext } from '../services/gemini.service';
import type { ChatMessage } from '../types';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { LoadingSpinner } from './ui/LoadingSpinner';

// ─── Load restaurant context from Firestore ───────────────────────────────────

async function loadContext(): Promise<RestaurantContext> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const semana = new Date(today);
  semana.setDate(semana.getDate() - 7);
  const semanaISO = semana.toISOString();

  const [pedidosHoySnap, pedidosSemanSnap, stockSnap, alertasSnap, escandSnap] =
    await Promise.all([
      getDocs(query(collection(db, 'pedidos'), where('estado', '==', 'cerrado'), where('closedAt', '>=', todayISO))),
      getDocs(query(collection(db, 'pedidos'), where('estado', '==', 'cerrado'), where('closedAt', '>=', semanaISO))),
      getDocs(query(collection(db, 'stock'), orderBy('nombre'))),
      getDocs(query(collection(db, 'alertas'), where('leido', '==', false), orderBy('createdAt', 'desc'), limit(10))),
      getDocs(query(collection(db, 'escandallos'), orderBy('foodCostPct', 'desc'), limit(5))),
    ]);

  const pedidosHoy  = pedidosHoySnap.docs.map(d => d.data() as { total: number });
  const pedidosSem  = pedidosSemanSnap.docs.map(d => d.data() as { total: number });
  const stockItems  = stockSnap.docs.map(d => d.data() as { nombre: string; cantidad: number; stockMinimo: number; unidad: string });
  const alertasData = alertasSnap.docs.map(d => d.data() as { tipo: string; datos: Record<string, unknown>; mensaje: string });
  const escandData  = escandSnap.docs.map(d => d.data() as { productoNombre: string; foodCostPct: number; costeTotal: number; precioVenta: number });

  return {
    ventasHoy:     pedidosHoy.reduce((s, p) => s + p.total, 0),
    pedidosHoy:    pedidosHoy.length,
    ventasSemana:  pedidosSem.reduce((s, p) => s + p.total, 0),
    stockAlertas:  stockItems.filter(s => s.stockMinimo > 0 && s.cantidad < s.stockMinimo),
    alertasPrecios: alertasData
      .filter(a => a.tipo === 'precio_subida')
      .map(a => ({
        producto:  String(a.datos.producto ?? ''),
        proveedor: String(a.datos.proveedor ?? ''),
        subidaPct: Number(a.datos.subidaPct ?? 0),
      })),
    escandallosAltos: escandData
      .filter(e => e.foodCostPct > 35)
      .map(e => ({ plato: e.productoNombre, foodCost: e.foodCostPct, coste: e.costeTotal, precio: e.precioVenta })),
  };
}

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGERENCIAS = [
  '¿Cuánto he vendido hoy?',
  '¿Qué ingredientes se me van a acabar?',
  '¿Cuáles son mis platos menos rentables?',
  '¿Qué proveedor me ha subido más los precios?',
  '¿Debo subir algún precio de la carta?',
];

// ─── ChatIA component ─────────────────────────────────────────────────────────

export const ChatIA: React.FC = () => {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const endRef                  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    setError('');
    const userMsg: ChatMessage = { role: 'user', text: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const context = await loadContext();
      const reply   = await chatWithAssistant(newMessages, context);
      setMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con el asistente');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-20 right-4 z-50 w-14 h-14 bg-amber-500 hover:bg-amber-400 rounded-full shadow-xl flex items-center justify-center text-2xl transition-all active:scale-90"
        aria-label="Asistente IA"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '65vh' }}
        >
          {/* Header */}
          <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <p className="text-white font-bold text-sm">Asistente Los Barriles</p>
                <p className="text-slate-400 text-xs">Powered by Gemini</p>
              </div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-slate-400 text-sm">Hola, soy tu asistente de gestión. Tengo acceso a tus ventas, stock y escandallos. ¿Qué quieres saber?</p>
                <div className="space-y-2">
                  {SUGERENCIAS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs rounded-xl transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-amber-500 text-black font-medium rounded-br-sm'
                      : 'bg-slate-800 border border-slate-700 text-white rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-sm px-4 py-3">
                  <LoadingSpinner size={4} />
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-900/40 border border-red-600 rounded-xl px-3 py-2">
                <p className="text-red-300 text-xs">{error}</p>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-700 p-3 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Pregunta algo..."
              disabled={loading}
              className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-bold rounded-xl text-sm"
            >
              →
            </button>
          </form>
        </div>
      )}
    </>
  );
};
