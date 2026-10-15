'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Table, TBody, TD, TH, THead, TR } from '@/components/ui';
import { engineApi, type ExperimentRow } from '@/features/studio/api';
import type { GraphMeta } from '@/features/studio/types';

const pct = (v: unknown, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '-');

export default function ExperimentsPage() {
  const [rows, setRows] = useState<ExperimentRow[] | null>(null);
  const [graphs, setGraphs] = useState<Record<string, GraphMeta>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    engineApi.list().then((gs) => setGraphs(Object.fromEntries(gs.map((g) => [g.id, g])))).catch(() => undefined);
    const load = () =>
      engineApi
        .experiments({ limit: 200 })
        .then(setRows)
        .catch((e: Error) => {
          setError(e.message);
          setRows([]);
        });
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Experiments</h1>
        <Link href="/studio/experiments/new"><Button variant="primary">New experiment</Button></Link>
      </div>
      <Card>
        {error && <p className="mb-3 text-sm text-negative">{error}</p>}
        {rows === null ? (
          <p className="text-sm text-fg-3">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-fg-3">No experiments yet. Start one to tune a strategy with walk-forward testing.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Started</TH>
                <TH>Name</TH>
                <TH>Graph</TH>
                <TH>Status</TH>
                <TH className="text-right">Out-of-sample CAGR</TH>
                <TH className="text-right">Max drawdown</TH>
                <TH className="text-right">Overfitting (PBO)</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((e) => {
                const s = (e.summary ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
                const o = s.oos_performance ?? s.oos ?? {};
                const pbo = s.pbo?.pbo;
                return (
                  <TR key={e.id}>
                    <TD className="num">
                      <Link className="text-accent hover:underline" href={`/studio/experiments/${e.id}`}>{e.created_at?.slice(0, 16).replace('T', ' ')}</Link>
                    </TD>
                    <TD>{e.name ?? '-'}</TD>
                    <TD>{graphs[e.graph_id]?.name ?? e.graph_id.slice(0, 8)}</TD>
                    <TD>
                      <Badge tone={(e.status === 'done' ? 'positive' : e.status === 'failed' ? 'negative' : 'info') as never}>{e.status}</Badge>
                    </TD>
                    <TD className="num text-right">{pct(o.cagr, 2)}</TD>
                    <TD className="num text-right">{pct(o.max_drawdown)}</TD>
                    <TD className={`num text-right ${typeof pbo === 'number' ? (pbo < 0.25 ? 'text-positive' : pbo < 0.5 ? 'text-warning' : 'text-negative') : ''}`}>{pct(pbo, 0)}</TD>
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
