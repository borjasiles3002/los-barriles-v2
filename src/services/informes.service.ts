import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { getIngresosByFecha } from './ingresos.service';
import { getGastosByFecha } from './gastos.service';
import { getMondayOfWeek, dateToStr, DIAS_ES, MESES_ES } from '../utils/dates';
import type { Ingreso, Gasto, LineaPedido } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function agregaIngresos(ingresos: Ingreso[]) {
  const totalIngresos = ingresos.reduce((s, i) => s + i.total, 0);
  const numeroPedidos = ingresos.length;
  const ticketMedio   = numeroPedidos > 0 ? totalIngresos / numeroPedidos : 0;

  const prodsMap: Record<string, { cantidad: number; total: number }> = {};
  for (const ing of ingresos) {
    for (const linea of ing.lineas) {
      if (!prodsMap[linea.nombre]) prodsMap[linea.nombre] = { cantidad: 0, total: 0 };
      prodsMap[linea.nombre].cantidad += linea.cantidad;
      prodsMap[linea.nombre].total   += linea.precio * linea.cantidad;
    }
  }
  const topProductos = Object.entries(prodsMap)
    .map(([nombre, d]) => ({ nombre, ...d }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const porMetodo: Record<string, number> = {};
  for (const ing of ingresos) {
    porMetodo[ing.metodoPago] = (porMetodo[ing.metodoPago] ?? 0) + ing.total;
  }

  const productosManales: DatosDiarios['productosManales'] = [];
  for (const ing of ingresos) {
    for (const linea of ing.lineas) {
      if ((linea as LineaPedido & { esManual?: boolean }).esManual) {
        productosManales.push({
          nombre:   linea.nombre,
          precio:   linea.precio,
          cantidad: linea.cantidad,
          mesa:     ing.mesaNombre,
          camarero: ing.camareroNombre,
        });
      }
    }
  }

  return { totalIngresos, numeroPedidos, ticketMedio, topProductos, porMetodo, productosManales };
}

function totalGastos(gastos: Gasto[]): number {
  return gastos.reduce((s, g) => s + g.importe, 0);
}

// ─── Tipos de datos de informe ────────────────────────────────────────────────

export interface DatosDiarios {
  fecha: string;
  totalIngresos: number;
  totalGastos: number;
  beneficio: number;
  numeroPedidos: number;
  ticketMedio: number;
  ventasPorHora: { hora: string; total: number }[];
  porMetodo: Record<string, number>;
  topProductos: { nombre: string; cantidad: number; total: number }[];
  productosManales: { nombre: string; precio: number; cantidad: number; mesa: string; camarero: string }[];
}

export interface DatosSemanales {
  semana: number;
  año: number;
  desde: string;
  hasta: string;
  totalIngresos: number;
  totalGastos: number;
  beneficio: number;
  numeroPedidos: number;
  ticketMedio: number;
  porDia: { dia: string; total: number; gastos: number }[];
  topProductos: { nombre: string; cantidad: number; total: number }[];
}

export interface DatosMensuales {
  mes: string;
  totalIngresos: number;
  totalGastos: number;
  beneficio: number;
  numeroPedidos: number;
  ticketMedio: number;
  porDia: { dia: number; ingresos: number; gastos: number }[];
  porCategoriaGasto: Record<string, number>;
  topProductos: { nombre: string; cantidad: number; total: number }[];
}

export interface DatosAnuales {
  año: number;
  totalIngresos: number;
  totalGastos: number;
  beneficio: number;
  numeroPedidos: number;
  porMes: { mes: string; ingresos: number; gastos: number; beneficio: number }[];
  topProductos: { nombre: string; cantidad: number; total: number }[];
}

// ─── Informe diario ───────────────────────────────────────────────────────────

export async function getDatosDiarios(fecha: string): Promise<DatosDiarios> {
  const [ingresos, gastos] = await Promise.all([
    getIngresosByFecha(fecha, fecha),
    getGastosByFecha(fecha, fecha),
  ]);

  const agg  = agregaIngresos(ingresos);
  const tGas = totalGastos(gastos);

  const horasMap: Record<string, number> = {};
  for (const ing of ingresos) {
    const hora = (ing.hora ?? '').slice(0, 2) + ':00';
    horasMap[hora] = (horasMap[hora] ?? 0) + ing.total;
  }
  const ventasPorHora = Object.entries(horasMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hora, total]) => ({ hora, total }));

  return {
    fecha,
    ...agg,
    totalGastos:  tGas,
    beneficio:    agg.totalIngresos - tGas,
    ventasPorHora,
  };
}

// ─── Informe semanal ──────────────────────────────────────────────────────────

