/**
 * Script de seed — inicializa mesas, categorías y productos en Firestore.
 * Ejecutar UNA SOLA VEZ en un proyecto nuevo.
 *
 * npx tsx src/scripts/seed.ts
 */

import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, writeBatch, doc } from 'firebase/firestore';

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

// ─── MESAS ────────────────────────────────────────────────────────────────────

const MESAS = [
  ...Array.from({ length: 20 }, (_, i) => ({
    numero: i + 1,
    nombre: `Mesa ${i + 1}`,
    estado: 'libre',
  })),
  { numero: 21, nombre: 'Terraza 1', estado: 'libre' },
  { numero: 22, nombre: 'Terraza 2', estado: 'libre' },
  { numero: 23, nombre: 'Barra',     estado: 'libre' },
];

// ─── CATEGORÍAS ───────────────────────────────────────────────────────────────

const CATEGORIAS = [
  { nombre: 'Entrantes',  orden: 1 },
  { nombre: 'Ensaladas',  orden: 2 },
  { nombre: 'Carnes',     orden: 3 },
  { nombre: 'Pescados',   orden: 4 },
  { nombre: 'Arroces',    orden: 5 },
  { nombre: 'Postres',    orden: 6 },
  { nombre: 'Bebidas',    orden: 7 },
  { nombre: 'Cervezas',   orden: 8 },
  { nombre: 'Vinos',      orden: 9 },
];

// ─── PRODUCTOS (por nombre de categoría) ─────────────────────────────────────

