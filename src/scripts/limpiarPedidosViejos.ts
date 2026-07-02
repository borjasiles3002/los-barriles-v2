/**
 * Limpieza inicial: cierra pedidos abiertos/en_cocina y libera sus mesas.
 *
 * npx tsx src/scripts/limpiarPedidosViejos.ts
 */

import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getFirestore, collection, getDocs, query, where,
  writeBatch, doc,
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

async function main() {
  console.log('\n=== Limpieza pedidos viejos — Los Barriles ===');
  console.log(`   Proyecto: ${firebaseConfig.projectId}\n`);

  // 1. Buscar pedidos abiertos o en_cocina
  const snap = await getDocs(
    query(collection(db, 'pedidos'), where('estado', 'in', ['abierto', 'en_cocina'])),
  );

  if (snap.empty) {
    console.log('✅  No hay pedidos abiertos o en_cocina. Nada que limpiar.\n');
    await deleteApp(app);
    process.exit(0);
  }

  console.log(`🔍  ${snap.size} pedido(s) encontrado(s) para cerrar:\n`);

  const mesasAfectadas = new Set<string>();
  const ahora = new Date().toISOString();

  // Procesar en batches de 499 (límite Firestore)
  let batch = writeBatch(db);
  let opsEnBatch = 0;
  let pedidosCerrados = 0;

  const flushBatch = async () => {
    if (opsEnBatch > 0) {
      await batch.commit();
      batch = writeBatch(db);
      opsEnBatch = 0;
    }
  };

  for (const d of snap.docs) {
    const data = d.data();
    const mesaId    = data['mesaId']    as string | undefined;
    const mesaNombre = data['mesaNombre'] as string | 'desconocida';
    const estado    = data['estado']    as string;
    const total     = data['total']     as number ?? 0;

    console.log(`   • Pedido ${d.id.slice(0, 8)}… | ${mesaNombre} | estado: ${estado} | total: ${total.toFixed(2)}€`);

    // Cerrar pedido
    batch.update(doc(db, 'pedidos', d.id), {
      estado:    'cancelado',
      closedAt:  ahora,
      notaCierre: 'limpieza inicial sistema',
    });
    opsEnBatch++;
    pedidosCerrados++;

    // Liberar mesa asociada
    if (mesaId) {
      mesasAfectadas.add(mesaId);
      batch.update(doc(db, 'mesas', mesaId), {
        estado:       'libre',
        pedidoActivo: null,
        comensales:   null,
      });
      opsEnBatch++;
    }

    if (opsEnBatch >= 498) await flushBatch();
  }

  await flushBatch();

  console.log(`\n✅  Limpieza completada:`);
  console.log(`    - ${pedidosCerrados} pedido(s) marcados como "cancelado"`);
  console.log(`    - ${mesasAfectadas.size} mesa(s) liberadas\n`);

  await deleteApp(app);
  process.exit(0);
}

main().catch(err => {
  console.error('❌  Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
