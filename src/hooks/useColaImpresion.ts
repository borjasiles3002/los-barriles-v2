/**
 * Escucha /colaImpresion en Firestore y ejecuta cada trabajo pendiente
 * a través de QZ Tray. Solo debe montarse en el TPV principal.
 */
import { useEffect } from 'react';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { ColaImpresion } from '../types';
import {
  conectarQZ, imprimirTrabajo, getConfigImpresoras, qzConectado,
} from '../services/impresion.service';

export function useColaImpresion(): void {
  useEffect(() => {
    // Intentar conectar QZ Tray al montar (silencioso si no está disponible)
    void conectarQZ().catch(e =>
      console.info('[QZ Tray] No disponible al iniciar:', (e as Error).message ?? e),
    );

    const procesando = new Set<string>();

    const q = query(
      collection(db, 'colaImpresion'),
      where('estado', '==', 'pendiente'),
    );

    const unsub = onSnapshot(q, snap => {
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        if (procesando.has(change.doc.id)) return;

        const job = { id: change.doc.id, ...change.doc.data() } as ColaImpresion;
        procesando.add(job.id);

        void (async () => {
          const ref = doc(db, 'colaImpresion', job.id);
          try {
            const config    = await getConfigImpresoras();
            const impresora = job.tipo === 'cocina'
              ? config.impresoraCocina
              : config.impresoraBarra;

            if (!impresora) {
              console.warn(`[QZ] Sin impresora configurada para "${job.tipo}"`);
              await updateDoc(ref, {
                estado:      'error',
                errorMsg:    `Sin impresora configurada para tipo "${job.tipo}"`,
                procesadoAt: new Date().toISOString(),
              });
              return;
            }

            // Reconectar QZ si se desconectó (p.ej. QZ Tray se reinició)
            const activo = await qzConectado();
            if (!activo) {
              console.info('[QZ] Reconectando…');
              await conectarQZ();
            }

            await imprimirTrabajo(job, impresora);
            await updateDoc(ref, {
              estado:      'procesado',
              procesadoAt: new Date().toISOString(),
            });
            console.info(`[QZ] Trabajo ${job.id} impreso en "${impresora}"`);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error('[QZ] Error al procesar trabajo:', msg, job);
            await updateDoc(ref, {
              estado:      'error',
              errorMsg:    msg.slice(0, 300),
              procesadoAt: new Date().toISOString(),
            }).catch(() => {});
          } finally {
            procesando.delete(job.id);
          }
        })();
      });
    });

    return () => { unsub(); };
  }, []);
}
