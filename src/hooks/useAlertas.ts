import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Alerta } from '../types';

export function useAlertas(onlyUnread = false) {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    // Avoid composite index: when filtering by leido, skip orderBy (different field)
    const q = onlyUnread
      ? query(collection(db, 'alertas'), where('leido', '==', false))
      : query(collection(db, 'alertas'), orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(q, (snap) => {
      setAlertas(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Alerta));
      setLoading(false);
    });
    return unsub;
  }, [onlyUnread]);

  return { alertas, loading };
}
