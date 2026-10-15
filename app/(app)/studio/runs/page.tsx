'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { engineApi, type RunRow } from '@/features/studio/api';
import type { GraphMeta } from '@/features/studio/types';

const pct = (v: unknown, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '-');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '-');

function StatusBadge({ status }: { status: RunRow['status'] }) {
  const tone = status === 'done' ? 'positive' : status === 'failed' ? 'negative' : status === 'running' || status === 'queued' ? 'info' : undefined;
  return <Badge tone={tone as never}>{status}</Badge>;
}

export default function RunsPage() {
  const [rows, setRows] = useState<RunRow[] | null>(null);
  const [graphs, setGraphs] = useState<Record<string, GraphMeta>>({});
  const [graphFilter, setGraphFilter] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    engineApi
      .runs({ graph_id: graphFilter || undefined, limit: 200 })
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
    engineApi.list().then((gs) => setGraphs(Object.fromEntries(gs.map((g) => [g.id, g])))).catch(() => undefined);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // pick up queued / running jobs as they finish
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Runs</h1>
        <select
          className="ml-auto rounded border border-line-2 bg-bg px-2 py-1 text-sm"
          value={graphFilter}
          onChange={(e) => setGraphFilter(e.target.value)}
        >
          <option value="">All graphs</option>
          {Object.values(graphs)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
        </select>
        <Button onClick={load}>Refresh</Button>
      </div>
      <Card>
        {error && <p className="mb-3 text-sm text-negative">{error}</p>}
        {rows === null ? (
          <p className="text-sm text-fg-3">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-fg-3">
            No runs yet. Open a saved graph, go to the Run preview tab and press <b>Run full backtest</b>.
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Started</TH>
                <TH>Graph</TH>
                <TH>Period</TH>
                <TH>Status</TH>
                <TH className="text-right">Total return</TH>
                <TH className="text-right">CAGR</TH>
                <TH className="text-right">Buy and hold CAGR</TH>
                <TH className="text-right">Max drawdown</TH>
                <TH className="text-right">Sharpe</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => {
                const s = (r.summary ?? {}) as Record<string, unknown>;
                const b = (s.benchmark ?? {}) as Record<string, unknown>;
                return (
                  <TR key={r.id}>
                    <TD className="num">
                      <Link className="text-accent hover:underline" href={`/studio/runs/${r.id}`}>
                        {r.created_at?.slice(0, 16).replace('T', ' ')}
                      </Link>
                    </TD>
                    <TD>{graphs[r.graph_id]?.name ?? r.graph_id.slice(0, 8)}</TD>
                    <TD className="num text-fg-2">{r.start_date?.slice(0, 10)} to {r.end_date?.slice(0, 10)}</TD>
                    <TD>
                      <StatusBadge status={r.status} />
                    </TD>
                    <TD className="num text-right">{pct(s.total_return, 1)}</TD>
                    <TD className="num text-right">{pct(s.cagr, 2)}</TD>
                    <TD className="num text-right text-fg-2">{pct(b.cagr, 2)}</TD>
                    <TD className="num text-right">{pct(s.max_drawdown, 1)}</TD>
                    <TD className="num text-right">{num(s.sharpe)}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
