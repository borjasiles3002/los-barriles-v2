/**
 * Migración única: asigna el campo destino a los productos existentes en Firestore.
 * Detecta la categoría por nombre y asigna barra/cocina.
 *
 * npx tsx src/scripts/migrarDestinos.ts
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

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// Categorías que van a barra (el resto va a cocina)
const CATEGORIAS_BARRA = ['bebidas', 'cervezas', 'vinos', 'cafés', 'cafes', 'refrescos'];

async function main() {
  console.log('\n=== Migración destinos — Los Barriles ===');
  console.log(`   Proyecto: ${firebaseConfig.projectId}\n`);

  // 1. Leer categorías para saber el nombre de cada una
  const cartaSnap = await getDocs(collection(db, 'carta'));
  const categoriaPorId: Record<string, string> = {};
  cartaSnap.docs.forEach(d => {
    categoriaPorId[d.id] = (d.data()['nombre'] as string ?? '').toLowerCase();
  });
  console.log(`📋  ${cartaSnap.size} categorías leídas.`);

  // 2. Leer productos
  const prodSnap = await getDocs(collection(db, 'productos'));
  console.log(`🍽️   ${prodSnap.size} productos leídos.`);

  let actualizados = 0;
  let omitidos     = 0;

  // 3. Actualizar en batches de 499
  let batch = writeBatch(db);
  let opsEnBatch = 0;

  for (const d of prodSnap.docs) {
    const data = d.data();

    // Si ya tiene destino, no tocar
    if (data['destino']) {
      omitidos++;
      continue;
    }

    const nombreCat = categoriaPorId[data['categoriaId'] as string] ?? '';
    const esBarra   = CATEGORIAS_BARRA.some(c => nombreCat.includes(c));
    const destino   = esBarra ? 'barra' : 'cocina';

    batch.update(doc(db, 'productos', d.id), { destino });
    actualizados++;
    opsEnBatch++;

    if (opsEnBatch >= 499) {
      await batch.commit();
      console.log(`   Batch de ${opsEnBatch} operaciones commiteado.`);
      batch = writeBatch(db);
      opsEnBatch = 0;
    }
  }

  if (opsEnBatch > 0) {
    await batch.commit();
  }

  console.log(`\n✅  Migración completada:`);
  console.log(`    - ${actualizados} productos actualizados con campo destino`);
  console.log(`    - ${omitidos} productos ya tenían destino (no modificados)\n`);

  await deleteApp(app);
  process.exit(0);
}

main().catch(err => {
  console.error('❌  Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
