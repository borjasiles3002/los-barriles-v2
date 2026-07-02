/**
 * Seed carta real de Los Barriles.
 * 1. Borra todas las categorías (/carta) y productos (/productos) existentes.
 * 2. Crea la carta real con categorías, destinos y precios reales.
 *
 * npx tsx src/scripts/seedCarta.ts
 */

import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, writeBatch, doc,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY             ?? '',
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN         ?? '',
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID          ?? '',
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET      ?? '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.VITE_FIREBASE_APP_ID              ?? '',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ─── Carta real Los Barriles ──────────────────────────────────────────────────

interface ProductoSeed {
  nombre:      string;
  precio:      number;
  descripcion: string;
}

interface CategoriaSeed {
  nombre:    string;
  orden:     number;
  destino:   'cocina' | 'barra';
  productos: ProductoSeed[];
}

const CARTA: CategoriaSeed[] = [
  {
    nombre:  'De la Huerta y el Frío',
    orden:   1,
    destino: 'cocina',
    productos: [
      { nombre: 'Ensalada "Huerta de Segura" al Rescoldo', precio: 14.50, descripcion: 'Verduras de temporada asadas al rescoldo con vinagreta de la huerta' },
      { nombre: 'Cogollos Quemados y Queso de Cabra',      precio: 15.50, descripcion: 'Cogollos a la llama con queso de cabra cremoso y reducción de Pedro Ximénez' },
      { nombre: 'Tiradito de Corvina Premium',             precio: 17.50, descripcion: 'Corvina fresca marinada al estilo peruano con leche de tigre y ají amarillo' },
      { nombre: 'Tartar de Fuet Tradición',                precio: 14.00, descripcion: 'Tartar de fuet artesano con encurtidos, mostaza antigua y pan de masa madre' },
    ],
  },
  {
    nombre:  'Para Compartir y Pecar',
    orden:   2,
    destino: 'cocina',
    productos: [
      { nombre: 'Plato de Jamón Ibérico',             precio: 24.00, descripcion: 'Jamón ibérico de bellota cortado a mano · Mitad 14,00€' },
      { nombre: 'Bravas con Torreznos de Soria',      precio: 13.00, descripcion: 'Patatas bravas crujientes con torreznos de Soria y salsa picante de la casa' },
      { nombre: 'Croquetas Cremosas de la Casa',      precio: 12.50, descripcion: 'Croquetas de jamón ibérico con bechamel cremosa (6 uds)' },
      { nombre: 'Brioche de Panceta Glaseada',        precio: 15.00, descripcion: 'Brioche artesano con panceta glaseada al horno, rúcula y queso ahumado' },
      { nombre: 'Chanquetes con Huevos de Corral',    precio: 15.50, descripcion: 'Chanquetes fritos con huevos estrellados de corral y ali-oli de ajo negro' },
      { nombre: 'Mejillones al Curry Rojo Thai',      precio: 16.00, descripcion: 'Mejillones gallegos al vapor con salsa de curry rojo thai y leche de coco' },
      { nombre: 'Puerros Confitados y Carbonizados',  precio: 13.50, descripcion: 'Puerros confitados a baja temperatura, terminados a la brasa con romesco' },
      { nombre: 'Milhojas de Bacalao Desmigado',      precio: 16.50, descripcion: 'Milhojas de bacalao desalado con pisto casero, pimentón de la Vera y aceite de oliva virgen extra' },
    ],
  },
  {
    nombre:  'Fuego y Brasas',
    orden:   3,
    destino: 'cocina',
    productos: [
      { nombre: 'Pollo Jerk "Los Barriles" (Sous-Vide)',  precio: 19.00, descripcion: 'Pollo marinado en especias jamaicanas, cocción sous-vide y terminado a la brasa' },
      { nombre: 'Trucha de la Sierra al Horno',           precio: 22.00, descripcion: 'Trucha del río Segura al horno con hierbas aromáticas, ajo y aceite de oliva' },
      { nombre: 'Lomo de Bacalao Premium "Gran Grosor"',  precio: 24.95, descripcion: 'Lomo de bacalao de gran grosor confitado a baja temperatura con pil pil artesano' },
      { nombre: 'Picaña de Vaca Premium a la Brasa',      precio: 23.50, descripcion: 'Picaña de vaca nacional madurada, brasa de leña y chimichurri de la casa' },
      { nombre: 'Costillar BBQ "Chupadedos"',             precio: 24.00, descripcion: 'Costillar de cerdo ibérico caramelizado con salsa BBQ artesana · Mitad 15,00€' },
      { nombre: 'Codillo al Horno Tradición',             precio: 21.00, descripcion: 'Codillo de cerdo al horno durante 8 horas con caldo de verduras y mostaza' },
      { nombre: 'Lubina a la Brasa de Olivo',             precio: 22.00, descripcion: 'Lubina salvaje a la brasa de sarmientos de olivo con ensalada de hinojo y cítricos' },
    ],
  },
  {
    nombre:  'El Dulce Final',
    orden:   4,
    destino: 'cocina',
    productos: [
      { nombre: 'Torrija de Pan Brioche y Helado',                    precio: 7.50, descripcion: 'Torrija de pan brioche caramelizada con helado de vainilla artesano' },
      { nombre: 'Tarta de Queso Fluida Sierra de Segura',             precio: 7.50, descripcion: 'Tarta de queso fresco de la Sierra de Segura con coulis de frutos del bosque' },
      { nombre: 'Tiramisú Artesano con Mascarpone Zanetti',           precio: 7.50, descripcion: 'Tiramisú clásico artesano con mascarpone Zanetti y café espresso' },
      { nombre: 'Tarta Tres Chocolates "Los Barriles"',               precio: 7.00, descripcion: 'Tarta de tres chocolates de la casa: negro, con leche y blanco' },
    ],
  },
  {
    nombre:  'Bebidas',
    orden:   5,
    destino: 'barra',
    productos: [
      { nombre: 'Agua Mineral',    precio: 2.00, descripcion: 'Agua mineral natural o con gas' },
      { nombre: 'Refresco',        precio: 2.50, descripcion: 'Coca-Cola, Fanta, Aquarius u otros' },
      { nombre: 'Cerveza',         precio: 2.50, descripcion: 'Caña de cerveza rubia de barril, 25cl' },
      { nombre: 'Copa de Vino',    precio: 3.50, descripcion: 'Vino tinto, blanco o rosado de la casa' },
      { nombre: 'Café Solo',       precio: 1.50, descripcion: 'Espresso doble' },
      { nombre: 'Café con Leche',  precio: 1.80, descripcion: 'Espresso con leche vaporizada' },
    ],
  },
];

