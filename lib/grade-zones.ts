/** nextv0's grade colours and wording, shared by every grade display in nextv1 (no server imports: safe in the browser).
 *  Sources: nextv0 app/ui/dashboard/visx-heatmap-chart.tsx (grade % zones, part-score colours) and
 *  app/lib/placeholder-data.ts indicatorList (reading labels and colours on the overview cards). */

export interface Zone { min: number; max: number; color: string | null; label: string }

/** Grade % (share of the maximum score, 0..100; higher = more undervalued). 40-80 is normal (no colour). */
export const GRADE_ZONES: Zone[] = [
  { min: 96, max: 100, color: '#66ffff', label: 'Extremely Undervalue' },
  { min: 90, max: 96, color: '#caedfb', label: 'Very Undervalue' },
  { min: 80, max: 90, color: '#66ccff', label: 'Undervalue' },
  { min: 40, max: 80, color: null, label: 'Normal' },
  { min: 36, max: 40, color: '#ffccff', label: 'Overvalue' },
  { min: 30, max: 36, color: '#ff00ff', label: 'Very Overvalue' },
  { min: 0, max: 30, color: '#ff0066', label: 'Extremely Overvalue' },
];

export function gradeZone(g: number): Zone {
  return GRADE_ZONES.find((z) => g >= z.min && (g < z.max || (z.max === 100 && g <= 100))) ?? (g > 100 ? GRADE_ZONES[0] : GRADE_ZONES[6]);
}

/** Reading = the `<SYMBOL>_DAILY_IND` value, -3..+3 (nextv0 indicatorList). */
export const READINGS: Record<number, { label: string; color: string }> = {
  [-3]: { label: 'EXTREMELY UNDERVALUED', color: '#66ffff' },
  [-2]: { label: 'VERY UNDERVALUED', color: '#caedfb' },
  [-1]: { label: 'UNDERVALUED', color: '#61cbf3' },
  0: { label: 'BETWEEN RANGE', color: '#bbbbbb' },
  1: { label: 'OVERVALUED', color: '#ffcccc' },
  2: { label: 'VERY OVERVALUED', color: '#ff9999' },
  3: { label: 'EXTREMELY OVERVALUED', color: '#ff0066' },
};

export function readingInfo(r: number | null | undefined): { label: string; color: string | null } {
  if (r === null || r === undefined || Number.isNaN(r)) return { label: 'NO DATA', color: null };
  return READINGS[Math.round(r)] ?? { label: String(r), color: null };
}

/** Part scores 1..5 (each component grade), nextv0 heatmap colours: 5 most undervalued. */
export function partScoreColor(s: number | null | undefined): string | null {
  if (s === null || s === undefined || s < 0) return null;
  if (s >= 5) return '#66ffff';
  if (s >= 4) return '#66ccff';
  if (s >= 3) return '#ffccff';
  if (s >= 2) return '#ff00ff';
  return '#ff0066';
}

/** Readable text on a nextv0 colour (all are light except the two magentas). */
export function inkOn(color: string | null): string {
  return color === '#ff0066' || color === '#ff00ff' ? '#ffffff' : '#10131a';
}
