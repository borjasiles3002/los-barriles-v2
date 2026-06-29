/**
 * Script de un solo uso para crear el primer usuario administrador.
 *
 * Uso:
 *   ADMIN_EMAIL=tu@email.com ADMIN_PASSWORD=TuPass123 npx tsx src/scripts/createAdmin.ts
 *
 * En Windows PowerShell:
 *   $env:ADMIN_EMAIL="tu@email.com"; $env:ADMIN_PASSWORD="TuPass123"; npx tsx src/scripts/createAdmin.ts
 */

import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// ─── Config ───────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY            ?? '',
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN        ?? '',
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID         ?? '',
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET     ?? '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.VITE_FIREBASE_APP_ID             ?? '',
};

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const ADMIN_NOMBRE   = process.env.ADMIN_NOMBRE   ?? 'Admin';

// ─── Crear usuario en Firebase Auth via REST API ──────────────────────────────
// Usamos la REST API directamente para evitar dependencias de browser en Node.js

async function crearUsuarioAuth(email: string, password: string): Promise<string> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ email, password, returnSecureToken: true }),
  });

  const data = await res.json() as {
    localId?: string;
    error?:   { message: string };
  };

  if (!res.ok || !data.localId) {
    throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  }

  return data.localId; // UID del usuario creado
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Crear usuario admin — Los Barriles ===\n');

  // Validaciones
  if (!firebaseConfig.apiKey) {
    console.error('❌  VITE_FIREBASE_API_KEY no encontrada.');
    console.error('    Asegúrate de que existe el archivo .env con los valores de Firebase.\n');
    process.exit(1);
  }
  if (!ADMIN_EMAIL) {
    console.error('❌  ADMIN_EMAIL no proporcionado.');
    console.error('    Ejecútalo con: ADMIN_EMAIL=tu@email.com ADMIN_PASSWORD=... npx tsx src/scripts/createAdmin.ts\n');
    process.exit(1);
  }
  if (!ADMIN_PASSWORD) {
    console.error('❌  ADMIN_PASSWORD no proporcionado.\n');
    process.exit(1);
  }
  if (ADMIN_PASSWORD.length < 6) {
    console.error('❌  La contraseña debe tener mínimo 6 caracteres.\n');
    process.exit(1);
  }

  console.log(`   Email:   ${ADMIN_EMAIL}`);
  console.log(`   Nombre:  ${ADMIN_NOMBRE}`);
  console.log(`   Proyecto: ${firebaseConfig.projectId}\n`);

  // 1. Crear en Firebase Auth
  let uid: string;
  try {
    uid = await crearUsuarioAuth(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log(`✅  Auth — usuario creado. UID: ${uid}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('EMAIL_EXISTS')) {
      console.error('❌  Ya existe un usuario con ese email en Firebase Auth.');
      console.error('    Si ya tienes la cuenta y solo quieres actualizar el rol,');
      console.error('    ve a Firestore Console → /usuarios/{uid} y cambia role a "admin".\n');
    } else if (msg.includes('WEAK_PASSWORD')) {
      console.error('❌  Contraseña demasiado débil. Usa al menos 6 caracteres con letras y números.\n');
    } else if (msg.includes('INVALID_EMAIL')) {
      console.error(`❌  Email inválido: "${ADMIN_EMAIL}"\n`);
    } else {
      console.error(`❌  Error en Firebase Auth: ${msg}\n`);
    }
    process.exit(1);
  }

  // 2. Guardar en Firestore /usuarios/{uid}
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);

  // Comprobar si ya existe el documento (por si se ejecuta dos veces)
  const existing = await getDoc(doc(db, 'usuarios', uid));
  if (existing.exists()) {
    console.log('⚠️   El documento /usuarios/{uid} ya existe. Actualizando role a "admin"...');
  }

  await setDoc(doc(db, 'usuarios', uid), {
    uid,
    email:  ADMIN_EMAIL,
    nombre: ADMIN_NOMBRE,
    role:   'admin',
    activo: true,
  });

  console.log(`✅  Firestore — /usuarios/${uid} guardado`);
  console.log('\n🎉  Admin creado correctamente. Ya puedes iniciar sesión en la app.\n');

  await deleteApp(app);
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌  Error inesperado:', err instanceof Error ? err.message : err, '\n');
  process.exit(1);
});
