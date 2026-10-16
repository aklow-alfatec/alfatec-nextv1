'use client';

import { useEffect, useMemo, useState } from 'react';
import { engineApi } from '@/features/studio/api';
import type { BlockSpec, GraphMeta, GraphRecord, GraphVersion } from '@/features/studio/types';
import { parseValues, type EdgeSet, type GraphEdgeRule } from './edge-set';

const cell = 'rounded border border-line-2 bg-bg px-1 py-0.5 text-xs';
const OPS: [GraphEdgeRule['op'], string][] = [['gt', 'above'], ['ge', 'at or above'], ['lt', 'below'], ['le', 'at or below'], ['eq', 'equal to']];

interface OutputChoice { ref: string; label: string; dtype: GraphEdgeRule['dtype'] }

/** Numeric and bool outputs of a saved graph (object ports such as legacy `out` are left out). */
function outputsOf(rec: GraphRecord, blocks: Record<string, BlockSpec>): OutputChoice[] {
  const out: OutputChoice[] = [];
  for (const n of rec.graph.nodes) {
    const spec = blocks[n.type];
    if (!spec) continue;
    for (const [port, p] of Object.entries(spec.outputs)) {
      if (p.dtype === 'object' || port === 'present') continue;
      out.push({ ref: `${n.id}.${port}`, label: `${n.id} · ${port}`, dtype: p.dtype as OutputChoice['dtype'] });
    }
  }
  // the usual question first: a pipeline's overall grade
  return out.sort((a, b) => Number(/DAILY_GRADE\.pct$/.test(b.ref)) - Number(/DAILY_GRADE\.pct$/.test(a.ref)));
}

