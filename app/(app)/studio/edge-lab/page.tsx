'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { EdgeForm } from '@/features/edges/edge-form';
import { DEFAULT_SET, edgeRequest, loadEdgeSet, saveEdgeSet, type EdgeSet } from '@/features/edges/edge-set';
import { engineApi, type EdgeOverlapResult, type EdgeStackResult, type EdgeStatsResult, type Num } from '@/features/studio/api';

const pct = (v: Num | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '-' : `${(v * 100).toFixed(d)}%`);
const num = (v: Num | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '-' : v.toFixed(d));
const liftCls = (v: Num | undefined) => (v === null || v === undefined ? 'text-fg-3' : v > 0.02 ? 'text-positive' : v < -0.02 ? 'text-negative' : 'text-fg-2');

/** Lift by year as small bars around zero. */
function LiftBars({ rows }: { rows: { period: string; n: Num; lift: Num }[] }) {
  const max = Math.max(0.05, ...rows.map((r) => Math.abs(r.lift ?? 0)));
  const w = 6;
  return (
    <svg width={rows.length * w} height={32} aria-label="lift by year">
      <line x1={0} x2={rows.length * w} y1={16} y2={16} className="stroke-line" />
      {rows.map((r, i) => {
        const v = r.lift;
        const h = v === null ? 1 : Math.max(1, (Math.abs(v) / max) * 14);
        return (
          <rect key={r.period} x={i * w} width={w - 1} y={v === null || v >= 0 ? 16 - h : 16} height={h}
                className={v === null ? 'fill-line' : v >= 0 ? 'fill-positive' : 'fill-negative'}>
            <title>{`${r.period}: ${v === null ? 'no occurrences' : `lift ${pct(v)} (n ${r.n})`}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export default function EdgeLabPage() {
  const [set, setSet] = useState<EdgeSet>(DEFAULT_SET);
  const [stats, setStats] = useState<EdgeStatsResult | null>(null);
  const [overlap, setOverlap] = useState<EdgeOverlapResult | null>(null);
  const [stack, setStack] = useState<EdgeStackResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setSet(loadEdgeSet()), []);
  const change = (s: EdgeSet) => {
    setSet(s);
    saveEdgeSet(s);
  };

  const evaluate = async () => {
    setError('');
    setBusy(true);
    try {
      const body = { ...edgeRequest(set), n_tests: set.rules.length };
      const [a, b, c] = await Promise.all([engineApi.edgeStats(body), engineApi.edgeOverlap(body), engineApi.edgeStack(body)]);
      setStats(a);
      setOverlap(b);
      setStack(c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const base = stats?.edges[0]?.stats.base_rate;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Edge Lab</h1>
        <span className="text-sm text-fg-2">Does a condition make the next {set.horizon} bars better than usual?</span>
        <Link href="/studio/kelly" className="ml-auto"><Button>Size these edges (Kelly)</Button></Link>
      </div>

      <Card title="Edges" actions={<Button variant="primary" onClick={evaluate} disabled={busy || !set.rules.length}>{busy ? 'Evaluating...' : 'Evaluate'}</Button>}>
        <EdgeForm set={set} onChange={change} />
        {error && <p className="mt-2 text-xs text-negative">{error}</p>}
      </Card>

      {stats && (
        <Card title={`Each edge vs the base rate${base !== undefined ? ` (${set.asset} rose over ${set.horizon} bars ${pct(base)} of the time)` : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-fg-3">
                <tr>
                  {['Edge', 'Occurrences', 'Active', 'Win rate', 'Lift', 'Payoff', 'Expectancy', 'Kelly', 't-stat', 'Years with positive lift', 'Lift by year'].map((h, i) => (
                    <th key={h} className={`p-1 font-medium ${i === 0 || i === 10 ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.edges.map((e) => (
                  <tr key={e.name} className="border-t border-line">
                    <td className="p-1 font-medium">{e.name}</td>
                    <td className="num p-1 text-right">{e.stats.n ?? 0}</td>
                    <td className="num p-1 text-right">{pct(e.stats.active_share, 0)}</td>
                    <td className="num p-1 text-right">{pct(e.stats.win_rate)}</td>
                    <td className={`num p-1 text-right font-semibold ${liftCls(e.stats.lift)}`}>{pct(e.stats.lift)}</td>
                    <td className="num p-1 text-right">{num(e.stats.payoff)}</td>
                    <td className="num p-1 text-right">{pct(e.stats.expectancy, 2)}</td>
                    <td className="num p-1 text-right">{pct(e.stats.kelly, 0)}</td>
                    <td className="num p-1 text-right">{num(e.stats.t_stat, 1)}</td>
                    <td className="num p-1 text-right">{pct(e.share_positive_lift, 0)}</td>
                    <td className="p-1"><LiftBars rows={e.stability} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-fg-3">
            Lift = win rate minus the base rate; an edge is only useful if it beats how often the asset rises anyway.
            Occurrences overlap when the horizon is longer than one bar, so the t-stat overstates confidence; small
            counts (under ~30) are anecdotes.
          </p>
        </Card>
      )}

      {overlap && overlap.names.length > 1 && (
        <Card title="Overlap: how often edges are active together">
          <table className="text-xs">
            <thead>
              <tr>
                <th />
                {overlap.names.map((n) => <th key={n} className="p-1 text-right font-medium text-fg-3">{n}</th>)}
              </tr>
            </thead>
            <tbody>
              {overlap.names.map((a, i) => (
                <tr key={a}>
                  <td className="p-1 pr-3 text-fg-2">{a}</td>
                  {overlap.names.map((b, j) => {
                    const v = overlap.co_occurrence[i][j];
                    return (
                      <td key={b} className="num p-1 text-right" style={{ background: i === j || v === null ? undefined : `rgb(var(--accent) / ${Math.min(0.6, v)})` }}>
                        {i === j ? '-' : pct(v, 0)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-fg-3">Share of active weeks two edges have in common. Above ~50% they mostly say the same thing, so stacking them double counts.</p>
        </Card>
      )}

      {stack && (
        <Card title="Stacking: win rate by number of active edges">
          <table className="w-full max-w-2xl text-xs">
            <thead className="text-fg-3">
              <tr>
                {['Active edges', 'Occurrences', 'Win rate', 'Lift', 'Expectancy', 'p (adjusted)'].map((h, i) => (
                  <th key={h} className={`p-1 font-medium ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stack.curve.map((r) => (
                <tr key={r.n_active} className="border-t border-line">
                  <td className="p-1">{r.n_active}</td>
                  <td className="num p-1 text-right">{r.n}</td>
                  <td className="num p-1 text-right">
                    <span className="mr-2 inline-block h-2 bg-accent/60 align-middle" style={{ width: `${(r.win_rate ?? 0) * 80}px` }} />
                    {pct(r.win_rate)}
                  </td>
                  <td className={`num p-1 text-right ${liftCls(r.lift)}`}>{pct(r.lift)}</td>
                  <td className="num p-1 text-right">{pct(r.expectancy, 2)}</td>
                  <td className={`num p-1 text-right ${(r.p_holm ?? 1) < 0.05 ? 'text-positive' : 'text-fg-3'}`}>{num(r.p_holm, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-fg-3">
            Stacking is rarely additive: look for a steady rise with enough occurrences, not one lucky bucket. p is
            adjusted for the number of edges tested (Holm).
          </p>
        </Card>
      )}
    </div>
  );
}
