import type { ChatMessage, FacturaProducto } from '../types';

// Always call through /api/gemini (Vercel serverless) to keep the key server-side.
const API = '/api/gemini';

// ─── File → base64 (images: resize to 1920px; PDFs: raw base64) ──────────────

export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  // PDF: use FileReader (native, fast, handles any size)
  if (file.type === 'application/pdf') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'application/pdf' });
      };
      reader.onerror = () => reject(new Error('No se pudo leer el PDF'));
      reader.readAsDataURL(file);
    });
  }

  // Images: compress to max 1920px, quality 0.85
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1920;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      resolve({ base64, mimeType: 'image/jpeg' });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

function humanizeError(raw: string): string {
  if (raw.includes('API key not valid') || raw.includes('API_KEY_INVALID'))
    return 'Clave API de Gemini inválida. Revisa GEMINI_API_KEY en Vercel.';
  if (raw.includes('GEMINI_API_KEY no configurada'))
    return 'Clave API no configurada. Ve a Vercel → Settings → Environment Variables.';
  if (raw.includes('quota') || raw.includes('RESOURCE_EXHAUSTED'))
    return 'Límite de cuota de Gemini alcanzado. Espera un momento e inténtalo de nuevo.';
  if (raw.includes('too large') || raw.includes('REQUEST_TOO_LARGE'))
    return 'El archivo es demasiado grande para Gemini. Usa una imagen más pequeña.';
  if (raw.includes('SAFETY'))
    return 'Gemini bloqueó la respuesta por filtros de seguridad.';
  return raw;
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
  // Size check (15 MB limit for inline data)
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('El archivo supera 15 MB. Usa una foto de menor resolución.');
  }

  const { base64, mimeType } = await fileToBase64(file);

  const res = await fetch(API, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'analyze', imageBase64: base64, mimeType }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(humanizeError(body.error ?? `Error HTTP ${res.status}`));
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
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'chat', messages, context }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error: string };
    throw new Error(humanizeError(body.error ?? `Error HTTP ${res.status}`));
  }

  const { reply } = await res.json() as { reply: string };
  return reply;
}
