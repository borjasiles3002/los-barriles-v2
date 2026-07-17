import {
  collection, doc, setDoc, getDoc, runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { FacturaEmitida, LineaPedido, ConfigRestaurante, TipoIva, Cliente } from '../types';

const RATES: Record<TipoIva, number> = { reducido: 0.10, superreducido: 0.04, normal: 0.21 };

// ─── Obtener siguiente número de factura ──────────────────────────────────────

async function getSiguienteNumero(): Promise<string> {
  const counterRef = doc(db, 'contadores', 'facturas');
  let numero = 1;

  await runTransaction(db, async (t) => {
    const snap = await t.get(counterRef);
    if (!snap.exists()) {
      numero = 1;
      t.set(counterRef, { siguiente: 2 });
    } else {
      numero = snap.data()['siguiente'] as number;
      t.update(counterRef, { siguiente: numero + 1 });
    }
  });

  const year = new Date().getFullYear();
  return `FAC-${year}-${String(numero).padStart(4, '0')}`;
}

// ─── Construir líneas de factura desde líneas de pedido ───────────────────────

function buildLineas(lineas: LineaPedido[]) {
  const bases: Record<TipoIva, number>     = { reducido: 0, superreducido: 0, normal: 0 };
  const cuotas: Record<TipoIva, number>    = { reducido: 0, superreducido: 0, normal: 0 };

  const lineasFactura: FacturaEmitida['lineas'] = lineas.map(l => {
    const tipo    = l.tipoIva ?? 'reducido';
    const rate    = RATES[tipo];
    const totalLinea = l.precio * l.cantidad;
    const base    = totalLinea / (1 + rate);
    const iva     = totalLinea - base;
    bases[tipo]  += base;
    cuotas[tipo] += iva;
    return {
      nombre:       l.nombre,
      cantidad:     l.cantidad,
      precioConIva: l.precio,
      base:         Math.round(base * 100) / 100,
      iva:          Math.round(iva * 100) / 100,
      tipoIva:      tipo,
    };
  });

  // Round aggregates
  Object.keys(bases).forEach(k => {
    bases[k as TipoIva]  = Math.round(bases[k as TipoIva]  * 100) / 100;
    cuotas[k as TipoIva] = Math.round(cuotas[k as TipoIva] * 100) / 100;
  });

  return { lineasFactura, bases, cuotas };
}

// ─── Obtener configuración del restaurante ────────────────────────────────────

export async function getConfigRestaurante(): Promise<ConfigRestaurante | null> {
  const snap = await getDoc(doc(db, 'configuracion', 'restaurante'));
  if (!snap.exists()) return null;
  return snap.data() as ConfigRestaurante;
}

export async function saveConfigRestaurante(config: ConfigRestaurante): Promise<void> {
  await setDoc(doc(db, 'configuracion', 'restaurante'), config);
}

// ─── Emitir factura ───────────────────────────────────────────────────────────

export async function emitirFactura(params: {
  pedidoId:    string;
  mesaNombre:  string;
  lineas:      LineaPedido[];
  total:       number;
  cliente?:    Cliente;
}): Promise<FacturaEmitida> {
  const numero = await getSiguienteNumero();
  const { lineasFactura, bases, cuotas } = buildLineas(params.lineas);
  const ahora  = new Date().toISOString();

  const factura: Omit<FacturaEmitida, 'id'> = {
    numero,
    fecha:   ahora.slice(0, 10),
    lineas:  lineasFactura,
    bases,
    cuotasIva: cuotas,
    total:   params.total,
    pedidoId:   params.pedidoId,
    mesaNombre: params.mesaNombre,
    creadaEn:   ahora,
    ...(params.cliente ? {
      clienteId:       params.cliente.id,
      clienteNombre:   `${params.cliente.nombre} ${params.cliente.apellidos}`,
      clienteNif:      params.cliente.nif,
      clienteDireccion: [params.cliente.direccion, params.cliente.cp, params.cliente.ciudad]
        .filter(Boolean).join(', '),
    } : {}),
  };

  const ref = doc(collection(db, 'facturas_emitidas'));
  await setDoc(ref, factura);
  return { id: ref.id, ...factura };
}

// ─── Logo helper para PDF ─────────────────────────────────────────────────────

async function cargarLogoParaPDF(maxWMm = 60): Promise<{ base64: string; w: number; h: number } | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const mmPerPx = 25.4 / 96;
      let w = img.naturalWidth  * mmPerPx;
      let h = img.naturalHeight * mmPerPx;
      if (w > maxWMm) { h = h * maxWMm / w; w = maxWMm; }
      const c = document.createElement('canvas');
      c.width  = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      resolve({ base64: c.toDataURL('image/jpeg', 0.9).split(',')[1], w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 });
    };
    img.onerror = () => resolve(null);
    img.src = '/logo-ticket.jpg';
  });
}

// ─── Generar PDF factura con jsPDF ────────────────────────────────────────────

