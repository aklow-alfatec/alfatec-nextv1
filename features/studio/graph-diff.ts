import type { GraphJson } from './types';

/** What changed between two graphs (node positions are ignored, as in the graph hash). */
export interface GraphDiff {
  clock: { from: string; to: string } | null;
  nodesAdded: { id: string; type: string }[];
  nodesRemoved: { id: string; type: string }[];
  typeChanged: { id: string; from: string; to: string }[];
  params: { node: string; path: string; from: unknown; to: unknown }[];
  edgesAdded: string[];
  edgesRemoved: string[];
  outputsChanged: boolean;
}

const MAX_PARAM_ROWS = 200;

function leaves(v: unknown, path: string, out: Map<string, unknown>) {
  if (Array.isArray(v)) {
    if (v.length === 0) out.set(path, []);
    v.forEach((x, i) => leaves(x, `${path}.${i}`, out));
  } else if (v && typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    if (entries.length === 0) out.set(path, {});
    for (const [k, x] of entries) leaves(x, path ? `${path}.${k}` : k, out);
  } else {
    out.set(path, v);
  }
}

const clockText = (c: GraphJson['clock'] | undefined) => (c ? `${c.timeframe}${c.anchor ? `-${c.anchor}` : ''}` : '-');

/** Changes needed to go from `a` (older) to `b` (newer). */
export function diffGraphs(a: GraphJson, b: GraphJson): GraphDiff {
  const na = new Map(a.nodes.map((n) => [n.id, n]));
  const nb = new Map(b.nodes.map((n) => [n.id, n]));
  const d: GraphDiff = {
    clock: clockText(a.clock) !== clockText(b.clock) ? { from: clockText(a.clock), to: clockText(b.clock) } : null,
    nodesAdded: b.nodes.filter((n) => !na.has(n.id)).map((n) => ({ id: n.id, type: n.type })),
    nodesRemoved: a.nodes.filter((n) => !nb.has(n.id)).map((n) => ({ id: n.id, type: n.type })),
    typeChanged: [],
    params: [],
    edgesAdded: [],
    edgesRemoved: [],
    outputsChanged: JSON.stringify([...(a.outputs ?? [])].sort()) !== JSON.stringify([...(b.outputs ?? [])].sort()),
  };
  for (const [id, x] of na) {
    const y = nb.get(id);
    if (!y) continue;
    if (x.type !== y.type) d.typeChanged.push({ id, from: x.type, to: y.type });
    const pa = new Map<string, unknown>();
    const pb = new Map<string, unknown>();
    leaves(x.params ?? {}, '', pa);
    leaves(y.params ?? {}, '', pb);
    for (const k of new Set([...pa.keys(), ...pb.keys()])) {
      const from = pa.get(k);
      const to = pb.get(k);
      if (JSON.stringify(from) !== JSON.stringify(to) && d.params.length < MAX_PARAM_ROWS) d.params.push({ node: id, path: k, from, to });
    }
  }
  const ea = new Set(a.edges.map((e) => `${e.from} → ${e.to}`));
  const eb = new Set(b.edges.map((e) => `${e.from} → ${e.to}`));
  d.edgesAdded = [...eb].filter((e) => !ea.has(e));
  d.edgesRemoved = [...ea].filter((e) => !eb.has(e));
  return d;
}

export function diffCount(d: GraphDiff): number {
  return (d.clock ? 1 : 0) + d.nodesAdded.length + d.nodesRemoved.length + d.typeChanged.length + d.params.length +
    d.edgesAdded.length + d.edgesRemoved.length + (d.outputsChanged ? 1 : 0);
}
