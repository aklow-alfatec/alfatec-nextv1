'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button, GradeChip, PartScoreChip, ReadingTag } from '@/components/ui';
import type { RiskRewardRow } from '@/lib/risk-reward';
import { groupBySection, type SectionKey } from '@/lib/sections';
import { DayDetailsDialog, useDayDetails } from './day-details-dialog';

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

/** The split between the grades and the details: % of the width the grades may take. Default 2/3 on narrow screens,
 *  3/4 on wide ones; dragged positions are kept per browser. */
const SPLIT_KEY = 'alfatec.grades.split';
const COLLAPSED_KEY = 'alfatec.grades.collapsed';
const SPLIT_MIN = 25;
const SPLIT_MAX = 90;
const defaultSplit = () => (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches ? 75 : 100 * (2 / 3));
const fmtNum = (v: number | null) =>
  v === null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 ? 5 : Math.abs(v) < 100 ? 3 : 1 });

/** A sideways-scrolling area with a second scrollbar above it, kept in step with the one below. The bar above always
 *  takes its height (invisible when nothing overflows), so two panes side by side keep their rows level. */
function TopScroll({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const top = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState({ scroll: 0, client: 0 });
  useEffect(() => {
    const m = main.current;
    if (!m) return;
    const measure = () => setWide({ scroll: m.scrollWidth, client: m.clientWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(m);
    if (m.firstElementChild) ro.observe(m.firstElementChild);
    return () => ro.disconnect();
  }, []);
  const sync = (from: 'top' | 'main') => {
    const a = from === 'top' ? top.current : main.current;
    const b = from === 'top' ? main.current : top.current;
    if (a && b && b.scrollLeft !== a.scrollLeft) b.scrollLeft = a.scrollLeft;
  };
  const overflow = wide.scroll > wide.client + 1;
  return (
    <div className={className} style={style}>
      <div ref={top} onScroll={() => sync('top')} className="mb-1 overflow-x-auto overflow-y-hidden rounded-full bg-raised" style={{ height: 14, visibility: overflow ? 'visible' : 'hidden' }} aria-hidden>
        <div style={{ width: wide.scroll, height: 1 }} />
      </div>
      <div ref={main} onScroll={() => sync('main')} className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

/** Weekly grade grid grouped into the dashboard sections, with the reading and each asset's risk / reward notes
 *  (nextv0's assets dashboard, merged in); a grade opens that Friday's breakdown. */
export function GradesTable({ rows, weeks }: { rows: GradeRow[]; weeks: string[] }) {
  const dd = useDayDetails();
  const { show } = dd;
  const box = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(100 * (2 / 3));
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let saved = NaN;
    try {
      saved = Number(localStorage.getItem(SPLIT_KEY));
    } catch {
      /* storage blocked: use the default */
    }
    setSplit(Number.isFinite(saved) && saved >= SPLIT_MIN && saved <= SPLIT_MAX ? saved : defaultSplit());
  }, []);
  const dragTo = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return;
    setSplit(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ((clientX - r.left) / r.width) * 100)));
  };
  const endDrag = () => {
    setDragging(false);
    try {
      localStorage.setItem(SPLIT_KEY, String(Math.round(split * 10) / 10));
    } catch {
      /* storage blocked: the position just isn't kept */
    }
  };
  // groups (Commodity, Index, ETF, Stocks) fold like the dashboard's; the choice is kept in this browser
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setCollapsed(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '{}'));
    } catch {
      /* nothing kept */
    }
  }, []);
  const toggleGroup = (key: string) =>
    setCollapsed((c) => {
      const next = { ...c, [key]: !c[key] };
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        /* storage blocked: not kept */
      }
      return next;
    });
  const setAll = (fold: boolean) => {
    const next = Object.fromEntries(groupBySection(rows).map((s) => [s.key, fold]));
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: not kept */
    }
  };
  const wide = weeks.length > 12;
  const sections = groupBySection(rows);
  const leftCols = weeks.length + 3;
  // the dashboard's band counts, on each group's latest grade
  const band = (items: GradeRow[]) => {
    const last = items.map((r) => r.grades[r.grades.length - 1]).filter((g): g is number => g !== null);
    return { under: last.filter((g) => g >= 80).length, normal: last.filter((g) => g >= 40 && g < 80).length, over: last.filter((g) => g < 40).length };
  };

  return (
    <>
      <div className="mb-2 flex justify-end gap-2">
        <Button size="sm" onClick={() => setAll(false)}>Expand all</Button>
        <Button size="sm" onClick={() => setAll(true)}>Collapse all</Button>
      </div>
      {/* two tables with matching row heights: the grades on the left, the risk / reward details on the right, which
          scroll sideways on their own */}
      <div ref={box} className={`flex items-stretch ${dragging ? 'select-none' : ''}`}>
        <TopScroll className="shrink-0" style={{ maxWidth: `${split}%` }}>
          <table className="border-separate border-spacing-1 text-xs">
            <thead>
              <tr className={`${HEAD} text-fg-3`}>
                <th className="sticky left-0 z-10 bg-surface pr-2 text-left font-medium">Assets</th>
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
                  <td colSpan={leftCols} className="border-b border-line align-bottom">
                    {/* like the dashboard's groups: the title stays at the left while the weeks scroll under it; click to
                        fold the group */}
                    <button
                      type="button"
                      onClick={() => toggleGroup(s.key)}
                      aria-expanded={!collapsed[s.key]}
                      className="sticky left-0 z-10 inline-flex items-center gap-2 whitespace-nowrap bg-surface pb-0.5 pr-3 text-left text-sm hover:opacity-80"
                    >
                      <span className={`text-fg-3 transition-transform ${collapsed[s.key] ? '' : 'rotate-90'}`}>›</span>
                      <span className={`font-semibold ${s.key === 'other' ? '' : 'text-[#EA7A12]'}`}>{s.label}</span>
                      <span className="num rounded-chip bg-line px-1.5 text-[11px] text-fg-2">{s.items.length}</span>
                      {(() => {
                        const b = band(s.items);
                        return <span className="num text-[11px] text-fg-3">{b.under} undervalued · {b.normal} normal · {b.over} overvalued</span>;
                      })()}
                    </button>
                  </td>
                </tr>
                {!collapsed[s.key] && s.items.map((r) => (
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
        </TopScroll>
        {/* drag (touch or mouse) to move the split; double-click / double-tap puts it back to the default */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={Math.round(split)}
          aria-valuemin={SPLIT_MIN}
          aria-valuemax={SPLIT_MAX}
          title="Drag to resize"
          className={`group flex w-3 shrink-0 cursor-col-resize touch-none items-center justify-center ${dragging ? 'bg-accent/10' : 'hover:bg-raised'}`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
          }}
          onPointerMove={(e) => dragging && dragTo(e.clientX)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => {
            setSplit(defaultSplit());
            try {
              localStorage.removeItem(SPLIT_KEY);
            } catch {
              /* nothing kept */
            }
          }}
        >
          <span className={`h-10 w-1 rounded-full ${dragging ? 'bg-accent' : 'bg-line-2 group-hover:bg-fg-3'}`} />
        </div>
        <TopScroll className="min-w-0 flex-1 border-l border-line">
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
                <tr className={SECTION}><td colSpan={6} className="border-b border-line" /></tr>
                {!collapsed[s.key] && s.items.map((r) => (
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
        </TopScroll>
      </div>

      <DayDetailsDialog state={dd} />
    </>
  );
}
