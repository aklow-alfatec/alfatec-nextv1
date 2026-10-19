import Link from 'next/link';
import { Card, GradeZoneLegend } from '@/components/ui';
import { activePipelines, componentChanges, fridays, lastFinalFriday, readingLabel, weeklyGrades } from '@/lib/grades';
import { latestRiskReward } from '@/lib/risk-reward';
import { ExportCsv } from './export-csv';
import { GradesTable } from './grades-table';

export const dynamic = 'force-dynamic';

const RANGES = { '4w': 4, '12w': 12, '1y': 52, '5y': 260 } as const;
type Range = keyof typeof RANGES;
const FILTERS = { all: 'All', under: 'Undervalued', movers: 'Movers' } as const;
type Filter = keyof typeof FILTERS;

const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default async function GradesPage({ searchParams }: { searchParams: Promise<{ range?: string; filter?: string }> }) {
  const sp = await searchParams;
  const range: Range = (sp.range && sp.range in RANGES ? sp.range : '4w') as Range;
  const filter: Filter = (sp.filter && sp.filter in FILTERS ? sp.filter : 'all') as Filter;
  const end = lastFinalFriday();
  const weeks = fridays(end, RANGES[range]);
  const prev = weeks[weeks.length - 2];
  const pipes = await activePipelines();
  const symbols = pipes.map((p) => p.symbol);
  const [grid, changes, rr] = await Promise.all([weeklyGrades(symbols, weeks), componentChanges(symbols, prev, end), latestRiskReward(symbols)]);
  const rrBy = new Map(rr.map((x) => [x.symbol, x]));

  let rows = pipes.map((p) => {
    const grades = weeks.map((w) => grid[p.symbol]?.[w]?.grade ?? null);
    const cur = grades[grades.length - 1];
    const before = grades[grades.length - 2];
    const delta = cur !== null && before !== null ? Math.round(cur) - Math.round(before) : null;
    const rd = grid[p.symbol]?.[end]?.reading ?? null;
    return { ...p, grades, cur, delta, readingValue: rd, reading: readingLabel(rd), rr: rrBy.get(p.symbol) ?? null };
  });
  if (filter === 'under') rows = rows.filter((r) => (r.cur ?? 0) >= 80);
  if (filter === 'movers') rows = rows.filter((r) => r.delta);
  const link = (p: Partial<{ range: Range; filter: Filter }>) => `/grades?range=${p.range ?? range}&filter=${p.filter ?? filter}`;
  const seg = (on: boolean) => `px-3 py-1 text-sm ${on ? 'bg-raised text-fg' : 'text-fg-2 hover:text-fg'}`;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">Grades</h1>
          <p className="text-sm text-fg-2">{pipes.length} active graphs · weekly, Fridays · click a grade for that week's breakdown, a symbol for its page · risk / reward notes are edited on Trades</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <div className="flex overflow-hidden rounded-control border border-line-2">
            {(Object.keys(RANGES) as Range[]).map((r) => (
              <Link key={r} href={link({ range: r })} className={seg(r === range)}>{r === '4w' ? '4 weeks' : r === '12w' ? '12 weeks' : r === '1y' ? '1 year' : '5 years'}</Link>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-control border border-line-2">
            {(Object.keys(FILTERS) as Filter[]).map((f) => (
              <Link key={f} href={link({ filter: f })} className={seg(f === filter)}>{FILTERS[f]}</Link>
            ))}
          </div>
          <ExportCsv weeks={weeks} rows={rows.map((r) => ({ symbol: r.symbol, grades: r.grades, reading: r.reading }))} filename={`grades-${end}-${range}.csv`} />
        </div>
      </div>

      <Card>
        <GradesTable
          weeks={weeks}
          rows={rows.map((r) => ({ symbol: r.symbol, title: r.title, section: r.section, grades: r.grades, delta: r.delta, readingValue: r.readingValue, rr: r.rr }))}
        />
        <div className="mt-3 space-y-1.5 text-[11px] text-fg-3">
          <span>Grade zones (as nextv0)</span>
          <GradeZoneLegend />
          <p>The reading tag comes from each graph&apos;s indicator grader (−3 to +3).</p>
        </div>
      </Card>

      <Card title={`Component grades that changed, ${short(prev)} → ${short(end)}`}>
        {changes.length === 0 ? (
          <p className="text-sm text-fg-3">No component grade changed.</p>
        ) : (
          <table className="w-full max-w-2xl text-sm">
            <thead className="text-xs text-fg-3">
              <tr><th className="text-left font-medium">Symbol</th><th className="text-left font-medium">Component</th><th className="text-right font-medium">Grade</th></tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={`${c.symbol}|${c.node}`} className="border-t border-line">
                  <td className="py-1"><Link href={`/symbols/${encodeURIComponent(c.symbol)}`} className="hover:text-accent">{c.symbol}</Link></td>
                  <td className="py-1 text-fg-2">{c.node.replace(/_GRADE$/, '')}</td>
                  <td className="num py-1 text-right">
                    {c.from ?? '-'} → <span className={(c.to ?? 0) > (c.from ?? 0) ? 'text-positive' : 'text-negative'}>{c.to ?? '-'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-[11px] text-fg-3">Each graph adds up its component grades (1 to 5) into the weekly grade; this lists which inputs moved.</p>
      </Card>
    </div>
  );
}
