import {
  collection, addDoc, getDoc, setDoc, doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ColaImpresion, ConfigImpresoras, LineaPedido, ConfigRestaurante } from '../types';
import { getConfigRestaurante } from './facturasEmitidas.service';

interface QzSecurity {
  setCertificatePromise(fn: (resolve: (cert?: string | null) => void, reject: (e?: unknown) => void) => void): void;
  setSignatureAlgorithm(algo: string): void;
  setSignaturePromise(fn: (data: string) => (resolve: (sig?: string | null) => void, reject: (e?: unknown) => void) => void): void;
}
interface QzWebsocket {
  connect(opts?: { host?: string; port?: { secure?: number[]; insecure?: number[] } | number; usingSecure?: boolean }): Promise<void>;
  disconnect(): Promise<void>;
  isActive(): boolean;
}
interface QzPrinters { find(query?: string): Promise<string | string[]>; }
interface QzConfigs  { create(printer: string, opts?: Record<string, unknown>): unknown; }
interface Qz {
  security:  QzSecurity;
  websocket: QzWebsocket;
  printers:  QzPrinters;
  configs:   QzConfigs;
  print(cfg: unknown, data: (string | Record<string, unknown>)[]): Promise<void>;
}

let _qz: Qz | null = null;

async function getQZ(): Promise<Qz> {
  if (_qz) return _qz;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import('qz-tray') as any;
  _qz = ((mod.default ?? mod) as Qz);

  _qz.security.setCertificatePromise(resolve => { resolve(null); });
  _qz.security.setSignatureAlgorithm('SHA512');
  _qz.security.setSignaturePromise(() => resolve => { resolve(null); });

  return _qz;
}

const ESC = '\x1B', GS = '\x1D', LF = '\x0A', BEL = '\x07';
const INIT        = `${ESC}\x40`;
const BOLD_ON     = `${ESC}\x45\x01`;
const BOLD_OFF    = `${ESC}\x45\x00`;
const CENTER      = `${ESC}\x61\x01`;
const LEFT        = `${ESC}\x61\x00`;
const SIZE_4X     = `${ESC}\x21\x30`;
const SIZE_2H     = `${ESC}\x21\x10`;
const SIZE_NORMAL = `${ESC}\x21\x00`;
const CUT         = `${GS}\x56\x00`;
const FEED_3      = `${ESC}\x64\x03`;

const BUZZER_COCINA = `${BEL}${BEL}${BEL}${ESC}\x42\x05\x07`;

const W = 48;

