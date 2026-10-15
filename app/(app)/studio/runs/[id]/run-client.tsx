'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Card } from '@/components/ui';
import { engineApi, type RunDetail } from '@/features/studio/api';
import { StrategyResult } from '@/features/studio/results';

const ACTIVE = new Set(['queued', 'running', 'stopping']);

export function RunClient({ id }: { id: string }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [graphName, setGraphName] = useState('');
  const [error, setError] = useState('');
  const [pick, setPick] = useState(0);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const st = await engineApi.runStatus(id);
        if (ACTIVE.has(st.status)) {
          setRun((r) => ({ ...(r ?? ({} as RunDetail)), ...(st as unknown as RunDetail) }));
          if (!stop) timer = setTimeout(tick, 2000);
          return;
        }
        const full = await engineApi.run(id);
        if (!stop) setRun(full);
      } catch (e) {
        if (!stop) setError((e as Error).message);
      }
    };
    void tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  useEffect(() => {
    if (run?.graph_id && !graphName) engineApi.get(run.graph_id).then((g) => setGraphName(g.name)).catch(() => undefined);
  }, [run?.graph_id, graphName]);

  const strategies = run?.summary?.strategies ?? [];
  const active = run && ACTIVE.has(run.status);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/studio/runs" className="text-sm text-fg-2 hover:underline">Runs</Link>
        <span className="text-fg-3">/</span>
        <h1 className="text-xl font-semibold">{graphName || 'Run'}</h1>
        {run?.status && <Badge tone={(run.status === 'done' ? 'positive' : run.status === 'failed' ? 'negative' : 'info') as never}>{run.status}</Badge>}
        <span className="num text-sm text-fg-2">
          {run?.start_date?.slice(0, 10)} to {run?.end_date?.slice(0, 10)}
        </span>
        <span className="ml-auto flex gap-2">
          {run?.graph_id && (
            <Link href={`/studio/graphs/${run.graph_id}`}>
              <Button>Open graph</Button>
            </Link>
          )}
          {active && <Button onClick={() => engineApi.stopRun(id).catch((e: Error) => setError(e.message))}>Stop</Button>}
        </span>
      </div>
      {error && <p className="text-sm text-negative">{error}</p>}
      {!run && !error && <p className="text-sm text-fg-3">Loading...</p>}
      {active && (
        <Card>
          <p className="text-sm">
            {run.status === 'queued' ? 'Waiting for the worker to pick this run up...' : `Running${run.progress?.step ? `: ${run.progress.step}` : ''}...`}
          </p>
          <p className="mt-1 text-xs text-fg-3">This page updates by itself. If it stays queued, check that the worker is running.</p>
        </Card>
      )}
      {run?.status === 'failed' && (
        <Card title="Run failed">
          <pre className="whitespace-pre-wrap text-xs text-negative">{run.error}</pre>
        </Card>
      )}
      {run?.status === 'done' && strategies.length === 0 && (
        <Card>
          <p className="text-sm text-fg-2">This run has no strategy block, so there is no equity curve. Its outputs are in the downloads below.</p>
        </Card>
      )}
      {strategies.length > 0 && (
        <Card
          title="Results"
          actions={
            strategies.length > 1 ? (
              <select className="rounded border border-line-2 bg-bg px-1 py-0.5 text-xs" value={pick} onChange={(e) => setPick(Number(e.target.value))}>
                {strategies.map((s, k) => (
                  <option key={s.node} value={k}>{s.node}</option>
                ))}
              </select>
            ) : undefined
          }
        >
          <StrategyResult report={strategies[Math.min(pick, strategies.length - 1)]} chartHeight={320} />
        </Card>
      )}
      {run?.exports && Object.values(run.exports).some(Boolean) && (
        <Card title="Downloads">
          <ul className="flex flex-wrap gap-3 text-sm">
            {Object.entries(run.exports).map(([name, url]) =>
              url ? (
                <li key={name}>
                  <a className="text-accent hover:underline" href={url} target="_blank" rel="noreferrer">{name}</a>
                </li>
              ) : null,
            )}
          </ul>
          <p className="mt-2 text-xs text-fg-3">Links expire after an hour; reload the page for fresh ones.</p>
        </Card>
      )}
    </div>
  );
}
