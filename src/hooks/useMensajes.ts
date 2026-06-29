import { useState, useEffect } from 'react';
import type { Conversacion, Mensaje } from '../types';
import {
  subscribeConversaciones,
  subscribeMensajes,
  subscribeTotalNoLeidos,
} from '../services/mensajes.service';

export function useConversaciones(uid: string) {
  const [convs,   setConvs]   = useState<Conversacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeConversaciones(uid, data => {
      setConvs(data);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { convs, loading };
}

export function useMensajesConv(conversacionId: string | null) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);

  useEffect(() => {
    if (!conversacionId) { setMensajes([]); return; }
    return subscribeMensajes(conversacionId, setMensajes);
  }, [conversacionId]);

  return mensajes;
}

export function useTotalNoLeidos(uid: string) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeTotalNoLeidos(uid, setTotal);
  }, [uid]);

  return total;
}
