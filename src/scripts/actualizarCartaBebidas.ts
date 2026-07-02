/**
 * Sustituye todos los productos de las 6 subcategorías de bebidas
 * por la carta real del restaurante Los Barriles.
 *
 * npx tsx src/scripts/actualizarCartaBebidas.ts
 */

import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, addDoc,
  deleteDoc, query, where, doc,
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

type TipoIva  = 'reducido' | 'normal';
type Destino  = 'barra';

interface ProductoDef {
  nombre:      string;
  precio:      number | 'KEEP';   // 'KEEP' = conservar precio existente
  descripcion: string;
  tipoIva:     TipoIva;
}

interface CategoriaConfig {
  nombre:    string;
  tipoIva:   TipoIva;
  productos: ProductoDef[];
}

// ─── Carta real del restaurante ───────────────────────────────────────────────

const CARTA: CategoriaConfig[] = [
  {
    nombre: 'Cervezas',
    tipoIva: 'normal',
    productos: [
      { nombre: 'Caña de Barril',    precio: 2.50, descripcion: 'Cerveza rubia de barril',              tipoIva: 'normal' },
      { nombre: 'Mahou Clásica',     precio: 2.80, descripcion: 'Botellín Mahou Clásica 33cl',          tipoIva: 'normal' },
      { nombre: 'Alcázar',           precio: 2.80, descripcion: 'Botellín Alcázar 33cl',                tipoIva: 'normal' },
      { nombre: 'Heineken',          precio: 2.80, descripcion: 'Botellín Heineken 33cl',               tipoIva: 'normal' },
      { nombre: 'Mahou Tostada 0.0', precio: 2.80, descripcion: 'Mahou Tostada sin alcohol 33cl',      tipoIva: 'normal' },
      { nombre: 'Heineken 0.0',      precio: 2.80, descripcion: 'Heineken sin alcohol 33cl',            tipoIva: 'normal' },
      { nombre: 'Alhambra 1925',     precio: 3.00, descripcion: 'Alhambra Reserva 1925 33cl',           tipoIva: 'normal' },
    ],
  },
  {
    nombre: 'Vinos Tintos',
    tipoIva: 'normal',
    productos: [
      { nombre: 'Tinto de Verano',       precio: 2.80, descripcion: 'Tinto de verano con gaseosa',            tipoIva: 'normal' },
      { nombre: 'Copa Castillo de Aza',  precio: 3.50, descripcion: 'Copa de vino tinto Castillo de Aza',     tipoIva: 'normal' },
      { nombre: 'Copa Ramón Bilbao',     precio: 4.50, descripcion: 'Copa de vino tinto Ramón Bilbao Crianza',tipoIva: 'normal' },
      { nombre: 'Vermú',                 precio: 3.80, descripcion: 'Vermú rojo con naranja y aceituna',       tipoIva: 'normal' },
    ],
  },
  {
    nombre: 'Vinos Blancos',
    tipoIva: 'normal',
    productos: [
      { nombre: 'Copa Solar de la Vega',   precio: 3.50, descripcion: 'Copa de Verdejo Solar de la Vega',     tipoIva: 'normal' },
      { nombre: 'Copa Marqués de Vizhoja', precio: 4.00, descripcion: 'Copa de Albariño Marqués de Vizhoja', tipoIva: 'normal' },
    ],
  },
  {
    nombre: 'Refrescos',
    tipoIva: 'reducido',
    productos: [
      { nombre: 'Coca-Cola',         precio: 2.80, descripcion: 'Coca-Cola lata',              tipoIva: 'reducido' },
      { nombre: 'Coca-Cola Zero',    precio: 2.80, descripcion: 'Coca-Cola Zero lata',         tipoIva: 'reducido' },
      { nombre: 'Coca-Cola Zero Zero', precio: 2.80, descripcion: 'Coca-Cola Zero Zero lata', tipoIva: 'reducido' },
      { nombre: 'Fanta Limón',       precio: 2.80, descripcion: 'Fanta Limón lata',            tipoIva: 'reducido' },
      { nombre: 'Fanta Naranja',     precio: 2.80, descripcion: 'Fanta Naranja lata',          tipoIva: 'reducido' },
      { nombre: 'Sprite',            precio: 2.80, descripcion: 'Sprite lata',                 tipoIva: 'reducido' },
      { nombre: '7UP',               precio: 2.80, descripcion: '7UP lata',                    tipoIva: 'reducido' },
      { nombre: 'Tónica',            precio: 2.80, descripcion: 'Tónica Schweppes lata',       tipoIva: 'reducido' },
      { nombre: 'Aquarius',          precio: 2.80, descripcion: 'Aquarius naranja o limón',    tipoIva: 'reducido' },
      { nombre: 'Nestea Limón',      precio: 2.80, descripcion: 'Nestea sabor limón lata',     tipoIva: 'reducido' },
      { nombre: 'Nestea Maracuyá',   precio: 2.80, descripcion: 'Nestea sabor maracuyá lata',  tipoIva: 'reducido' },
      { nombre: 'Agua con Gas',      precio: 2.80, descripcion: 'Agua con gas 33cl',           tipoIva: 'reducido' },
      { nombre: 'Agua Mineral',      precio: 'KEEP', descripcion: 'Agua mineral natural',      tipoIva: 'reducido' },
    ],
  },
  {
    nombre: 'Café e Infusiones',
    tipoIva: 'reducido',
    productos: [
      { nombre: 'Café Solo',      precio: 1.20, descripcion: 'Espresso',                         tipoIva: 'reducido' },
      { nombre: 'Café Cortado',   precio: 1.30, descripcion: 'Espresso con un poco de leche',    tipoIva: 'reducido' },
      { nombre: 'Café con Leche', precio: 1.50, descripcion: 'Espresso con leche vaporizada',    tipoIva: 'reducido' },
      { nombre: 'Té Rojo',        precio: 1.50, descripcion: 'Infusión de té rojo',              tipoIva: 'reducido' },
      { nombre: 'Té Verde',       precio: 1.50, descripcion: 'Infusión de té verde',             tipoIva: 'reducido' },
      { nombre: 'Manzanilla',     precio: 1.50, descripcion: 'Infusión de manzanilla',           tipoIva: 'reducido' },
      { nombre: 'Poleo Menta',    precio: 1.50, descripcion: 'Infusión de poleo menta',          tipoIva: 'reducido' },
    ],
  },
  {
    nombre: 'Licores',
    tipoIva: 'normal',
    productos: [
      { nombre: 'Combinado Nacional', precio: 6.00, descripcion: 'Combinado con licor nacional a elegir', tipoIva: 'normal' },
      { nombre: 'Combinado Premium',  precio: 8.50, descripcion: 'Combinado con licor premium a elegir',  tipoIva: 'normal' },
    ],
  },
];

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();

