/**
 * Script de alta de trabajadores para Los Barriles.
 * Uso: npx tsx src/scripts/crearTrabajadores.ts
 */

import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, query, where,
  getDocs, setDoc, doc, updateDoc,
} from 'firebase/firestore';

// ─── Firebase ─────────────────────────────────────────────────────────────────

const app = initializeApp({
  apiKey:            process.env.VITE_FIREBASE_API_KEY!,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.VITE_FIREBASE_APP_ID!,
});
const db = getFirestore(app);

// ─── Utils ────────────────────────────────────────────────────────────────────

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generarPins(n: number): string[] {
  const pins = new Set<string>();
  while (pins.size < n) {
    pins.add(String(Math.floor(1000 + Math.random() * 9000)));
  }
  return [...pins];
}

async function crearAuthUsuario(email: string, password: string): Promise<string> {
  const res  = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.VITE_FIREBASE_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const data = await res.json() as { localId?: string; error?: { message: string } };
  if (!res.ok || !data.localId) throw new Error(data.error?.message ?? 'Error Auth');
  return data.localId;
}

async function buscarUidEnFirestore(email: string): Promise<string | null> {
  const snap = await getDocs(query(collection(db, 'usuarios'), where('email', '==', email)));
  return snap.empty ? null : snap.docs[0].id;
}

// ─── Definición de trabajadores ───────────────────────────────────────────────

const [pinSiham, pinKhadi, pinMalika, pinNadia, pinYerai] = generarPins(5);

type Role = 'gerente' | 'cocinero' | 'camarero';

const TRABAJADORES: { nombre: string; email: string; password: string; pin: string; role: Role }[] = [
  { nombre: 'Siham',  email: 'siham@losbarriles.app',  password: 'Siham2026!',  pin: pinSiham,  role: 'cocinero' },
  { nombre: 'Khadi',  email: 'khadi@losbarriles.app',  password: 'Khadi2026!',  pin: pinKhadi,  role: 'cocinero' },
  { nombre: 'Malika', email: 'malika@losbarriles.app', password: 'Malika2026!', pin: pinMalika, role: 'cocinero' },
  { nombre: 'Nadia',  email: 'nadia@losbarriles.app',  password: 'Nadia2026!',  pin: pinNadia,  role: 'camarero' },
  { nombre: 'Yerai',  email: 'yerai@losbarriles.app',  password: 'Yerai2026!',  pin: pinYerai,  role: 'camarero' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🍺  Alta de trabajadores — Los Barriles\n');

  // 1. Borja: asegurar que su rol es gerente
  const adminEmail = process.env.VITE_ADMIN_EMAIL;
  if (adminEmail) {
    const uid = await buscarUidEnFirestore(adminEmail);
    if (uid) {
      await updateDoc(doc(db, 'usuarios', uid), { role: 'gerente' });
      console.log(`✅  Borja (${adminEmail}) → rol actualizado a gerente\n`);
    } else {
      console.log(`⚠️   Borja no encontrado en Firestore (${adminEmail}). Inicia sesión una vez para que se cree su perfil.\n`);
    }
  }

  // 2. Crear / actualizar cada trabajador
  const resultados: { nombre: string; email: string; password: string; pin: string; role: string; ok: boolean; nota: string }[] = [];

  for (const w of TRABAJADORES) {
    process.stdout.write(`   ${w.nombre.padEnd(8)} `);

    let uid: string | null = await buscarUidEnFirestore(w.email);
    let nota = '';

    if (uid) {
      nota = 'ya existía';
      process.stdout.write('(ya existe en Firestore, actualizando...) ');
    } else {
      try {
        uid = await crearAuthUsuario(w.email, w.password);
        process.stdout.write('Auth ✓ → Firestore ');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('EMAIL_EXISTS')) {
          // Auth existe pero sin doc Firestore → no podemos recuperar el uid sin Admin SDK
          console.log(`⚠️  email ya existe en Auth pero no en Firestore. Omitiendo.`);
          resultados.push({ ...w, role: w.role, ok: false, nota: 'EMAIL_EXISTS en Auth, sin doc Firestore' });
          continue;
        }
        console.log(`❌  ${msg}`);
        resultados.push({ ...w, role: w.role, ok: false, nota: msg });
        continue;
      }
    }

    try {
      const pinHash = await hashPin(w.pin);
      await setDoc(doc(db, 'usuarios', uid), {
        uid,
        email:     w.email,
        nombre:    w.nombre,
        apellidos: '',
        telefono:  '',
        role:      w.role,
        pinHash,
        activo:    true,
        fechaAlta: new Date().toISOString(),
        avatar:    w.nombre[0].toUpperCase(),
      }, { merge: true });
      console.log(`✅  ${nota}`);
      resultados.push({ ...w, role: w.role, ok: true, nota: nota || 'creado' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`❌  Firestore: ${msg}`);
      resultados.push({ ...w, role: w.role, ok: false, nota: msg });
    }
  }

  // 3. Tabla de credenciales
  const sep = '─'.repeat(77);
  console.log(`\n${sep}`);
  console.log('  CREDENCIALES PARA ENTREGAR A CADA TRABAJADOR');
  console.log(sep);
  console.log('  Nombre   Email                       Contraseña     PIN   Rol');
  console.log(sep);

  for (const r of resultados) {
    const rolLabel = r.role === 'cocinero' ? 'cocinero/a' : r.role === 'camarero' ? 'camarero/a' : r.role;
    const ok = r.ok ? '✅' : '❌';
    console.log(
      `${ok} ${r.nombre.padEnd(8)} ${r.email.padEnd(27)} ${r.password.padEnd(14)} ${r.pin}  ${rolLabel}`,
    );
  }

  console.log(sep);
  console.log('\n  ⚠️  Guarda estos datos ahora. Los PINs están hasheados en Firestore');
  console.log('      y no se pueden recuperar. Si se olvida un PIN, genera uno nuevo');
  console.log('      desde Personal → editar trabajador.\n');

  console.log('  ACCESO POR DISPOSITIVO DESPUÉS DEL LOGIN:');
  console.log('  • Siham / Khadi / Malika  → cocina.losbarriles.app/cocina  (vista cocina)');
  console.log('  • Nadia / Yerai           → tpv.losbarriles.app/tpv       (TPV / PDA)');
  console.log('  • Borja                   → panel completo (gerente)\n');

  process.exit(0);
}

main().catch(e => {
  console.error('\n❌  Error fatal:', e);
  process.exit(1);
});
