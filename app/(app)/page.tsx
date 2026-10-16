import Link from 'next/link';
import { Card, GradeChip, Sparkline } from '@/components/ui';
import sql from '@/lib/db';
import { activePipelines, fridays, lastFinalFriday, readingLabel, weeklyGrades } from '@/lib/grades';

export const dynamic = 'force-dynamic';

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const shift = (d: string, days: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
};

async function dataHealth(priceSymbols: string[]) {
  const q = (where: ReturnType<typeof sql>) => sql<{ last: Date | null }[]>`SELECT MAX(date) AS last FROM stock_data WHERE ${where}`;
  const [prices, cot, macro, naaim] = await Promise.all([
    priceSymbols.length ? sql<{ symbol: string; last: Date }[]>`
      SELECT symbol, MAX(date) AS last FROM stock_data WHERE symbol IN ${sql(priceSymbols)} GROUP BY symbol` : Promise.resolve([]),
    q(sql`symbol LIKE 'COT\\_%'`),
    sql<{ symbol: string; last: Date }[]>`
      SELECT symbol, MAX(date) AS last FROM stock_data WHERE symbol IN ('M2SL', 'FRED_CPIAUCSL', 'FRED_GACDFSA066MSFRBPHI') GROUP BY symbol`,
    q(sql`symbol = 'NAAIM'`),
  ]);
  const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const priceDates = prices.map((r) => iso(r.last)!).sort();
  return {
    pricesLatest: priceDates[priceDates.length - 1] ?? null,
    pricesOldest: priceDates[0] ?? null,
    stalePrices: prices.filter((r) => iso(r.last)! < (priceDates[priceDates.length - 1] ?? '')).map((r) => r.symbol),
    cot: iso(cot[0]?.last),
    macro: macro.map((r) => ({ symbol: r.symbol, last: iso(r.last) })),
    naaim: iso(naaim[0]?.last),
  };
}

