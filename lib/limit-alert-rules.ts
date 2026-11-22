// Pure helpers for the limit-breach alerts (no imports, so node --test can load them).
// The alerts are computed by the backend (alfatec-backend app/services/limit_alerts.py, docs/featureAsk-001.md).

export const DEFAULT_RANGE = 0.2;
export const DEFAULT_CHECK_DATA_ABOVE = 0.5;

/** A percentage typed in Settings ("20", "20%", "0.2" is read as 0.2%) as a fraction; null when not a number in
 *  (0, 500]%. An empty string is `''` (clears a per-pipeline override). */
export function parsePercent(input: string): number | null | '' {
  const s = input.trim().replace(/%$/, '').trim();
  if (s === '') return '';
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
  return Math.round(n * 1000) / 100000;
}

export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;

export interface BreachRow {
  week: string;
  symbol: string;
  pipeline: string | null;
  node: string;
  pair: string;
  side: 'cheap' | 'expensive';
  value: number;
  limitValue: number;
  alertLevel: number;
  excess: number;
  scaling: string;
  firstBreachWeek: string;
  isNew: boolean;
  checkData: boolean;
  alertRange: number;
}

/** New breaches first, then the largest excess. */
export const sortBreaches = (rows: BreachRow[]) =>
  [...rows].sort((a, b) => Number(b.isNew) - Number(a.isNew) || b.excess - a.excess || a.symbol.localeCompare(b.symbol));
