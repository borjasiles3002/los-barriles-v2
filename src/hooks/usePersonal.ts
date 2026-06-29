import { useState, useEffect } from 'react';
import type { AppUser } from '../types';
import { subscribePersonal } from '../services/personal.service';

export function usePersonal() {
  const [personal, setPersonal] = useState<AppUser[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const unsub = subscribePersonal(data => {
      setPersonal(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { personal, loading };
}
