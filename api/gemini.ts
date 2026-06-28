import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_BASE    = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ─── Invoice analysis ────────────────────────────────────────────────────────

async function analyzeInvoice(imageBase64: string, mimeType: string): Promise<unknown> {
  const prompt = `Analiza esta factura de proveedor de restaurante.
Extrae ÚNICAMENTE en JSON sin texto adicional, con este formato exacto:
{
  "proveedor": "nombre del proveedor",
  "fecha": "YYYY-MM-DD",
  "numero_factura": "número de factura",
  "productos": [
    {
      "nombre": "nombre del producto",
      "cantidad": 0,
      "unidad": "kg/L/ud/caja",
      "precio_unidad": 0.00,
      "precio_total": 0.00
    }
  ],
  "subtotal": 0.00,
  "iva": 0.00,
  "total": 0.00
}
Si no encuentras algún campo, usa null. Responde SOLO con el JSON, sin texto adicional.`;

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
        { text: prompt },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  };

  const res = await fetch(`${GEMINI_BASE}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  // Extract JSON from response (Gemini may wrap it in ```json ... ```)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const jsonStr   = jsonMatch ? jsonMatch[1] : text;
  return JSON.parse(jsonStr.trim());
}

// ─── Chat with restaurant context ────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

interface RestaurantContext {
  ventasHoy?: number;
  pedidosHoy?: number;
  ventasSemana?: number;
  stockAlertas?: { nombre: string; cantidad: number; stockMinimo: number; unidad: string }[];
  alertasPrecios?: { producto: string; proveedor: string; subidaPct: number }[];
  escandallosAltos?: { plato: string; foodCost: number; coste: number; precio: number }[];
  topProductos?: { nombre: string; veces: number }[];
}

async function chat(messages: ChatMessage[], context: RestaurantContext): Promise<string> {
  const systemText = `Eres el asistente de gestión del restaurante "Los Barriles".
Tienes acceso al contexto actual del restaurante:

VENTAS HOY: ${context.ventasHoy?.toFixed(2) ?? 'N/D'}€ (${context.pedidosHoy ?? 0} pedidos)
VENTAS ESTA SEMANA: ${context.ventasSemana?.toFixed(2) ?? 'N/D'}€

STOCK BAJO MÍNIMO:
${context.stockAlertas?.length
  ? context.stockAlertas.map(s => `  - ${s.nombre}: ${s.cantidad}${s.unidad} (mínimo: ${s.stockMinimo}${s.unidad})`).join('\n')
  : '  - Sin alertas de stock'}

ALERTAS DE PRECIO (últimas):
${context.alertasPrecios?.length
  ? context.alertasPrecios.map(a => `  - ${a.producto} (${a.proveedor}): +${a.subidaPct.toFixed(1)}%`).join('\n')
  : '  - Sin alertas de precio recientes'}

PLATOS CON FOOD COST ALTO (>35%):
${context.escandallosAltos?.length
  ? context.escandallosAltos.map(e => `  - ${e.plato}: ${e.foodCost.toFixed(1)}% food cost (coste ${e.coste.toFixed(2)}€, PVP ${e.precio.toFixed(2)}€)`).join('\n')
  : '  - Sin alertas de escandallo'}

Responde de forma concisa y directa con datos concretos. Cuando des consejos, sé específico con nombres de platos y cantidades. Usa € para moneda.`;

  const contents = messages.map(m => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  const body = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  const res = await fetch(`${GEMINI_BASE}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No pude generar una respuesta.';
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  try {
    const { action } = req.body as { action: string };

    if (action === 'analyze') {
      const { imageBase64, mimeType } = req.body as { imageBase64: string; mimeType: string };
      const result = await analyzeInvoice(imageBase64, mimeType);
      return res.status(200).json({ result });
    }

    if (action === 'chat') {
      const { messages, context } = req.body as { messages: ChatMessage[]; context: RestaurantContext };
      const reply = await chat(messages, context);
      return res.status(200).json({ reply });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
