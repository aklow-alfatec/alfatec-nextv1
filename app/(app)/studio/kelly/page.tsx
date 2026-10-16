'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@/components/ui';
import { EdgeForm } from '@/features/edges/edge-form';
import { DEFAULT_SET, edgeRequest, loadEdgeSet, saveEdgeSet, type EdgeSet } from '@/features/edges/edge-set';
import { engineApi, type KellyResult, type KellyRow, type Num } from '@/features/studio/api';

const pct = (v: Num | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '-' : `${(v * 100).toFixed(d)}%`);
const x = (v: Num | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? '-' : `${v.toFixed(2)}x`);

/** 'estimated x0.25' -> '1/4 Kelly', 'estimated x1' -> 'full Kelly'. */
function kellyLabel(label?: string) {
  const m = label?.replace('estimated x', '') ?? '';
  const named: Record<string, string> = { '0.25': '1/4 Kelly', '0.5': '1/2 Kelly', '1': 'full Kelly' };
  return named[m] ?? (m ? `${m} x Kelly` : label ?? '');
}

/** Growth (CAGR) and max drawdown against the fixed fraction of capital, hindsight. */
function KellyCurve({ rows, optimal }: { rows: KellyRow[]; optimal: KellyRow }) {
  const pts = rows.filter((r) => r.fraction !== undefined && r.cagr !== null);
  if (pts.length < 2) return null;
  const W = 640;
  const H = 220;
  const pad = 30;
  const xs = pts.map((r) => r.fraction as number);
  const maxX = Math.max(...xs);
  const ys = pts.flatMap((r) => [r.cagr ?? 0, r.max_drawdown ?? 0]);
  const lo = Math.min(-0.05, ...ys);
  const hi = Math.max(0.05, ...ys);
  const X = (f: number) => pad + (f / maxX) * (W - pad - 8);
  const Y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 8 - 20);
  const line = (key: 'cagr' | 'max_drawdown') => pts.map((r, i) => `${i ? 'L' : 'M'}${X(r.fraction as number)},${Y(r[key] ?? 0)}`).join('');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl">
      <line x1={pad} x2={W} y1={Y(0)} y2={Y(0)} className="stroke-line" />
      {[0, 1, 2, 3, 4, 5].filter((f) => f <= maxX).map((f) => (
        <g key={f}>
          <line x1={X(f)} x2={X(f)} y1={8} y2={H - 20} className="stroke-line" strokeDasharray="2 4" />
          <text x={X(f)} y={H - 6} textAnchor="middle" className="fill-fg-3 text-[10px]">{f}x</text>
        </g>
      ))}
      <path d={line('max_drawdown')} fill="none" className="stroke-negative" strokeWidth={1.5} />
      <path d={line('cagr')} fill="none" className="stroke-accent" strokeWidth={2} />
      {optimal.fraction !== undefined && optimal.fraction <= maxX && (
        <g>
          <line x1={X(optimal.fraction)} x2={X(optimal.fraction)} y1={8} y2={H - 20} className="stroke-accent" strokeDasharray="4 3" />
          <text x={X(optimal.fraction) + 4} y={18} className="fill-accent text-[10px]">full Kelly (hindsight) {x(optimal.fraction)}</text>
        </g>
      )}
      <text x={2} y={Y(hi) + 4} className="fill-fg-3 text-[10px]">{pct(hi, 0)}</text>
      <text x={2} y={Y(lo)} className="fill-fg-3 text-[10px]">{pct(lo, 0)}</text>
    </svg>
  );
}

