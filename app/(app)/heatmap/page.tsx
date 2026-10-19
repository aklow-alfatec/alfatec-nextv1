import { activePipelines, lastFinalFriday, weeklyGrades } from '@/lib/grades';
import { latestRiskReward } from '@/lib/risk-reward';
import { HeatmapTable, type HeatRow } from './heatmap-table';

export const dynamic = 'force-dynamic';

/** `n` Fridays `spacing` weeks apart, ending at `end` (oldest first). nextv0 shows 4, four weeks apart. */
function spacedFridays(end: string, n: number, spacing: number): string[] {
  const out: string[] = [];
  const d = new Date(`${end}T00:00:00Z`);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setUTCDate(d.getUTCDate() - 7 * spacing * i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}

export default async function HeatmapPage() {
  const pipes = await activePipelines();
  const symbols = pipes.map((p) => p.symbol);
  const dates = spacedFridays(lastFinalFriday(), 4, 4);
  const [grid, rr] = await Promise.all([weeklyGrades(symbols, dates), latestRiskReward(symbols)]);
  const rrBy = new Map(rr.map((r) => [r.symbol, r]));
  const rows: HeatRow[] = pipes.map((p) => ({
    symbol: p.symbol,
    title: p.title,
    section: p.section,
    cells: dates.map((d) => ({ date: d, reading: grid[p.symbol]?.[d]?.reading ?? null, grade: grid[p.symbol]?.[d]?.grade ?? null })),
    rr: rrBy.get(p.symbol) ?? null,
  }));
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Heatmap</h1>
        <p className="text-sm text-fg-2">
          Valuation reading on four Fridays, four weeks apart, with each asset&apos;s risk / reward notes (edited on Trades). Click a cell for the grade breakdown.
        </p>
      </div>
      <HeatmapTable rows={rows} dates={dates} />
    </div>
  );
}
