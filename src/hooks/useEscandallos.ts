import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { Escandallo } from '../types';

export function useEscandallos() {
  const [escandallos, setEscandallos] = useState<Escandallo[]>([]);
  const [loading, setLoading]          = useState(true);

  useEffect(() => {
    const q     = query(collection(db, 'escandallos'), orderBy('productoNombre'));
    const unsub  = onSnapshot(q, (snap) => {
      setEscandallos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Escandallo));
      setLoading(false);
    });
    return unsub;
  }, []);

  return { escandallos, loading };
}