const PRODUCTOS: Record<string, { nombre: string; precio: number; descripcion: string }[]> = {
  Entrantes: [
    { nombre: 'Croquetas de jamón ibérico',  precio: 8.50,  descripcion: 'Ración de 8 croquetas caseras con jamón ibérico' },
    { nombre: 'Patatas bravas',              precio: 6.50,  descripcion: 'Con salsa brava y alioli' },
    { nombre: 'Jamón ibérico de bellota',    precio: 18.00, descripcion: 'Tabla de jamón ibérico 100% bellota, 80 g' },
    { nombre: 'Boquerones en vinagre',       precio: 8.00,  descripcion: 'Marinados en vinagre de Jerez con ajo y perejil' },
  ],
  Ensaladas: [
    { nombre: 'Ensalada mixta',              precio: 7.00,  descripcion: 'Lechuga, tomate, cebolla, aceitunas y atún' },
    { nombre: 'Ensalada César',              precio: 10.50, descripcion: 'Romana, pollo a la plancha, parmesano y croutons' },
    { nombre: 'Ensalada de queso de cabra',  precio: 11.00, descripcion: 'Mezclum, nueces, queso de cabra gratinado y miel' },
    { nombre: 'Gazpacho andaluz',            precio: 6.50,  descripcion: 'Gazpacho tradicional con guarnición' },
  ],
  Carnes: [
    { nombre: 'Entrecot de ternera',         precio: 22.00, descripcion: '300 g de entrecot con guarnición a elegir' },
    { nombre: 'Secreto ibérico a la brasa',  precio: 19.50, descripcion: 'Secreto de cerdo ibérico con patatas y pimientos' },
    { nombre: 'Pollo al ajillo',             precio: 14.00, descripcion: 'Pollo de corral con ajo, vino blanco y romero' },
    { nombre: 'Chuletón de buey 400 g',      precio: 34.00, descripcion: 'Chuletón madurado 21 días, con patatas panaderas' },
  ],
  Pescados: [
    { nombre: 'Merluza a la plancha',        precio: 18.00, descripcion: 'Lomo de merluza con verduras salteadas' },
    { nombre: 'Bacalao al pil-pil',          precio: 21.00, descripcion: 'Bacalao confitado con salsa pil-pil tradicional' },
    { nombre: 'Lubina al horno',             precio: 23.00, descripcion: 'Lubina entera al horno con patatas y tomate' },
    { nombre: 'Gambas al ajillo',            precio: 16.50, descripcion: 'Gambas frescas con aceite, ajo y guindilla' },
  ],
  Arroces: [
    { nombre: 'Paella valenciana',           precio: 17.00, descripcion: 'Pollo, conejo, judía verde y garrofó (mín. 2 personas, precio por persona)' },
    { nombre: 'Arroz negro',                 precio: 18.00, descripcion: 'Con sepia, gambas y alioli (mín. 2 personas, precio por persona)' },
    { nombre: 'Arroz a banda',               precio: 17.00, descripcion: 'Arroz meloso con pescado y alioli (mín. 2 personas, precio por persona)' },
    { nombre: 'Fideuá',                      precio: 16.00, descripcion: 'Fideos con marisco y alioli (mín. 2 personas, precio por persona)' },
  ],
  Postres: [
    { nombre: 'Tarta de queso',              precio: 7.00,  descripcion: 'Tarta de queso vasca con coulis de frutos rojos' },
    { nombre: 'Crema catalana',              precio: 6.00,  descripcion: 'Crema catalana tradicional con azúcar quemado' },
    { nombre: 'Coulant de chocolate',        precio: 7.50,  descripcion: 'Bizcocho tibio de chocolate negro con helado de vainilla' },
    { nombre: 'Helado artesano',             precio: 5.50,  descripcion: '3 bolas a elegir: vainilla, chocolate, fresa o limón' },
  ],
  Bebidas: [
    { nombre: 'Agua mineral 50 cl',          precio: 2.00,  descripcion: 'Agua mineral natural o con gas' },
    { nombre: 'Agua mineral 1 L',            precio: 3.00,  descripcion: 'Agua mineral natural o con gas' },
    { nombre: 'Refresco',                    precio: 3.00,  descripcion: 'Coca-Cola, Fanta naranja, Fanta limón o Nestea' },
    { nombre: 'Zumo de naranja natural',     precio: 4.00,  descripcion: 'Zumo exprimido al momento' },
  ],
  Cervezas: [
    { nombre: 'Caña',                        precio: 2.50,  descripcion: 'Cerveza de grifo, 25 cl' },
    { nombre: 'Jarra de cerveza',            precio: 4.50,  descripcion: 'Cerveza de grifo, 50 cl' },
    { nombre: 'Cerveza sin gluten',          precio: 3.50,  descripcion: 'Botella 33 cl' },
    { nombre: 'Cerveza artesana IPA',        precio: 5.00,  descripcion: 'Botella 33 cl, elaboración local' },
  ],
  Vinos: [
    { nombre: 'Vino de la casa (copa)',       precio: 3.00,  descripcion: 'Tinto, blanco o rosado de la casa' },
    { nombre: 'Ribera del Duero Crianza',     precio: 20.00, descripcion: 'Botella 75 cl, D.O. Ribera del Duero' },
    { nombre: 'Rioja Reserva',               precio: 22.00, descripcion: 'Botella 75 cl, D.O.Ca. Rioja' },
    { nombre: 'Albariño',                    precio: 21.00, descripcion: 'Botella 75 cl, D.O. Rías Baixas' },
  ],
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function coleccionVacia(nombre: string): Promise<boolean> {
  const snap = await getDocs(collection(db, nombre));
  return snap.empty;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Seed — Los Barriles ===');
  console.log(`   Proyecto: ${firebaseConfig.projectId}\n`);

  // ── Mesas ──────────────────────────────────────────────────────────────────
  if (await coleccionVacia('mesas')) {
    console.log('🪑  Creando mesas...');
    const batch = writeBatch(db);
    for (const mesa of MESAS) {
      batch.set(doc(collection(db, 'mesas')), mesa);
    }
    await batch.commit();
    console.log(`    ✅  ${MESAS.length} mesas creadas.`);
  } else {
    console.log('    ⏭️   Mesas ya existen — omitiendo.');
  }

  // ── Categorías + Productos ─────────────────────────────────────────────────
  if (await coleccionVacia('carta')) {
    console.log('\n📋  Creando categorías y productos...');
    let totalProductos = 0;

    for (const cat of CATEGORIAS) {
      const catRef = await addDoc(collection(db, 'carta'), cat);
      const prods  = PRODUCTOS[cat.nombre] ?? [];

      const batch = writeBatch(db);
      for (const p of prods) {
        batch.set(doc(collection(db, 'productos')), {
          categoriaId:  catRef.id,
          nombre:       p.nombre,
          precio:       p.precio,
          descripcion:  p.descripcion,
          disponible:   true,
        });
      }
      await batch.commit();
      console.log(`    ✅  ${cat.nombre} (${prods.length} productos)`);
      totalProductos += prods.length;
    }

    console.log(`\n    Total: ${CATEGORIAS.length} categorías, ${totalProductos} productos.`);
  } else {
    console.log('\n    ⏭️   Carta ya existe — omitiendo.');
  }

  console.log('\n🎉  Seed completado. La app está lista para usar.\n');

  await deleteApp(app);
  process.exit(0);
}

main().catch(err => {
  console.error('❌  Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