async function recent() {
  const [runs, exps] = await Promise.all([
    sql<{ id: string; name: string | null; status: string; summary: Record<string, number> | null; created_at: Date }[]>`
      SELECT r.id::text, g.name, r.status, r.summary, r.created_at FROM engine_runs r LEFT JOIN graphs g ON g.id = r.graph_id
      WHERE r.kind = 'backtest' ORDER BY r.created_at DESC LIMIT 4`.catch(() => []),
    sql<{ id: string; name: string | null; status: string; summary: Record<string, any> | null; created_at: Date }[]>`
      SELECT id::text, name, status, summary, created_at FROM experiments ORDER BY created_at DESC LIMIT 3`.catch(() => []),
  ]);
  return [
    ...runs.map((r) => ({ kind: 'RUN', href: `/studio/runs/${r.id}`, at: r.created_at, text: `${r.name ?? 'graph'} · ${r.status === 'done' ? `CAGR ${((r.summary?.cagr ?? 0) * 100).toFixed(1)}%` : r.status}` })),
    ...exps.map((e) => ({ kind: 'EXP', href: `/studio/experiments/${e.id}`, at: e.created_at,
      text: `${e.name ?? 'experiment'} · ${e.status === 'done' ? `out of sample CAGR ${(((e.summary?.oos_performance?.cagr) ?? 0) * 100).toFixed(1)}%` : e.status}` })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 6);
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: wParam } = await searchParams;
  const latest = lastFinalFriday();
  const week = wParam && /^\d{4}-\d{2}-\d{2}$/.test(wParam) && wParam <= latest ? wParam : latest;
  const pipes = await activePipelines();
  const symbols = pipes.map((p) => p.symbol);
  const weeks = fridays(week, 12);
  const prev = weeks[weeks.length - 2];
  const [grid, health, feed] = await Promise.all([weeklyGrades(symbols, weeks), dataHealth(symbols), recent()]);

  const rows = pipes.map((p) => {
    const cur = grid[p.symbol]?.[week];
    const before = grid[p.symbol]?.[prev];
    const g = cur?.grade ?? null;
    const delta = g !== null && before?.grade != null ? Math.round(g) - Math.round(before.grade) : null;
    const series = weeks.map((w) => grid[p.symbol]?.[w]?.grade).filter((v): v is number => v !== null && v !== undefined);
    return { ...p, grade: g, reading: cur?.reading ?? null, date: cur?.date ?? null, delta, series, before: before?.grade ?? null };
  }).sort((a, b) => (b.grade ?? -1) - (a.grade ?? -1));

  const graded = rows.filter((r) => r.grade !== null);
  const under = graded.filter((r) => (r.grade as number) >= 80).length;
  const normal = graded.filter((r) => (r.grade as number) >= 40 && (r.grade as number) < 80).length;
  const over = graded.filter((r) => (r.grade as number) < 40).length;
  const moved = rows.filter((r) => r.delta !== null && r.delta !== 0).sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Week of {fmtDay(week)}</h1>
          <p className="text-sm text-fg-2">
            {graded.length} of {pipes.length} graphs graded · grade = share of the maximum score; higher means more undervalued
          </p>
        </div>
        <div className="ml-auto flex gap-2 text-sm">
          <Link className="rounded-control border border-line-2 px-3 py-1.5 hover:bg-raised" href={`/?week=${shift(week, -7)}`}>Previous week</Link>
          {week < latest && <Link className="rounded-control border border-line-2 px-3 py-1.5 hover:bg-raised" href={`/?week=${shift(week, 7)}`}>Next week</Link>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [under, 'Undervalued · grade 80+'],
          [normal, 'Normal · 40–79'],
          [over, 'Overvalued · under 40'],
          [moved.length, 'Changed since last week'],
        ].map(([v, k]) => (
          <Card key={k as string}>
            <div className="num text-2xl font-medium">{v}</div>
            <div className="text-xs text-fg-2">{k}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="This week's grades" actions={<Link className="text-xs text-accent hover:underline" href="/grades">All grades →</Link>} className="lg:col-span-2">
          <table className="w-full text-sm">
            <thead className="text-xs text-fg-3">
              <tr>
                <th className="py-1 text-left font-medium">Symbol</th>
                <th className="py-1 text-left font-medium">Grade</th>
                <th className="py-1 text-left font-medium">Reading</th>
                <th className="hidden py-1 text-left font-medium md:table-cell">12 weeks</th>
                <th className="py-1 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.symbol} className="border-t border-line hover:bg-raised">
                  <td className="py-1.5">
                    <Link href={`/symbols/${encodeURIComponent(r.symbol)}`} className="font-semibold hover:text-accent">{r.title}</Link>
                    {r.tags.length > 0 && <span className="ml-1 text-[10px] text-fg-3">{r.tags.join(', ')}</span>}
                  </td>
                  <td className="py-1.5"><GradeChip grade={r.grade} /></td>
                  <td className="py-1.5 text-xs text-fg-2">
                    {readingLabel(r.reading)}
                    {r.date && r.date !== week && <span className="ml-1 text-fg-3">(as of {fmtDay(r.date)})</span>}
                  </td>
                  <td className="hidden py-1.5 md:table-cell"><Sparkline data={r.series} /></td>
                  <td className={`num py-1.5 text-right ${r.delta ? (r.delta > 0 ? 'text-positive' : 'text-negative') : 'text-fg-3'}`}>
                    {r.delta === null ? '-' : r.delta > 0 ? `+${r.delta}` : r.delta}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="space-y-4">
          <Card title={`Biggest moves vs ${fmtDay(prev)}`}>
            {moved.length === 0 ? (
              <p className="text-sm text-fg-3">No grade changed.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {moved.slice(0, 6).map((r) => (
                  <li key={r.symbol} className="flex items-center gap-2">
                    <Link href={`/symbols/${encodeURIComponent(r.symbol)}`} className="w-24 font-medium hover:text-accent">{r.title}</Link>
                    <span className="num text-fg-2">{Math.round(r.before!)} → {Math.round(r.grade!)}</span>
                    <span className={`num ml-auto ${r.delta! > 0 ? 'text-positive' : 'text-negative'}`}>{r.delta! > 0 ? `+${r.delta}` : r.delta}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Data health" actions={<Link className="text-xs text-accent hover:underline" href="/data">Data →</Link>}>
            <ul className="space-y-1.5 text-sm">
              <li className="flex justify-between gap-2">
                <span className="text-fg-2">Daily prices</span>
                <span className="num">{health.pricesLatest ? `to ${fmtDay(health.pricesLatest)}` : '-'}</span>
              </li>
              {health.stalePrices.length > 0 && (
                <li className="text-xs text-warning">Behind: {health.stalePrices.join(', ')}</li>
              )}
              <li className="flex justify-between gap-2">
                <span className="text-fg-2">COT positioning <span className="text-fg-3">weekly</span></span>
                <span className="num">{health.cot ? `to ${fmtDay(health.cot)}` : '-'}</span>
              </li>
              {health.macro.map((m) => (
                <li key={m.symbol} className="flex justify-between gap-2">
                  <span className="text-fg-2">{m.symbol.replace('FRED_', '')} <span className="text-fg-3">monthly</span></span>
                  <span className="num">{m.last ? fmtDay(m.last) : '-'}</span>
                </li>
              ))}
              <li className="flex justify-between gap-2">
                <span className="text-fg-2">NAAIM</span>
                <span className={`num ${health.naaim && health.naaim < shift(week, -21) ? 'text-warning' : ''}`}>{health.naaim ? `last ${fmtDay(health.naaim)}` : '-'}</span>
              </li>
            </ul>
          </Card>

          <Card title="Recent">
            {feed.length === 0 ? (
              <p className="text-sm text-fg-3">No runs or experiments yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {feed.map((f) => (
                  <li key={f.href} className="flex items-center gap-2">
                    <span className="num rounded-chip bg-line px-1.5 text-[10px] text-fg-2">{f.kind}</span>
                    <Link href={f.href} className="truncate hover:text-accent">{f.text}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
