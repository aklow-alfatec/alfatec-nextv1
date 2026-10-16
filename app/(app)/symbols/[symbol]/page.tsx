import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button, Card, GradeChip, PartScoreChip, ReadingTag } from '@/components/ui';
import { fridays, lastFinalFriday } from '@/lib/grades';
import { activePipelineFor, assetInfo, components, graphForPipeline, prices, runsForSymbol, weeklyPayloads } from '@/lib/symbols';
import { PriceGradeChart } from './price-grade-chart';

export const dynamic = 'force-dynamic';

const RANGES = { '3m': 13, '6m': 26, '1y': 52, '5y': 260, all: 1400 } as const;
type Range = keyof typeof RANGES;
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmt = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 ? 5 : Math.abs(v) < 100 ? 2 : 1 }) : '-';
const pct = (v: number | null, d = 1) => (v === null ? '-' : `${(v * 100).toFixed(d)}%`);

export default async function SymbolPage({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ range?: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw);
  const { range: r } = await searchParams;
  const range: Range = (r && r in RANGES ? r : '1y') as Range;
  const end = lastFinalFriday();
  const weeks = fridays(end, RANGES[range]);
  const heatWeeks = fridays(end, 54);
  const priceStart = range === 'all' ? '1900-01-01' : weeks[0];

  const [asset, pipe, px, weekly, heat, runs, year] = await Promise.all([
    assetInfo(symbol),
    activePipelineFor(symbol),
    prices(symbol, priceStart),
    weeklyPayloads(symbol, weeks),
    weeklyPayloads(symbol, heatWeeks),
    runsForSymbol(symbol),
    prices(symbol, fridays(end, 52)[0]),
  ]);
  if (!asset && !pipe && px.length === 0) notFound();
  const graph = pipe ? await graphForPipeline(pipe.name) : null;
  const parts = pipe ? components(pipe.nodes) : [];

  const cur = heat[end];
  const prevW = heatWeeks[heatWeeks.length - 2];
  const prev = heat[prevW];
  const delta = cur?.grade != null && prev?.grade != null ? Math.round(cur.grade) - Math.round(prev.grade) : null;
  const last = px.length ? px[px.length - 1] : null;
  const yr = year.map((p) => p.close);
  const link = (x: Range) => `/symbols/${encodeURIComponent(symbol)}?range=${x}`;
  const nodeVal = (nodes: Record<string, unknown> | undefined, k: string | null) => {
    if (!nodes || !k) return null;
    const v = nodes[k];
    return v && typeof v === 'object' ? (v as Record<string, unknown>).value : v;
  };
  const nodeGrade = (nodes: Record<string, unknown> | undefined, k: string) => {
    const v = nodes?.[k];
    return v && typeof v === 'object' && Number.isFinite(Number((v as Record<string, unknown>).grade)) ? Number((v as Record<string, unknown>).grade) : null;
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="text-sm text-fg-2"><Link href="/grades" className="hover:underline">Grades</Link> / {symbol}</div>
      <div className="flex flex-wrap items-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{symbol}</h1>
          <p className="text-sm text-fg-2">
            {asset?.name ?? symbol}
            {asset?.pull_method && <> · daily from {asset.pull_method}</>}
            {pipe && <> · graph {pipe.name}</>}
          </p>
          {last && (
            <p className="num mt-1 text-sm">
              {fmt(last.close)} close, {fmtDay(last.date)}
              {yr.length > 1 && <span className="text-fg-2"> · 52 weeks: {fmt(Math.min(...yr))}–{fmt(Math.max(...yr))}</span>}
            </p>
          )}
        </div>
        {cur && (
          <div className="flex items-center gap-3">
            <GradeChip grade={cur.grade} className="h-10 min-w-14 text-lg" />
            <div className="text-sm">
              <div><ReadingTag reading={cur.reading} /></div>
              <div className="num text-fg-2">
                {cur.points !== null && cur.max !== null && <>{cur.points} of {cur.max} points · </>}
                {delta === null ? 'no change data' : delta === 0 ? 'unchanged this week' : `${delta > 0 ? '+' : ''}${delta} this week`}
              </div>
            </div>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          {graph && <Link href={`/studio/graphs/${graph.id}`}><Button>Open graph in studio</Button></Link>}
          {graph && <Link href={`/studio/experiments/new?graph=${graph.id}`}><Button>Tune</Button></Link>}
        </div>
      </div>

      <Card
        title="Price and grade"
        actions={
          <div className="flex overflow-hidden rounded-control border border-line-2 text-xs">
            {(Object.keys(RANGES) as Range[]).map((x) => (
              <Link key={x} href={link(x)} className={`px-2 py-1 ${x === range ? 'bg-raised text-fg' : 'text-fg-2 hover:text-fg'}`}>{x.toUpperCase()}</Link>
            ))}
          </div>
        }
      >
        <PriceGradeChart prices={px} weekly={weeks.map((w) => ({ date: w, grade: weekly[w]?.grade ?? null }))} />
      </Card>

      {pipe && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title={`What makes up the grade${cur?.points != null && cur?.max != null ? ` · ${cur.points} / ${cur.max}` : ''}`} className="lg:col-span-2">
            <table className="w-full text-sm">
              <thead className="text-xs text-fg-3">
                <tr>
                  <th className="py-1 text-left font-medium">Part</th>
                  <th className="py-1 text-left font-medium">Rule</th>
                  <th className="py-1 text-right font-medium">Input</th>
                  <th className="py-1 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((c) => {
                  const g = nodeGrade(cur?.nodes, c.node);
                  const g0 = nodeGrade(prev?.nodes, c.node);
                  return (
                    <tr key={c.node} className="border-t border-line">
                      <td className="py-1.5 font-medium">{c.node.replace(/_GRADE$/, '')}</td>
                      <td className="py-1.5 text-xs text-fg-2">{c.describe}</td>
                      <td className="num py-1.5 text-right">{fmt(nodeVal(cur?.nodes, c.input) ?? nodeVal(cur?.nodes, c.node))}</td>
                      <td className="num py-1.5 text-right">
                        <PartScoreChip score={g} className="h-5 min-w-7" />
                        {g !== null && g0 !== null && g !== g0 && <span className={`ml-1 text-xs ${g > g0 ? 'text-positive' : 'text-negative'}`}>({g0}→{g})</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-fg-3">Each part scores 1–5: 5 = undervalued, 1 = overvalued (nextv0 colours). The grade is the total as a share of the maximum.</p>
          </Card>

          <Card title={`Runs on ${symbol}`} actions={graph ? <Link className="text-xs text-accent hover:underline" href="/studio/runs">All runs →</Link> : undefined}>
            {runs.length === 0 ? (
              <p className="text-sm text-fg-3">No backtests or experiments yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {runs.map((x) => (
                  <li key={x.id} className="flex items-center gap-2">
                    <span className="num rounded-chip bg-line px-1.5 text-[10px] text-fg-2">{x.kind}</span>
                    <Link href={x.kind === 'RUN' ? `/studio/runs/${x.id}` : `/studio/experiments/${x.id}`} className="truncate hover:text-accent">{x.name}</Link>
                    <span className="num ml-auto whitespace-nowrap text-xs text-fg-2">
                      {x.status === 'done' ? `${pct(x.cagr)} a year` : x.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {pipe && parts.length > 0 && (
        <Card title="Part scores, last 54 weeks">
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-px text-[10px]">
              <thead>
                <tr className="text-fg-3">
                  <th className="sticky left-0 bg-surface pr-2 text-left font-medium">Part</th>
                  {heatWeeks.map((w, i) => (
                    <th key={w} className="num font-normal" title={w}>{i % 4 === 0 ? short(w) : ''}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...parts.map((c) => c.node), '__TOTAL__'].map((k) => (
                  <tr key={k}>
                    <td className="sticky left-0 whitespace-nowrap bg-surface pr-2 text-xs">{k === '__TOTAL__' ? 'Grade' : k.replace(/_GRADE$/, '')}</td>
                    {heatWeeks.map((w) => {
                      const p = heat[w];
                      const g = k === '__TOTAL__' ? p?.grade ?? null : nodeGrade(p?.nodes, k);
                      return (
                        <td key={w} title={`${w}: ${g === null ? 'no data' : k === '__TOTAL__' ? Math.round(g) : g}`}>
                          {k === '__TOTAL__'
                            ? <GradeChip grade={g} className="h-5 min-w-0 w-3 px-0 text-[0px]" />
                            : <PartScoreChip score={g} className="h-5 min-w-0 w-3 px-0 text-[0px]" />}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
