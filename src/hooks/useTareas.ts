import { useState, useEffect } from 'react';
import type { Tarea } from '../types';
import {
  subscribeTareasAsignadas,
  subscribeTareasPorAsignador,
  subscribeTodasTareas,
  subscribeTareasPendientes,
} from '../services/tareas.service';

export function useTareasAsignadas(uid: string) {
  const [tareas,  setTareas]  = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeTareasAsignadas(uid, data => {
      setTareas(data);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { tareas, loading };
}

export function useTareasCreadas(uid: string) {
  const [tareas,  setTareas]  = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeTareasPorAsignador(uid, data => {
      setTareas(data);
      setLoading(false);
    });
    return unsub;
  }, [uid]);

  return { tareas, loading };
}

export function useTodasTareas() {
  const [tareas,  setTareas]  = useState<Tarea[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeTodasTareas(data => {
      setTareas(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { tareas, loading };
}

export function useTareasPendientesCount(uid: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeTareasPendientes(uid, setCount);
  }, [uid]);

  return count;
}