// ─── Helper: borrar colección en batches ──────────────────────────────────────

async function borrarColeccion(nombre: string): Promise<number> {
  const snap = await getDocs(collection(db, nombre));
  if (snap.empty) return 0;

  let batch = writeBatch(db);
  let ops = 0;
  let total = 0;

  for (const d of snap.docs) {
    batch.delete(d.ref);
    ops++;
    total++;
    if (ops >= 499) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return total;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   Seed Carta Real — Los Barriles             ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`   Proyecto: ${firebaseConfig.projectId}\n`);

  // ── 1. Borrar datos existentes ─────────────────────────────────────────────
  console.log('🗑️   Borrando carta existente...');
  const prodBorrados  = await borrarColeccion('productos');
  const catBorradas   = await borrarColeccion('carta');
  console.log(`    ✅  ${catBorradas} categoría(s) y ${prodBorrados} producto(s) eliminados.\n`);

  // ── 2. Crear nueva carta ───────────────────────────────────────────────────
  console.log('🍽️   Creando carta real...\n');

  let totalCats  = 0;
  let totalProds = 0;

  for (const cat of CARTA) {
    // Crear categoría
    const catRef = doc(collection(db, 'carta'));
    const catBatch = writeBatch(db);
    catBatch.set(catRef, { nombre: cat.nombre, orden: cat.orden, destino: cat.destino });

    // Crear productos de esta categoría en el mismo batch
    for (const prod of cat.productos) {
      const prodRef = doc(collection(db, 'productos'));
      catBatch.set(prodRef, {
        categoriaId:  catRef.id,
        nombre:       prod.nombre,
        precio:       prod.precio,
        descripcion:  prod.descripcion,
        disponible:   true,
        destino:      cat.destino,
        tipoIva:      'reducido',
      });
    }

    await catBatch.commit();

    const destLabel = cat.destino === 'barra' ? '🍺 Barra' : '🍳 Cocina';
    console.log(`   ${destLabel}  ${cat.nombre}`);
    cat.productos.forEach(p => {
      console.log(`          • ${p.nombre.padEnd(50, ' ')} ${p.precio.toFixed(2)}€`);
    });
    console.log();

    totalCats++;
    totalProds += cat.productos.length;
  }

  // ── 3. Resumen ─────────────────────────────────────────────────────────────
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   Resumen de lo creado                       ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`   Categorías : ${totalCats}`);
  console.log(`   Productos  : ${totalProds}`);
  console.log(`   Destinos   : cocina (${CARTA.filter(c => c.destino === 'cocina').flatMap(c => c.productos).length} platos) · barra (${CARTA.filter(c => c.destino === 'barra').flatMap(c => c.productos).length} bebidas)`);
  console.log(`   IVA        : reducido (10%) en todos los productos`);
  console.log(`   Estado     : disponible: true en todos\n`);
  console.log('✅  Carta creada. La app ya tiene la carta real de Los Barriles.\n');

  await deleteApp(app);
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌  Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
