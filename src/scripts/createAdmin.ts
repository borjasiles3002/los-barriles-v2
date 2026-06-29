/**
 * Script de un solo uso para crear el primer usuario administrador.
 *
 * Uso en Windows PowerShell:
 *   $env:ADMIN_EMAIL="tu@email.com"; $env:ADMIN_PASSWORD="TuPass123"; npx tsx src/scripts/createAdmin.ts
 */

import 'dotenv/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY             ?? '',
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN         ?? '',
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID          ?? '',
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET      ?? '',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.VITE_FIREBASE_APP_ID              ?? '',
};

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const ADMIN_NOMBRE   = process.env.ADMIN_NOMBRE   ?? 'Admin';
const AUTH_BASE      = 'https://identitytoolkit.googleapis.com/v1/accounts';

async function authPost(endpoint: string, body: object): Promise<string> {
  const res  = await fetch(`${AUTH_BASE}:${endpoint}?key=${firebaseConfig.apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...body, returnSecureToken: true }),
  });
  const data = await res.json() as { localId?: string; error?: { message: string } };
  if (!res.ok || !data.localId) throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  return data.localId;
}

// Devuelve el UID del usuario (creado o ya existente)
async function resolverUID(email: string, password: string): Promise<string> {
  try {
    const uid = await authPost('signUp', { email, password });
    console.log(`✅  Auth — usuario creado. UID: ${uid}`);
    return uid;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (!msg.includes('EMAIL_EXISTS')) {
      if (msg.includes('WEAK_PASSWORD'))   console.error('❌  Contraseña demasiado débil (mínimo 6 caracteres).');
      else if (msg.includes('INVALID_EMAIL')) console.error(`❌  Email inválido: "${email}"`);
      else                                    console.error(`❌  Error Auth: ${msg}`);
      process.exit(1);
    }

    // EMAIL_EXISTS → intentar sign-in para obtener UID
    console.log('ℹ️   El usuario ya existe. Iniciando sesión para obtener UID...');
    try {
      const uid = await authPost('signInWithPassword', { email, password });
      console.log(`✅  Auth — UID obtenido: ${uid}`);
      return uid;
    } catch (signInErr) {
      const signInMsg = signInErr instanceof Error ? signInErr.message : String(signInErr);
      if (signInMsg.includes('INVALID_LOGIN_CREDENTIALS') || signInMsg.includes('INVALID_PASSWORD')) {
        // Enviar email de reset para que el usuario pueda establecer la contraseña deseada
        console.log('\n⚠️   La contraseña no coincide con la cuenta existente.');
        console.log('    Enviando email de restablecimiento de contraseña...\n');
        const resetRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
          },
        );
        if (resetRes.ok) {
          console.log(`📧  Email de reset enviado a: ${email}`);
          console.log('    Pasos:');
          console.log('      1. Abre el email y haz clic en "Restablecer contraseña"');
          console.log('      2. Elige tu nueva contraseña (ej. TuContraseña123)');
          console.log('      3. Vuelve a ejecutar este script con ADMIN_PASSWORD=TuNuevaContraseña\n');
        } else {
          console.log('    Alternativamente: Firebase Console → Authentication → Users');
          console.log('    → busca tu email → icono editar → cambia contraseña\n');
        }
      } else {
        console.error(`❌  No se pudo iniciar sesión: ${signInMsg}`);
      }
      process.exit(1);
    }
  }
}

async function main() {
  console.log('\n=== Crear usuario admin — Los Barriles ===\n');

  if (!firebaseConfig.apiKey) { console.error('❌  VITE_FIREBASE_API_KEY no encontrada en .env'); process.exit(1); }
  if (!ADMIN_EMAIL)           { console.error('❌  ADMIN_EMAIL no proporcionado');                 process.exit(1); }
  if (!ADMIN_PASSWORD)        { console.error('❌  ADMIN_PASSWORD no proporcionado');              process.exit(1); }

  console.log(`   Email:    ${ADMIN_EMAIL}`);
  console.log(`   Nombre:   ${ADMIN_NOMBRE}`);
  console.log(`   Proyecto: ${firebaseConfig.projectId}\n`);

  const uid = await resolverUID(ADMIN_EMAIL, ADMIN_PASSWORD);

  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);

  const existing = await getDoc(doc(db, 'usuarios', uid));
  if (existing.exists()) {
    console.log('ℹ️   Documento ya existe en Firestore — actualizando role a "admin"...');
  }

  await setDoc(doc(db, 'usuarios', uid), {
    uid,
    email:  ADMIN_EMAIL,
    nombre: ADMIN_NOMBRE,
    role:   'admin',
    activo: true,
  });

  console.log(`✅  Firestore — /usuarios/${uid} guardado con role: "admin"`);
  console.log('\n🎉  Admin listo. Ya puedes iniciar sesión en la app.\n');

  await deleteApp(app);
  process.exit(0);
}

main().catch(err => {
  console.error('❌  Error inesperado:', err instanceof Error ? err.message : err);
  process.exit(1);
});