export async function generarPDFFactura(
  factura:   FacturaEmitida,
  restaurante: ConfigRestaurante | null,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const L = 14;    // left margin
  const W = 182;   // content width
  let y = 20;

  const addLine = (h = 6) => { y += h; };

  // ── Logo ──
  const logo = await cargarLogoParaPDF(50);
  if (logo) {
    try {
      doc.addImage(logo.base64, 'JPEG', L + (W - logo.w) / 2, y, logo.w, logo.h);
      y += logo.h + 4;
    } catch { /* continuar sin logo */ }
  }

  // ── Datos restaurante ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(restaurante?.nombre ?? 'Restaurante', L, y); addLine(7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (restaurante?.nif)      { doc.text(`NIF: ${restaurante.nif}`, L, y); addLine(); }
  if (restaurante?.direccion) { doc.text(restaurante.direccion, L, y); addLine(); }
  if (restaurante?.ciudad)   { doc.text(`${restaurante.cp ?? ''} ${restaurante.ciudad}`.trim(), L, y); addLine(); }
  if (restaurante?.telefono) { doc.text(`Tel: ${restaurante.telefono}`, L, y); addLine(); }
  addLine(4);

  // ── Nº factura y fecha ──
  doc.setFillColor(243, 166, 31);
  doc.rect(L, y - 2, W, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`FACTURA ${factura.numero}`, L + 2, y + 5);
  doc.setFontSize(10);
  doc.text(new Date(factura.fecha + 'T12:00:00').toLocaleDateString('es-ES'), L + W - 2, y + 5, { align: 'right' });
  doc.setTextColor(0);
  y += 14;

  // ── Datos cliente ──
  if (factura.clienteNombre) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Cliente:', L, y); addLine(6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(factura.clienteNombre, L, y); addLine();
    if (factura.clienteNif)       { doc.text(`NIF: ${factura.clienteNif}`, L, y); addLine(); }
    if (factura.clienteDireccion) { doc.text(factura.clienteDireccion, L, y); addLine(); }
    addLine(4);
  }

  // ── Tabla líneas ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setFillColor(51, 65, 85);
  doc.rect(L, y - 2, W, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('Concepto',    L + 2,       y + 4);
  doc.text('Cant.',       L + 100,     y + 4, { align: 'right' });
  doc.text('P. Unit.',    L + 130,     y + 4, { align: 'right' });
  doc.text('IVA',         L + 155,     y + 4, { align: 'right' });
  doc.text('Total',       L + W,       y + 4, { align: 'right' });
  doc.setTextColor(0);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  factura.lineas.forEach((l, i) => {
    if (i % 2 === 0) { doc.setFillColor(245, 245, 245); doc.rect(L, y - 2, W, 7, 'F'); }
    doc.text(l.nombre,                              L + 2,   y + 3);
    doc.text(String(l.cantidad),                    L + 100, y + 3, { align: 'right' });
    doc.text(`${l.precioConIva.toFixed(2)}€`,       L + 130, y + 3, { align: 'right' });
    doc.text(`${Math.round(RATES[l.tipoIva] * 100)}%`, L + 155, y + 3, { align: 'right' });
    doc.text(`${(l.precioConIva * l.cantidad).toFixed(2)}€`, L + W, y + 3, { align: 'right' });
    y += 7;
    if (y > 260) { doc.addPage(); y = 20; }
  });

  addLine(4);

  // ── Desglose IVA ──
  const tiposConDatos = (Object.entries(factura.bases) as [TipoIva, number][])
    .filter(([, base]) => base > 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Desglose IVA:', L + 100, y); addLine(6);
  doc.setFont('helvetica', 'normal');
  tiposConDatos.forEach(([tipo, base]) => {
    const pct  = Math.round(RATES[tipo] * 100);
    const cuota = factura.cuotasIva[tipo];
    doc.text(`IVA ${pct}% — Base: ${base.toFixed(2)}€   Cuota: ${cuota.toFixed(2)}€`, L + 100, y);
    addLine();
  });

  addLine(4);

  // ── Total ──
  doc.setFillColor(243, 166, 31);
  doc.rect(L + 100, y - 2, W - 100, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(`TOTAL: ${factura.total.toFixed(2)}€`, L + W, y + 5, { align: 'right' });
  y += 15;

  // ── Pie ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(128);
  if (restaurante?.iban)  { doc.text(`IBAN: ${restaurante.iban}`, L, y); addLine(); }
  if (restaurante?.email) { doc.text(`Email: ${restaurante.email}`, L, y); addLine(); }
  doc.text(`Mesa: ${factura.mesaNombre}`, L, y);

  doc.save(`${factura.numero}.pdf`);
}

// ─── Generar ticket simplificado (sin cliente ni factura) ─────────────────────

export async function generarPDFTicket(
  pedidoId: string,
  mesaNombre: string,
  lineas: LineaPedido[],
  total: number,
  restaurante: ConfigRestaurante | null,
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
  const L = 5;
  let y = 8;

  // ── Logo ──
  const logo = await cargarLogoParaPDF(60);
  if (logo) {
    try {
      doc.addImage(logo.base64, 'JPEG', (80 - logo.w) / 2, y, logo.w, logo.h);
      y += logo.h + 3;
    } catch { /* continuar sin logo */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(restaurante?.nombre ?? 'Restaurante', 40, y, { align: 'center' }); y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  if (restaurante?.direccion) { doc.text(restaurante.direccion, 40, y, { align: 'center' }); y += 5; }
  doc.text(new Date().toLocaleString('es-ES'), 40, y, { align: 'center' }); y += 5;
  doc.text(`Mesa: ${mesaNombre}`, L, y); y += 6;
  doc.text('─'.repeat(35), L, y); y += 5;

  lineas.forEach(l => {
    doc.text(`${l.cantidad}x ${l.nombre}`, L, y);
    doc.text(`${(l.precio * l.cantidad).toFixed(2)}€`, 75, y, { align: 'right' });
    y += 5;
  });

  doc.text('─'.repeat(35), L, y); y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL', L, y);
  doc.text(`${total.toFixed(2)}€`, 75, y, { align: 'right' }); y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('¡Gracias por su visita!', 40, y, { align: 'center' });
  doc.text(`Ref: ${pedidoId.slice(-6)}`, 40, y + 4, { align: 'center' });

  doc.save(`ticket_${mesaNombre}_${Date.now()}.pdf`);
}
