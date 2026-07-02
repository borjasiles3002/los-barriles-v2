/**
 * Impresión automática mediante QZ Tray (https://qz.io).
 *
 * Prerrequisitos en el TPV:
 *   1. Instalar QZ Tray desde https://qz.io/download/
 *   2. Abrirlo y activar "Allow unsigned" en Settings → Advanced
 *   3. La impresora térmica 80mm debe tener drivers instalados en Windows
 *
 * Flujo:
 *   - Cualquier dispositivo (PDA, tablet) llama a encolarImpresion() → escribe en Firestore /colaImpresion
 *   - El TPV principal ejecuta useColaImpresion() → lee la cola y lanza impresiones vía QZ Tray
 */

import {
  collection, addDoc, getDoc, setDoc, doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ColaImpresion, ConfigImpresoras, LineaPedido } from '../types';

// ─── Interfaz mínima de QZ Tray para TypeScript ───────────────────────────────

interface QzSecurity {
  setCertificatePromise(fn: (resolve: (cert?: string | null) => void, reject: (e?: unknown) => void) => void): void;
  setSignatureAlgorithm(algo: string): void;
  setSignaturePromise(fn: (data: string) => (resolve: (sig?: string | null) => void, reject: (e?: unknown) => void) => void): void;
}
interface QzWebsocket {
  connect(opts?: { host?: string; port?: number; usingSecure?: boolean }): Promise<void>;
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

  // Modo sin firma — QZ Tray debe tener activado "Allow unsigned" en Advanced
  _qz.security.setCertificatePromise((_res, _rej) => { _res(); });
  _qz.security.setSignatureAlgorithm('SHA512');
  _qz.security.setSignaturePromise(() => (res) => { res(); });

  return _qz;
}

// ─── ESC/POS helpers (impresora térmica 80mm, 48 chars/línea) ────────────────

const ESC = '\x1B', GS = '\x1D', LF = '\x0A';
const INIT        = `${ESC}\x40`;          // Inicializar
const BOLD_ON     = `${ESC}\x45\x01`;
const BOLD_OFF    = `${ESC}\x45\x00`;
const CENTER      = `${ESC}\x61\x01`;
const LEFT        = `${ESC}\x61\x00`;
const SIZE_4X     = `${ESC}\x21\x30`;      // Doble ancho + doble alto
const SIZE_2H     = `${ESC}\x21\x10`;      // Doble alto
const SIZE_NORMAL = `${ESC}\x21\x00`;
const CUT         = `${GS}\x56\x00`;       // Corte completo
const FEED_3      = `${ESC}\x64\x03`;      // Alimentar 3 líneas

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

function buildTicket(job: ColaImpresion): string {
  const total = job.total ?? job.lineas.reduce((s, l) => s + l.precio * l.cantidad, 0);
  return [
    INIT,
    CENTER,
    SIZE_4X, `LOS BARRILES${LF}`,
    SIZE_NORMAL,
    `${divider('=')}${LF}`,
    `${centerText(job.mesaNombre)}${LF}`,
    `${centerText(fmtFecha())}${LF}`,
    `${divider('=')}${LF}`,
    LEFT,
    lineasRows(job.lineas, true),
    `${divider('=')}${LF}`,
    CENTER, SIZE_2H, BOLD_ON,
    `TOTAL: ${fmtEur(total)}${LF}`,
    BOLD_OFF, SIZE_NORMAL,
    `${centerText('¡Gracias por su visita!')}${LF}`,
    `${centerText('Los Barriles')}${LF}`,
    FEED_3,
    CUT,
  ].join('');
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function conectarQZ(): Promise<void> {
  const qz = await getQZ();
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect({ host: 'localhost', port: 8182, usingSecure: false });
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
      nombre: `Impresora OK — ${impresora}`,
      precio: 0, cantidad: 1, estado: 'pendiente', destino: 'barra',
    }],
    estado: 'pendiente', createdAt: new Date().toISOString(),
  };
  const qz  = await getQZ();
  if (!qz.websocket.isActive()) await conectarQZ();
  const cfg = qz.configs.create(impresora);
  await qz.print(cfg, [buildComanda(prueba)]);
}

export async function imprimirTrabajo(job: ColaImpresion, impresora: string): Promise<void> {
  const qz  = await getQZ();
  if (!qz.websocket.isActive()) await conectarQZ();
  const raw = job.tipo === 'ticket' ? buildTicket(job) : buildComanda(job);
  const cfg = qz.configs.create(impresora);
  await qz.print(cfg, [raw]);
}

// ─── Cola en Firestore (/colaImpresion) ───────────────────────────────────────

export async function encolarImpresion(
  job: Pick<ColaImpresion, 'tipo' | 'mesaNombre' | 'pedidoId' | 'lineas' | 'total'>,
): Promise<void> {
  try {
    await addDoc(collection(db, 'colaImpresion'), {
      ...job,
      estado:    'pendiente' as const,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[impresion] Error al encolar trabajo:', e);
  }
}

// ─── Configuración de impresoras (/configuracion/impresoras) ─────────────────

const configRef = () => doc(db, 'configuracion', 'impresoras');

export async function getConfigImpresoras(): Promise<ConfigImpresoras> {
  const snap = await getDoc(configRef());
  if (!snap.exists()) return { impresoraCocina: '', impresoraBarra: '' };
  return snap.data() as ConfigImpresoras;
}

export async function saveConfigImpresoras(cfg: ConfigImpresoras): Promise<void> {
  await setDoc(configRef(), cfg);
}
