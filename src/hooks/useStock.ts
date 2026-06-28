import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { StockItem } from '../types';

export function useStock() {
  const [stock, setStock]    = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q    = query(collection(db, 'stock'), orderBy('nombre'));
    const unsub = onSnapshot(q, (snap) => {
      setStock(snap.docs.map(d => ({ id: d.id, ...d.data() }) as StockItem));
      setLoading(false);
    });
    return unsub;
  }, []);

  const stockBajoMinimo = stock.filter(s => s.cantidad < s.stockMinimo);
  return { stock, stockBajoMinimo, loading };
}
