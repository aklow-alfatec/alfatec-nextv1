'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card } from '@/components/ui';
import { engineApi, type ExperimentDetail } from '@/features/studio/api';
import { paramLabel, setParam } from '@/features/studio/param-paths';
import { EquityChart } from '@/features/studio/results';
import type { GraphRecord } from '@/features/studio/types';

const ACTIVE = new Set(['queued', 'running', 'stopping']);
const pct = (v: unknown, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '-');
const num = (v: unknown, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : '-');

/** CAGR and max drawdown of a (thinned) curve. */
function curveStats(index: string[], vals: (number | null)[] | null) {
  if (!vals || vals.length < 2 || vals[0] === null) return null;
  const v = vals.map((x) => (x === null ? NaN : x));
  const years = (Date.parse(index[index.length - 1]) - Date.parse(index[0])) / (365.25 * 864e5);
  const last = v[v.length - 1];
  let peak = -Infinity;
  let mdd = 0;
  for (const x of v) {
    if (!Number.isFinite(x)) continue;
    peak = Math.max(peak, x);
    mdd = Math.min(mdd, x / peak - 1);
  }
  return { total: last / v[0] - 1, cagr: years > 0 ? Math.pow(last / v[0], 1 / years) - 1 : NaN, mdd };
}

function verdictPbo(p: number | null | undefined) {
  if (p === null || p === undefined || !Number.isFinite(p)) return { tone: 'neutral', text: 'not available (too few windows or settings)' };
  if (p < 0.25) return { tone: 'positive', text: 'low: the best training settings usually also do well on new data' };
  if (p < 0.5) return { tone: 'warning', text: 'moderate: treat the best settings with caution' };
  return { tone: 'negative', text: 'high: the best training settings usually do worse than average on new data (overfit)' };
}

function verdictDsr(p: number | null | undefined) {
  if (p === null || p === undefined || !Number.isFinite(p)) return { tone: 'neutral', text: 'not available' };
  if (p >= 0.95) return { tone: 'positive', text: 'strong: the edge is unlikely to be luck, even after counting every setting tried' };
  if (p >= 0.8) return { tone: 'warning', text: 'moderate: some evidence, not conclusive' };
  return { tone: 'negative', text: 'weak: the result can be explained by trying many settings' };
}