function centerText(s: string): string {
  const p = Math.max(0, Math.floor((W - s.length) / 2));
  return ' '.repeat(p) + s;
}
function divider(ch = '-'): string { return ch.repeat(W); }
function fmtFecha(): string {
  const now = new Date();
  return `${now.toLocaleDateString('es-ES')}  ${now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}
function fmtEur(n: number): string { return `${n.toFixed(2)}EUR`; }

function rowLabelValue(label: string, value: string): string {
  const spaces = Math.max(1, W - label.length - value.length);
  return `${label}${' '.repeat(spaces)}${value}`;
}

function calcIVA(lineas: LineaPedido[]): { iva10: number; iva21: number; subtotal: number } {
  const RATES: Record<string, number> = { reducido: 0.10, superreducido: 0.04, normal: 0.21 };
  let iva10 = 0, iva21 = 0;
  lineas.forEach(l => {
    const rate    = RATES[l.tipoIva ?? 'reducido'] ?? 0.10;
    const linTotal = l.precio * l.cantidad;
    if (rate === 0.21) iva21 += linTotal / 1.21 * 0.21;
    else               iva10 += linTotal / (1 + rate) * rate;
  });
  const total = lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  return {
    iva10:    Math.round(iva10 * 100) / 100,
    iva21:    Math.round(iva21 * 100) / 100,
    subtotal: Math.round((total - iva10 - iva21) * 100) / 100,
  };
}

function lineasRows(lineas: LineaPedido[], withPrice: boolean): string {
  return lineas.map(l => {
    const qty   = String(l.cantidad).padStart(2);
    const price = withPrice ? fmtEur(l.precio * l.cantidad) : '';
    const sep   = withPrice ? 1 : 0;
    const maxN  = W - qty.length - 1 - price.length - sep;
    const nom   = l.nombre.length > maxN ? l.nombre.slice(0, maxN - 1) + '…' : l.nombre;
    const spaces = withPrice ? W - qty.length - 1 - nom.length - price.length : 0;
    const row   = withPrice
      ? `${qty} ${nom}${' '.repeat(Math.max(1, spaces))}${price}`
      : `${qty} ${nom}`;
    const nota  = l.notas ? `   >> ${l.notas}` : '';
    return BOLD_ON + row + LF + BOLD_OFF + (nota ? nota + LF : '');
  }).join('');
}

function buildComanda(job: ColaImpresion): string {
  const header = job.tipo === 'cocina' ? '*** COCINA ***' : '*** BARRA ***';
  return [
    job.tipo === 'cocina' ? BUZZER_COCINA : '',
    INIT,
    CENTER,
    SIZE_4X, `LOS BARRILES${LF}`,
    SIZE_NORMAL,
    `${divider('=')}${LF}`,
    SIZE_2H, BOLD_ON, `${centerText(job.mesaNombre)}${LF}`, BOLD_OFF, SIZE_NORMAL,
    `${centerText(header)}${LF}`,
    `${centerText(fmtFecha())}${LF}`,
    `${divider('=')}${LF}`,
    LEFT,
    lineasRows(job.lineas, false),
    `${divider()}${LF}`,
    FEED_3,
    CUT,
  ].join('');
}

function buildProforma(
  job:         ColaImpresion,
  restaurante: ConfigRestaurante | null,
  comensales?: number,
): string {
  const total   = job.total ?? job.lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const { iva10, iva21, subtotal } = calcIVA(job.lineas);
  const nombre  = restaurante?.nombre   ?? 'LOS BARRILES';
  const dir     = restaurante?.direccion ?? '';
  const comStr  = comensales ? `Comensales: ${comensales}` : '';

  return [
    INIT,
    CENTER,
    SIZE_4X, `${nombre}${LF}`,
    SIZE_NORMAL,
    dir   ? `${centerText(dir)}${LF}` : '',
    `${divider('=')}${LF}`,
    SIZE_2H, BOLD_ON, `${centerText(job.mesaNombre)}${LF}`, BOLD_OFF, SIZE_NORMAL,
    comStr ? `${centerText(comStr)}${LF}` : '',
    `${centerText(fmtFecha())}${LF}`,
    `${divider('=')}${LF}`,
    LEFT,
    lineasRows(job.lineas, true),
    `${divider()}${LF}`,
    iva10 > 0 ? `${rowLabelValue('Base imp.:', fmtEur(subtotal))}${LF}` : '',
    iva10 > 0 ? `${rowLabelValue('IVA 10%:', fmtEur(iva10))}${LF}` : '',
    iva21 > 0 ? `${rowLabelValue('IVA 21%:', fmtEur(iva21))}${LF}` : '',
    `${divider()}${LF}`,
    CENTER, SIZE_2H, BOLD_ON,
    `TOTAL: ${fmtEur(total)}${LF}`,
    BOLD_OFF, SIZE_NORMAL,
    `${divider('─')}${LF}`,
    `${centerText('─ CUENTA PROVISIONAL ─')}${LF}`,
    `${centerText('No válido como factura')}${LF}`,
    FEED_3,
    CUT,
  ].join('');
}

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', tarjeta: 'Tarjeta', bizum: 'Bizum',
  invitacion: 'Invitación', otros: 'Otros',
};

function buildTicketCompleto(
  job:        ColaImpresion,
  restaurante: ConfigRestaurante | null,
  numero?:    string,
  metodoPago?: string,
  entregado?: number,
  cambio?:    number,
): string {
  const total   = job.total ?? job.lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  const { iva10, iva21, subtotal } = calcIVA(job.lineas);
  const nombre  = restaurante?.nombre    ?? 'LOS BARRILES';
  const dir     = restaurante?.direccion ?? '';
  const nif     = restaurante?.nif       ?? '';

  return [
    INIT,
    CENTER,
    SIZE_4X, `${nombre}${LF}`,
    SIZE_NORMAL,
    dir ? `${centerText(dir)}${LF}` : '',
    nif ? `${centerText(`NIF: ${nif}`)}${LF}` : '',
    `${divider('=')}${LF}`,
    numero ? `${centerText(`N\xba ${numero}`)}${LF}` : '',
    `${centerText(job.mesaNombre)}${LF}`,
    `${centerText(fmtFecha())}${LF}`,
    `${divider('=')}${LF}`,
    LEFT,
    lineasRows(job.lineas, true),
    `${divider()}${LF}`,
    `${rowLabelValue('Base imp.:', fmtEur(subtotal))}${LF}`,
    iva10 > 0 ? `${rowLabelValue('IVA 10%:', fmtEur(iva10))}${LF}` : '',
    iva21 > 0 ? `${rowLabelValue('IVA 21%:', fmtEur(iva21))}${LF}` : '',
    `${divider()}${LF}`,
    CENTER, SIZE_2H, BOLD_ON,
    `TOTAL: ${fmtEur(total)}${LF}`,
    BOLD_OFF, SIZE_NORMAL,
    LEFT,
    metodoPago ? `${rowLabelValue('PAGO:', METODO_LABEL[metodoPago] ?? metodoPago)}${LF}` : '',
    entregado != null ? `${rowLabelValue('Entregado:', fmtEur(entregado))}${LF}` : '',
    cambio    != null ? `${rowLabelValue('Cambio:', fmtEur(Math.max(0, cambio)))}${LF}` : '',
    CENTER,
    `${divider('─')}${LF}`,
    `${centerText('IVA incluido — ¡Gracias por su visita!')}${LF}`,
    FEED_3,
    CUT,
  ].join('');
}

function toHex(raw: string): string {
  let hex = '';
  for (let i = 0; i < raw.length; i++) {
    hex += (raw.charCodeAt(i) & 0xFF).toString(16).padStart(2, '0');
  }
  return hex;
}

export async function conectarQZ(): Promise<void> {
  const qz = await getQZ();
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect({
      host: 'localhost',
      usingSecure: false,
      port: { insecure: [8182, 8183, 8184] },
    });
  }
}

export async function desconectarQZ(): Promise<void> {
  if (_qz?.websocket.isActive()) await _qz.websocket.disconnect();
}

export async function qzConectado(): Promise<boolean> {
  try { return (await getQZ()).websocket.isActive(); }
  catch { return false; }
}

export async function obtenerImpresoras(): Promise<string[]> {
  const qz = await getQZ();
  if (!qz.websocket.isActive()) await conectarQZ();
  const result = await qz.printers.find();
  return Array.isArray(result) ? result : result ? [result] : [];
}

export async function imprimirPrueba(impresora: string): Promise<void> {
  const prueba: ColaImpresion = {
    id: 'test', tipo: 'barra',
    mesaNombre: 'PRUEBA',
    pedidoId:   'test',
    lineas: [{
      id: 'l1', productoId: 'p1',
      nombre: `Impresora OK: ${impresora.slice(0, 30)}`,
      precio: 0, cantidad: 1, estado: 'pendiente', destino: 'barra',
    }],
    estado: 'pendiente', createdAt: new Date().toISOString(),
  };
  const qz  = await getQZ();
  if (!qz.websocket.isActive()) await conectarQZ();
  const cfg = qz.configs.create(impresora);
  const raw = buildComanda(prueba);
  await qz.print(cfg, [{ type: 'raw', format: 'hex', data: toHex(raw) }]);
}

export async function imprimirPruebaTicket(impresora: string): Promise<void> {
  const testJob: ColaImpresion = {
    id: 'test', tipo: 'ticket', mesaNombre: 'Mesa 1',
    pedidoId: 'test', estado: 'pendiente', createdAt: new Date().toISOString(),
    numero: 'T-2026-00001',
    lineas: [
      { id: 'l1', productoId: 'p1', nombre: 'Chuletón 400g', precio: 24.50, cantidad: 1, estado: 'pendiente', destino: 'cocina', tipoIva: 'reducido' },
      { id: 'l2', productoId: 'p2', nombre: 'Rioja Crianza', precio: 12.00, cantidad: 2, estado: 'pendiente', destino: 'barra', tipoIva: 'reducido' },
    ],
    total: 48.50, metodoPago: 'tarjeta',
  };
  const qz  = await getQZ();
  if (!qz.websocket.isActive()) await conectarQZ();
  const raw = buildTicketCompleto(testJob, null, 'T-2026-00001', 'tarjeta');
  const cfg = qz.configs.create(impresora);
  await qz.print(cfg, [{ type: 'raw', format: 'hex', data: toHex(raw) }]);
}

export async function imprimirTrabajo(job: ColaImpresion, impresora: string): Promise<void> {
  const qz         = await getQZ();
  if (!qz.websocket.isActive()) await conectarQZ();
  const restaurante = await getConfigRestaurante();
  let raw: string;
  if (job.tipo === 'proforma') {
    raw = buildProforma(job, restaurante, job.comensales);
  } else if (job.tipo === 'ticket') {
    raw = buildTicketCompleto(job, restaurante, job.numero, job.metodoPago, job.entregado, job.cambio);
  } else {
    raw = buildComanda(job);
  }
  const cfg = qz.configs.create(impresora);
  await qz.print(cfg, [{ type: 'raw', format: 'hex', data: toHex(raw) }]);
}

export async function encolarImpresion(
  job: Pick<ColaImpresion, 'tipo' | 'mesaNombre' | 'pedidoId' | 'lineas'> &
       Partial<Pick<ColaImpresion, 'total' | 'numero' | 'metodoPago' | 'entregado' | 'cambio' | 'comensales'>>,
): Promise<void> {
  try {
    await addDoc(collection(db, 'colaImpresion'), Object.fromEntries(
      Object.entries({ ...job, estado: 'pendiente' as const, createdAt: new Date().toISOString() })
        .filter(([, v]) => v !== undefined),
    ));
  } catch (e) {
    console.error('[impresion] Error al encolar trabajo:', e);
  }
}

const configRef = () => doc(db, 'configuracion', 'impresoras');

export async function getConfigImpresoras(): Promise<ConfigImpresoras> {
  const snap = await getDoc(configRef());
  if (!snap.exists()) return { impresoraCocina: '', impresoraBarra: '' };
  return snap.data() as ConfigImpresoras;
}

export async function saveConfigImpresoras(cfg: ConfigImpresoras): Promise<void> {
  await setDoc(configRef(), cfg);
}
