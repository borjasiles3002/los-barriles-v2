import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_KEY   = process.env.GEMINI_API_KEY ?? '';
const GEMINI_BASE      = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const FIREBASE_API_KEY = process.env.FIREBASE_WEB_API_KEY ?? 'AIzaSyCkjDqR6xbrKk6Q3p3I3K_f9D8lQEfRUJY';
const FIREBASE_PROJECT = 'losbarrilesrestaurante-a18eb';

// ─── Auth helpers ──────────────────────────────────────────────────────────────

async function verifyToken(idToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) },
    );
    if (!res.ok) return null;
    const data = await res.json() as { users?: Array<{ localId: string }> };
    return data.users?.[0]?.localId ?? null;
  } catch { return null; }
}

async function getUserRole(uid: string, idToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/usuarios/${uid}`,
      { headers: { Authorization: `Bearer ${idToken}` } },
    );
    if (!res.ok) return null;
    const data = await res.json() as { fields?: { role?: { stringValue?: string } } };
    return data.fields?.role?.stringValue ?? null;
  } catch { return null; }
}

function extractBearerToken(req: VercelRequest): string | null {
  const h = req.headers['authorization'];
  const header = Array.isArray(h) ? h[0] : h;
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function geminiPost(body: unknown): Promise<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada en Vercel → Dashboard → Settings → Environment Variables');

  const res = await fetch(`${GEMINI_BASE}?key=${GEMINI_API_KEY}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const raw = await res.text();
    // Intentar extraer el mensaje de error del JSON de Gemini
    let detail = raw.slice(0, 300);
    try {
      const j = JSON.parse(raw) as { error?: { message?: string; status?: string } };
      if (j.error?.message) detail = j.error.message;
    } catch { /* raw ya está asignado */ }
    throw new Error(`Gemini ${res.status}: ${detail}`);
  }

  return res.json() as Promise<{ candidates?: { content?: { parts?: { text?: string }[] } }[] }>;
}

function extractText(data: { candidates?: { content?: { parts?: { text?: string }[] } }[] }): string {
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

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

  const data = await geminiPost(body);
  const text = extractText(data);

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
  const jsonStr   = jsonMatch ? jsonMatch[1] : text;
  try {
    return JSON.parse(jsonStr.trim());
  } catch {
    throw new Error(`Gemini devolvió texto no JSON: ${text.slice(0, 200)}`);
  }
}

// ─── Chat with restaurant context ────────────────────────────────────────────

interface ChatMessage { role: 'user' | 'model'; text: string; }

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

  const body = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  };

  const data = await geminiPost(body);
  return extractText(data) || 'No pude generar una respuesta.';
}

// ─── Financial reports ────────────────────────────────────────────────────────

const INFORME_PROMPTS: Record<string, string> = {
  diario: `Eres el analista financiero del restaurante "Los Barriles". Genera un informe diario conciso (máximo 250 palabras) basado en estos datos reales:\n\nDATOS:\n{{datos}}\n\nEl informe debe cubrir en este orden:\n1. Resumen ejecutivo (1-2 frases con los KPIs principales)\n2. Análisis de ventas: hora pico, productos estrella\n3. Situación financiera del día (beneficio, food cost estimado si hay gastos)\n4. 2-3 acciones concretas para mañana\n\nSé directo y usa números. Sin introducciones genéricas. En español.`,
  semanal: `Eres el analista financiero del restaurante "Los Barriles". Genera un informe semanal conciso (máximo 300 palabras) basado en estos datos reales:\n\nDATOS:\n{{datos}}\n\nEl informe debe cubrir:\n1. Resumen de la semana (total ingresos, gastos, beneficio estimado)\n2. El mejor y peor día, con explicación breve\n3. Top 3 productos de la semana\n4. Recomendaciones para la próxima semana\n\nDirecto y con datos concretos. En español.`,
  mensual: `Eres el analista financiero del restaurante "Los Barriles". Genera un informe mensual (máximo 400 palabras) basado en estos datos reales:\n\nDATOS:\n{{datos}}\n\nEl informe debe cubrir:\n1. Resumen ejecutivo del mes\n2. Análisis de tendencias (semanas fuertes/débiles, días pico)\n3. Control de gastos por categoría (porcentaje sobre ingresos)\n4. Top 5 productos del mes\n5. 3 recomendaciones estratégicas para el próximo mes\n\nEn español.`,
  anual:   `Eres el analista financiero del restaurante "Los Barriles". Genera un informe anual ejecutivo (máximo 500 palabras) basado en estos datos reales:\n\nDATOS:\n{{datos}}\n\nEl informe debe cubrir:\n1. Balance anual: ingresos totales, gastos, beneficio estimado\n2. Estacionalidad: mejores y peores meses\n3. Tendencia: crecimiento o decrecimiento\n4. Productos más rentables del año\n5. 4 objetivos estratégicos para el próximo año\n\nVisión estratégica, datos reales, en español.`,
};

async function generarInforme(tipo: string, datos: unknown): Promise<string> {
  const prompt = (INFORME_PROMPTS[tipo] ?? INFORME_PROMPTS['diario'])
    .replace('{{datos}}', JSON.stringify(datos, null, 2));

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  };

  const data = await geminiPost(body);
  return extractText(data) || 'No se pudo generar el informe.';
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { action } = req.body as { action: string };
    const idToken    = extractBearerToken(req);

    // Todas las acciones requieren usuario autenticado
    if (!idToken) return res.status(401).json({ error: 'Autenticación requerida' });
    const uid = await verifyToken(idToken);
    if (!uid) return res.status(401).json({ error: 'Token inválido o expirado' });

    if (action === 'analyze') {
      const { imageBase64, mimeType } = req.body as { imageBase64: string; mimeType: string };
      if (!imageBase64) return res.status(400).json({ error: 'Falta imageBase64 en el cuerpo' });
      const result = await analyzeInvoice(imageBase64, mimeType ?? 'image/jpeg');
      return res.status(200).json({ result });
    }

    if (action === 'chat') {
      // El asistente de chat solo es para el gerente
      const role = await getUserRole(uid, idToken);
      if (role !== 'gerente') return res.status(403).json({ error: 'Acceso restringido al gerente' });
      const { messages, context } = req.body as { messages: ChatMessage[]; context: RestaurantContext };
      const reply = await chat(messages, context ?? {});
      return res.status(200).json({ reply });
    }

    if (action === 'informe') {
      const { tipo, datos } = req.body as { tipo: string; datos: unknown };
      const narrative = await generarInforme(tipo, datos);
      return res.status(200).json({ narrative });
    }

    return res.status(400).json({ error: `Acción desconocida: ${action}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/gemini] Error:', msg);
    return res.status(500).json({ error: msg });
  }
}
