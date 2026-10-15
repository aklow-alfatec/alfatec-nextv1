'use client';

import React, { useMemo, useState } from 'react';
import type { StrategyReport, TradeRow } from './api';

const pct = (v: number | null | undefined, d = 1) => (v === null || v === undefined || !Number.isFinite(v) ? '-' : `${(v * 100).toFixed(d)}%`);
const num = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '-' : v.toFixed(d));
const money = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: 0 });
const day = (s: string) => s.slice(0, 10);

/** Equity vs buy-and-hold (top) and drawdown (bottom) as inline SVG; hover shows the values. */
export function EquityChart({ curve, height = 260 }: { curve: StrategyReport['curve']; height?: number }) {
  const [log, setLog] = useState(true);
  const [hover, setHover] = useState<number | null>(null);
  const n = curve.index.length;
  const W = 1000;
  const top = height * 0.68;
  const ddH = height - top - 14;

  const { eqPath, bhPath, ddPath, ticks, yOf } = useMemo(() => {
    const vals = [...curve.equity, ...(curve.benchmark ?? [])].filter((v): v is number => v !== null && v > 0);
    const f = (v: number) => (log ? Math.log(v) : v);
    const lo = f(Math.min(...vals));
    const hi = f(Math.max(...vals));
    const y = (v: number | null) => (v === null || v <= 0 ? null : 6 + (1 - (f(v) - lo) / (hi - lo || 1)) * (top - 12));
    const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
    const path = (arr: (number | null)[] | null, yf: (v: number | null) => number | null) => {
      if (!arr) return '';
      let d = '';
      let pen = false;
      arr.forEach((v, i) => {
        const yy = yf(v);
        if (yy === null) return void (pen = false);
        d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${yy.toFixed(1)}`;
        pen = true;
      });
      return d;
    };
    const minDd = Math.min(-0.0001, ...curve.drawdown.filter((v): v is number => v !== null));
    const ddY = (v: number | null) => (v === null ? null : top + 14 + (v / minDd) * ddH);
    const dd = path(curve.drawdown, ddY);
    const ddArea = dd ? `${dd}L${W},${top + 14}L0,${top + 14}Z` : '';
    const lvl = [0, 0.5, 1].map((k) => {
      const v = log ? Math.exp(lo + (hi - lo) * k) : lo + (hi - lo) * k;
      return { y: y(v) ?? 0, label: money(v) };
    });
    return { eqPath: path(curve.equity, y), bhPath: path(curve.benchmark, y), ddPath: ddArea, ticks: { lvl, minDd }, yOf: y };
  }, [curve, log, n, top, ddH]);

  const hi = hover === null ? null : Math.min(n - 1, Math.max(0, hover));
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-fg-2">
        <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-accent" />Strategy</span>
        {curve.benchmark && <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-4 bg-fg-3" />Buy and hold</span>}
        <span className="flex items-center gap-1"><i className="inline-block h-2 w-3 bg-negative/40" />Drawdown</span>
        <label className="ml-auto flex items-center gap-1">
          <input type="checkbox" checked={log} onChange={(e) => setLog(e.target.checked)} /> log scale
        </label>
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${height}`}
          preserveAspectRatio="none"
          className="block w-full"
          style={{ height }}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHover(Math.round(((e.clientX - r.left) / r.width) * (n - 1)));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.lvl.map((t, k) => (
            <line key={k} x1={0} x2={W} y1={t.y} y2={t.y} className="stroke-line" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={0} x2={W} y1={top + 14} y2={top + 14} className="stroke-line" vectorEffect="non-scaling-stroke" />
          <path d={ddPath} className="fill-negative/30" />
          {bhPath && <path d={bhPath} fill="none" className="stroke-fg-3" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />}
          <path d={eqPath} fill="none" className="stroke-accent" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
          {hi !== null && <line x1={(hi / Math.max(1, n - 1)) * W} x2={(hi / Math.max(1, n - 1)) * W} y1={0} y2={height} className="stroke-fg-2" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
          {hi !== null && curve.equity[hi] !== null && (
            <circle cx={(hi / Math.max(1, n - 1)) * W} cy={yOf(curve.equity[hi]) ?? 0} r={3} className="fill-accent" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 text-[10px] text-fg-3">
          {ticks.lvl.map((t, k) => (
            <span key={k} className="num absolute left-1" style={{ top: Math.max(0, t.y - 12) }}>{t.label}</span>
          ))}
          <span className="num absolute left-1" style={{ top: top + 16 }}>0%</span>
          <span className="num absolute bottom-0 left-1">{pct(ticks.minDd, 0)}</span>
        </div>
        {hi !== null && (
          <div className="pointer-events-none absolute right-1 top-1 rounded border border-line bg-surface/95 px-2 py-1 text-[11px] shadow">
            <div className="num text-fg-2">{day(curve.index[hi])}</div>
            <div className="num">Strategy {money(curve.equity[hi])}</div>
            {curve.benchmark && <div className="num text-fg-2">Buy and hold {money(curve.benchmark[hi])}</div>}
            <div className="num text-negative">Drawdown {pct(curve.drawdown[hi])}</div>
          </div>
        )}
      </div>
      <div className="num flex justify-between text-[10px] text-fg-3">
        <span>{n ? day(curve.index[0]) : ''}</span>
        <span>{n ? day(curve.index[n - 1]) : ''}</span>
      </div>
    </div>
  );
}

const ROWS: [string, string, (v: number | null | undefined) => string][] = [
  ['Total return', 'total_return', (v) => pct(v, 1)],
  ['CAGR', 'cagr', (v) => pct(v, 2)],
  ['Volatility', 'volatility', (v) => pct(v, 1)],
  ['Sharpe', 'sharpe', (v) => num(v)],
  ['Sortino', 'sortino', (v) => num(v)],
  ['Max drawdown', 'max_drawdown', (v) => pct(v, 1)],
  ['Calmar', 'calmar', (v) => num(v)],
  ['Time in market', 'exposure', (v) => pct(v, 0)],
];

export function MetricsTable({ report }: { report: StrategyReport }) {
  const m = report.metrics as Record<string, number>;
  const b = (report.benchmark ?? null) as Record<string, number> | null;
  const ts = report.trade_stats as Record<string, number> | null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-fg-3">
            <th className="py-1 text-left font-medium" />
            <th className="py-1 text-right font-medium">Strategy</th>
            {b && <th className="py-1 text-right font-medium">Buy and hold</th>}
          </tr>
        </thead>
        <tbody>
          {ROWS.map(([label, key, fmt]) => (
            <tr key={key} className="border-t border-line">
              <td className="py-1 text-fg-2">{label}</td>
              <td className="num py-1 text-right">{fmt(m[key])}</td>
              {b && <td className="num py-1 text-right text-fg-2">{key === 'exposure' ? '100%' : fmt(b[key])}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <table className="w-full self-start text-xs">
        <tbody>
          <tr className="border-t border-line"><td className="py-1 text-fg-2">Closed trades</td><td className="num py-1 text-right">{ts ? ts.trade_count : 0}</td></tr>
          <tr className="border-t border-line"><td className="py-1 text-fg-2">Win rate</td><td className="num py-1 text-right">{ts ? pct(ts.win_rate, 0) : '-'}</td></tr>
          <tr className="border-t border-line"><td className="py-1 text-fg-2">Profit factor</td><td className="num py-1 text-right">{ts ? (Number.isFinite(ts.profit_factor) ? num(ts.profit_factor) : 'no losses') : '-'}</td></tr>
          <tr className="border-t border-line"><td className="py-1 text-fg-2">Average trade</td><td className="num py-1 text-right">{ts ? money(ts.avg_trade) : '-'}</td></tr>
          <tr className="border-t border-line"><td className="py-1 text-fg-2">Average win / loss</td><td className="num py-1 text-right">{ts ? `${money(ts.avg_win)} / ${money(ts.avg_loss)}` : '-'}</td></tr>
          <tr className="border-t border-line"><td className="py-1 text-fg-2">Open at end</td><td className="num py-1 text-right">{report.open_position ? `${num(report.open_position, 4)} units` : 'flat'}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function TradesTable({ trades, limit = 200 }: { trades: TradeRow[]; limit?: number }) {
  if (!trades.length) return <p className="text-xs text-fg-3">No closed trades in this period.</p>;
  const shown = trades.slice(-limit).reverse();
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-surface">
          <tr className="text-fg-3">
            {['Entry', 'Exit', 'Side', 'Entry price', 'Exit price', 'Return', 'P&L', 'Bars', 'Reason'].map((h) => (
              <th key={h} className="px-1 py-1 text-right font-medium first:text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((t, k) => (
            <tr key={k} className="border-t border-line">
              <td className="num px-1 py-1">{day(t.entry)}</td>
              <td className="num px-1 py-1 text-right">{day(t.exit)}</td>
              <td className="px-1 py-1 text-right">{t.side}</td>
              <td className="num px-1 py-1 text-right">{num(t.entry_price)}</td>
              <td className="num px-1 py-1 text-right">{num(t.exit_price)}</td>
              <td className={`num px-1 py-1 text-right ${(t.return ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>{pct(t.return)}</td>
              <td className={`num px-1 py-1 text-right ${(t.pnl ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>{money(t.pnl)}</td>
              <td className="num px-1 py-1 text-right">{t.bars}</td>
              <td className="px-1 py-1 text-right text-fg-2">{t.reason ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {trades.length > limit && <p className="mt-1 text-[10px] text-fg-3">Latest {limit} of {trades.length} trades shown.</p>}
    </div>
  );
}

/** Full report for one strategy node: chart, metrics, trades. */
export function StrategyResult({ report, chartHeight }: { report: StrategyReport; chartHeight?: number }) {
  const [tab, setTab] = useState<'chart' | 'trades'>('chart');
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold">{report.node}</span>
        <span className="text-fg-3">{report.type}{report.price_ref ? ` · trades ${report.price_ref}` : ''}</span>
        <div className="ml-auto flex rounded border border-line-2">
          {(['chart', 'trades'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-2 py-0.5 ${tab === t ? 'bg-raised text-fg' : 'text-fg-2'}`}>
              {t === 'chart' ? 'Chart and metrics' : `Trades (${report.trades.length})`}
            </button>
          ))}
        </div>
      </div>
      {tab === 'chart' ? (
        <>
          <EquityChart curve={report.curve} height={chartHeight} />
          <MetricsTable report={report} />
        </>
      ) : (
        <TradesTable trades={report.trades} />
      )}
    </div>
  );
}