function GraphEdgeRow({ g, graphs, blocks, onChange, onRemove }: {
  g: GraphEdgeRule;
  graphs: GraphMeta[];
  blocks: Record<string, BlockSpec>;
  onChange: (g: GraphEdgeRule) => void;
  onRemove: () => void;
}) {
  const [rec, setRec] = useState<GraphRecord | null>(null);
  const [versions, setVersions] = useState<GraphVersion[]>([]);
  const [valuesText, setValuesText] = useState(g.values.join(', '));
  useEffect(() => {
    if (!g.graphId) return;
    engineApi.get(g.graphId).then(setRec).catch(() => setRec(null));
    engineApi.versions(g.graphId).then(setVersions).catch(() => setVersions([]));
  }, [g.graphId]);
  const outputs = useMemo(() => (rec ? outputsOf(rec, blocks) : []), [rec, blocks]);

  const pickGraph = (id: string) => {
    const meta = graphs.find((x) => x.id === id);
    onChange({ ...g, graphId: id, graphName: meta?.name ?? '', version: null, ref: '', label: '', pinned: null });
  };
  const pickOutput = (ref: string) => {
    const o = outputs.find((x) => x.ref === ref);
    if (!o) return;
    const isPct = /\.pct$/.test(ref);
    const values = o.dtype === 'bool' ? [] : g.values.length ? g.values : isPct ? [40, 50, 60, 70, 80] : [];
    setValuesText(values.join(', '));
    onChange({ ...g, ref, dtype: o.dtype, label: g.label || ref.split('.').slice(-2).join(' '), values, pinned: null });
  };
  const n = g.dtype === 'bool' ? 1 : g.values.length;
  return (
    <tr className="border-t border-line align-top">
      <td className="p-1">
        <select className={`${cell} w-44`} value={g.graphId} onChange={(e) => pickGraph(e.target.value)}>
          <option value="">graph...</option>
          {graphs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        {versions.length > 1 && (
          <select className={`${cell} mt-1 w-44`} value={g.version ?? ''} onChange={(e) => onChange({ ...g, version: e.target.value ? Number(e.target.value) : null })}>
            <option value="">current version (v{versions[0].version})</option>
            {versions.map((v) => <option key={v.id} value={v.version}>v{v.version}{v.note ? ` · ${v.note.slice(0, 30)}` : ''}</option>)}
          </select>
        )}
      </td>
      <td className="p-1">
        <select className={`${cell} w-56`} value={g.ref} onChange={(e) => pickOutput(e.target.value)} disabled={!rec}>
          <option value="">{rec ? 'output...' : 'pick a graph first'}</option>
          {outputs.map((o) => <option key={o.ref} value={o.ref}>{o.label} ({o.dtype})</option>)}
        </select>
        <input className={`${cell} mt-1 w-56`} placeholder="label" value={g.label} onChange={(e) => onChange({ ...g, label: e.target.value })} />
      </td>
      <td className="p-1">
        {g.dtype === 'bool' ? (
          <span className="text-fg-3">yes / no output: used as it is</span>
        ) : (
          <>
            <select className={cell} value={g.op} onChange={(e) => onChange({ ...g, op: e.target.value as GraphEdgeRule['op'] })}>
              {OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input
              className={`${cell} ml-1 w-40`}
              placeholder="40, 50, 60  or  40-80/10"
              value={valuesText}
              onChange={(e) => {
                setValuesText(e.target.value);
                const values = parseValues(e.target.value);
                onChange({ ...g, values, pinned: g.pinned !== null && values.includes(g.pinned) ? g.pinned : null });
              }}
            />
            <div className="mt-1 text-[10px] text-fg-3">{g.values.length} value{g.values.length === 1 ? '' : 's'}: {g.values.join(', ') || '-'}</div>
          </>
        )}
      </td>
      <td className="p-1">
        {g.dtype !== 'bool' && (
          <select className={cell} value={g.pinned ?? ''} onChange={(e) => onChange({ ...g, pinned: e.target.value === '' ? null : Number(e.target.value) })}
                  title="The value used in overlap, stacking and Kelly">
            <option value="">not in stack</option>
            {g.values.map((v) => <option key={v} value={v}>use {v}</option>)}
          </select>
        )}
      </td>
      <td className="num p-1 text-right text-fg-3">{n} edge{n === 1 ? '' : 's'}</td>
      <td className="p-1 text-right">
        <button className="text-fg-3 hover:text-negative" title="Remove" onClick={onRemove}>✕</button>
      </td>
    </tr>
  );
}

/** Edges taken from saved graphs (e.g. a pipeline's daily grade), with threshold sweeps. */
export function GraphEdgeForm({ set, onChange }: { set: EdgeSet; onChange: (s: EdgeSet) => void }) {
  const [graphs, setGraphs] = useState<GraphMeta[]>([]);
  const [blocks, setBlocks] = useState<Record<string, BlockSpec>>({});
  useEffect(() => {
    engineApi.list().then((gs) => setGraphs(gs.sort((a, b) => a.name.localeCompare(b.name)))).catch(() => undefined);
    engineApi.blocks().then((bs) => setBlocks(Object.fromEntries(bs.map((b) => [b.type, b])))).catch(() => undefined);
  }, []);
  const list = set.graphEdges ?? [];
  const upd = (i: number, g: GraphEdgeRule) => {
    const next = list.map((x, k) => (k === i ? g : x));
    // the first graph edge sets the outcome asset to that graph's symbol
    const meta = graphs.find((x) => x.id === g.graphId);
    const asset = list.length === 1 && meta?.symbol && i === 0 && list[0].graphId !== g.graphId ? meta.symbol : set.asset;
    onChange({ ...set, asset, graphEdges: next });
  };
  const add = () =>
    onChange({ ...set, graphEdges: [...list, { graphId: '', graphName: '', version: null, ref: '', label: '', dtype: 'float', op: 'gt', values: [], pinned: null }] });
  return (
    <div className="space-y-2">
      {list.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-fg-3">
            <tr>
              <th className="p-1 text-left font-medium">Saved graph</th>
              <th className="p-1 text-left font-medium">Output</th>
              <th className="p-1 text-left font-medium">Condition and values (sweep)</th>
              <th className="p-1 text-left font-medium">In stack / Kelly</th>
              <th className="p-1" />
              <th className="p-1" />
            </tr>
          </thead>
          <tbody>
            {list.map((g, i) => (
              <GraphEdgeRow key={i} g={g} graphs={graphs} blocks={blocks} onChange={(x) => upd(i, x)}
                            onRemove={() => onChange({ ...set, graphEdges: list.filter((_, k) => k !== i) })} />
            ))}
          </tbody>
        </table>
      )}
      <button className="text-xs text-accent hover:underline" onClick={add}>+ add edge from a saved graph</button>
      {list.length > 0 && (
        <p className="text-[11px] text-fg-3">
          Graph edges run on the graph&apos;s own clock (weekly Friday for the converted pipelines), so the Bars setting is ignored.
          A sweep is shown row by row; pin one value to use it in overlap, stacking and Kelly.
        </p>
      )}
    </div>
  );
}
