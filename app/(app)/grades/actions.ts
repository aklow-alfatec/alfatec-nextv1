'use server';

import { activePipelineFor, components, weeklyPayloads } from '@/lib/symbols';
import { sessionUser } from '@/lib/session-user';

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
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The grade breakdown of one symbol on one Friday (Grades page cell details, like nextv0's day-data modal). */
export async function dayDetailsAction(symbol: string, friday: string): Promise<DayDetails | null> {
  if (!(await sessionUser())) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(friday)) return null;
  const [pipe, weeks] = await Promise.all([activePipelineFor(symbol), weeklyPayloads(symbol, [friday])]);
  const w = weeks[friday];
  const parts = pipe ? components(pipe.nodes) : [];
  return {
    symbol,
    pipeline: pipe?.name ?? null,
    date: w?.date ?? null,
    grade: w?.grade ?? null,
    points: w?.points ?? null,
    max: w?.max ?? null,
    reading: w?.reading ?? null,
    parts: parts.map((p) => {
      const g = w?.nodes?.[p.node];
      return {
        node: p.node,
        input: p.input,
        value: p.input ? num(w?.nodes?.[p.input]) : null,
        score: g && typeof g === 'object' ? num((g as Record<string, unknown>).grade) : num(g),
        rule: p.describe,
      };
    }),
  };
}
