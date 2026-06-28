import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { Factura, FacturaProducto } from '../types';
import { updateStockFromFactura } from './stock.service';
import { recalcularPorCambioPrecio } from './escandallos.service';
import { findStockByName } from './stock.service';

// ─── Guardar factura + actualizar stock ───────────────────────────────────────

export async function procesarFactura(
  datos: Omit<Factura, 'id' | 'imagenUrl' | 'procesada' | 'createdAt'>,
  imageFile: File | null,
): Promise<string> {
  // 1. Upload image to Firebase Storage
  let imagenUrl = '';
  if (imageFile) {
    const path    = `facturas/${Date.now()}_${imageFile.name}`;
    const sRef    = ref(storage, path);
    await uploadBytes(sRef, imageFile);
    imagenUrl = await getDownloadURL(sRef);
  }

  // 2. Save factura document
  const facturaRef = await addDoc(collection(db, 'facturas'), {
    ...datos,
    imagenUrl,
    procesada: true,
    createdAt: new Date().toISOString(),
  });

  // 3. Update stock for each product in invoice
  // First collect which products have price changes for escandallo recalc
  const preciosCambiados: { stockId: string; precio: number }[] = [];

  for (const prod of datos.productos) {
    const existing = await findStockByName(prod.nombre);
    if (existing && existing.ultimoPrecio > 0 && prod.precio_unidad !== existing.ultimoPrecio) {
      preciosCambiados.push({ stockId: existing.id, precio: prod.precio_unidad });
    }
  }

  await updateStockFromFactura(datos.productos, facturaRef.id, datos.proveedor);

  // 4. Recalculate escandallos for changed prices
  for (const { stockId, precio } of preciosCambiados) {
    await recalcularPorCambioPrecio(stockId, precio);
  }

  return facturaRef.id;
}

// ─── Obtener una página de facturas ──────────────────────────────────────────

export type { Factura, FacturaProducto };
