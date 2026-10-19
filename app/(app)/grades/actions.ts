'use server';

import { activePipelineFor, components, weeklyPayloads } from '@/lib/symbols';
import { maskParts } from '@/lib/access';
import { currentViewer } from '@/lib/viewer';

export interface DayPart {
  node: string;
  input: string | null;
  value: number | null;
  score: number | null;
  rule: string;
}

export interface DayDetails {
  symbol: string;
  pipeline: string | null;
  date: string | null;          // the graded row's date (a Friday, or the latest row before it)
  grade: number | null;         // grade %
  points: number | null;
  max: number | null;
  reading: number | null;
  parts: DayPart[];
  masked: boolean;              // guest view: components as Indicator n, scores only
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The grade breakdown of one symbol on one Friday (Grades page cell details, like nextv0's day-data modal). */
export async function dayDetailsAction(symbol: string, friday: string): Promise<DayDetails | null> {
  const viewer = await currentViewer();
  if (!viewer) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(friday)) return null;
  const [pipe, weeks] = await Promise.all([activePipelineFor(symbol), weeklyPayloads(symbol, [friday])]);
  const w = weeks[friday];
  const parts = pipe ? components(pipe.nodes) : [];
  return {
    symbol,
    pipeline: viewer.guest ? null : pipe?.name ?? null,
    date: w?.date ?? null,
    grade: w?.grade ?? null,
    points: w?.points ?? null,
    max: w?.max ?? null,
    reading: w?.reading ?? null,
    parts: (() => {
      const all: DayPart[] = parts.map((p) => {
        const g = w?.nodes?.[p.node];
        return {
          node: p.node,
          input: p.input,
          value: p.input ? num(w?.nodes?.[p.input]) : null,
          score: g && typeof g === 'object' ? num((g as Record<string, unknown>).grade) : num(g),
          rule: p.describe,
        };
      });
      // masked on the server: a guest's response never carries the real names, inputs, values or rules
      return viewer.guest ? (maskParts(all) as DayPart[]) : all;
    })(),
    masked: viewer.guest,
  };
}
