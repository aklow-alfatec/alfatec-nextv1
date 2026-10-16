'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { engineApi, type RunRow } from './api';
import { diffCount, diffGraphs, type GraphDiff } from './graph-diff';
import type { GraphJson, GraphRecord, GraphVersion } from './types';

const pct = (v: unknown, d = 1) => (typeof v === 'number' && Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '-');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(2) : '-');
const show = (v: unknown) => (v === undefined ? '(none)' : typeof v === 'string' ? v : JSON.stringify(v));
const btn = 'rounded border border-line-2 bg-raised px-1.5 py-0.5 text-[11px] text-fg hover:bg-line disabled:opacity-50';

/** Latest finished run of a version (by graph_version_id). */
function latestRun(runs: RunRow[], versionId: string | undefined): RunRow | undefined {
  return runs.find((r) => r.graph_version_id === versionId && r.status === 'done');
}

function DiffList({ d }: { d: GraphDiff }) {
  if (diffCount(d) === 0) return <p className="text-fg-3">No differences (positions on the canvas are not compared).</p>;
  return (
    <ul className="space-y-1">
      {d.clock && <li>Clock {d.clock.from} → <b>{d.clock.to}</b></li>}
      {d.nodesAdded.map((n) => <li key={`a${n.id}`} className="text-positive">+ block {n.id} <span className="text-fg-3">{n.type}</span></li>)}
      {d.nodesRemoved.map((n) => <li key={`r${n.id}`} className="text-negative">− block {n.id} <span className="text-fg-3">{n.type}</span></li>)}
      {d.typeChanged.map((n) => <li key={`t${n.id}`}>{n.id}: type {n.from} → <b>{n.to}</b></li>)}
      {d.params.map((p, i) => (
        <li key={`p${i}`} className="break-words">
          {p.node}.<span className="text-fg-2">{p.path}</span>: <span className="text-negative line-through">{show(p.from)}</span> → <b>{show(p.to)}</b>
        </li>
      ))}
      {d.edgesAdded.map((e) => <li key={`ea${e}`} className="text-positive">+ wire {e}</li>)}
      {d.edgesRemoved.map((e) => <li key={`er${e}`} className="text-negative">− wire {e}</li>)}
      {d.outputsChanged && <li>Graph outputs changed</li>}
    </ul>
  );
}

