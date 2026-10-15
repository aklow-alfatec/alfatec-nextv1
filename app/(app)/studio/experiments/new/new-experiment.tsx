'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select } from '@/components/ui';
import { engineApi, type ExperimentSpecBody } from '@/features/studio/api';
import { gridCount, numericParams, paramLabel, suggestRange, type NumericParam } from '@/features/studio/param-paths';
import type { GraphMeta, GraphRecord } from '@/features/studio/types';

type Range = { low: number; high: number; step: number };

const METRICS: [string, string, 'maximize' | 'minimize'][] = [
  ['sharpe', 'Sharpe ratio (return per unit of risk)', 'maximize'],
  ['sortino', 'Sortino ratio (return per unit of downside risk)', 'maximize'],
  ['calmar', 'Calmar ratio (CAGR / max drawdown)', 'maximize'],
  ['cagr', 'CAGR', 'maximize'],
  ['total_return', 'Total return', 'maximize'],
  ['max_drawdown', 'Max drawdown (smallest)', 'maximize'],
];

export function NewExperiment({ initialGraphId }: { initialGraphId: string }) {
  const router = useRouter();
  const [graphs, setGraphs] = useState<GraphMeta[]>([]);
  const [graphId, setGraphId] = useState(initialGraphId);
  const [rec, setRec] = useState<GraphRecord | null>(null);
  const [picked, setPicked] = useState<Record<string, Range>>({});
  const [filter, setFilter] = useState('');
  const [start, setStart] = useState('2005-01-01');
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [splitKind, setSplitKind] = useState<'rolling' | 'anchored'>('rolling');
  const [train, setTrain] = useState('8Y');
  const [test, setTest] = useState('2Y');
  const [objRef, setObjRef] = useState('');
  const [metric, setMetric] = useState('sharpe');
  const [optKind, setOptKind] = useState<'grid' | 'random' | 'optuna'>('grid');
  const [nTrials, setNTrials] = useState(100);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    engineApi.list().then((gs) => setGraphs(gs.sort((a, b) => a.name.localeCompare(b.name)))).catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    setRec(null);
    setPicked({});
    if (!graphId) return;
    engineApi
      .get(graphId)
      .then((r) => {
        setRec(r);
        // preselect the trigger thresholds of a grade-trigger strategy
        const ps = numericParams(r.graph);
        const pre: Record<string, Range> = {};
        for (const p of ps) if (/\.triggers\.\d+\.threshold_grade$/.test(p.key)) pre[p.key] = suggestRange(p);
        setPicked(pre);
        const eq = r.graph.nodes.find((n) => n.type.startsWith('strategy.'));
        setObjRef(eq ? `${eq.id}.equity` : '');
        setName(`${r.name} walk-forward`);
      })
      .catch((e: Error) => setError(e.message));
  }, [graphId]);

  const params: NumericParam[] = useMemo(() => (rec ? numericParams(rec.graph) : []), [rec]);
  const equityRefs = useMemo(
    () => (rec ? rec.graph.nodes.filter((n) => n.type.startsWith('strategy.')).map((n) => `${n.id}.equity`) : []),
    [rec],
  );
  const shown = params.filter((p) => !filter || p.key.toLowerCase().includes(filter.toLowerCase()) || picked[p.key]);
  const combos = Object.values(picked).reduce((n, r) => n * Math.max(1, gridCount(r)), Object.keys(picked).length ? 1 : 0);
  const evaluations = optKind === 'grid' ? combos : Math.min(nTrials, combos || nTrials);

  const toggle = (p: NumericParam) =>
    setPicked((cur) => {
      const next = { ...cur };
      if (next[p.key]) delete next[p.key];
      else next[p.key] = suggestRange(p);
      return next;
    });
  const setRange = (key: string, field: keyof Range, v: string) =>
    setPicked((cur) => ({ ...cur, [key]: { ...cur[key], [field]: Number(v) } }));

  const submit = async () => {
    setError('');
    if (!graphId || !rec) return setError('Pick a saved graph.');
    if (!Object.keys(picked).length) return setError('Pick at least one setting to tune.');
    if (!objRef) return setError('This graph has no strategy block, so there is no equity to score. Add one first.');
    if (optKind === 'grid' && combos > 2000) return setError(`The grid has ${combos} combinations; narrow the ranges or use random / optuna search.`);
    const dir = METRICS.find((m) => m[0] === metric)?.[2] ?? 'maximize';
    const spec: ExperimentSpecBody = {
      param_space: Object.fromEntries(Object.entries(picked).map(([k, r]) => [k, { low: r.low, high: r.high, step: r.step }])),
      start,
      end,
      split: { kind: splitKind, train, test },
      objective: { ref: objRef, series: 'equity', metric, direction: dir },
      optimiser: optKind === 'grid' ? { kind: 'grid' } : { kind: optKind, n_trials: nTrials, seed: 0 },
    };
    setBusy(true);
    try {
      const r = await engineApi.queueExperiment({ graph_id: graphId, spec, name: name || undefined });
      router.push(`/studio/experiments/${r.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const lbl = 'mb-1 block text-xs font-medium text-fg-2';
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Link href="/studio/experiments" className="text-sm text-fg-2 hover:underline">Experiments</Link>
        <span className="text-fg-3">/</span>
        <h1 className="text-xl font-semibold">New walk-forward experiment</h1>
      </div>
      <p className="max-w-3xl text-sm text-fg-2">
        The period is cut into windows. In each window the settings are chosen on the training years only, then
        tested on the following years the search never saw. The results page joins those test years into one
        out-of-sample curve and reports how likely the best result is just luck.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="1. Graph and settings to tune" className="lg:col-span-2">
          <label className={lbl}>Saved graph</label>
          <Select value={graphId} onChange={(e) => setGraphId(e.target.value)}>
            <option value="">Choose a graph...</option>
            {graphs.map((g) => (
              <option key={g.id} value={g.id}>{g.name}{g.symbol ? ` [${g.symbol}]` : ''}</option>
            ))}
          </Select>
          {rec && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <Input placeholder="filter settings, e.g. TRIGGERS or period" value={filter} onChange={(e) => setFilter(e.target.value)} />
              </div>
              <div className="mt-2 max-h-[420px] overflow-y-auto rounded border border-line">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface text-fg-3">
                    <tr>
                      <th className="w-6 p-1" />
                      <th className="p-1 text-left font-medium">Setting</th>
                      <th className="p-1 text-right font-medium">Now</th>
                      <th className="p-1 text-right font-medium">From</th>
                      <th className="p-1 text-right font-medium">To</th>
                      <th className="p-1 text-right font-medium">Step</th>
                      <th className="p-1 text-right font-medium">Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((p) => {
                      const r = picked[p.key];
                      return (
                        <tr key={p.key} className={`border-t border-line ${r ? 'bg-accent/5' : ''}`}>
                          <td className="p-1 text-center"><input type="checkbox" checked={!!r} onChange={() => toggle(p)} /></td>
                          <td className="p-1" title={p.key}>{paramLabel(rec.graph, p.key)}</td>
                          <td className="num p-1 text-right text-fg-2">{p.value}</td>
                          {(['low', 'high', 'step'] as const).map((f) => (
                            <td key={f} className="p-1 text-right">
                              {r ? (
                                <input type="number" step="any" value={r[f]} onChange={(e) => setRange(p.key, f, e.target.value)}
                                       className="num w-20 rounded border border-line-2 bg-bg px-1 py-0.5 text-right" />
                              ) : null}
                            </td>
                          ))}
                          <td className="num p-1 text-right text-fg-2">{r ? gridCount(r) : ''}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[11px] text-fg-3">{params.length} numeric settings in this graph; {Object.keys(picked).length} selected.</p>
            </>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="2. Period and windows">
            <div className="grid grid-cols-2 gap-2">
              <div><label className={lbl}>Start</label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
              <div><label className={lbl}>End</label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
              <div>
                <label className={lbl}>Windows</label>
                <Select value={splitKind} onChange={(e) => setSplitKind(e.target.value as 'rolling' | 'anchored')}>
                  <option value="rolling">rolling (fixed training length)</option>
                  <option value="anchored">anchored (training grows)</option>
                </Select>
              </div>
              <div />
              <div><label className={lbl}>Training length</label><Input value={train} onChange={(e) => setTrain(e.target.value)} placeholder="8Y" /></div>
              <div><label className={lbl}>Test length</label><Input value={test} onChange={(e) => setTest(e.target.value)} placeholder="2Y" /></div>
            </div>
            <p className="mt-1 text-[11px] text-fg-3">Lengths like 8Y, 18M, 52W.</p>
          </Card>
          <Card title="3. Score and search">
            <label className={lbl}>Score each setting by</label>
            <Select value={metric} onChange={(e) => setMetric(e.target.value)}>
              {METRICS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
            {equityRefs.length > 1 && (
              <>
                <label className={`${lbl} mt-2`}>Strategy</label>
                <Select value={objRef} onChange={(e) => setObjRef(e.target.value)}>
                  {equityRefs.map((r) => <option key={r}>{r}</option>)}
                </Select>
              </>
            )}
            <label className={`${lbl} mt-2`}>Search</label>
            <Select value={optKind} onChange={(e) => setOptKind(e.target.value as 'grid' | 'random' | 'optuna')}>
              <option value="grid">grid: try every combination</option>
              <option value="random">random sample</option>
              <option value="optuna">optuna (smart search)</option>
            </Select>
            {optKind !== 'grid' && (
              <>
                <label className={`${lbl} mt-2`}>Trials per window</label>
                <Input type="number" value={nTrials} min={10} onChange={(e) => setNTrials(Number(e.target.value))} />
              </>
            )}
            <p className={`mt-2 text-xs ${combos > 2000 && optKind === 'grid' ? 'text-negative' : 'text-fg-2'}`}>
              {combos.toLocaleString()} combinations; {evaluations.toLocaleString()} tried in each window.
            </p>
            <label className={`${lbl} mt-2`}>Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button variant="primary" className="mt-3 w-full" onClick={submit} disabled={busy || !rec}>
              {busy ? 'Queuing...' : 'Run experiment'}
            </Button>
            {error && <p className="mt-2 text-xs text-negative">{error}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