export default function KellyPage() {
  const [set, setSet] = useState<EdgeSet>(DEFAULT_SET);
  const [k, setK] = useState(1);
  const [cap, setCap] = useState(1);
  const [res, setRes] = useState<KellyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setSet(loadEdgeSet()), []);
  const change = (s: EdgeSet) => {
    setSet(s);
    saveEdgeSet(s);
  };

  const run = async () => {
    setError('');
    setBusy(true);
    try {
      const ppy = set.timeframe === '1W' ? 52 : set.timeframe === '1M' ? 12 : 252;
      const window = set.timeframe === '1W' ? 156 : set.timeframe === '1M' ? 36 : 756;
      setRes(await engineApi.edgeKelly({ ...edgeRequest(set), k: Math.min(k, set.rules.length), cap, periods_per_year: ppy,
                                          window, min_obs: Math.round(window / 3) }));
    } catch (e) {
      setError((e as Error).message);
      setRes(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Kelly sizing</h1>
        <span className="text-sm text-fg-2">How much to hold while the edges are active, and what it costs in drawdown.</span>
        <Link href="/studio/edge-lab" className="ml-auto"><Button>Back to Edge Lab</Button></Link>
      </div>

      <Card
        title="Signal"
        actions={
          <div className="flex items-center gap-2 text-xs">
            <label>hold when at least</label>
            <Input type="number" min={1} max={set.rules.length || 1} value={k} onChange={(e) => setK(Math.max(1, Number(e.target.value)))} className="h-7 w-14" />
            <label>of {set.rules.length} edges are active · cap</label>
            <Input type="number" min={0.1} step={0.25} value={cap} onChange={(e) => setCap(Number(e.target.value))} className="h-7 w-16" />
            <span>x capital</span>
            <Button variant="primary" onClick={run} disabled={busy || !set.rules.length}>{busy ? 'Calculating...' : 'Calculate'}</Button>
          </div>
        }
      >
        <EdgeForm set={set} onChange={change} />
        {error && <p className="mt-2 text-xs text-negative">{error}</p>}
      </Card>

      {res && (
        <>
          <Card title={`Fixed fraction of capital, in hindsight (${res.weeks_in_position} bars in position)`}>
            <KellyCurve rows={res.curve} optimal={res.optimal} />
            <div className="mt-1 flex gap-4 text-[11px] text-fg-2">
              <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-accent" />growth per year (CAGR)</span>
              <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-negative" />max drawdown</span>
            </div>
            <p className="mt-2 text-xs text-fg-2">
              Best fixed size with hindsight: <b>{x(res.optimal.fraction)}</b> capital, {pct(res.optimal.cagr)} a year with a {pct(res.optimal.max_drawdown)} drawdown.
              It uses the whole history to pick the size, so it is a ceiling, never a setting.
            </p>
          </Card>

          <Card title="Sized only from past data (no hindsight)">
            <table className="w-full max-w-2xl text-xs">
              <thead className="text-fg-3">
                <tr>
                  {['Rule', 'Average size', 'CAGR', 'Max drawdown', 'Growth of 1'].map((h, i) => (
                    <th key={h} className={`p-1 font-medium ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {res.estimated.map((r) => (
                  <tr key={r.label} className="border-t border-line">
                    <td className="p-1">{kellyLabel(r.label)}</td>
                    <td className="num p-1 text-right">{x(r.mean_fraction)}</td>
                    <td className="num p-1 text-right">{pct(r.cagr)}</td>
                    <td className="num p-1 text-right text-negative">{pct(r.max_drawdown)}</td>
                    <td className="num p-1 text-right">{x(r.final)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-fg-3">
              Each bar the win rate and payoff are re-estimated from the previous {String(res.settings.window)} bars, then
              sized at a share of Kelly and capped at {x(res.settings.cap as number)}. This is what you could actually have
              done. Quarter Kelly is the usual safe default.
            </p>
            {res.estimated.every((r) => !r.mean_fraction) && (
              <p className="mt-2 rounded bg-warning/10 p-2 text-xs text-warning">
                Size 0 throughout: before each date there were fewer than {String(res.settings.min_obs)} bars in position, or the
                past win rate and payoff did not show a positive edge. Without hindsight this signal would never have been traded.
              </p>
            )}
          </Card>

          <Card title="Risk of ruin (bootstrap of the bar returns)">
            <table className="w-full max-w-2xl text-xs">
              <thead className="text-fg-3">
                <tr>
                  {['Size', 'Chance of losing half', 'Chance of a loss', 'Bad-case drawdown (5%)', 'Typical end value'].map((h, i) => (
                    <th key={h} className={`p-1 font-medium ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {res.ruin.map((r) => (
                  <tr key={r.label} className="border-t border-line">
                    <td className="p-1">{r.label}</td>
                    <td className={`num p-1 text-right ${(r.risk_of_ruin ?? 0) > 0.05 ? 'text-negative' : ''}`}>{pct(r.risk_of_ruin)}</td>
                    <td className="num p-1 text-right">{pct(r.prob_loss)}</td>
                    <td className="num p-1 text-right text-negative">{pct(r.max_drawdown_p05)}</td>
                    <td className="num p-1 text-right">{x(r.final_equity_p50)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] text-fg-3">
              {String(res.settings.n_paths)} reshuffled histories (blocks of {String(res.settings.block_size)} bars keep streaks together).
              &quot;Losing half&quot; = equity falls below {pct(res.settings.ruin_level as number, 0)} of the start at any point.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
