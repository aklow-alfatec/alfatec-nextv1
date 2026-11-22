'use client';
import { useState, useTransition } from 'react';
import { Button, GradeChip, PartScoreChip, ReadingTag } from '@/components/ui';
import { ChannelButton } from '@/features/charts/channel-button';
import { dayDetailsAction, type DayDetails } from './actions';

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtNum = (v: number | null) =>
  v === null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 ? 5 : Math.abs(v) < 100 ? 3 : 1 });

/** State for the grade breakdown of one asset on one Friday (Grades cells, Dashboard alerts): `show` opens it. */
export function useDayDetails() {
  const [open, setOpen] = useState<{ symbol: string; date: string } | null>(null);
  const [details, setDetails] = useState<DayDetails | null>(null);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
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
  return { open, details, error, pending, show, close: () => setOpen(null) };
}

/** The breakdown dialog: grade, points, reading and each component's score (names masked for guests by the server). */
export function DayDetailsDialog({ state }: { state: ReturnType<typeof useDayDetails> }) {
  const { open, details, error, pending, close } = state;
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`${open.symbol} on ${open.date}`}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-card border border-line bg-surface shadow-xl">
        <div className="flex items-center gap-2 border-b border-line p-4">
          <span className="font-semibold">{open.symbol}</span>
          {details?.pipeline && <span className="text-xs text-fg-3">{details.pipeline}</span>}
          <span className="num text-xs text-fg-2">{fmtDay(open.date)}</span>
          <Button className="ml-auto" size="sm" onClick={close}>Close</Button>
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
                        <td className="py-1.5 font-medium">
                          {p.channel ? <ChannelButton symbol={open.symbol} node={p.node} label={p.input ?? p.node.replace(/_GRADE$/, '')} /> : p.input ?? p.node.replace(/_GRADE$/, '')}
                        </td>
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
  );
}
