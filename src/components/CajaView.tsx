import React, { useEffect, useState } from 'react';
import { getPedidosCerradosHoy } from '../services/pedidos.service';
import { realizarCierreDeCaja } from '../services/caja.service';
import type { Pedido } from '../types';
import { LoadingSpinner } from './ui/LoadingSpinner';

export const CajaView: React.FC = () => {
  const [pedidos, setPedidos]     = useState<Pedido[]>([]);
  const [loading, setLoading]     = useState(true);
  const [closing, setClosing]     = useState(false);
  const [closeMsg, setCloseMsg]   = useState('');
  const [error, setError]         = useState('');

  const fetchToday = async () => {
    setLoading(true);
    try {
      const result = await getPedidosCerradosHoy();
      setPedidos(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchToday(); }, []);

  const totalHoy    = pedidos.reduce((s, p) => s + p.total, 0);
  const ticketMedio = pedidos.length > 0 ? totalHoy / pedidos.length : 0;

  const handleCierre = async () => {
    if (!window.confirm('¿Realizar cierre de caja? Se registrarán los pedidos cerrados de hoy.')) return;
    setClosing(true);
    setCloseMsg('');
    setError('');
    try {
      await realizarCierreDeCaja();
      setCloseMsg('Cierre realizado correctamente.');
      await fetchToday();
    } catch (e: any) {
      setError(e?.message ?? 'Error al realizar el cierre.');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-black text-2xl">Caja</h1>
            <p className="text-slate-400 text-sm">Resumen de ventas de hoy</p>
          </div>
          <button
            onClick={fetchToday}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-colors"
          >
            {loading ? <LoadingSpinner size={4} /> : '↻'} Actualizar
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="Total del día" value={`${totalHoy.toFixed(2)}€`} color="text-amber-400" />
          <KpiCard label="Pedidos cerrados" value={pedidos.length.toString()} color="text-blue-400" />
          <KpiCard label="Ticket medio" value={`${ticketMedio.toFixed(2)}€`} color="text-emerald-400" />
        </div>

        {/* Pedidos list */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h2 className="text-white font-bold">Pedidos cerrados hoy</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner size={8} />
            </div>
          ) : pedidos.length === 0 ? (
            <div className="py-10 text-center text-slate-500">
              <p>Sin pedidos cerrados hoy todavía</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {pedidos.map(p => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-white font-bold text-sm">{p.mesaNombre}</p>
                    <p className="text-slate-400 text-xs">
                      {p.lineas.length} art. •{' '}
                      {p.closedAt
                        ? new Date(p.closedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </p>
                  </div>
                  <span className="text-amber-400 font-black">{p.total.toFixed(2)}€</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cierre de caja */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-3">
          <h2 className="text-white font-bold">Cierre de caja</h2>
          <p className="text-slate-400 text-sm">
            Registra un cierre contable con el resumen de pedidos cerrados hoy. El cierre queda guardado en Firestore para consulta posterior.
          </p>

          {closeMsg && (
            <div className="bg-emerald-900/40 border border-emerald-600 rounded-xl px-4 py-2">
              <p className="text-emerald-300 text-sm font-bold">{closeMsg}</p>
            </div>
          )}
          {error && (
            <div className="bg-red-900/40 border border-red-600 rounded-xl px-4 py-2">
              <p className="text-red-300 text-sm font-bold">{error}</p>
            </div>
          )}

          <button
            onClick={handleCierre}
            disabled={closing || pedidos.length === 0}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-black font-black rounded-xl transition-colors flex items-center gap-2"
          >
            {closing ? <LoadingSpinner size={5} /> : '🏦 Realizar cierre de caja'}
          </button>
        </div>
      </div>
    </div>
  );
};

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 text-center">
      <p className={`font-black text-2xl md:text-3xl ${color}`}>{value}</p>
      <p className="text-slate-400 text-xs uppercase mt-1">{label}</p>
    </div>
  );
}