async function main() {
  console.log('\n🍺  Actualización carta real de bebidas — Los Barriles\n');

  // 1. Leer todas las categorías de la carta
  const cartaSnap = await getDocs(collection(db, 'carta'));
  const catMap: Record<string, string> = {};
  cartaSnap.docs.forEach(d => {
    catMap[norm(d.data()['nombre'] as string)] = d.id;
  });

  const bebidasCats = CARTA.map(c => c.nombre);
  console.log('🗂️  Categorías de bebidas a actualizar:', bebidasCats.join(', '));

  let totalBorrados = 0;
  let totalCreados  = 0;

  for (const config of CARTA) {
    const catId = catMap[norm(config.nombre)];
    if (!catId) {
      console.log(`⚠️  Categoría "${config.nombre}" no encontrada en Firestore — omitida`);
      continue;
    }

    console.log(`\n── ${config.nombre} (${catId}) ──`);

    // 2. Leer productos existentes en esta categoría
    const existSnap = await getDocs(
      query(collection(db, 'productos'), where('categoriaId', '==', catId)),
    );

    // 3. Guardar precio de "Agua Mineral" si existe (precio: 'KEEP')
    const preciosExistentes: Record<string, number> = {};
    existSnap.docs.forEach(d => {
      preciosExistentes[norm(d.data()['nombre'] as string)] = d.data()['precio'] as number;
    });

    // 4. Borrar todos los productos existentes
    for (const prodDoc of existSnap.docs) {
      await deleteDoc(doc(db, 'productos', prodDoc.id));
    }
    const borrados = existSnap.size;
    totalBorrados += borrados;
    console.log(`   🗑️  Borrados ${borrados} productos anteriores`);

    // 5. Crear los productos nuevos
    let creados = 0;
    for (const prod of config.productos) {
      const precio = prod.precio === 'KEEP'
        ? (preciosExistentes[norm(prod.nombre)] ?? 2.00)
        : prod.precio;

      await addDoc(collection(db, 'productos'), {
        categoriaId:  catId,
        nombre:       prod.nombre,
        precio,
        descripcion:  prod.descripcion,
        disponible:   true,
        destino:      'barra' as Destino,
        tipoIva:      prod.tipoIva,
        controlStock: false,
      });

      const precioLabel = prod.precio === 'KEEP' ? `${precio}€ (conservado)` : `${precio}€`;
      console.log(`   ✅  ${prod.nombre} — ${precioLabel}`);
      creados++;
    }
    totalCreados += creados;
  }

  // 6. Verificación: contar productos por categoría
  console.log('\n📋  Verificación final:');
  let ok = true;
  for (const config of CARTA) {
    const catId = catMap[norm(config.nombre)];
    if (!catId) continue;

    const snap = await getDocs(
      query(collection(db, 'productos'), where('categoriaId', '==', catId)),
    );
    const todos = snap.docs.map(d => ({
      nombre:  d.data()['nombre'] as string,
      precio:  d.data()['precio'] as number,
      destino: d.data()['destino'] as string,
      tipoIva: d.data()['tipoIva'] as string,
    }));

    const todosBarra = todos.every(p => p.destino === 'barra');
    const ivaEsperado = config.tipoIva;
    const ivaOk = todos.every(p => p.tipoIva === ivaEsperado);
    const status = todosBarra && ivaOk ? '✅' : '❌';
    if (!todosBarra || !ivaOk) ok = false;

    console.log(`   ${status}  ${config.nombre}: ${todos.length} productos — destino barra: ${todosBarra} — IVA ${ivaEsperado}: ${ivaOk}`);
    todos.forEach(p => {
      const d = p.destino !== 'barra' ? ' ⚠️ destino!' : '';
      const v = p.tipoIva !== ivaEsperado ? ' ⚠️ IVA!' : '';
      console.log(`        · ${p.nombre.padEnd(30)} ${String(p.precio).padStart(5)}€${d}${v}`);
    });
  }

  console.log(`\n📊  Total: ${totalBorrados} borrados, ${totalCreados} creados`);
  console.log(ok ? '\n✅  Carta actualizada correctamente.\n' : '\n❌  Hay errores — revisa arriba.\n');

  await deleteApp(app);
  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('\n❌  Error fatal:', e);
  process.exit(1);
});
