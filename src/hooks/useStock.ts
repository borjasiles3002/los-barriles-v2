import { useState, useEffect } from 'react';
import type { Producto, StockItem } from '../types';
import { useStockSubscription, subscribeProductosStock } from '../services/stock.service';

// Hook for ingredient inventory (/stock/ collection)
export function useStock() {
  const [stock,   setStock]   = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return useStockSubscription(items => {
      setStock(items);
      setLoading(false);
    });
  }, []);

  const stockBajoMinimo = stock.filter(s => s.cantidad < s.stockMinimo && s.stockMinimo > 0);
  return { stock, stockBajoMinimo, loading };
}

// Hook for daily menu stock (/productos/ collection)
export function useProductosStock() {
  const [productos, setProductos] = useState<Producto[]>([]);

  useEffect(() => {
    return subscribeProductosStock(setProductos);
  }, []);

  return productos;
}
