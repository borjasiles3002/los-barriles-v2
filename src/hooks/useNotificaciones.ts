import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Notificacion } from '../types';

export function useNotificaciones() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'notificaciones'), where('leido', '==', false));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Notificacion)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setNotificaciones(data);
    });
    return unsub;
  }, []);

  return { notificaciones };
}
