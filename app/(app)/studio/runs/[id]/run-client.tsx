'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Button, Card } from '@/components/ui';
import { engineApi, type RunDetail } from '@/features/studio/api';
import { RunChart } from '@/features/charts/run-chart';
import { runSource, type ChartSource } from '@/features/charts/sources';
import { StrategyResult } from '@/features/studio/results';

const ACTIVE = new Set(['queued', 'running', 'stopping']);

export function RunClient({ id }: { id: string }) {
  const [run, setRun] = useState<RunDetail | null>(null);
  const [graphName, setGraphName] = useState('');
  const [versionNo, setVersionNo] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [pick, setPick] = useState(0);
  const [source, setSource] = useState<ChartSource | null>(null);
  const [chartError, setChartError] = useState('');

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
  useEffect(() => {
    if (!run?.graph_id || !run.graph_version_id) return;
    engineApi
      .versions(run.graph_id)
      .then((vs) => setVersionNo(vs.find((v) => v.id === run.graph_version_id)?.version ?? null))
      .catch(() => undefined);
  }, [run?.graph_id, run?.graph_version_id]);

  // the indicator chart reads the run's series from the engine (catalogue first, columns as the layout needs them)
  const done = run?.status === 'done';
  useEffect(() => {
    if (!done) return;
    let stop = false;
    runSource(id).then((s) => !stop && setSource(s)).catch((e: Error) => !stop && setChartError(e.message));
    return () => {
      stop = true;
    };
  }, [id, done]);

  const strategies = run?.summary?.strategies ?? [];
  const active = run && ACTIVE.has(run.status);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/studio/runs" className="text-sm text-fg-2 hover:underline">Runs</Link>
        <span className="text-fg-3">/</span>
        <h1 className="text-xl font-semibold">{graphName || 'Run'}</h1>
        {versionNo !== null && <span className="rounded-chip bg-line px-2 py-0.5 text-[11px] text-fg-2">graph v{versionNo}</span>}
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
          {(() => {
            const report = strategies[Math.min(pick, strategies.length - 1)];
            return (
              <StrategyResult
                report={report}
                chartHeight={320}
                chart={
                  source ? (
                    <RunChart key={report.node} source={source} report={report} graphId={run?.graph_id} />
                  ) : chartError ? (
                    <p className="text-xs text-negative">Indicator chart unavailable: {chartError}</p>
                  ) : undefined
                }
              />
            );
          })()}
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
