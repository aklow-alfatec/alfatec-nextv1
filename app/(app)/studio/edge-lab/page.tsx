'use client';
import Link from 'next/link';
import { Fragment, useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { EdgeForm } from '@/features/edges/edge-form';
import { DEFAULT_SET, edgeRequest, loadEdgeSet, saveEdgeSet, type EdgeSet } from '@/features/edges/edge-set';
import { engineApi, type EdgeOverlapResult, type EdgeStackResult, type EdgeStatsResult, type EdgeStatsRow, type Num } from '@/features/studio/api';

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

/** Win rate against the threshold for one swept graph edge, base rate dashed, occurrences as bars. */
function ThresholdCurve({ title, rows }: { title: string; rows: EdgeStatsRow[] }) {
  const pts = rows.filter((r) => r.value !== null).sort((a, b) => (a.value as number) - (b.value as number));
  if (pts.length < 2) return null;
  const W = 360;
  const H = 150;
  const base = pts[0].stats.base_rate ?? 0;
  const wrs = pts.map((r) => r.stats.win_rate).filter((v): v is number => v !== null);
  const lo = Math.max(0, Math.min(base, ...wrs) - 0.05);
  const hi = Math.min(1, Math.max(base, ...wrs) + 0.05);
  const maxN = Math.max(1, ...pts.map((r) => r.stats.n ?? 0));
  const xs = pts.map((r) => r.value as number);
  const X = (v: number) => 30 + ((v - xs[0]) / (xs[xs.length - 1] - xs[0] || 1)) * (W - 40);
  const Y = (v: number) => 8 + (1 - (v - lo) / (hi - lo || 1)) * (H - 50);
  const line = pts.filter((r) => r.stats.win_rate !== null).map((r, i) => `${i ? 'L' : 'M'}${X(r.value as number)},${Y(r.stats.win_rate as number)}`).join('');
  return (
    <div>
      <div className="mb-1 text-xs font-medium">{title}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md">
        {pts.map((r) => {
          const h = ((r.stats.n ?? 0) / maxN) * 26;
          return <rect key={r.name} x={X(r.value as number) - 5} y={H - 18 - h} width={10} height={h} className="fill-line" />;
        })}
        <line x1={30} x2={W - 10} y1={Y(base)} y2={Y(base)} className="stroke-fg-3" strokeDasharray="4 3" />
        <text x={W - 10} y={Y(base) - 3} textAnchor="end" className="fill-fg-3 text-[9px]">base {pct(base)}</text>
        <path d={line} fill="none" className="stroke-accent" strokeWidth={2} />
        {pts.map((r) =>
          r.stats.win_rate === null ? null : (
            <circle key={r.name} cx={X(r.value as number)} cy={Y(r.stats.win_rate)} r={3.5}
                    className={(r.p_holm ?? 1) < 0.05 ? 'fill-positive' : 'fill-surface stroke-accent'}>
              <title>{`${r.name}: win ${pct(r.stats.win_rate)}, lift ${pct(r.stats.lift)}, n ${r.stats.n ?? 0}, adjusted p ${num(r.p_holm, 3)}`}</title>
            </circle>
          ),
        )}
        {pts.map((r) => (
          <text key={r.name} x={X(r.value as number)} y={H - 4} textAnchor="middle" className="fill-fg-3 text-[9px]">{r.value}</text>
        ))}
        <text x={2} y={Y(hi) + 8} className="fill-fg-3 text-[9px]">{pct(hi, 0)}</text>
        <text x={2} y={Y(lo)} className="fill-fg-3 text-[9px]">{pct(lo, 0)}</text>
      </svg>
      <p className="text-[10px] text-fg-3">Line = win rate at each threshold; bars = occurrences; a filled dot = adjusted p below 0.05.</p>
    </div>
  );
}

export default function EdgeLabPage() {
  const [set, setSet] = useState<EdgeSet>(DEFAULT_SET);
  const [stats, setStats] = useState<EdgeStatsResult | null>(null);
  const [overlap, setOverlap] = useState<EdgeOverlapResult | null>(null);
  const [stack, setStack] = useState<EdgeStackResult | null>(null);
  const [comboNote, setComboNote] = useState('');
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
      const body = edgeRequest(set);
      setStats(await engineApi.edgeStats(body));
      // overlap and stacking need edges that can be combined (rules, bool outputs, pinned sweep values)
      const [b, c] = await Promise.allSettled([engineApi.edgeOverlap(body), engineApi.edgeStack(body)]);
      setOverlap(b.status === 'fulfilled' ? b.value : null);
      setStack(c.status === 'fulfilled' ? c.value : null);
      setComboNote(c.status === 'rejected' ? (c.reason as Error).message : '');
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

      <Card title="Edges" actions={<Button variant="primary" onClick={evaluate} disabled={busy || (!set.rules.length && !(set.graphEdges ?? []).some((g) => g.graphId && g.ref))}>{busy ? 'Evaluating...' : 'Evaluate'}</Button>}>
        <EdgeForm set={set} onChange={change} />
        {error && <p className="mt-2 text-xs text-negative">{error}</p>}
      </Card>

      {stats && (
        <Card title={`Each edge vs the base rate${base !== undefined ? ` (${set.asset} rose over ${set.horizon} bars ${pct(base)} of the time)` : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-fg-3">
                <tr>
                  {['Edge', 'Occurrences', 'Active', 'Win rate', 'Lift', 'Payoff', 'Expectancy', 'Kelly', 'p', 'Adjusted p', 'Years with positive lift', 'Lift by year'].map((h, i) => (
                    <th key={h} className={`p-1 font-medium ${i === 0 || i === 11 ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.edges.map((e, i) => {
                  const first = e.group !== null && stats.edges[i - 1]?.group !== e.group;
                  return (
                  <Fragment key={e.name}>
                  {first && (
                    <tr className="border-t border-line bg-raised/50">
                      <td colSpan={12} className="p-1 font-semibold">{e.group}</td>
                    </tr>
                  )}
                  <tr className={`border-t border-line ${(e.p_holm ?? 1) < 0.05 ? 'bg-positive/5' : ''}`}>
                    <td className={`p-1 ${e.group ? 'pl-4 text-fg-2' : 'font-medium'}`}>
                      {e.group && e.value !== null ? e.name.slice(e.group.length + 1) : e.name}
                      {e.group && e.in_stack && e.value !== null && <span className="ml-1 rounded-chip bg-accent/15 px-1 text-[10px] text-accent">in stack</span>}
                    </td>
                    <td className="num p-1 text-right">{e.stats.n ?? 0}</td>
                    <td className="num p-1 text-right">{pct(e.stats.active_share, 0)}</td>
                    <td className="num p-1 text-right">{pct(e.stats.win_rate)}</td>
                    <td className={`num p-1 text-right font-semibold ${liftCls(e.stats.lift)}`}>{pct(e.stats.lift)}</td>
                    <td className="num p-1 text-right">{num(e.stats.payoff)}</td>
                    <td className="num p-1 text-right">{pct(e.stats.expectancy, 2)}</td>
                    <td className="num p-1 text-right">{pct(e.stats.kelly, 0)}</td>
                    <td className="num p-1 text-right">{num(e.p_value, 3)}</td>
                    <td className={`num p-1 text-right ${(e.p_holm ?? 1) < 0.05 ? 'font-semibold text-positive' : 'text-fg-2'}`}>{num(e.p_holm, 3)}</td>
                    <td className="num p-1 text-right">{pct(e.share_positive_lift, 0)}</td>
                    <td className="p-1"><LiftBars rows={e.stability} /></td>
                  </tr>
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-fg-3">
            Lift = win rate minus the base rate; an edge is only useful if it beats how often the asset rises anyway.
            p tests the win rate against the base rate on non-overlapping outcomes (occurrences ÷ {stats.effective_n_divisor},
            since {stats.effective_n_divisor}-bar outcomes of neighbouring bars overlap). Adjusted p corrects for all{' '}
            <b>{stats.n_tests} tests in this evaluation</b> (Holm): a sweep of many thresholds pays for itself here.
            {stats.graphs.length > 0 && <> Graphs used: {stats.graphs.map((g) => `${g.name} v${g.version ?? '?'}`).join(', ')}.</>}
          </p>
          {(() => {
            const groups = Array.from(new Set(stats.edges.filter((e) => e.group && e.value !== null).map((e) => e.group as string)));
            return groups.length ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {groups.map((g) => <ThresholdCurve key={g} title={g} rows={stats.edges.filter((e) => e.group === g)} />)}
              </div>
            ) : null;
          })()}
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
          {overlap.ignored && overlap.ignored.length > 0 && <p className="mt-2 text-[11px] text-warning">Not included (no pinned value): {overlap.ignored.join(', ')}</p>}
          <p className="mt-2 text-[11px] text-fg-3">Share of active weeks two edges have in common. Above ~50% they mostly say the same thing, so stacking them double counts.</p>
        </Card>
      )}

      {comboNote && !stack && (
        <Card title="Stacking">
          <p className="text-xs text-fg-2">{comboNote}</p>
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
            adjusted for the {stack.n_tests ?? stack.n_edges} tests in this evaluation (Holm).
            {stack.ignored && stack.ignored.length > 0 && <> Not included (no pinned value): {stack.ignored.join(', ')}.</>}
          </p>
        </Card>
      )}
    </div>
  );
}