/** Versions of the saved graph: notes, runs per version, compare with the canvas, open or restore. */
export default function HistoryPanel({ graphId, current, currentVersion, refreshKey, onOpen, onRestored }: {
  graphId: string | null;
  current: GraphJson;
  currentVersion: number | null;
  refreshKey: number;
  onOpen: (graph: GraphJson, version: number) => void;
  onRestored: (rec: GraphRecord) => void;
}) {
  const [versions, setVersions] = useState<GraphVersion[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [cmp, setCmp] = useState<{ v: GraphVersion; graph: GraphJson } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!graphId) return;
    engineApi.versions(graphId).then(setVersions).catch((e: Error) => setError(e.message));
    engineApi.runs({ graph_id: graphId, limit: 500 }).then(setRuns).catch(() => setRuns([]));
  }, [graphId]);
  useEffect(() => {
    setCmp(null);
    load();
  }, [load, refreshKey]);

  const diff = useMemo(() => (cmp ? diffGraphs(cmp.graph, current) : null), [cmp, current]);
  const runsBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of runs) if (r.graph_version_id) m.set(r.graph_version_id, (m.get(r.graph_version_id) ?? 0) + 1);
    return m;
  }, [runs]);

  if (!graphId) return <p className="text-xs text-fg-3">Save the graph to start its version history.</p>;

  const guard = async (fn: () => Promise<void>) => {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const compare = (v: GraphVersion) => guard(async () => setCmp({ v, graph: (await engineApi.version(graphId, v.version)).graph }));
  const open = (v: GraphVersion) => guard(async () => onOpen((await engineApi.version(graphId, v.version)).graph, v.version));
  const restore = (v: GraphVersion) =>
    guard(async () => {
      if (!window.confirm(`Make version ${v.version} the current graph again? It is saved as a new version; nothing is deleted.`)) return;
      const old = await engineApi.version(graphId, v.version);
      const rec = await engineApi.update(graphId, { graph: old.graph, note: `restored from v${v.version}` });
      onRestored(rec);
      load();
    });

  const curV = versions.find((v) => v.version === currentVersion);
  const runOld = cmp ? latestRun(runs, cmp.v.id) : undefined;
  const runNew = latestRun(runs, curV?.id);
  const s = (r?: RunRow) => (r?.summary ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-3 text-xs">
      {error && <p className="rounded bg-negative/10 p-2 text-negative">{error}</p>}
      <ul className="space-y-1">
        {versions.map((v) => {
          const n = runsBy.get(v.id) ?? 0;
          const last = latestRun(runs, v.id);
          const isCur = v.version === currentVersion;
          return (
            <li key={v.id} className={`rounded border p-2 ${isCur ? 'border-accent/50 bg-accent/5' : 'border-line'}`}>
              <div className="flex items-center gap-2">
                <span className="font-semibold">v{v.version}</span>
                {isCur && <span className="rounded-chip bg-accent/15 px-1 text-[10px] text-accent">current</span>}
                <span className="num ml-auto text-fg-3">{v.created_at?.slice(0, 16).replace('T', ' ')}</span>
              </div>
              {v.note && <p className="mt-0.5 text-fg-2">{v.note}</p>}
              <p className="mt-0.5 text-fg-3">
                {n} run{n === 1 ? '' : 's'}
                {last && <> · latest CAGR {pct(s(last).cagr, 2)}, max DD {pct(s(last).max_drawdown)}</>}
              </p>
              <div className="mt-1 flex gap-1">
                {!isCur && <button className={btn} disabled={busy} onClick={() => compare(v)}>Compare</button>}
                <button className={btn} disabled={busy} onClick={() => open(v)} title="Load this version onto the canvas (not saved)">Open</button>
                {!isCur && <button className={btn} disabled={busy} onClick={() => restore(v)}>Restore</button>}
                {last && <a className={btn} href={`/studio/runs/${last.id}`} target="_blank" rel="noreferrer">Latest run</a>}
              </div>
            </li>
          );
        })}
        {versions.length === 0 && <li className="text-fg-3">No versions yet.</li>}
      </ul>

      {cmp && diff && (
        <section className="rounded border border-line p-2">
          <div className="mb-1 flex items-center">
            <h3 className="font-semibold">Changes from v{cmp.v.version} to the canvas</h3>
            <button className="ml-auto text-fg-3 hover:text-fg" onClick={() => setCmp(null)}>✕</button>
          </div>
          <DiffList d={diff} />
          <h4 className="mb-1 mt-3 font-semibold">Latest runs</h4>
          {runOld || runNew ? (
            <table className="w-full">
              <thead className="text-fg-3">
                <tr><th className="text-left font-medium" /><th className="text-right font-medium">v{cmp.v.version}</th><th className="text-right font-medium">v{currentVersion ?? '?'}</th></tr>
              </thead>
              <tbody>
                {([['Period', (r?: RunRow) => (r ? `${r.start_date?.slice(0, 4)}–${r.end_date?.slice(0, 4)}` : '-')],
                   ['Total return', (r?: RunRow) => pct(s(r).total_return)],
                   ['CAGR', (r?: RunRow) => pct(s(r).cagr, 2)],
                   ['Max drawdown', (r?: RunRow) => pct(s(r).max_drawdown)],
                   ['Sharpe', (r?: RunRow) => num(s(r).sharpe)]] as [string, (r?: RunRow) => string][]).map(([label, f]) => (
                  <tr key={label} className="border-t border-line">
                    <td className="py-0.5 text-fg-2">{label}</td>
                    <td className="num text-right">{f(runOld)}</td>
                    <td className="num text-right">{f(runNew)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-fg-3">Neither version has a finished run. Use Run full backtest after saving.</p>
          )}
          {runOld && runNew && runOld.start_date !== runNew.start_date && (
            <p className="mt-1 text-warning">The runs cover different periods; compare like with like.</p>
          )}
        </section>
      )}
    </div>
  );
}
