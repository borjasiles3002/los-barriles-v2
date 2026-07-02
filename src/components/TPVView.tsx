import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { jsPDF } from 'jspdf';
import type {
  Mesa, Pedido, Producto, Categoria, MetodoPago, Cliente,
  LineaPedido, Notificacion, Ingreso,
} from '../types';
import { IVA_RATES as IVA } from '../types';
import { useMesas }          from '../hooks/useMesas';
import { usePedidos }        from '../hooks/usePedidos';
import { useCarta }          from '../hooks/useCarta';
import { useNotificaciones } from '../hooks/useNotificaciones';
import { useIngresosHoy }    from '../hooks/useIngresos';
import { useAuthContext }    from '../contexts/AuthContext';
import {
  abrirMesa, agregarProducto, quitarProducto,
  cambiarEstadoPedido, cerrarPedido, pedirCuenta,
  asignarClienteAPedido, actualizarNotaLinea,
  marcarNotificacionLeida, marcarTodasLeidas,
} from '../services/pedidos.service';
import { registrarIngreso }              from '../services/ingresos.service';
import { buscarClientes, crearCliente, registrarVisitaCliente } from '../services/clientes.service';
import {
  emitirFactura, generarPDFFactura, generarPDFTicket, getConfigRestaurante,
} from '../services/facturasEmitidas.service';
import { LoadingSpinner, FullScreenLoader } from './ui/LoadingSpinner';
import { StockBadge }         from './AperturaView';
import { useProductosStock }  from '../hooks/useStock';

// ─── Constants ────────────────────────────────────────────────────────────────

const METODOS_PAGO: { key: MetodoPago; label: string; icon: string }[] = [
  { key: 'efectivo',   label: 'Efectivo',   icon: '💵' },
  { key: 'tarjeta',    label: 'Tarjeta',    icon: '💳' },
  { key: 'bizum',      label: 'Bizum',      icon: '📱' },
  { key: 'invitacion', label: 'Invitación', icon: '🎁' },
  { key: 'otros',      label: 'Otros',      icon: '💰' },
];

const LINEA_ESTADO_ICON: Record<string, string> = {
  pendiente:      '⏳',
  en_preparacion: '🍳',
  listo:          '✓',
  servido:        '✓✓',
};

