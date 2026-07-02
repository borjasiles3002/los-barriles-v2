/** Redondea a 2 decimales sin ruido de punto flotante */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Formatea como string monetario: 1234.5 → "1234.50€" */
export function fmtEur(n: number): string {
  return round2(n).toFixed(2) + '€';
}
