import { useState, useEffect } from 'react';
import { subscribeReservasPorFecha, subscribeReservasMes } from '../services/reservas.service';
import { todayStr, dateToStr, startOfMonth, endOfMonth } from '../utils/dates';
import type { Reserva } from '../types';

export function useReservasHoy(): { reservas: Reserva[]; loading: boolean } {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = subscribeReservasPorFecha(todayStr(), r => {
      setReservas(r);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { reservas, loading };
}

export function useReservasDia(fecha: string): { reservas: Reserva[]; loading: boolean } {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeReservasPorFecha(fecha, r => {
      setReservas(r);
      setLoading(false);
    });
    return unsub;
  }, [fecha]);

  return { reservas, loading };
}

export function useReservasMes(
  year: number,
  month: number,
): { reservas: Reserva[]; loading: boolean } {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const d     = new Date(year, month - 1, 1);
    const desde = dateToStr(startOfMonth(d));
    const hasta = dateToStr(endOfMonth(d));
    setLoading(true);
    const unsub = subscribeReservasMes(desde, hasta, r => {
      setReservas(r);
      setLoading(false);
    });
    return unsub;
  }, [year, month]);

  return { reservas, loading };
}

export function useReservasMañana(): { reservas: Reserva[]; loading: boolean } {
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const unsub = subscribeReservasPorFecha(dateToStr(manana), r => {
      setReservas(r);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { reservas, loading };
}
