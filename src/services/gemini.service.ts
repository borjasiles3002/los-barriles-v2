import type { ChatMessage, FacturaProducto } from '../types';

// Always call through /api/gemini (Vercel serverless) to keep the key server-side.
const API = '/api/gemini';

// ─── Compress image to base64 ─────────────────────────────────────────────────

export function fileToBase64(file: File, maxSizePx = 1024): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSizePx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      resolve({ base64, mimeType: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Invoice analysis (Gemini Vision) ────────────────────────────────────────

export interface GeminiFacturaResult {
  proveedor: string;
  fecha: string;
  numero_factura: string;
  productos: FacturaProducto[];
  subtotal: number;
  iva: number;
  total: number;
}

export async function analyzeInvoice(file: File): Promise<GeminiFacturaResult> {
  const { base64, mimeType } = await fileToBase64(file);

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'analyze', imageBase64: base64, mimeType }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? 'Error al analizar la factura');
  }

  const { result } = await res.json() as { result: GeminiFacturaResult };
  return result;
}

// ─── Chat assistant ───────────────────────────────────────────────────────────

export interface RestaurantContext {
  ventasHoy?: number;
  pedidosHoy?: number;
  ventasSemana?: number;
  stockAlertas?: { nombre: string; cantidad: number; stockMinimo: number; unidad: string }[];
  alertasPrecios?: { producto: string; proveedor: string; subidaPct: number }[];
  escandallosAltos?: { plato: string; foodCost: number; coste: number; precio: number }[];
}

export async function chatWithAssistant(
  messages: ChatMessage[],
  context: RestaurantContext,
): Promise<string> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'chat', messages, context }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? 'Error al conectar con el asistente');
  }

  const { reply } = await res.json() as { reply: string };
  return reply;
}
