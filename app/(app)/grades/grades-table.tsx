'use client';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button, GradeChip, PartScoreChip, ReadingTag } from '@/components/ui';
import type { RiskRewardRow } from '@/lib/risk-reward';
import { groupBySection, type SectionKey } from '@/lib/sections';
import { dayDetailsAction, type DayDetails } from './actions';

export interface GradeRow {
  symbol: string;
  title: string;
  section: SectionKey;
  grades: (number | null)[];
  delta: number | null;
  readingValue: number | null;
  rr: RiskRewardRow | null;
}

const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const yearOf = (d: string) => d.slice(0, 4);
const BIAS_COLOR: Record<string, string> = { LONG: '#2F8FD8', SHORT: '#E0245E' };
/** When a risk / reward note was last saved, in the viewer's time zone: "20 Oct 2026, 11:16". */
const fmtSaved = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// the same row heights in both tables keep their rows lined up
const HEAD = 'h-6';
const SECTION = 'h-8';
const ROW = 'h-7';
const fmtNum = (v: number | null) =>
  v === null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 ? 5 : Math.abs(v) < 100 ? 3 : 1 });

/** Weekly grade grid grouped into the dashboard sections, with the reading and each asset's risk / reward notes
 *  (nextv0's assets dashboard, merged in); a grade opens that Friday's breakdown. */
export function GradesTable({ rows, weeks }: { rows: GradeRow[]; weeks: string[] }) {
  const [open, setOpen] = useState<{ symbol: string; date: string } | null>(null);
  const [details, setDetails] = useState<DayDetails | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const wide = weeks.length > 12;
  const sections = groupBySection(rows);
  const leftCols = weeks.length + 3;

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
    <>
      {/* two tables with matching row heights: the grades on the left, the risk / reward details on the right, which
          scroll sideways on their own */}
      <div className="flex items-start">
        <div className="max-w-[85%] shrink-0 overflow-x-auto md:max-w-[75%]">
          <table className="border-separate border-spacing-1 text-xs">
            <thead>
              <tr className={`${HEAD} text-fg-3`}>
                <th className="sticky left-0 z-10 bg-surface pr-2 text-left font-medium">Asset</th>
                {weeks.map((w, i) => (
                  <th key={w} className="num min-w-10 font-normal" title={w}>
                    {wide ? (i === 0 || yearOf(w) !== yearOf(weeks[i - 1]) ? yearOf(w) : '') : short(w)}
                  </th>
                ))}
                <th className="num pl-2 text-right font-medium">Δ</th>
                <th className="pl-3 text-left font-medium">Grades</th>
              </tr>
            </thead>
            {sections.map((s) => (
              <tbody key={s.key}>
                <tr className={SECTION}>
                  <td colSpan={leftCols} className={`sticky left-0 align-bottom text-[11px] font-semibold uppercase tracking-wider ${s.key === 'other' ? 'text-fg-2' : 'text-[#EA7A12]'}`}>
                    {s.label} <span className="num ml-1 font-normal text-fg-3">{s.items.length}</span>
                  </td>
                </tr>
                {s.items.map((r) => (
                  <tr key={r.symbol} className={ROW}>
                    <td className="sticky left-0 z-10 bg-surface pr-2">
                      <Link href={`/symbols/${encodeURIComponent(r.symbol)}`} className="whitespace-nowrap font-semibold hover:text-accent">{r.title}</Link>
                    </td>
                    {r.grades.map((g, i) => (
                      <td key={weeks[i]} className={wide ? 'p-0' : 'text-center'}>
                        {g === null ? (
                          <GradeChip grade={null} className={wide ? 'h-6 min-w-0 w-2 px-0 text-[0px]' : undefined} />
                        ) : (
                          <button
                            type="button"
                            onClick={() => show(r.symbol, weeks[i])}
                            className="rounded-chip transition-opacity hover:opacity-80"
                            title={`${r.title} ${weeks[i]}: grade ${g.toFixed(0)}. Click for the breakdown.`}
                          >
                            <GradeChip grade={g} className={wide ? 'h-6 min-w-0 w-2 px-0 text-[0px]' : undefined} />
                          </button>
                        )}
                      </td>
                    ))}
                    <td className={`num pl-2 text-right ${r.delta ? (r.delta > 0 ? 'text-positive' : 'text-negative') : 'text-fg-3'}`}>
                      {r.delta === null ? '-' : r.delta > 0 ? `+${r.delta}` : r.delta}
                    </td>
                    <td className="whitespace-nowrap pl-3"><ReadingTag reading={r.readingValue} className="w-40 justify-center" /></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto border-l border-line">
          <table className="border-separate border-spacing-1 text-xs">
            <thead>
              <tr className={`${HEAD} whitespace-nowrap text-fg-3`}>
                <th className="pl-3 text-left font-medium">Position bias</th>
                <th className="pl-3 text-right font-medium">Potential risk</th>
                <th className="pl-3 text-right font-medium">Potential reward</th>
                <th className="pl-3 text-right font-medium">Risk / reward</th>
                <th className="pl-3 text-right font-medium">Est. duration</th>
                <th className="pl-3 text-right font-medium">Last updated</th>
              </tr>
            </thead>
            {sections.map((s) => (
              <tbody key={s.key}>
                <tr className={SECTION}><td colSpan={6} /></tr>
                {s.items.map((r) => (
                  <tr key={r.symbol} className={`${ROW} whitespace-nowrap`}>
                    <td className="pl-3 font-bold" style={{ color: BIAS_COLOR[r.rr?.potential_bias ?? ''] }}>{r.rr?.potential_bias ?? '-'}</td>
                    <td className="num pl-3 text-right">{r.rr ? `${r.rr.potential_risk}%` : '-'}</td>
                    <td className="num pl-3 text-right">{r.rr ? `${r.rr.potential_reward}%` : '-'}</td>
                    <td className="num pl-3 text-right">{r.rr?.potential_risk_reward_ratio ?? '-'}</td>
                    <td className="num pl-3 text-right">{r.rr ? `${r.rr.estimated_position_duration} months` : '-'}</td>
                    <td className="num pl-3 text-right text-fg-2" title={r.rr?.edited_at ?? undefined} suppressHydrationWarning>
                      {r.rr?.edited_at ? fmtSaved(r.rr.edited_at) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
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
                          {!details.masked && <th className="py-1 text-right font-medium">Value</th>}
                          <th className="py-1 text-center font-medium">Score</th>
                          {!details.masked && <th className="py-1 pl-3 text-left font-medium">Rule</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {details.parts.map((p) => (
                          <tr key={p.node} className="border-t border-line">
                            <td className="py-1.5 font-medium">{p.input ?? p.node.replace(/_GRADE$/, '')}</td>
                            {!details.masked && <td className="num py-1.5 text-right">{fmtNum(p.value)}</td>}
                            <td className="py-1.5 text-center"><PartScoreChip score={p.score} /></td>
                            {!details.masked && <td className="py-1.5 pl-3 text-xs text-fg-2">{p.rule}</td>}
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
    </>
  );
}
