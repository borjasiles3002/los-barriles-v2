import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Gasto } from '../types';

export function useGastos(desde: string, hasta: string) {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'gastos'),
      where('fecha', '>=', desde),
      where('fecha', '<=', hasta),
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Gasto)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      setGastos(data);
      setLoading(false);
    });
    return unsub;
  }, [desde, hasta]);

  return { gastos, loading };
}
