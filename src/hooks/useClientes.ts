import { useState, useEffect } from 'react';
import type { Cliente } from '../types';
import { subscribeClientes } from '../services/clientes.service';

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const unsub = subscribeClientes(data => {
      setClientes(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { clientes, loading };
}
