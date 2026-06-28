import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { Mesa } from '../types';

export function useMesas() {
  const [mesas, setMesas]   = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'mesas'), orderBy('numero'));
    const unsub = onSnapshot(q, (snap) => {
      setMesas(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Mesa));
      setLoading(false);
    });
    return unsub;
  }, []);

  return { mesas, loading };
}