const LINEA_ESTADO_COLOR: Record<string, string> = {
  pendiente:      'text-slate-400',
  en_preparacion: 'text-orange-400',
  listo:          'text-emerald-400',
  servido:        'text-slate-500',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function elapsed(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function elapsedStr(min: number) {
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function fmtEur(n: number) {
  return n.toFixed(2) + '€';
}

type MesaColor = 'libre' | 'bebida_pendiente' | 'en_cocina' | 'listo' | 'cuenta_pedida' | 'ocupada';

function getMesaColor(mesa: Mesa, pedido: Pedido | undefined): MesaColor {
  if (mesa.estado === 'libre') return 'libre';
  if (mesa.estado === 'cuenta_pedida') return 'cuenta_pedida';
  if (!pedido) return 'ocupada';
  const bebidaPendiente = pedido.lineas.some(
    l => (l.destino === 'barra' || l.destino === 'ambos') && l.estado === 'pendiente',
  );
  if (bebidaPendiente) return 'bebida_pendiente';
  if (pedido.estado === 'en_cocina') return 'en_cocina';
  if (pedido.estado === 'listo') return 'listo';
  return 'ocupada';
}

const MESA_COLOR_STYLE: Record<MesaColor, string> = {
  libre:            'bg-slate-700/60 border-slate-600 text-slate-300',
  ocupada:          'bg-orange-900/70 border-orange-600 text-white',
  bebida_pendiente: 'bg-blue-900/80 border-blue-500 text-white animate-pulse',
  en_cocina:        'bg-purple-900/80 border-purple-500 text-white',
  listo:            'bg-emerald-900/80 border-emerald-500 text-white',
  cuenta_pedida:    'bg-red-900/80 border-red-500 text-white',
};

const MESA_DOT: Record<MesaColor, string> = {
  libre:            'bg-slate-500',
  ocupada:          'bg-orange-400',
  bebida_pendiente: 'bg-blue-400 animate-ping',
  en_cocina:        'bg-purple-400 animate-pulse',
  listo:            'bg-emerald-400',
  cuenta_pedida:    'bg-red-400 animate-pulse',
};

const MESA_LABEL: Record<MesaColor, string> = {
  libre:            'Libre',
  ocupada:          'Ocupada',
  bebida_pendiente: 'Bebidas ↑',
  en_cocina:        'En cocina',
  listo:            '¡Listo!',
  cuenta_pedida:    'Cuenta',
};

// ─── Mesa Card ────────────────────────────────────────────────────────────────

const MesaCard = memo(function MesaCard({
  mesa, pedido, selected, onSelect,
}: {
  mesa: Mesa;
  pedido: Pedido | undefined;
  selected: boolean;
  onSelect: (m: Mesa) => void;
}) {
  const color = getMesaColor(mesa, pedido);
  const min   = pedido ? elapsed(pedido.createdAt) : 0;

  return (
    <button
      onClick={() => onSelect(mesa)}
      className={`relative rounded-2xl border-2 p-3 flex flex-col items-center gap-1.5 h-[90px] transition-all active:scale-95 hover:brightness-110 ${
        MESA_COLOR_STYLE[color]
      } ${selected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-900' : ''}`}
    >
      <span className="font-black text-sm leading-none text-center line-clamp-1 w-full">{mesa.nombre}</span>
      {pedido && (
        <span className="text-[10px] tabular-nums opacity-80 font-mono">{elapsedStr(min)}</span>
      )}
      {mesa.comensales && <span className="text-[10px] opacity-70">{mesa.comensales}👤</span>}
      <div className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full shrink-0 ${MESA_DOT[color]}`} />
        <span className="text-[9px] font-bold uppercase opacity-90">{MESA_LABEL[color]}</span>
      </div>
      {pedido && pedido.total > 0 && (
        <span className="absolute top-1.5 right-2 text-[9px] font-black opacity-70">
          {fmtEur(pedido.total)}
        </span>
      )}
    </button>
  );
});

// ─── Comensales Modal ─────────────────────────────────────────────────────────

function ComensalesModal({
  mesa, onConfirm, onCancel,
}: { mesa: Mesa; onConfirm: (n: number) => void; onCancel: () => void }) {
  const [n, setN] = useState(2);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm">
      <div className="w-full bg-slate-800 rounded-t-2xl p-6 space-y-4 max-w-md mx-auto">
        <h3 className="text-white font-black text-xl text-center">{mesa.nombre}</h3>
        <p className="text-slate-400 text-sm text-center">¿Cuántos comensales?</p>
        <div className="flex items-center justify-center gap-6">
          <button onClick={() => setN(v => Math.max(1, v - 1))}
            className="w-14 h-14 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-90 text-white text-3xl font-black transition-all">−</button>
          <span className="text-white font-black text-5xl w-16 text-center tabular-nums">{n}</span>
          <button onClick={() => setN(v => v + 1)}
            className="w-14 h-14 rounded-2xl bg-slate-700 hover:bg-slate-600 active:scale-90 text-white text-3xl font-black transition-all">+</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(v => (
            <button key={v} onClick={() => setN(v)}
              className={`py-2 rounded-xl text-sm font-bold transition-colors ${n === v ? 'bg-amber-500 text-black' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
              {v}
            </button>
          ))}
        </div>
        <button onClick={() => onConfirm(n)}
          className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-black text-lg rounded-xl transition-all">
          Abrir mesa
        </button>
        <button onClick={onCancel} className="w-full py-2 text-slate-400 hover:text-white font-bold transition-colors text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Cobro Modal ──────────────────────────────────────────────────────────────

function CobroModal({
  pedido, mesa, cliente, onCobrar, onClose,
}: {
  pedido: Pedido;
  mesa: Mesa;
  cliente: Cliente | null;
  onCobrar: (metodo: MetodoPago, total: number, emitirFactura: boolean, motivo?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [metodo,         setMetodo]         = useState<MetodoPago | null>(null);
  const [efectivoRec,    setEfectivoRec]    = useState('');
  const [personas,       setPersonas]       = useState(mesa.comensales ?? 2);
  const [dividir,        setDividir]        = useState(false);
  const [descuento,      setDescuento]      = useState(0);
  const [motivoInvit,    setMotivoInvit]    = useState('');
  const [emitirFact,     setEmitirFact]     = useState(false);
  const [loading,        setLoading]        = useState(false);

  const totalConDesc = pedido.total * (1 - descuento / 100);
  const totalPorPers = dividir && personas > 0 ? totalConDesc / personas : null;
  const efectivoNum = parseFloat(efectivoRec);
  const cambio = metodo === 'efectivo' && efectivoRec && !isNaN(efectivoNum)
    ? efectivoNum - totalConDesc
    : null;

  const confirmar = async () => {
    if (!metodo) return;
    setLoading(true);
    try {
      await onCobrar(metodo, totalConDesc, emitirFact, metodo === 'invitacion' ? motivoInvit : undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-black text-xl">Cobrar — {mesa.nombre}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Total + descuento */}
          <div className="bg-slate-900 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-slate-400 text-sm flex-1">Descuento %</span>
              <div className="flex items-center gap-1">
                {[0, 5, 10, 15, 20].map(d => (
                  <button key={d} onClick={() => setDescuento(d)}
                    className={`w-10 h-8 rounded-lg text-xs font-bold transition ${descuento === d ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                    {d > 0 ? `-${d}%` : 'Sin'}
                  </button>
                ))}
              </div>
            </div>
            {descuento > 0 && (
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">Original</span>
                <span className="text-slate-400 line-through">{fmtEur(pedido.total)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline">
              <span className="text-slate-300 font-bold">Total a cobrar</span>
              <span className="text-amber-400 font-black text-3xl">{fmtEur(totalConDesc)}</span>
            </div>
            {mesa.comensales && (
              <p className="text-slate-500 text-xs mt-1 text-right">
                {mesa.comensales} com. · {fmtEur(totalConDesc / mesa.comensales)}/persona
              </p>
            )}
          </div>

          {/* Dividir cuenta */}
          <div className="flex items-center gap-3 bg-slate-700/50 rounded-xl px-4 py-3">
            <button onClick={() => setDividir(d => !d)}
              className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${dividir ? 'bg-amber-500' : 'bg-slate-600'}`}>
              <span className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${dividir ? 'translate-x-4' : ''}`} />
            </button>
            <span className="text-white text-sm font-medium flex-1">Dividir cuenta</span>
            {dividir && (
              <div className="flex items-center gap-2">
                <button onClick={() => setPersonas(p => Math.max(2, p - 1))}
                  className="w-7 h-7 rounded-lg bg-slate-600 text-white font-bold">−</button>
                <span className="text-white font-black text-lg w-8 text-center">{personas}</span>
                <button onClick={() => setPersonas(p => p + 1)}
                  className="w-7 h-7 rounded-lg bg-slate-600 text-white font-bold">+</button>
                <span className="text-amber-400 font-black text-sm">{totalPorPers && fmtEur(totalPorPers)}</span>
              </div>
            )}
          </div>

          {/* Factura fiscal */}
          {cliente && (
            <label className="flex items-center gap-3 bg-slate-700/50 rounded-xl px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={emitirFact} onChange={e => setEmitirFact(e.target.checked)}
                className="w-5 h-5 rounded accent-amber-500" />
              <div>
                <p className="text-white font-semibold text-sm">Emitir factura fiscal</p>
                <p className="text-slate-400 text-xs">{cliente.nombre} {cliente.apellidos}</p>
              </div>
            </label>
          )}

          {/* Método de pago */}
          <p className="text-slate-400 text-xs font-bold uppercase">Método de pago</p>
          <div className="grid grid-cols-3 gap-2">
            {METODOS_PAGO.map(({ key, label, icon }) => (
              <button key={key} onClick={() => setMetodo(key)}
                className={`py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all ${metodo === key ? 'bg-amber-500 text-black scale-105' : 'bg-slate-700 text-white hover:bg-slate-600'}`}>
                <span className="text-xl">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Efectivo: campo de importe recibido */}
          {metodo === 'efectivo' && (
            <div className="bg-slate-900 rounded-xl p-4 space-y-3">
              <p className="text-slate-400 text-sm">Importe recibido</p>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                value={efectivoRec}
                onChange={e => setEfectivoRec(e.target.value)}
                placeholder={totalConDesc.toFixed(2)}
                className="w-full bg-slate-700 text-white text-2xl font-black text-right rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              {cambio !== null && cambio >= 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">Cambio</span>
                  <span className="text-emerald-400 font-black text-2xl">{fmtEur(cambio)}</span>
                </div>
              )}
              {cambio !== null && cambio < 0 && (
                <p className="text-red-400 text-sm font-bold">Importe insuficiente ({fmtEur(Math.abs(cambio))} menos)</p>
              )}
            </div>
          )}

          {/* Invitación: motivo */}
          {metodo === 'invitacion' && (
            <input
              autoFocus
              value={motivoInvit}
              onChange={e => setMotivoInvit(e.target.value)}
              placeholder="Motivo de la invitación…"
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          )}

          <button
            onClick={() => void confirmar()}
            disabled={loading || !metodo || (metodo === 'efectivo' && cambio !== null && cambio < 0)}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white font-black text-lg rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {loading ? <LoadingSpinner size={5} /> : `✅ Confirmar cobro · ${fmtEur(totalConDesc)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Cierre de Caja Modal ─────────────────────────────────────────────────────

function CierreCajaModal({
  ingresos, onClose,
}: { ingresos: Ingreso[]; onClose: () => void }) {
  const [efectivoReal, setEfectivoReal] = useState('');
  const [notas,        setNotas]        = useState('');
  const [guardando,    setGuardando]    = useState(false);

  const total     = ingresos.reduce((s, i) => s + i.total, 0);
  const numPed    = ingresos.length;
  const ticket    = numPed > 0 ? total / numPed : 0;

  const porMetodo = useMemo(() => {
    const map: Partial<Record<MetodoPago, number>> = {};
    ingresos.forEach(i => { map[i.metodoPago] = (map[i.metodoPago] ?? 0) + i.total; });
    return map;
  }, [ingresos]);

  const efectivoEsperado = porMetodo['efectivo'] ?? 0;
  const efectivoRealN    = parseFloat(efectivoReal) || 0;
  const diferencia       = efectivoRealN - efectivoEsperado;

  const exportPDF = () => {
    const fecha = new Date().toLocaleDateString('es-ES');
    const doc   = new jsPDF();
    let y = 20;

    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('Los Barriles — Cierre de Caja', 105, y, { align: 'center' }); y += 8;
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(fecha, 105, y, { align: 'center' }); y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Resumen del día', 20, y); y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Total ingresos: ${fmtEur(total)}`, 25, y); y += 6;
    doc.text(`Pedidos cerrados: ${numPed}`, 25, y); y += 6;
    doc.text(`Ticket medio: ${fmtEur(ticket)}`, 25, y); y += 10;

    doc.setFont('helvetica', 'bold');
    doc.text('Por método de pago', 20, y); y += 7;
    doc.setFont('helvetica', 'normal');
    METODOS_PAGO.forEach(({ key, label }) => {
      const v = porMetodo[key] ?? 0;
      if (v > 0) { doc.text(`${label}: ${fmtEur(v)}`, 25, y); y += 6; }
    });
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Arqueo de caja', 20, y); y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Efectivo esperado: ${fmtEur(efectivoEsperado)}`, 25, y); y += 6;
    doc.text(`Efectivo real: ${fmtEur(efectivoRealN)}`, 25, y); y += 6;

    if (diferencia >= 0) doc.setTextColor(16, 185, 129);
    else doc.setTextColor(239, 68, 68);
    doc.setFont('helvetica', 'bold');
    doc.text(`Diferencia: ${diferencia >= 0 ? '+' : ''}${fmtEur(diferencia)}`, 25, y); y += 8;
    doc.setTextColor(0, 0, 0);

    if (notas) {
      doc.setFont('helvetica', 'bold');
      doc.text('Notas', 20, y); y += 7;
      doc.setFont('helvetica', 'normal');
      doc.text(notas, 25, y);
    }

    doc.save(`cierre-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleCerrar = async () => {
    setGuardando(true);
    exportPDF();
    setGuardando(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-black text-xl">Cierre de Caja</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total', value: fmtEur(total), color: 'text-amber-400' },
              { label: 'Pedidos', value: String(numPed), color: 'text-white' },
              { label: 'Ticket medio', value: fmtEur(ticket), color: 'text-emerald-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-700/60 rounded-xl p-3 text-center">
                <p className={`font-black text-lg ${color}`}>{value}</p>
                <p className="text-slate-400 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Por método */}
          <div className="bg-slate-900/50 rounded-xl p-4 space-y-2">
            <p className="text-slate-400 text-xs font-bold uppercase mb-3">Desglose por método</p>
            {METODOS_PAGO.map(({ key, label, icon }) => {
              const v = porMetodo[key] ?? 0;
              if (v === 0) return null;
              return (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-slate-300 text-sm">{icon} {label}</span>
                  <span className="text-white font-bold">{fmtEur(v)}</span>
                </div>
              );
            })}
          </div>

          {/* Arqueo */}
          <div className="bg-slate-900/50 rounded-xl p-4 space-y-3">
            <p className="text-slate-400 text-xs font-bold uppercase">Arqueo de caja</p>
            <div className="flex justify-between items-center">
              <span className="text-slate-300 text-sm">Efectivo esperado</span>
              <span className="text-white font-bold">{fmtEur(efectivoEsperado)}</span>
            </div>
            <div>
              <label className="text-slate-400 text-sm block mb-1">Efectivo real contado</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={efectivoReal}
                onChange={e => setEfectivoReal(e.target.value)}
                placeholder={efectivoEsperado.toFixed(2)}
                className="w-full bg-slate-700 text-white rounded-xl px-4 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {efectivoReal && (
              <div className={`flex justify-between items-center font-black text-lg ${diferencia >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <span>Diferencia</span>
                <span>{diferencia >= 0 ? '+' : ''}{fmtEur(diferencia)}</span>
              </div>
            )}
          </div>

          {/* Notas */}
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Notas del cierre (opcional)…"
            rows={2}
            className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
          />

          <div className="grid grid-cols-2 gap-3">
            <button onClick={exportPDF}
              className="py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition flex items-center justify-center gap-2">
              🖨️ Solo PDF
            </button>
            <button onClick={() => void handleCerrar()} disabled={guardando}
              className="py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black rounded-xl transition">
              {guardando ? '…' : '✅ Confirmar cierre'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Notificaciones Drawer ────────────────────────────────────────────────────

function NotifIcon({ tipo }: { tipo: Notificacion['tipo'] }) {
  if (tipo === 'pedido_listo')  return <span>✅</span>;
  if (tipo === 'cuenta_pedida') return <span>💳</span>;
  if (tipo === 'stock_agotado') return <span>⛔</span>;
  return <span>⚠️</span>;
}

function NotificacionesDrawer({
  notificaciones, onClose,
}: { notificaciones: Notificacion[]; onClose: () => void }) {
  const handleMarcarTodas = () => {
    void marcarTodasLeidas(notificaciones.map(n => n.id));
  };

  return (
    <div className="fixed inset-0 z-[55] flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm bg-slate-800 border-l border-slate-700 flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-white font-bold">🔔 Notificaciones</h3>
          <div className="flex gap-2">
            {notificaciones.length > 0 && (
              <button onClick={handleMarcarTodas}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 transition">
                Leer todas
              </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notificaciones.length === 0 && (
            <p className="text-slate-500 text-center mt-8">Sin notificaciones</p>
          )}
          {notificaciones.map(n => (
            <div key={n.id}
              className="flex items-start gap-3 bg-slate-700/60 rounded-xl p-3">
              <span className="text-xl"><NotifIcon tipo={n.tipo} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold">
                  {n.mesaNombre ?? n.productoNombre}
                </p>
                <p className="text-slate-400 text-xs">
                  {n.tipo === 'pedido_listo'  && 'Pedido listo para servir'}
                  {n.tipo === 'cuenta_pedida' && 'Han pedido la cuenta'}
                  {n.tipo === 'stock_agotado' && 'Producto agotado'}
                  {n.tipo === 'stock_bajo'    && `Stock bajo (${n.stockActual ?? 0} uds.)`}
                </p>
                <p className="text-slate-600 text-[10px] mt-0.5">
                  {new Date(n.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => void marcarNotificacionLeida(n.id)}
                className="text-slate-500 hover:text-white text-lg leading-none shrink-0">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Pedido Panel (zona derecha) ──────────────────────────────────────────────

function PedidoPanel({
  mesa, pedido, categorias, productos, onClose,
  onShowCobro,
}: {
  mesa: Mesa;
  pedido: Pedido;
  categorias: Categoria[];
  productos: Producto[];
  onClose: () => void;
  onShowCobro: () => void;
}) {
  const [showCarta,    setShowCarta]    = useState(false);
  const [activeCat,    setActiveCat]    = useState(categorias[0]?.id ?? '');
  const [busqueda,     setBusqueda]     = useState('');
  const [editarNota,   setEditarNota]   = useState<{ lineaId: string; nombre: string; notaActual: string } | null>(null);
  const [notaTexto,    setNotaTexto]    = useState('');
  const [loadingLine,  setLoadingLine]  = useState<string | null>(null);
  const [loadingAct,   setLoadingAct]   = useState(false);
  const [addingProd,   setAddingProd]   = useState<string | null>(null);
  const [errorToast,   setErrorToast]   = useState<string | null>(null);
  const [showCliente,  setShowCliente]  = useState(false);
  const [clienteBusq,  setClienteBusq]  = useState('');
  const [clienteRes,   setClienteRes]   = useState<Cliente[]>([]);
  const [clienteBusc,  setClienteBusc]  = useState(false);
  const [cliente,      setCliente]      = useState<Cliente | null>(null);
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', apellidos: '', nif: '', email: '' });
  const [modoNuevoCli, setModoNuevoCli] = useState(false);

  const min           = elapsed(pedido.createdAt);
  const lineasBebidas = pedido.lineas.filter(l => l.destino === 'barra' || l.destino === 'ambos');
  const lineasCocina  = pedido.lineas.filter(l => !l.destino || l.destino === 'cocina' || l.destino === 'ambos');
  const tieneComida   = lineasCocina.filter(l => l.destino !== 'barra').length > 0;

  // Totales con IVA desglosado
  const subtotalBase = useMemo(() => {
    let reducido = 0, normal = 0, superred = 0;
    pedido.lineas.forEach(l => {
      const total = l.precio * l.cantidad;
      const tipo  = l.tipoIva ?? 'reducido';
      if (tipo === 'reducido')       reducido  += total;
      else if (tipo === 'normal')    normal    += total;
      else if (tipo === 'superreducido') superred += total;
    });
    return { reducido, normal, superred };
  }, [pedido.lineas]);

  const ivaReducido = subtotalBase.reducido * (IVA.reducido / (1 + IVA.reducido));
  const ivaNormal   = subtotalBase.normal   * (IVA.normal   / (1 + IVA.normal));

  const productosFiltrados = useMemo(() => {
    const base = busqueda.trim()
      ? productos.filter(p => p.disponible && p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
      : productos.filter(p => p.disponible && p.categoriaId === activeCat);
    return base;
  }, [productos, activeCat, busqueda]);

  const handleAdd = useCallback(async (prod: Producto) => {
    setAddingProd(prod.id);
    try {
      await agregarProducto(pedido.id, prod, '');
    } catch (e) {
      console.error('[handleAdd]', e);
      const msg = e instanceof Error ? e.message : 'Error al añadir producto';
      setErrorToast(msg === 'STOCK_AGOTADO' ? 'Stock agotado' : msg);
    } finally {
      setAddingProd(null);
    }
  }, [pedido.id]);

  useEffect(() => {
    if (!errorToast) return;
    const id = setTimeout(() => setErrorToast(null), 3000);
    return () => clearTimeout(id);
  }, [errorToast]);

  const handleRemove = useCallback(async (lineaId: string) => {
    setLoadingLine(lineaId);
    try { await quitarProducto(pedido.id, lineaId); }
    catch (e) { console.error(e); }
    finally { setLoadingLine(null); }
  }, [pedido.id]);

  const handleSaveNota = async () => {
    if (!editarNota) return;
    try { await actualizarNotaLinea(pedido.id, editarNota.lineaId, notaTexto.trim()); }
    catch (e) { console.error(e); }
    setEditarNota(null);
    setNotaTexto('');
  };

  const handleEnviarCocina = async () => {
    setLoadingAct(true);
    try { await cambiarEstadoPedido(pedido.id, 'en_cocina'); }
    catch (e) { console.error(e); }
    finally { setLoadingAct(false); }
  };

  const handlePedirCuenta = async () => {
    setLoadingAct(true);
    try {
      await pedirCuenta(pedido.id, mesa.id, mesa.nombre);
      onClose();
    } catch (e) { console.error(e); }
    finally { setLoadingAct(false); }
  };

  const handleBuscarCliente = async () => {
    if (!clienteBusq.trim()) return;
    setClienteBusc(true);
    const res = await buscarClientes(clienteBusq);
    setClienteRes(res);
    setClienteBusc(false);
  };

  const handleAsignarCliente = async (c: Cliente) => {
    await asignarClienteAPedido(pedido.id, c.id, `${c.nombre} ${c.apellidos}`);
    setCliente(c);
    setShowCliente(false);
  };

  const handleCrearCliente = async () => {
    if (!nuevoCliente.nombre || !nuevoCliente.apellidos) return;
    const id = await crearCliente({ ...nuevoCliente });
    await handleAsignarCliente({ id, ...nuevoCliente, totalVisitas: 0, totalGastado: 0, creadoEn: new Date().toISOString() });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden relative">

      {/* ── Toast error añadir producto ── */}
      {errorToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-xl whitespace-nowrap pointer-events-none">
          ⚠️ {errorToast}
        </div>
      )}

      {/* ── Modal editar nota ── */}
      {editarNota && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/60"
          onClick={() => setEditarNota(null)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-black">Nota — {editarNota.nombre}</h3>
            <input
              autoFocus value={notaTexto} onChange={e => setNotaTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleSaveNota(); }}
              placeholder="Sin gluten, poco hecho…"
              className="w-full bg-slate-700 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-amber-500 border border-transparent"
            />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setEditarNota(null)}
                className="py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl">Cancelar</button>
              <button onClick={() => void handleSaveNota()}
                className="py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl">Guardar nota</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal cliente ── */}
      {showCliente && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/60" onClick={() => setShowCliente(false)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 space-y-3 max-h-[70%] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-black">Asignar cliente</h3>
            {!modoNuevoCli ? (
              <>
                {cliente && (
                  <div className="flex items-center justify-between bg-blue-900/40 rounded-xl px-3 py-2">
                    <span className="text-blue-300 text-sm">👤 {cliente.nombre} {cliente.apellidos}</span>
                    <button onClick={() => { setCliente(null); setShowCliente(false); }}
                      className="text-red-400 text-xs hover:text-red-300">Quitar</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input value={clienteBusq} onChange={e => setClienteBusq(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleBuscarCliente(); }}
                    placeholder="Nombre, empresa o NIF…"
                    className="flex-1 bg-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none" />
                  <button onClick={() => void handleBuscarCliente()} disabled={clienteBusc}
                    className="px-4 rounded-xl bg-amber-500 text-white text-sm font-bold">
                    {clienteBusc ? '…' : 'Buscar'}
                  </button>
                </div>
                {clienteRes.map(c => (
                  <button key={c.id} onClick={() => void handleAsignarCliente(c)}
                    className="w-full text-left px-3 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {c.nombre[0]}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{c.nombre} {c.apellidos}</p>
                      {c.empresa && <p className="text-slate-400 text-xs">{c.empresa}</p>}
                    </div>
                  </button>
                ))}
                <button onClick={() => setModoNuevoCli(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-700 text-slate-300 text-sm hover:bg-slate-600">
                  + Crear cliente nuevo
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(['nombre', 'apellidos', 'nif', 'email'] as const).map(k => (
                    <input key={k} value={nuevoCliente[k]} placeholder={k.charAt(0).toUpperCase() + k.slice(1)}
                      onChange={e => setNuevoCliente(f => ({ ...f, [k]: e.target.value }))}
                      className="bg-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none" />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setModoNuevoCli(false)}
                    className="py-3 bg-slate-700 text-white rounded-xl font-bold text-sm">← Volver</button>
                  <button onClick={() => void handleCrearCliente()}
                    className="py-3 bg-amber-500 text-black rounded-xl font-bold text-sm">Crear y asignar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-black text-xl leading-none">{mesa.nombre}</h2>
              {mesa.comensales && (
                <span className="text-slate-400 text-sm">{mesa.comensales}👤</span>
              )}
              <span className="text-slate-500 text-sm font-mono">{elapsedStr(min)}</span>
              {pedido.camareroNombre && (
                <span className="text-[11px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                  👤 {pedido.camareroNombre}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {cliente ? (
                <button onClick={() => setShowCliente(true)}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-blue-900 text-blue-300 font-bold hover:bg-blue-800 transition">
                  🏷️ {cliente.nombre} {cliente.apellidos}
                </button>
              ) : (
                <button onClick={() => setShowCliente(true)}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 transition">
                  + Asignar cliente
                </button>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-amber-400 font-black text-2xl leading-none">{fmtEur(pedido.total)}</p>
            <p className="text-slate-500 text-xs mt-0.5">{pedido.lineas.reduce((s, l) => s + l.cantidad, 0)} art.</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-white shrink-0">✕</button>
        </div>
      </div>

      {/* ── Tabs de sección ── */}
      <div className="shrink-0 flex border-b border-slate-700 bg-slate-800">
        <button onClick={() => setShowCarta(false)}
          className={`flex-1 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${!showCarta ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-white'}`}>
          Pedido ({pedido.lineas.length})
        </button>
        <button onClick={() => setShowCarta(true)}
          className={`flex-1 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors ${showCarta ? 'text-amber-400 border-b-2 border-amber-400' : 'text-slate-400 hover:text-white'}`}>
          + Añadir (F3)
        </button>
      </div>

      {/* ── Vista carta ── */}
      {showCarta && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Búsqueda */}
          <div className="px-3 pt-2 pb-1 shrink-0">
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar producto…"
              className="w-full bg-slate-700 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          {/* Categorías */}
          {!busqueda && (
            <div className="flex overflow-x-auto gap-2 px-3 py-1.5 shrink-0 scrollbar-hide">
              {categorias.map(cat => (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors shrink-0 ${
                    activeCat === cat.id ? 'bg-amber-500 text-black' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}>
                  {cat.nombre}
                </button>
              ))}
            </div>
          )}
          {/* Grid productos */}
          <div className="flex-1 overflow-y-auto p-3 pb-4">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
              {productosFiltrados.map(prod => {
                const esBarra = prod.destino === 'barra' || prod.destino === 'ambos';
                const qty     = pedido.lineas.filter(l => l.productoId === prod.id).reduce((s, l) => s + l.cantidad, 0);
                const agotado = prod.controlStock && (prod.stockActual ?? 0) === 0;
                return (
                  <button key={prod.id}
                    onClick={() => !agotado && void handleAdd(prod)} disabled={agotado || addingProd === prod.id}
                    className={`border rounded-xl p-2.5 text-left transition-all flex flex-col gap-1 relative ${
                      agotado ? 'bg-slate-800/30 border-slate-700 opacity-50 cursor-not-allowed'
                      : addingProd === prod.id ? 'scale-95 opacity-70 cursor-wait'
                      : esBarra ? 'bg-blue-950/40 border-blue-700/50 hover:border-blue-400 active:scale-95'
                      : 'bg-slate-800 border-slate-600 hover:border-amber-500 active:scale-95'
                    }`}>
                    {qty > 0 && (
                      <span className="absolute top-2 right-2 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">{qty}</span>
                    )}
                    <span className="text-[9px] font-bold uppercase tracking-wide pr-5 truncate">
                      {esBarra ? <span className="text-blue-400">🍺 Barra</span> : <span className="text-emerald-500">🍳 Cocina</span>}
                    </span>
                    <span className={`font-bold text-xs leading-tight line-clamp-2 ${agotado ? 'line-through text-slate-500' : 'text-white'}`}>
                      {prod.nombre}
                    </span>
                    <span className={`font-black text-sm mt-auto ${esBarra ? 'text-blue-300' : 'text-amber-400'}`}>
                      {fmtEur(prod.precio)}
                    </span>
                    {prod.controlStock && <div className="mt-0.5"><StockBadge stock={prod.stockActual} /></div>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Vista pedido ── */}
      {!showCarta && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {pedido.lineas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
              <span className="text-4xl mb-2">🛒</span>
              <p className="font-bold">Comanda vacía</p>
              <button onClick={() => setShowCarta(true)}
                className="mt-3 px-4 py-2 bg-amber-500 text-black font-bold rounded-xl text-sm hover:bg-amber-400 transition">
                + Añadir productos
              </button>
            </div>
          ) : (
            <>
              {/* Bebidas pendientes arriba */}
              {lineasBebidas.some(l => l.estado === 'pendiente') && (
                <div className="bg-blue-950/40 border border-blue-700/50 rounded-xl p-3">
                  <p className="text-blue-400 text-xs font-bold uppercase mb-2">🍺 Bebidas — Pendientes de barra</p>
                  <ul className="space-y-1.5">
                    {lineasBebidas.filter(l => l.estado === 'pendiente').map(linea => (
                      <LineaRow key={linea.id} linea={linea} pedidoId={pedido.id}
                        loading={loadingLine === linea.id}
                        onAdd={() => { const p = productos.find(x => x.id === linea.productoId); if (p) void handleAdd(p); }}
                        onRemove={() => void handleRemove(linea.id)}
                        onEditNota={() => { setEditarNota({ lineaId: linea.id, nombre: linea.nombre, notaActual: linea.notas ?? '' }); setNotaTexto(linea.notas ?? ''); }}
                        colorClass="border-blue-800/50 bg-transparent" />
                    ))}
                  </ul>
                </div>
              )}

              {/* Todas las bebidas */}
              {lineasBebidas.some(l => l.estado !== 'pendiente') && (
                <div>
                  <p className="text-blue-400 text-xs font-bold uppercase mb-2 px-1">🍺 Bebidas (barra)</p>
                  <ul className="space-y-1.5">
                    {lineasBebidas.filter(l => l.estado !== 'pendiente').map(linea => (
                      <LineaRow key={linea.id} linea={linea} pedidoId={pedido.id}
                        loading={loadingLine === linea.id}
                        onAdd={() => { const p = productos.find(x => x.id === linea.productoId); if (p) void handleAdd(p); }}
                        onRemove={() => void handleRemove(linea.id)}
                        onEditNota={() => { setEditarNota({ lineaId: linea.id, nombre: linea.nombre, notaActual: linea.notas ?? '' }); setNotaTexto(linea.notas ?? ''); }}
                        colorClass="border-blue-800/30 bg-blue-950/10" />
                    ))}
                  </ul>
                </div>
              )}

              {/* Comida */}
              {lineasCocina.filter(l => l.destino !== 'barra').length > 0 && (
                <div>
                  <p className="text-emerald-400 text-xs font-bold uppercase mb-2 px-1">🍳 Comida (cocina)</p>
                  <ul className="space-y-1.5">
                    {lineasCocina.filter(l => l.destino !== 'barra').map(linea => (
                      <LineaRow key={linea.id} linea={linea} pedidoId={pedido.id}
                        loading={loadingLine === linea.id}
                        onAdd={() => { const p = productos.find(x => x.id === linea.productoId); if (p) void handleAdd(p); }}
                        onRemove={() => void handleRemove(linea.id)}
                        onEditNota={() => { setEditarNota({ lineaId: linea.id, nombre: linea.nombre, notaActual: linea.notas ?? '' }); setNotaTexto(linea.notas ?? ''); }}
                        colorClass="border-slate-700 bg-slate-800/60" />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Totales + botones (siempre visibles) ── */}
      <div className="shrink-0 bg-slate-800 border-t border-slate-700 px-4 pt-3 pb-3 space-y-3">
        {/* IVA desglosado */}
        {pedido.total > 0 && (
          <div className="space-y-1">
            {ivaReducido > 0 && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>Base imponible 10%</span>
                <span>{fmtEur(subtotalBase.reducido - ivaReducido)}</span>
              </div>
            )}
            {ivaReducido > 0 && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>IVA 10%</span>
                <span>{fmtEur(ivaReducido)}</span>
              </div>
            )}
            {ivaNormal > 0 && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>IVA 21%</span>
                <span>{fmtEur(ivaNormal)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline border-t border-slate-700 pt-1">
              <span className="text-slate-300 font-bold text-sm uppercase">Total</span>
              <span className="text-amber-400 font-black text-2xl">{fmtEur(pedido.total)}</span>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        <div className="grid grid-cols-2 gap-2">
          {pedido.estado === 'abierto' && tieneComida && (
            <button onClick={() => void handleEnviarCocina()} disabled={loadingAct}
              className="col-span-2 py-3 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 active:scale-95 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
              {loadingAct ? <LoadingSpinner size={4} /> : '🍳 Enviar a cocina'}
            </button>
          )}
          {pedido.lineas.length > 0 && pedido.estado !== 'cuenta_pedida' && pedido.estado !== 'cerrado' && (
            <button onClick={() => void handlePedirCuenta()} disabled={loadingAct}
              className="py-3 bg-red-800 hover:bg-red-700 disabled:opacity-50 active:scale-95 text-white font-bold rounded-xl transition-all text-sm">
              💳 Pedir cuenta
            </button>
          )}
          {pedido.lineas.length > 0 && (
            <button onClick={onShowCobro} disabled={loadingAct}
              className={`py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 active:scale-95 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 text-sm ${
                !(pedido.estado !== 'cuenta_pedida' && tieneComida && pedido.estado === 'abierto') ? 'col-span-2' : ''
              }`}>
              💰 Cobrar (F1)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── LineaRow ─────────────────────────────────────────────────────────────────

function LineaRow({ linea, loading, onAdd, onRemove, onEditNota, colorClass }: {
  linea: LineaPedido;
  pedidoId: string;
  loading: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onEditNota: () => void;
  colorClass: string;
}) {
  const estadoIcon  = LINEA_ESTADO_ICON[linea.estado] ?? '?';
  const estadoColor = LINEA_ESTADO_COLOR[linea.estado] ?? 'text-slate-400';
  const servido     = linea.estado === 'servido';

  return (
    <li className={`flex items-center gap-2 border rounded-xl px-2.5 py-2 ${colorClass} ${servido ? 'opacity-50' : ''}`}>
      <span className={`text-xs w-5 text-center ${estadoColor} shrink-0`} title={linea.estado}>
        {estadoIcon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className={`text-white font-semibold text-xs truncate ${servido ? 'line-through' : ''}`}>
            {linea.nombre}
          </p>
          <button onClick={onEditNota} className="shrink-0 text-slate-600 hover:text-amber-400 transition text-xs">✏️</button>
        </div>
        {linea.notas && <p className="text-amber-400 text-[10px] italic">⚠ {linea.notas}</p>}
        <p className="text-slate-500 text-[10px]">{fmtEur(linea.precio)}/ud</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {loading ? (
          <LoadingSpinner size={4} />
        ) : (
          <>
            <button onClick={onRemove}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-red-700 active:scale-90 text-white transition text-base leading-none">−</button>
            <span className="text-white font-black text-sm w-5 text-center">{linea.cantidad}</span>
            <button onClick={onAdd}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-emerald-700 active:scale-90 text-white transition text-base leading-none">+</button>
          </>
        )}
      </div>
      <span className="text-amber-400 font-black text-xs shrink-0 w-14 text-right">
        {fmtEur(linea.precio * linea.cantidad)}
      </span>
    </li>
  );
}

// ─── Resumen día (zona derecha cuando no hay mesa) ────────────────────────────

function ResumenDia({ ingresos, mesas, pedidos }: {
  ingresos: Ingreso[];
  mesas: Mesa[];
  pedidos: Pedido[];
}) {
  const total   = ingresos.reduce((s, i) => s + i.total, 0);
  const numPed  = ingresos.length;
  const ticket  = numPed > 0 ? total / numPed : 0;
  const ocupadas = mesas.filter(m => m.estado !== 'libre').length;

  const porHora = useMemo(() => {
    const map: Record<number, number> = {};
    ingresos.forEach(i => {
      const h = parseInt(i.hora.split(':')[0], 10);
      map[h] = (map[h] ?? 0) + i.total;
    });
    return map;
  }, [ingresos]);

  const horas = Array.from({ length: 16 }, (_, i) => i + 8); // 8h–23h
  const maxHora = Math.max(...Object.values(porHora), 1);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Caja hoy', value: fmtEur(total), color: 'text-amber-400', icon: '💰' },
          { label: 'Pedidos cerrados', value: String(numPed), color: 'text-white', icon: '🍽️' },
          { label: 'Ticket medio', value: numPed > 0 ? fmtEur(ticket) : '—', color: 'text-emerald-400', icon: '🎫' },
          { label: 'Mesas ocupadas', value: `${ocupadas} / ${mesas.length}`, color: 'text-orange-400', icon: '🪑' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
            <p className="text-slate-400 text-xs mb-1">{icon} {label}</p>
            <p className={`font-black text-xl ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Ventas por hora */}
      {numPed > 0 && (
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <p className="text-slate-400 text-xs font-bold uppercase mb-3">📊 Ventas por hora</p>
          <div className="flex items-end gap-1 h-20">
            {horas.map(h => {
              const v   = porHora[h] ?? 0;
              const pct = v / maxHora;
              return (
                <div key={h} className="flex flex-col items-center flex-1 gap-1" title={`${h}h: ${fmtEur(v)}`}>
                  <div className="w-full rounded-t bg-amber-500/80 transition-all"
                    style={{ height: `${Math.max(pct * 72, v > 0 ? 4 : 0)}px` }} />
                  <span className="text-[9px] text-slate-600">{h}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Últimos ingresos */}
      {ingresos.length > 0 && (
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <p className="text-slate-400 text-xs font-bold uppercase px-4 pt-3 pb-2">Últimos cobros</p>
          <div className="divide-y divide-slate-700">
            {[...ingresos].reverse().slice(0, 8).map(i => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{i.mesaNombre}</p>
                  <p className="text-slate-500 text-xs">{i.hora} · {METODOS_PAGO.find(m => m.key === i.metodoPago)?.icon} {i.metodoPago}</p>
                </div>
                <span className="text-amber-400 font-black text-sm shrink-0">{fmtEur(i.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ingresos.length === 0 && pedidos.length === 0 && (
        <div className="text-center py-12 text-slate-600">
          <span className="text-4xl block mb-3">🍺</span>
          <p className="font-bold text-slate-400">Sin ventas hoy todavía</p>
          <p className="text-sm">Selecciona una mesa para empezar</p>
        </div>
      )}
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ ingresos, onCierre }: { ingresos: Ingreso[]; onCierre: () => void }) {
  const total    = ingresos.reduce((s, i) => s + i.total, 0);
  const numPed   = ingresos.length;
  const ticket   = numPed > 0 ? total / numPed : 0;
  const efectivo = ingresos.filter(i => i.metodoPago === 'efectivo').reduce((s, i) => s + i.total, 0);
  const tarjeta  = ingresos.filter(i => i.metodoPago === 'tarjeta').reduce((s, i) => s + i.total, 0);
  const bizum    = ingresos.filter(i => i.metodoPago === 'bizum').reduce((s, i) => s + i.total, 0);

  return (
    <div className="shrink-0 bg-slate-800/90 border-t border-slate-700 px-4 py-2 flex items-center gap-4 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-4 flex-1 min-w-0 text-sm whitespace-nowrap">
        <span className="text-amber-400 font-black">💰 {fmtEur(total)}</span>
        <span className="text-slate-400">🍽️ {numPed} pedidos</span>
        <span className="text-slate-400">🎫 {numPed > 0 ? fmtEur(ticket) : '—'}</span>
        {efectivo > 0 && <span className="text-slate-400">💵 {fmtEur(efectivo)}</span>}
        {tarjeta  > 0 && <span className="text-slate-400">💳 {fmtEur(tarjeta)}</span>}
        {bizum    > 0 && <span className="text-slate-400">📱 {fmtEur(bizum)}</span>}
      </div>
      <button onClick={onCierre}
        className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-lg transition-colors whitespace-nowrap">
        CIERRE DE CAJA
      </button>
    </div>
  );
}

// ─── TPV View principal ───────────────────────────────────────────────────────

export function TPVView() {
  const { user }                       = useAuthContext();
  const { mesas, loading: mesasLoading } = useMesas();
  const { pedidos, loading: pedidosLoading } = usePedidos(['abierto', 'en_cocina', 'listo', 'cuenta_pedida']);
  const { categorias, productos }      = useCarta();
  const { notificaciones }             = useNotificaciones();
  const { ingresos }                   = useIngresosHoy();
  useProductosStock(); // keep subscription alive for stock badges in PedidoPanel

  const [selectedMesaId,   setSelectedMesaId]   = useState<string | null>(null);
  const [openingMesa,      setOpeningMesa]       = useState<string | null>(null);
  const [comensalesModal,  setComensalesModal]   = useState<Mesa | null>(null);
  const [showCobro,        setShowCobro]         = useState(false);
  const [showCierre,       setShowCierre]        = useState(false);
  const [showNotif,        setShowNotif]         = useState(false);
  const [clienteSelec,     setClienteSelec]      = useState<Cliente | null>(null);

  // Pedido de la mesa seleccionada en tiempo real (viene de usePedidos)
  const selectedMesa   = selectedMesaId ? mesas.find(m => m.id === selectedMesaId) : null;
  const selectedPedido = selectedMesa?.pedidoActivo
    ? pedidos.find(p => p.id === selectedMesa.pedidoActivo)
    : null;

  // Map de pedidos por mesaId para colores en las tarjetas
  const pedidoByMesa = useMemo(() => {
    const map: Record<string, Pedido> = {};
    pedidos.forEach(p => { map[p.mesaId] = p; });
    return map;
  }, [pedidos]);

  // Métricas resumen
  const mesasOcupadas  = mesas.filter(m => m.estado !== 'libre').length;
  const pendientesCobro = pedidos.filter(p => p.estado === 'cuenta_pedida').length;

  const handleMesaSelect = (mesa: Mesa) => {
    if (mesa.estado === 'libre') {
      setComensalesModal(mesa);
    } else {
      setSelectedMesaId(mesa.id);
    }
  };

  const handleOpenMesa = async (comensales: number) => {
    if (!comensalesModal) return;
    const mesa = comensalesModal;
    setComensalesModal(null);
    setOpeningMesa(mesa.id);
    try {
      await abrirMesa(mesa.id, mesa.nombre, user?.uid ?? '', user?.nombre ?? '', comensales);
      setSelectedMesaId(mesa.id);
    } catch (e) {
      console.error('Error al abrir mesa:', e);
      alert('Error al abrir la mesa. Comprueba la conexión.');
    } finally { setOpeningMesa(null); }
  };

  const handleCobrar = async (metodo: MetodoPago, total: number, emitirFact: boolean, _motivo?: string) => {
    if (!selectedPedido || !selectedMesa) return;
    // Snapshot de los datos antes de cerrar (el pedido desaparecerá del onSnapshot)
    const pedidoSnap = { ...selectedPedido };
    const mesaSnap   = { ...selectedMesa };
    const clienteSnap = clienteSelec;
    setShowCobro(false);
    setSelectedMesaId(null);
    setClienteSelec(null);
    try {
      await cerrarPedido(pedidoSnap.id, mesaSnap.id);
      await registrarIngreso(
        pedidoSnap.id, mesaSnap.id, mesaSnap.nombre,
        pedidoSnap.lineas, total, metodo,
        pedidoSnap.camareroId ?? '', pedidoSnap.camareroNombre ?? '',
      );
      if (clienteSnap) await registrarVisitaCliente(clienteSnap.id, total);
      const config = await getConfigRestaurante();
      if (emitirFact && clienteSnap) {
        const factura = await emitirFactura({
          pedidoId: pedidoSnap.id, mesaNombre: mesaSnap.nombre,
          lineas: pedidoSnap.lineas, total, cliente: clienteSnap,
        });
        await generarPDFFactura(factura, config);
      } else {
        await generarPDFTicket(pedidoSnap.id, mesaSnap.nombre, pedidoSnap.lineas, total, config);
      }
    } catch (e) {
      console.error('Error al cobrar:', e);
      alert('Error al registrar el cobro. Comprueba la conexión y reintenta.');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); if (selectedPedido) setShowCobro(true); }
      if (e.key === 'F3') { e.preventDefault(); /* handled in PedidoPanel */ }
      if (e.key === 'Escape') {
        if (showCobro) { setShowCobro(false); return; }
        if (showCierre) { setShowCierre(false); return; }
        if (showNotif) { setShowNotif(false); return; }
        setSelectedMesaId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedPedido, showCobro, showCierre, showNotif]);

  if (mesasLoading || pedidosLoading) return <FullScreenLoader />;

  const showRightPanel = !!selectedMesa;

  return (
    <div className="flex flex-col h-screen bg-slate-900 overflow-hidden">

      {/* ── Modals ── */}
      {comensalesModal && (
        <ComensalesModal mesa={comensalesModal} onConfirm={handleOpenMesa} onCancel={() => setComensalesModal(null)} />
      )}
      {showCobro && selectedPedido && selectedMesa && (
        <CobroModal
          pedido={selectedPedido} mesa={selectedMesa} cliente={clienteSelec}
          onCobrar={handleCobrar} onClose={() => setShowCobro(false)}
        />
      )}
      {showCierre && (
        <CierreCajaModal ingresos={ingresos} onClose={() => setShowCierre(false)} />
      )}
      {showNotif && (
        <NotificacionesDrawer notificaciones={notificaciones} onClose={() => setShowNotif(false)} />
      )}

      {/* ── Top bar ── */}
      <div className="shrink-0 bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-white font-black text-base leading-none">🍺 Los Barriles</h1>
            <p className="text-slate-500 text-xs">{user?.nombre}</p>
          </div>
          {/* Métricas inline */}
          <div className="hidden sm:flex items-center gap-3 ml-4">
            <span className="text-xs bg-orange-900/60 text-orange-300 px-2.5 py-1 rounded-lg font-bold">
              🪑 {mesasOcupadas}/{mesas.length} ocupadas
            </span>
            {pendientesCobro > 0 && (
              <span className="text-xs bg-red-900/60 text-red-300 px-2.5 py-1 rounded-lg font-bold animate-pulse">
                💳 {pendientesCobro} pendientes cobro
              </span>
            )}
            <span className="text-xs bg-amber-900/40 text-amber-300 px-2.5 py-1 rounded-lg font-bold">
              💰 {fmtEur(ingresos.reduce((s, i) => s + i.total, 0))} hoy
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Notificaciones */}
          <button onClick={() => setShowNotif(s => !s)}
            className={`relative p-2 rounded-lg transition ${showNotif ? 'bg-amber-500' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            <span className="text-lg">🔔</span>
            {notificaciones.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                {notificaciones.length > 9 ? '9+' : notificaciones.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Main content: split layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Lista de mesas (siempre visible en lg, oculta en móvil cuando hay mesa seleccionada) */}
        <div className={`${showRightPanel ? 'hidden lg:flex' : 'flex'} flex-col lg:w-2/5 border-r border-slate-700 overflow-hidden`}>
          {/* Summary header */}
          <div className="shrink-0 px-3 pt-3 pb-2 grid grid-cols-3 gap-2">
            {[
              { label: 'Libres', value: mesas.filter(m => m.estado === 'libre').length, color: 'text-slate-400' },
              { label: 'Ocupadas', value: mesasOcupadas, color: 'text-orange-400' },
              { label: 'Cobro', value: pendientesCobro, color: pendientesCobro > 0 ? 'text-red-400 animate-pulse' : 'text-slate-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-800 rounded-xl p-2 text-center">
                <p className={`font-black text-lg leading-none ${color}`}>{value}</p>
                <p className="text-slate-500 text-[10px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Grid de mesas */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {mesas.map(mesa => (
                <div key={mesa.id} className="relative">
                  <MesaCard
                    mesa={mesa}
                    pedido={pedidoByMesa[mesa.id]}
                    selected={selectedMesaId === mesa.id}
                    onSelect={handleMesaSelect}
                  />
                  {openingMesa === mesa.id && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                      <LoadingSpinner size={5} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Leyenda */}
          <div className="shrink-0 px-3 py-2 border-t border-slate-800 flex flex-wrap gap-x-3 gap-y-1">
            {(Object.entries(MESA_LABEL) as [MesaColor, string][])
              .filter(([k]) => k !== 'libre')
              .map(([k, label]) => (
                <div key={k} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${MESA_DOT[k].replace('animate-ping', '').replace('animate-pulse', '')}`} />
                  <span className="text-[9px] text-slate-600">{label}</span>
                </div>
              ))}
          </div>
        </div>

        {/* RIGHT: Detalle del pedido o resumen del día */}
        <div className={`${showRightPanel ? 'flex' : 'hidden lg:flex'} flex-col flex-1 overflow-hidden`}>
          {selectedMesa && selectedPedido ? (
            <PedidoPanel
              mesa={selectedMesa}
              pedido={selectedPedido}
              categorias={categorias}
              productos={productos}
              onClose={() => setSelectedMesaId(null)}
              onShowCobro={() => setShowCobro(true)}
            />
          ) : selectedMesa && !selectedPedido ? (
            /* Mesa seleccionada pero sin pedido activo aún (raro) */
            <div className="flex items-center justify-center h-full text-slate-500">
              <LoadingSpinner size={6} />
            </div>
          ) : (
            <ResumenDia ingresos={ingresos} mesas={mesas} pedidos={pedidos} />
          )}
        </div>
      </div>

      {/* ── Stats Bar inferior ── */}
      <StatsBar ingresos={ingresos} onCierre={() => setShowCierre(true)} />
    </div>
  );
}
