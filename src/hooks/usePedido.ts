import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Pedido } from '../types';

export function usePedido(pedidoId: string | null) {
  const [pedido, setPedido]   = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pedidoId) {
      setPedido(null);
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(doc(db, 'pedidos', pedidoId), (snap) => {
      setPedido(snap.exists() ? ({ id: snap.id, ...snap.data() } as Pedido) : null);
      setLoading(false);
    });

    return unsub;
  }, [pedidoId]);

  return { pedido, loading };
}
