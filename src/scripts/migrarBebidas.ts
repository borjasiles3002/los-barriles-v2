/**
 * Migra la categoría "Bebidas" a 6 subcategorías de bebidas.
 * - Crea las 6 nuevas categorías (órdenes 5-10)
 * - Mueve productos existentes de "Bebidas" a su subcategoría correcta
 * - Añade productos básicos en cada subcategoría (omite duplicados por nombre)
 * - Elimina la categoría "Bebidas" antigua
 *
 * npx tsx src/scripts/migrarBebidas.ts
 */

import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, writeBatch,
  doc, query, where, addDoc, updateDoc, deleteDoc,
} from 'firebase/firestore';

const app = initializeApp({
  apiKey:            process.env.VITE_FIREBASE_API_KEY             ?? '',
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN         ?? '',
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID          ?? '',
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET      ?? '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.VITE_FIREBASE_APP_ID              ?? '',
});
const db = getFirestore(app);

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Destino = 'barra' | 'cocina' | 'ambos';
type TipoIva = 'reducido' | 'normal' | 'superreducido';

interface ProductoDef {
  nombre:      string;
  precio:      number;
  descripcion: string;
  tipoIva:     TipoIva;
}

interface CategoriaDef {
  nombre:    string;
  orden:     number;
  productos: ProductoDef[];
}

// ─── Nuevas categorías y sus productos ───────────────────────────────────────

const NUEVAS_CATEGORIAS: CategoriaDef[] = [
  {
    nombre: 'Cervezas',
    orden:  5,
    productos: [
      { nombre: 'Caña',                precio: 1.80, descripcion: 'Caña de cerveza rubia de barril, 20cl',           tipoIva: 'normal' },
      { nombre: 'Doble',               precio: 2.50, descripcion: 'Cerveza de barril, 33cl',                          tipoIva: 'normal' },
      { nombre: 'Tercio',              precio: 2.80, descripcion: 'Botellín de cerveza 33cl',                         tipoIva: 'normal' },
      { nombre: 'Cerveza Sin Alcohol', precio: 2.50, descripcion: 'Botellín sin alcohol 33cl',                        tipoIva: 'normal' },
      { nombre: 'Radler',              precio: 2.80, descripcion: 'Mezcla de cerveza y limón, refrescante',           tipoIva: 'normal' },
    ],
  },
  {
    nombre: 'Vinos Tintos',
    orden:  6,
    productos: [
      { nombre: 'Copa Rioja Crianza',    precio: 3.50, descripcion: 'Copa de Rioja Crianza 12 meses en barrica',      tipoIva: 'normal' },
      { nombre: 'Botella Rioja Crianza', precio: 18.00, descripcion: 'Botella de Rioja Crianza 75cl',                 tipoIva: 'normal' },
    ],
  },
  {
    nombre: 'Vinos Blancos',
    orden:  7,
    productos: [
      { nombre: 'Copa Verdejo',    precio: 3.00,  descripcion: 'Copa de Verdejo Rueda, fresco y afrutado',           tipoIva: 'normal' },
      { nombre: 'Botella Verdejo', precio: 16.00, descripcion: 'Botella de Verdejo Rueda 75cl',                      tipoIva: 'normal' },
    ],
  },
  {
    nombre: 'Refrescos',
    orden:  8,
    productos: [
      { nombre: 'Agua',         precio: 2.00, descripcion: 'Agua mineral natural o con gas 33cl',               tipoIva: 'reducido' },
      { nombre: 'Coca-Cola',    precio: 2.50, descripcion: 'Coca-Cola lata / botellín',                         tipoIva: 'reducido' },
      { nombre: 'Fanta Naranja',precio: 2.50, descripcion: 'Fanta Naranja lata',                                tipoIva: 'reducido' },
      { nombre: 'Fanta Limón',  precio: 2.50, descripcion: 'Fanta Limón lata',                                  tipoIva: 'reducido' },
      { nombre: 'Nestea',       precio: 2.50, descripcion: 'Nestea lata',                                       tipoIva: 'reducido' },
      { nombre: 'Tónica',       precio: 2.50, descripcion: 'Tónica Schweppes lata',                             tipoIva: 'reducido' },
      { nombre: 'Zumo',         precio: 2.50, descripcion: 'Zumo de naranja, piña o melocotón',                 tipoIva: 'reducido' },
    ],
  },
  {
    nombre: 'Café e Infusiones',
    orden:  9,
    productos: [
      { nombre: 'Café Solo',      precio: 1.50, descripcion: 'Espresso doble',                                   tipoIva: 'reducido' },
      { nombre: 'Cortado',        precio: 1.60, descripcion: 'Espresso con una pizca de leche vaporizada',       tipoIva: 'reducido' },
      { nombre: 'Café con Leche', precio: 1.80, descripcion: 'Espresso con leche vaporizada',                    tipoIva: 'reducido' },
      { nombre: 'Descafeinado',   precio: 1.60, descripcion: 'Descafeinado solo o con leche',                    tipoIva: 'reducido' },
      { nombre: 'Infusión',       precio: 1.80, descripcion: 'Manzanilla, poleo, tila o similar',                tipoIva: 'reducido' },
      { nombre: 'Carajillo',      precio: 2.50, descripcion: 'Café con licor a elegir',                          tipoIva: 'reducido' },
    ],
  },
  {
    nombre: 'Licores',
    orden:  10,
    productos: [
      { nombre: 'Chupito Orujo', precio: 2.50, descripcion: 'Orujo blanco o de hierbas',                       tipoIva: 'normal' },
      { nombre: 'Gin Tonic',     precio: 7.00, descripcion: 'Gin selección con tónica premium y guarnición',    tipoIva: 'normal' },
      { nombre: 'Ron Cola',      precio: 6.50, descripcion: 'Ron con Coca-Cola y hielo',                        tipoIva: 'normal' },
      { nombre: 'Whisky',        precio: 6.50, descripcion: 'Whisky con agua o con hielo',                      tipoIva: 'normal' },
      { nombre: 'Vermut',        precio: 3.50, descripcion: 'Vermut rojo con naranja y aceituna',               tipoIva: 'normal' },
    ],
  },
];