export function ExperimentClient({ id }: { id: string }) {
  const [exp, setExp] = useState<ExperimentDetail | null>(null);
  const [graph, setGraph] = useState<GraphRecord | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const st = await engineApi.experimentStatus(id);
        if (ACTIVE.has(st.status)) {
          setExp((e) => ({ ...(e ?? ({} as ExperimentDetail)), ...(st as unknown as ExperimentDetail) }));
          if (!stop) timer = setTimeout(tick, 2500);
          return;
        }
        const full = await engineApi.experiment(id);
        if (!stop) setExp(full);
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
    if (exp?.graph_id && !graph) engineApi.get(exp.graph_id).then(setGraph).catch(() => undefined);
  }, [exp?.graph_id, graph]);

  const s = (exp?.summary ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const oos = s.oos_performance ?? s.oos ?? {};
  const pbo = s.pbo?.pbo as number | undefined;
  const dsr = s.deflated_sharpe?.dsr as number | undefined;
  const metric = (exp?.spec?.objective?.metric as string) ?? 'sharpe';
  const bench = useMemo(() => (exp?.oos_curve ? curveStats(exp.oos_curve.index, exp.oos_curve.benchmark) : null), [exp?.oos_curve]);
  const best = (exp?.best_params ?? s.best_params ?? {}) as Record<string, unknown>;
  const active = exp && ACTIVE.has(exp.status);
  const label = (k: string) => (graph ? paramLabel(graph.graph, k) : k);
  const short = (k: string) => {
    const m = k.match(/triggers\.(\d+)\.(\w+)$/);
    const trig = graph ? paramLabel(graph.graph, k).match(/trigger "([^"]+)"/)?.[1] : undefined;
    return m ? `${trig ?? `trigger ${m[1]}`} ${m[2].replace('threshold_grade', 'threshold')}` : k.split('.').slice(-2).join('.');
  };

  const applyBest = async () => {
    if (!graph || !Object.keys(best).length) return;
    if (!window.confirm('Save these settings into the graph as a new version?')) return;
    try {
      let g = graph.graph;
      for (const [k, v] of Object.entries(best)) g = setParam(g, k, v);
      const rec = await engineApi.update(graph.id, { graph: g, note: `best settings from experiment ${exp?.name ?? id}` });
      setGraph(rec);
      setNotice(`Saved as version ${rec.current_version ?? ''} of ${rec.name}.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const vP = verdictPbo(pbo);
  const vD = verdictDsr(dsr);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/studio/experiments" className="text-sm text-fg-2 hover:underline">Experiments</Link>
        <span className="text-fg-3">/</span>
        <h1 className="text-xl font-semibold">{exp?.name ?? 'Experiment'}</h1>
        {exp?.status && <Badge tone={(exp.status === 'done' ? 'positive' : exp.status === 'failed' ? 'negative' : 'info') as never}>{exp.status}</Badge>}
        <span className="ml-auto flex gap-2">
          {graph && <Link href={`/studio/graphs/${graph.id}`}><Button>Open graph</Button></Link>}
          {active && <Button onClick={() => engineApi.stopExperiment(id).catch((e: Error) => setError(e.message))}>Stop</Button>}
        </span>
      </div>
      {error && <p className="text-sm text-negative">{error}</p>}
      {notice && <p className="text-sm text-positive">{notice}</p>}
      {!exp && !error && <p className="text-sm text-fg-3">Loading...</p>}

      {active && (
        <Card>
          <p className="text-sm">
            {exp.status === 'queued' ? 'Waiting for the worker...' : `Running: ${exp.progress?.message || exp.progress?.step || ''}`}
          </p>
          {exp.progress?.total ? (
            <div className="mt-2 h-2 w-full rounded bg-line">
              <div className="h-2 rounded bg-accent" style={{ width: `${Math.min(100, ((exp.progress.done ?? 0) / exp.progress.total) * 100)}%` }} />
            </div>
          ) : null}
        </Card>
      )}
      {exp?.status === 'failed' && <Card title="Experiment failed"><pre className="whitespace-pre-wrap text-xs text-negative">{exp.error}</pre></Card>}

      {exp?.status === 'done' && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Out of sample (test years only)" className="lg:col-span-2">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-fg-3"><th /><th className="text-right font-medium">Strategy</th><th className="text-right font-medium">Buy and hold</th></tr></thead>
                <tbody>
                  <tr className="border-t border-line"><td className="py-1 text-fg-2">Total return</td><td className="num text-right">{pct(oos.total_return)}</td><td className="num text-right text-fg-2">{pct(bench?.total)}</td></tr>
                  <tr className="border-t border-line"><td className="py-1 text-fg-2">CAGR</td><td className="num text-right">{pct(oos.cagr, 2)}</td><td className="num text-right text-fg-2">{pct(bench?.cagr, 2)}</td></tr>
                  <tr className="border-t border-line"><td className="py-1 text-fg-2">Max drawdown</td><td className="num text-right">{pct(oos.max_drawdown)}</td><td className="num text-right text-fg-2">{pct(bench?.mdd)}</td></tr>
                  <tr className="border-t border-line"><td className="py-1 text-fg-2">Sharpe</td><td className="num text-right">{num(oos.sharpe)}</td><td className="num text-right text-fg-2">-</td></tr>
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-fg-3">
                {s.n_folds} windows, {s.n_trials} settings tried per window, scored by {metric}. Each test period
                uses settings chosen only on the years before it.
              </p>
            </Card>
            <Card title="Is it luck?">
              <div className="space-y-3 text-sm">
                <div>
                  <div className="flex items-center justify-between"><span className="text-fg-2">Chance of overfitting (PBO)</span><span className="num font-semibold">{pct(pbo, 0)}</span></div>
                  <p className={`text-xs text-${vP.tone === 'neutral' ? 'fg-3' : vP.tone}`}>{vP.text}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between"><span className="text-fg-2">Deflated Sharpe (confidence)</span><span className="num font-semibold">{pct(dsr, 0)}</span></div>
                  <p className={`text-xs text-${vD.tone === 'neutral' ? 'fg-3' : vD.tone}`}>{vD.text}</p>
                </div>
              </div>
            </Card>
          </div>

          {exp.oos_curve && (
            <Card title="Out-of-sample equity (test years joined)">
              <EquityChart curve={{ ...exp.oos_curve, benchmark: exp.oos_curve.benchmark }} height={300} />
            </Card>
          )}

          <Card title="Windows">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-fg-3">
                  <tr>
                    <th className="p-1 text-left font-medium">#</th>
                    <th className="p-1 text-left font-medium">Trained on</th>
                    <th className="p-1 text-left font-medium">Tested on</th>
                    <th className="p-1 text-left font-medium">Chosen settings</th>
                    <th className="p-1 text-right font-medium">Train {metric}</th>
                    <th className="p-1 text-right font-medium">Test {metric}</th>
                    <th className="p-1 text-right font-medium">Test return</th>
                  </tr>
                </thead>
                <tbody>
                  {exp.folds.map((f) => {
                    const tr = f.test_metrics?.total_return;
                    return (
                      <tr key={f.fold_no} className="border-t border-line">
                        <td className="p-1">{f.fold_no + 1}</td>
                        <td className="num p-1">{f.train_start?.slice(0, 7)} to {f.train_end?.slice(0, 7)}</td>
                        <td className="num p-1">{f.test_start?.slice(0, 7)} to {f.test_end?.slice(0, 7)}</td>
                        <td className="p-1">{Object.entries(f.best_params ?? {}).map(([k, v]) => `${short(k)} ${v}`).join(', ')}</td>
                        <td className="num p-1 text-right">{num(f.train_metrics?.[metric])}</td>
                        <td className="num p-1 text-right">{num(f.test_metrics?.[metric])}</td>
                        <td className={`num p-1 text-right ${(tr ?? 0) >= 0 ? 'text-positive' : 'text-negative'}`}>{pct(tr)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[11px] text-fg-3">When the chosen settings jump around from window to window, or train scores are far above test scores, the strategy is fitting noise.</p>
          </Card>

          <Card
            title="Best settings over the whole period"
            actions={<Button onClick={applyBest} disabled={!graph || !Object.keys(best).length}>Save into graph</Button>}
          >
            <ul className="space-y-1 text-sm">
              {Object.entries(best).map(([k, v]) => (
                <li key={k}><span className="text-fg-2">{label(k)}</span>: <span className="num font-semibold">{String(v)}</span></li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-fg-3">
              These are the settings most often chosen across the windows. A backtest of them over the full period is
              {exp.best_run_id ? (
                <> <Link className="text-accent hover:underline" href={`/studio/runs/${exp.best_run_id}`}>here</Link></>
              ) : ' not available'}
              , but it is in-sample (the settings were picked with hindsight): judge the strategy by the out-of-sample results above.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
