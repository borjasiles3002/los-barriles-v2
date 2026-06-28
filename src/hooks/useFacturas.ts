import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import type { Factura } from '../types';

export function useFacturas(limitN = 50) {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const q    = query(collection(db, 'facturas'), orderBy('createdAt', 'desc'), limit(limitN));
    const unsub = onSnapshot(q, (snap) => {
      setFacturas(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Factura));
      setLoading(false);
    });
    return unsub;
  }, [limitN]);

  return { facturas, loading };
}