export async function getDatosSemanales(semana: number, año: number): Promise<DatosSemanales> {
  // Find a date in that ISO week: advance from Monday of week 1
  const jan4    = new Date(año, 0, 4);
  const weekMon = getMondayOfWeek(jan4);
  weekMon.setDate(weekMon.getDate() + (semana - 1) * 7);
  const weekSun = new Date(weekMon);
  weekSun.setDate(weekMon.getDate() + 6);

  const desde = dateToStr(weekMon);
  const hasta  = dateToStr(weekSun);

  const [ingresos, gastos] = await Promise.all([
    getIngresosByFecha(desde, hasta),
    getGastosByFecha(desde, hasta),
  ]);

  const agg  = agregaIngresos(ingresos);
  const tGas = totalGastos(gastos);

  const ingresosDia: Record<string, number> = {};
  const gastosDia:   Record<string, number> = {};
  for (const ing of ingresos) ingresosDia[ing.fecha] = (ingresosDia[ing.fecha] ?? 0) + ing.total;
  for (const g of gastos)     gastosDia[g.fecha]     = (gastosDia[g.fecha]     ?? 0) + g.importe;

  const porDia = Array.from({ length: 7 }, (_, i) => {
    const d   = new Date(weekMon);
    d.setDate(weekMon.getDate() + i);
    const str = dateToStr(d);
    return {
      dia:    DIAS_ES[d.getDay()],
      total:  ingresosDia[str] ?? 0,
      gastos: gastosDia[str]   ?? 0,
    };
  });

  return { semana, año, desde, hasta, ...agg, totalGastos: tGas, beneficio: agg.totalIngresos - tGas, porDia };
}

// ─── Informe mensual ──────────────────────────────────────────────────────────

export async function getDatosMensuales(mes: string): Promise<DatosMensuales> {
  const [añoN, mesN] = mes.split('-').map(Number);
  const diasDelMes   = new Date(añoN, mesN, 0).getDate();
  const desde        = `${mes}-01`;
  const hasta        = `${mes}-${String(diasDelMes).padStart(2, '0')}`;

  const [ingresos, gastos] = await Promise.all([
    getIngresosByFecha(desde, hasta),
    getGastosByFecha(desde, hasta),
  ]);

  const agg  = agregaIngresos(ingresos);
  const tGas = totalGastos(gastos);

  const ingresosDia: Record<number, number> = {};
  const gastosDia:   Record<number, number> = {};
  for (const ing of ingresos) {
    const dia = parseInt(ing.fecha.split('-')[2]);
    ingresosDia[dia] = (ingresosDia[dia] ?? 0) + ing.total;
  }
  for (const g of gastos) {
    const dia = parseInt(g.fecha.split('-')[2]);
    gastosDia[dia] = (gastosDia[dia] ?? 0) + g.importe;
  }

  const porDia = Array.from({ length: diasDelMes }, (_, i) => ({
    dia:      i + 1,
    ingresos: ingresosDia[i + 1] ?? 0,
    gastos:   gastosDia[i + 1]   ?? 0,
  }));

  const porCategoriaGasto: Record<string, number> = {};
  for (const g of gastos) {
    porCategoriaGasto[g.categoria] = (porCategoriaGasto[g.categoria] ?? 0) + g.importe;
  }

  return { mes, ...agg, totalGastos: tGas, beneficio: agg.totalIngresos - tGas, porDia, porCategoriaGasto };
}

// ─── Informe anual ────────────────────────────────────────────────────────────

export async function getDatosAnuales(año: number): Promise<DatosAnuales> {
  const desde = `${año}-01-01`;
  const hasta  = `${año}-12-31`;

  const [ingresos, gastos] = await Promise.all([
    getIngresosByFecha(desde, hasta),
    getGastosByFecha(desde, hasta),
  ]);

  const agg  = agregaIngresos(ingresos);
  const tGas = totalGastos(gastos);

  const ingresosMes: Record<string, number> = {};
  const gastosMes:   Record<string, number> = {};
  for (const ing of ingresos) {
    const m = ing.fecha.slice(0, 7);
    ingresosMes[m] = (ingresosMes[m] ?? 0) + ing.total;
  }
  for (const g of gastos) {
    const m = g.fecha.slice(0, 7);
    gastosMes[m] = (gastosMes[m] ?? 0) + g.importe;
  }

  const porMes = MESES_ES.map((nombre, i) => {
    const key = `${año}-${String(i + 1).padStart(2, '0')}`;
    const ing = ingresosMes[key] ?? 0;
    const gas = gastosMes[key]   ?? 0;
    return { mes: nombre, ingresos: ing, gastos: gas, beneficio: ing - gas };
  });

  return { año, ...agg, totalGastos: tGas, beneficio: agg.totalIngresos - tGas, porMes };
}

// ─── Objetivo mensual ─────────────────────────────────────────────────────────

export async function getObjetivo(mes: string): Promise<number> {
  const snap = await getDoc(doc(db, 'objetivos', mes));
  if (!snap.exists()) return 0;
  return (snap.data() as { ventasMensuales: number }).ventasMensuales ?? 0;
}

export async function saveObjetivo(mes: string, ventasMensuales: number): Promise<void> {
  await setDoc(doc(db, 'objetivos', mes), { ventasMensuales });
}
