import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { Categoria, Producto } from '../types';

export function useCarta() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos]   = useState<Producto[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const qCat = query(collection(db, 'carta'), orderBy('orden'));
    const unsubCat = onSnapshot(qCat, (snap) => {
      setCategorias(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Categoria));
    });

    // Flat collection with categoriaId field (no composite index required)
    const qProd = query(collection(db, 'productos'), orderBy('nombre'));
    const unsubProd = onSnapshot(qProd, (snap) => {
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Producto));
      setLoading(false);
    });

    return () => {
      unsubCat();
      unsubProd();
    };
  }, []);

  return { categorias, productos, loading };
}
