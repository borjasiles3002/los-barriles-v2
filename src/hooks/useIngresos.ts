import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Ingreso } from '../types';

export function useIngresosHoy() {
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const q   = query(collection(db, 'ingresos'), where('fecha', '==', hoy));
    const unsub = onSnapshot(q, (snap) => {
      setIngresos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Ingreso));
      setLoading(false);
    });
    return unsub;
  }, []);

  return { ingresos, loading };
}

export function useIngresosMes(mes: string) {
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const [añoN, mesN] = mes.split('-').map(Number);
    const diasDelMes   = new Date(añoN, mesN, 0).getDate();
    const desde        = `${mes}-01`;
    const hasta        = `${mes}-${String(diasDelMes).padStart(2, '0')}`;

    const q = query(
      collection(db, 'ingresos'),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta),
    );
    const unsub = onSnapshot(q, (snap) => {
      setIngresos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Ingreso));
      setLoading(false);
    });
    return unsub;
  }, [mes]);

  return { ingresos, loading };
}
