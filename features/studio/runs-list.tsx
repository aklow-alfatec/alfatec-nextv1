'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Badge, Button, Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { setBacktestAction } from '@/app/(app)/studio/runs/actions';
import { engineApi, type RunRow } from './api';

/** Same value as lib/studio-db.ts BACKTEST_TAG (that module is server-only). */
export const BACKTEST_TAG = 'ViewInBacktest';

const pct = (v: unknown, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '-');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '-');

type SortKey = 'started' | 'graph' | 'period' | 'status' | 'total_return' | 'cagr' | 'bh_cagr' | 'max_drawdown' | 'sharpe';
const finite = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The value a column sorts on; numbers without a value (failed or unfinished runs) go last either way. */
function sortValue(r: RunRow, k: SortKey, graphNames: Record<string, string>): string | number | null {
  const s = (r.summary ?? {}) as Record<string, unknown>;
  const b = (s.benchmark ?? {}) as Record<string, unknown>;
  switch (k) {
    case 'started': return r.created_at ?? '';
    case 'graph': {
      const name = (r.tags ?? []).find((t) => t.startsWith('name:'))?.slice(5) ?? '';
      return `${graphNames[r.graph_id] ?? r.graph_id} ${name}`.toLowerCase();
    }
    case 'period': return `${r.start_date ?? ''} ${r.end_date ?? ''}`;
    case 'status': return r.status;
    case 'bh_cagr': return finite(b.cagr);
    default: return finite(s[k]);
  }
}

function StatusBadge({ status }: { status: RunRow['status'] }) {
  const tone = status === 'done' ? 'positive' : status === 'failed' ? 'negative' : status === 'running' || status === 'queued' ? 'info' : undefined;
  return <Badge tone={tone as never}>{status}</Badge>;
}

/** The runs table. `canTag`: a Backtest tick per run (adds / removes the ViewInBacktest tag); with `onlyTagged` a
 *  run leaves the table when its tick is cleared. `linkRuns`: the start time opens the run (Studio only). */
