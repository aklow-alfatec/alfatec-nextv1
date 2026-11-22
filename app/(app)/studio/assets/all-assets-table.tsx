'use client';
import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button, Card, GradeChip, Input, ReadingTag } from '@/components/ui';
import type { AssetGroup, PipelineRow } from '@/lib/all-assets';

const OPEN_KEY = 'alfatec.allAssets.open';
const fmtDay = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-';
const fmtClose = (v: number | null) => (v === null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: 2 }));
const pipelineHref = (symbol: string, p: PipelineRow) =>
  `/symbols/${encodeURIComponent(symbol)}${p.active ? '' : `?pipeline=${encodeURIComponent(p.name)}`}`;

/** Assets with their pipelines: the active one on the asset's row; expanding shows the inactive ones too. Each
 *  pipeline opens the asset page for that pipeline. Which assets are open is kept in this browser. */
export function AllAssetsTable({ groups }: { groups: AssetGroup[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  useEffect(() => {
    try {
      setOpen(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}'));
    } catch {
      /* nothing kept */
    }
  }, []);
  const save = (next: Record<string, boolean>) => {
    setOpen(next);
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked: not kept */
    }
  };
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return groups;
    return groups.filter((g) => [g.symbol, g.name ?? '', g.active?.name ?? '', ...g.others.map((o) => o.name)].some((s) => s.toLowerCase().includes(t)));
  }, [groups, q]);
  const searching = q.trim() !== '';

  const cells = (symbol: string, p: PipelineRow, sub: boolean) => (
    <>
      <td className={`py-1.5 pr-3 ${sub ? 'pl-6' : ''}`}>
        <Link href={pipelineHref(symbol, p)} className={`font-medium hover:text-accent hover:underline ${p.active ? 'text-fg' : 'text-fg-2'}`}>{p.name}</Link>
        {p.graphId && <Link href={`/studio/graphs/${p.graphId}`} className="ml-2 text-[10px] text-fg-3 hover:text-accent">graph</Link>}
      </td>
      <td className="py-1.5 pr-3">
        <span className={`rounded-chip px-1.5 py-0.5 text-[10px] font-semibold ${p.active ? 'bg-positive/15 text-positive' : 'bg-line text-fg-3'}`}>{p.active ? 'ACTIVE' : 'inactive'}</span>
      </td>
      <td className="num py-1.5 pr-3 text-right text-fg-2">{p.parts}</td>
      <td className="py-1.5 pr-3"><GradeChip grade={p.grade} /></td>
      <td className="py-1.5 pr-3"><ReadingTag reading={p.reading} /></td>
      <td className="num py-1.5 pr-3 text-xs text-fg-2">{fmtDay(p.gradedOn)}</td>
      <td className="num py-1.5 pr-3 text-xs text-fg-3">{fmtDay(p.updated)}</td>
    </>
  );

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input className="w-64" placeholder="Search asset or pipeline" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-xs text-fg-3">{shown.length} of {groups.length} assets{searching ? ' (matches are shown expanded)' : ''}</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => save(Object.fromEntries(groups.map((g) => [g.symbol, true])))}>Expand all</Button>
          <Button size="sm" onClick={() => save({})}>Collapse all</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-xs text-fg-3">
            <tr className="border-b border-line">
              <th className="py-1.5 pr-3 text-left font-medium">Asset</th>
              <th className="py-1.5 pr-3 text-left font-medium">Pipeline</th>
              <th className="py-1.5 pr-3 text-left font-medium">Status</th>
              <th className="py-1.5 pr-3 text-right font-medium">Parts</th>
              <th className="py-1.5 pr-3 text-left font-medium">Grade</th>
              <th className="py-1.5 pr-3 text-left font-medium">Reading</th>
              <th className="py-1.5 pr-3 text-left font-medium">Graded</th>
              <th className="py-1.5 pr-3 text-left font-medium">Pipeline updated</th>
              <th className="py-1.5 text-right font-medium">Last close</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => {
              const isOpen = searching || !!open[g.symbol];
              const canOpen = g.others.length > 0;
              return (
                <Fragment key={g.symbol}>
                  <tr className="border-t border-line hover:bg-raised">
                    <td className="py-1.5 pr-3">
                      <button
                        type="button"
                        disabled={!canOpen}
                        onClick={() => save({ ...open, [g.symbol]: !open[g.symbol] })}
                        aria-expanded={isOpen}
                        className="inline-flex items-center gap-1.5 text-left disabled:cursor-default"
                        title={canOpen ? (isOpen ? 'Hide the inactive pipelines' : 'Show the inactive pipelines') : 'No inactive pipelines'}
                      >
                        <span className={`w-3 text-fg-3 transition-transform ${canOpen ? '' : 'opacity-0'} ${isOpen ? 'rotate-90' : ''}`}>›</span>
                        <span className="font-semibold">{g.symbol}</span>
                        {canOpen && <span className="num rounded-chip bg-line px-1.5 text-[10px] text-fg-2">+{g.others.length}</span>}
                      </button>
                      <div className="pl-[18px] text-[11px] leading-tight text-fg-3">{g.name ?? ''}{g.assetType ? ` · ${g.assetType.toLowerCase()}` : ''}</div>
                    </td>
                    {g.active ? cells(g.symbol, g.active, false) : (
                      <td colSpan={7} className="py-1.5 pr-3 text-xs text-fg-3">no active pipeline{canOpen ? ' · expand for its inactive ones' : ''}</td>
                    )}
                    <td className="num py-1.5 text-right" title={g.lastDate ?? undefined}>{fmtClose(g.lastClose)}</td>
                  </tr>
                  {isOpen && g.others.map((p) => (
                    <tr key={p.name} className="bg-raised/40 text-[13px] hover:bg-raised">
                      <td className="py-1 pr-3 text-right text-[10px] text-fg-3">└</td>
                      {cells(g.symbol, p, true)}
                      <td />
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-fg-3">
        Grades of inactive pipelines are computed by the backend every Friday (table pipeline_grades); they are not used by the
        Dashboard, Grades or alerts. Admins only.
      </p>
    </Card>
  );
}
