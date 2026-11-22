// Server-side only (reads run files from Storage via lib/run-store.ts).
import { openTradeDrawdown } from '@/features/charts/open-trade';
import { loadRun } from '@/lib/run-store';

export interface OpenTradeSeries {
  /** unix seconds, one per bar of the run */
  t: number[];
  /** percent, <= 0, null when flat */
  v: (number | null)[];
  /** the most negative value (percent), null when the run never held a position */
  max: number | null;
}

/** A strategy's open-trade drawdown over the whole run, from its saved price and position series (full resolution, so
 *  old and new runs get the same figure). Null when the run has no such columns. */
export async function openTradeSeries(runId: string, node: string, priceRef: string | null): Promise<OpenTradeSeries | null> {
  if (!priceRef) return null;
  const run = await loadRun(runId);
  const px = run.columns[priceRef];
  const pos = run.columns[`${node}.position`];
  if (!px || !pos) return null;
  const num = (a: unknown[]) => a.map((x) => (typeof x === 'number' && Number.isFinite(x) ? x : null));
  const r = openTradeDrawdown(num(px), num(pos));
  return { t: run.ts.map((d) => d.getTime() / 1000), v: r.v, max: r.max };
}