// ─── Mapa de migración (nombre_existente → nombre_nueva_categoría) ─────────────

const MIGRAR_A: Record<string, string> = {
  'cerveza':        'Cervezas',
  'copa de vino':   'Vinos Tintos',
  'refresco':       'Refrescos',
  'agua mineral':   'Refrescos',
  'agua':           'Refrescos',
  'café solo':      'Café e Infusiones',
  'cafe solo':      'Café e Infusiones',
  'café con leche': 'Café e Infusiones',
  'cafe con leche': 'Café e Infusiones',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🍺  Migración de Bebidas — Los Barriles\n');

  // 1. Encontrar categoría "Bebidas" antigua
  const cartaSnap = await getDocs(collection(db, 'carta'));
  const bebidasDoc = cartaSnap.docs.find(d => norm(d.data()['nombre'] as string).includes('bebida'));

  if (!bebidasDoc) {
    console.log('⚠️  No se encontró categoría "Bebidas". ¿Ya fue migrada?\n');
    // Don't abort — still create categories and products if missing
  } else {
    console.log(`✅  Categoría "Bebidas" encontrada: ${bebidasDoc.id}`);
  }

  // 2. Crear las 6 nuevas categorías (solo si no existen ya por nombre)
  const categoriasExistentes = cartaSnap.docs.map(d => ({
    id:     d.id,
    nombre: d.data()['nombre'] as string,
    orden:  d.data()['orden']  as number,
  }));

  const catIdByNombre: Record<string, string> = {};

  for (const def of NUEVAS_CATEGORIAS) {
    const existing = categoriasExistentes.find(c => norm(c.nombre) === norm(def.nombre));
    if (existing) {
      console.log(`   → Categoría "${def.nombre}" ya existe (${existing.id}), actualizando orden…`);
      await updateDoc(doc(db, 'carta', existing.id), { orden: def.orden });
      catIdByNombre[def.nombre] = existing.id;
    } else {
      const ref = await addDoc(collection(db, 'carta'), { nombre: def.nombre, orden: def.orden });
      catIdByNombre[def.nombre] = ref.id;
      console.log(`   ✅  Categoría "${def.nombre}" creada (${ref.id})`);
    }
  }

  // 3. Migrar productos existentes de "Bebidas"
  if (bebidasDoc) {
    const prodSnap = await getDocs(
      query(collection(db, 'productos'), where('categoriaId', '==', bebidasDoc.id)),
    );
    console.log(`\n📦  Productos en Bebidas: ${prodSnap.size}`);

    for (const prodDoc of prodSnap.docs) {
      const nombre    = prodDoc.data()['nombre'] as string;
      const destCat   = MIGRAR_A[norm(nombre)];
      const nuevoCatId = destCat ? catIdByNombre[destCat] : null;

      if (nuevoCatId) {
        // Determine tipoIva from target category
        const catDef = NUEVAS_CATEGORIAS.find(c => c.nombre === destCat);
        const tipoIva = catDef?.productos[0]?.tipoIva ?? 'reducido';

        await updateDoc(prodDoc.ref, {
          categoriaId: nuevoCatId,
          destino:     'barra',
          tipoIva,
        });
        console.log(`   ✅  "${nombre}" → ${destCat}`);
      } else {
        // No mapping found — delete it (will be replaced by new products)
        await deleteDoc(prodDoc.ref);
        console.log(`   🗑️   "${nombre}" eliminado (sin categoría de destino)`);
      }
    }
  }

  // 4. Añadir productos nuevos en cada subcategoría (omitir duplicados por nombre)
  console.log('\n🛒  Añadiendo productos…');

  for (const def of NUEVAS_CATEGORIAS) {
    const catId = catIdByNombre[def.nombre];
    if (!catId) continue;

    // Obtener productos ya existentes en esta categoría
    const existSnap = await getDocs(
      query(collection(db, 'productos'), where('categoriaId', '==', catId)),
    );
    const existingNames = new Set(
      existSnap.docs.map(d => norm(d.data()['nombre'] as string)),
    );

    let added = 0;
    let skipped = 0;

    for (const prod of def.productos) {
      if (existingNames.has(norm(prod.nombre))) {
        skipped++;
        continue;
      }
      await addDoc(collection(db, 'productos'), {
        categoriaId:  catId,
        nombre:       prod.nombre,
        precio:       prod.precio,
        descripcion:  prod.descripcion,
        disponible:   true,
        destino:      'barra' as const,
        tipoIva:      prod.tipoIva,
        controlStock: false,
      });
      added++;
    }
    console.log(`   ${def.nombre}: +${added} nuevos, ${skipped} ya existían`);
  }

  // 5. Eliminar categoría "Bebidas" antigua (si existe y ya no tiene productos)
  if (bebidasDoc) {
    const prodRest = await getDocs(
      query(collection(db, 'productos'), where('categoriaId', '==', bebidasDoc.id)),
    );
    if (prodRest.empty) {
      await deleteDoc(bebidasDoc.ref);
      console.log('\n🗑️   Categoría "Bebidas" eliminada');
    } else {
      console.log(`\n⚠️  Categoría "Bebidas" aún tiene ${prodRest.size} productos sin migrar — no eliminada`);
      prodRest.docs.forEach(d => console.log('     -', d.data()['nombre']));
    }
  }

  // 6. Resumen final
  const finalCartaSnap = await getDocs(collection(db, 'carta'));
  const finalCats = finalCartaSnap.docs
    .map(d => ({ nombre: d.data()['nombre'], orden: d.data()['orden'] }))
    .sort((a, b) => a.orden - b.orden);

  console.log('\n📋  Categorías finales en Firestore:');
  finalCats.forEach(c => console.log(`   ${String(c.orden).padStart(2)}. ${c.nombre}`));

  console.log('\n✅  Migración completada.\n');
  await deleteApp(app);
  process.exit(0);
}

main().catch(e => {
  console.error('\n❌  Error fatal:', e);
  process.exit(1);
});
