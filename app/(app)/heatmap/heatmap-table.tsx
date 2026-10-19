'use client';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { Button, GradeChip, PartScoreChip, ReadingTag } from '@/components/ui';
import { inkOn, readingInfo, READINGS } from '@/lib/grade-zones';
import type { RiskRewardRow } from '@/lib/risk-reward';
import { groupBySection, type SectionKey } from '@/lib/sections';
import { dayDetailsAction, type DayDetails } from './actions';

export interface HeatRow {
  symbol: string;
  title: string;
  section: SectionKey;
  cells: { date: string; reading: number | null; grade: number | null }[];
  rr: RiskRewardRow | null;
}

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const BIAS_COLOR: Record<string, string> = { LONG: '#2F8FD8', SHORT: '#E0245E' };
const fmtNum = (v: number | null) =>
  v === null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 ? 5 : Math.abs(v) < 100 ? 3 : 1 });

/** nextv0's assets dashboard ("Heatmap Overview"): readings on four Fridays plus the risk / reward notes,
 *  grouped into the dashboard sections; a cell opens that Friday's grade breakdown. */
export function HeatmapTable({ rows, dates }: { rows: HeatRow[]; dates: string[] }) {
  const [sort, setSort] = useState<'name' | 'indicator'>('name');
  const [details, setDetails] = useState<DayDetails | null>(null);
  const [open, setOpen] = useState<{ symbol: string; date: string } | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const newest = dates[dates.length - 1];

  const sorted = useMemo(() => {
    const list = [...rows];
    const latest = (r: HeatRow) => r.cells[r.cells.length - 1]?.reading;
    list.sort((a, b) => {
      if (sort === 'indicator') {
        const x = latest(a) ?? 99, y = latest(b) ?? 99;   // -3 extremely undervalued first, no data last
        if (x !== y) return x - y;
      }
      return a.title.localeCompare(b.title);
    });
    return groupBySection(list);
  }, [rows, sort]);

  const show = (symbol: string, date: string) => {
    setOpen({ symbol, date });
    setDetails(null);
    setError('');
    start(async () => {
      try {
        const d = await dayDetailsAction(symbol, date);
        if (d) setDetails(d);
        else setError('No data for this day.');
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-xs text-fg-2">
        Sort by
        <select className="rounded-control border border-line-2 bg-bg px-2 py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'indicator')}>
          <option value="name">Name (A → Z)</option>
          <option value="indicator">Indicator (undervalued → overvalued)</option>
        </select>
      </label>

      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="text-xs text-fg-3">
            <tr className="border-b border-line">
              <th className="p-2 text-left font-medium">Asset</th>
              {dates.map((d) => (
                <th key={d} className={`p-2 text-center font-medium ${d === newest ? 'text-fg' : ''}`}>{fmtDay(d)}</th>
              ))}
              <th className="p-2 text-left font-medium">Position bias</th>
              <th className="p-2 text-right font-medium">Potential risk</th>
              <th className="p-2 text-right font-medium">Potential reward</th>
              <th className="p-2 text-right font-medium">Risk / reward</th>
              <th className="p-2 text-right font-medium">Est. duration</th>
            </tr>
          </thead>
          {sorted.map((s) => (
            <tbody key={s.key}>
              <tr>
                <td colSpan={dates.length + 6} className="bg-raised px-2 py-1.5 text-xs font-semibold text-fg-2">
                  {s.label} <span className="num ml-1 font-normal text-fg-3">{s.items.length}</span>
                </td>
              </tr>
              {s.items.map((r) => (
                <tr key={r.symbol} className="border-t border-line">
                  <td className="p-2 font-semibold">
                    <Link href={`/symbols/${encodeURIComponent(r.symbol)}`} className="hover:text-accent">{r.title}</Link>
                  </td>
                  {r.cells.map((c) => {
                    const info = readingInfo(c.reading);
                    return (
                      <td key={c.date} className="p-1">
                        {c.reading === null ? (
                          <div className="flex h-12 items-center justify-center text-xs text-fg-3">-</div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => show(r.symbol, c.date)}
                            className={`flex h-12 w-full items-center justify-center rounded-chip px-2 text-center text-[11px] leading-tight transition-opacity hover:opacity-85 ${c.date === newest ? 'font-bold' : 'font-medium'}`}
                            style={info.color ? { background: info.color, color: inkOn(info.color) } : undefined}
                            title={`${r.title} on ${fmtDay(c.date)}: grade ${c.grade === null ? '-' : Math.round(c.grade)}. Click for the breakdown.`}
                          >
                            {info.label}
                          </button>
                        )}
                      </td>
                    );
                  })}
                  <td className="p-2 text-xs font-bold" style={{ color: BIAS_COLOR[r.rr?.potential_bias ?? ''] }}>{r.rr?.potential_bias ?? 'NONE'}</td>
                  <td className="num p-2 text-right">{r.rr ? `${r.rr.potential_risk}%` : '-'}</td>
                  <td className="num p-2 text-right">{r.rr ? `${r.rr.potential_reward}%` : '-'}</td>
                  <td className="num p-2 text-right">{r.rr?.potential_risk_reward_ratio ?? '-'}</td>
                  <td className="num p-2 text-right">{r.rr ? `${r.rr.estimated_position_duration} months` : '-'}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-fg-3">
        <span className="mr-1">Reading</span>
        {[-3, -2, -1, 0, 1, 2, 3].map((k) => (
          <span key={k} className="rounded-chip px-2 py-1 font-semibold" style={{ background: READINGS[k].color, color: inkOn(READINGS[k].color) }}>{READINGS[k].label}</span>
        ))}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`${open.symbol} on ${open.date}`}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-card border border-line bg-surface shadow-xl">
            <div className="flex items-center gap-2 border-b border-line p-4">
              <span className="font-semibold">{open.symbol}</span>
              {details?.pipeline && <span className="text-xs text-fg-3">{details.pipeline}</span>}
              <span className="num text-xs text-fg-2">{fmtDay(open.date)}</span>
              <Button className="ml-auto" size="sm" onClick={() => setOpen(null)}>Close</Button>
            </div>
            <div className="p-4">
              {pending && <p className="text-sm text-fg-3">Loading...</p>}
              {error && <p className="text-sm text-negative">{error}</p>}
              {details && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <GradeChip grade={details.grade} />
                    <span className="num text-fg-2">{details.points ?? '-'} / {details.max ?? '-'} points</span>
                    <ReadingTag reading={details.reading} />
                    {details.date && details.date !== open.date && <span className="text-xs text-fg-3">(graded {fmtDay(details.date)})</span>}
                  </div>
                  {details.parts.length === 0 ? (
                    <p className="text-sm text-fg-3">No grading components found for this pipeline.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-xs text-fg-3">
                        <tr>
                          <th className="py-1 text-left font-medium">Component</th>
                          <th className="py-1 text-right font-medium">Value</th>
                          <th className="py-1 text-center font-medium">Score</th>
                          <th className="py-1 pl-3 text-left font-medium">Rule</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.parts.map((p) => (
                          <tr key={p.node} className="border-t border-line">
                            <td className="py-1.5 font-medium">{p.input ?? p.node.replace(/_GRADE$/, '')}</td>
                            <td className="num py-1.5 text-right">{fmtNum(p.value)}</td>
                            <td className="py-1.5 text-center"><PartScoreChip score={p.score} /></td>
                            <td className="py-1.5 pl-3 text-xs text-fg-2">{p.rule}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <p className="text-[11px] text-fg-3">Score 5 = undervalued, 1 = overvalued.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
