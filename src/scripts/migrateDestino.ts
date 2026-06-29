/**
 * Migración: añade campo "destino" a todos los productos existentes
 * basándose en el nombre de la categoría.
 *
 * Ejecutar UNA SOLA VEZ:
 *   npx tsx src/scripts/migrateDestino.ts
 */

import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY             ?? '',
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN         ?? '',
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID          ?? '',
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET      ?? '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.VITE_FIREBASE_APP_ID              ?? '',
};

// Categorías que van a la barra (bebidas, cervezas, vinos, cafés, etc.)
const NOMBRES_BARRA = ['bebidas', 'cervezas', 'vinos', 'cafés', 'cafes', 'licores', 'refrescos'];
// Categorías que van a ambos sitios (postres que pueden ser fríos)
const NOMBRES_AMBOS = ['postres'];

function resolverDestino(nombreCategoria: string): 'barra' | 'cocina' | 'ambos' {
  const n = nombreCategoria.toLowerCase().trim();
  if (NOMBRES_BARRA.some(b => n.includes(b))) return 'barra';
  if (NOMBRES_AMBOS.some(a => n.includes(a))) return 'ambos';
  return 'cocina';
}

async function main() {
  console.log('\n=== Migración destino — Los Barriles ===\n');
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);

  // Cargar categorías
  const catSnap = await getDocs(collection(db, 'carta'));
  const catMap: Record<string, string> = {};
  catSnap.docs.forEach(d => { catMap[d.id] = (d.data() as { nombre: string }).nombre; });
  console.log(`   Categorías cargadas: ${catSnap.size}`);

  // Cargar productos
  const prodSnap = await getDocs(collection(db, 'productos'));
  console.log(`   Productos a migrar:  ${prodSnap.size}\n`);

  const batch = writeBatch(db);
  let count = 0;

  prodSnap.docs.forEach(d => {
    const data = d.data() as { categoriaId: string; nombre: string; destino?: string };
    if (data.destino) return; // ya migrado

    const catNombre = catMap[data.categoriaId] ?? '';
    const destino   = resolverDestino(catNombre);

    batch.update(doc(db, 'productos', d.id), { destino });
    console.log(`   ${data.nombre.padEnd(35)} → ${destino}  (${catNombre})`);
    count++;
  });

  if (count === 0) {
    console.log('   ✅  Todos los productos ya tienen "destino". Nada que migrar.\n');
  } else {
    await batch.commit();
    console.log(`\n✅  ${count} productos actualizados.\n`);
  }

  await deleteApp(app);
  process.exit(0);
}

main().catch(err => {
  console.error('❌  Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