export function RunsTable({ rows, graphNames, canTag, linkRuns, onlyTagged, runHrefBase = '/studio/runs/' }: {
  rows: RunRow[];
  graphNames: Record<string, string>;
  canTag: boolean;
  linkRuns: boolean;
  onlyTagged?: boolean;
  /** where a run's start time links to, + the run id (default: the Studio run page) */
  runHrefBase?: string;
}) {
  const [tags, setTags] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const tagsOf = (r: RunRow) => tags[r.id] ?? r.tags ?? [];
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'started', dir: 'desc' });
  const sortBy = (key: SortKey) =>
    // a new column starts high to low for numbers and dates, A to Z for names
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'graph' || key === 'status' || key === 'period' ? 'asc' : 'desc' }));
  const head = (key: SortKey, label: string, className?: string) => (
    <TH className={className} aria-sort={sort.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => sortBy(key)} className="whitespace-nowrap hover:text-fg">
        {label}{sort.key === key ? (sort.dir === 'desc' ? ' ↓' : ' ↑') : ''}
      </button>
    </TH>
  );

  const toggle = async (r: RunRow, on: boolean) => {
    setBusy(r.id);
    const res = await setBacktestAction(r.id, on);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setError('');
    setTags((t) => ({ ...t, [r.id]: res.tags }));
  };

  const shown = (onlyTagged ? rows.filter((r) => tagsOf(r).includes(BACKTEST_TAG)) : rows)
    .map((r) => ({ r, v: sortValue(r, sort.key, graphNames) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === null ? (b.v === null ? 0 : 1) : -1;
      const c = a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
      return sort.dir === 'asc' ? c : -c;
    })
    .map((x) => x.r);
  return (
    <>
      {error && <p className="mb-3 text-sm text-negative">{error}</p>}
      <Table>
        <THead>
          <TR>
            {head('started', 'Started')}
            {head('graph', 'Graph')}
            {head('period', 'Period')}
            {head('status', 'Status')}
            {head('total_return', 'Total return', 'text-right')}
            {head('cagr', 'CAGR', 'text-right')}
            {head('bh_cagr', 'Buy and hold CAGR', 'text-right')}
            {head('max_drawdown', 'Max drawdown', 'text-right')}
            {head('sharpe', 'Sharpe', 'text-right')}
            {canTag && <TH className="text-center" title="Show this run on the Backtest page">Backtest</TH>}
          </TR>
        </THead>
        <TBody>
          {shown.map((r) => {
            const s = (r.summary ?? {}) as Record<string, unknown>;
            const b = (s.benchmark ?? {}) as Record<string, unknown>;
            const on = tagsOf(r).includes(BACKTEST_TAG);
            const started = r.created_at?.slice(0, 16).replace('T', ' ');
            return (
              <TR key={r.id}>
                <TD className="num">
                  {linkRuns ? <Link className="text-accent hover:underline" href={`${runHrefBase}${r.id}`}>{started}</Link> : started}
                </TD>
                <TD>
                  {graphNames[r.graph_id] ?? r.graph_id.slice(0, 8)}
                  {/* re-run nextv0 backtests carry their old name as a name: tag (scripts/rerun_nextv0_backtests.py) */}
                  {(() => {
                    const n = tagsOf(r).find((t) => t.startsWith('name:'))?.slice(5);
                    return n ? <div className="text-[11px] text-fg-3">{n}</div> : null;
                  })()}
                </TD>
                <TD className="num text-fg-2">{r.start_date?.slice(0, 10)} to {r.end_date?.slice(0, 10)}</TD>
                <TD>
                  <StatusBadge status={r.status} />
                </TD>
                <TD className="num text-right">{pct(s.total_return, 1)}</TD>
                <TD className="num text-right">{pct(s.cagr, 2)}</TD>
                <TD className="num text-right text-fg-2">{pct(b.cagr, 2)}</TD>
                <TD className="num text-right">{pct(s.max_drawdown, 1)}</TD>
                <TD className="num text-right">{num(s.sharpe)}</TD>
                {canTag && (
                  <TD className="text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer accent-accent"
                      checked={on}
                      disabled={busy === r.id}
                      onChange={(e) => void toggle(r, e.target.checked)}
                      aria-label={on ? 'Remove from the Backtest page' : 'Show on the Backtest page'}
                    />
                  </TD>
                )}
              </TR>
            );
          })}
        </TBody>
      </Table>
    </>
  );
}

/** Studio Runs: every run, read from the database and refreshed every 5 s. */
export function RunsList({ title, links, empty }: { title: string; links?: ReactNode; empty: ReactNode }) {
  const [rows, setRows] = useState<RunRow[] | null>(null);
  const [graphs, setGraphs] = useState<Record<string, string>>({});
  const [graphFilter, setGraphFilter] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    engineApi
      .runs({ graph_id: graphFilter || undefined, limit: 500 })
      .then((r) => {
        setRows(r);
        setError('');
      })
      .catch((e: Error) => {
        setError(e.message);
        setRows([]);
      });
  }, [graphFilter]);

  useEffect(() => {
    engineApi.list().then((gs) => setGraphs(Object.fromEntries(gs.map((g) => [g.id, g.name])))).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // pick up queued / running jobs as they finish
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">{title}</h1>
        {links}
        <select
          className="ml-auto rounded border border-line-2 bg-bg px-2 py-1 text-sm"
          value={graphFilter}
          onChange={(e) => setGraphFilter(e.target.value)}
        >
          <option value="">All graphs</option>
          {Object.entries(graphs)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
        </select>
        <Button onClick={load}>Refresh</Button>
      </div>
      <Card>
        {error && <p className="mb-3 text-sm text-negative">{error}</p>}
        {rows === null ? (
          <p className="text-sm text-fg-3">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-fg-3">{empty}</p>
        ) : (
          <RunsTable rows={rows} graphNames={graphs} canTag linkRuns />
        )}
      </Card>
    </div>
  );
}
