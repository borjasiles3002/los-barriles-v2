import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import type { Pedido, PedidoEstado } from '../types';

export function usePedidos(estados?: PedidoEstado[]) {
  const [pedidos, setPedidos]  = useState<Pedido[]>([]);
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    const q = estados && estados.length > 0
      ? query(collection(db, 'pedidos'), where('estado', 'in', estados))
      : query(collection(db, 'pedidos'));

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Pedido)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setPedidos(data);
      setLoading(false);
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(estados)]);

  return { pedidos, loading };
}
