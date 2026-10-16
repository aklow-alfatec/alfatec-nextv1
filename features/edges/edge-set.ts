import type { GraphJson } from '@/features/studio/types';

/** One yes/no edge built from a simple rule; turned into graph blocks by buildEdgeGraph. */
export interface EdgeRule {
  name: string;
  symbol: string;
  indicator: 'close' | 'rsi' | 'sma' | 'zscore' | 'roc' | 'rank';
  period: number;
  op: 'lt' | 'gt';
  value: number;
}

/** An output of a saved graph used as an edge; numeric outputs get one edge per threshold value. */
export interface GraphEdgeRule {
  graphId: string;
  graphName: string;
  version: number | null;      // null = current version
  ref: string;                 // node.port in that graph
  label: string;
  dtype: 'float' | 'int' | 'bool';
  op: 'gt' | 'ge' | 'lt' | 'le' | 'eq';
  values: number[];
  pinned: number | null;       // the value used in overlap / stacking / Kelly
}

export interface EdgeSet {
  asset: string;               // the outcome is measured on this asset's close
  timeframe: '1D' | '1W' | '1M';
  start: string;
  end: string;
  horizon: number;             // bars ahead
  direction: 'long' | 'short';
  rules: EdgeRule[];
  graphEdges: GraphEdgeRule[];
}

export const INDICATORS: Record<EdgeRule['indicator'], { label: string; block?: string; port?: string; hasPeriod: boolean; hasValue: boolean }> = {
  close: { label: 'close price', hasPeriod: false, hasValue: true },
  rsi: { label: 'RSI', block: 'momentum.rsi', port: 'rsi', hasPeriod: true, hasValue: true },
  sma: { label: 'close vs its moving average', block: 'trend.sma', port: 'sma', hasPeriod: true, hasValue: false },
  zscore: { label: 'z-score of close', block: 'stats.zscore', port: 'zscore', hasPeriod: true, hasValue: true },
  roc: { label: 'rate of change % (period bars)', block: 'momentum.roc', port: 'roc', hasPeriod: true, hasValue: true },
  rank: { label: 'percentile rank of close (0-100)', block: 'stats.percentile_rank', port: 'rank', hasPeriod: true, hasValue: true },
};

export const DEFAULT_SET: EdgeSet = {
  asset: 'GOLD',
  timeframe: '1W',
  start: '2005-01-01',
  end: new Date().toISOString().slice(0, 10),
  horizon: 8,
  direction: 'long',
  rules: [
    { name: 'RSI 14 < 40', symbol: 'GOLD', indicator: 'rsi', period: 14, op: 'lt', value: 40 },
    { name: 'above 40-bar average', symbol: 'GOLD', indicator: 'sma', period: 40, op: 'gt', value: 0 },
    { name: 'COT managed money z < -1', symbol: 'COT_GOLD_MM_NET', indicator: 'zscore', period: 52, op: 'lt', value: -1 },
  ],
  graphEdges: [],
};

const KEY = 'alfatec.edge-set.v1';

export function loadEdgeSet(): EdgeSet {
  try {
    const raw = window.localStorage.getItem(KEY);
    // v1 sets (rules only) load as they are: graphEdges defaults to []
    if (raw) {
      const s = { ...DEFAULT_SET, ...(JSON.parse(raw) as Partial<EdgeSet>) };
      return { ...s, graphEdges: s.graphEdges ?? [] };
    }
  } catch {
    /* private window / blocked storage: fall back to the default */
  }
  return DEFAULT_SET;
}

export function saveEdgeSet(s: EdgeSet): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* not essential */
  }
}

const safe = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '_');

/** Graph with one data.bars per symbol and one bool node per rule (E1.out, E2.out, ...). */
export function buildEdgeGraph(set: EdgeSet): { graph: GraphJson; priceRef: string; refs: { name: string; ref: string }[] } {
  const nodes: GraphJson['nodes'] = [];
  const edges: GraphJson['edges'] = [];
  const bars = (sym: string) => {
    const id = `BARS_${safe(sym)}`;
    if (!nodes.some((n) => n.id === id)) nodes.push({ id, type: 'data.bars', params: { symbol: sym } });
    return id;
  };
  const priceRef = `${bars(set.asset)}.close`;
  const refs = set.rules.map((r, i) => {
    const b = bars(r.symbol || set.asset);
    const id = `E${i + 1}`;
    const ind = INDICATORS[r.indicator];
    nodes.push({ id, type: 'math.compare', params: ind.hasValue ? { op: r.op, value: r.value } : { op: r.op } });
    if (r.indicator === 'close') {
      edges.push({ from: `${b}.close`, to: `${id}.a` });
    } else if (r.indicator === 'sma') {
      nodes.push({ id: `${id}_IND`, type: ind.block!, params: { period: r.period } });
      edges.push({ from: `${b}.close`, to: `${id}_IND.close` }, { from: `${b}.close`, to: `${id}.a` }, { from: `${id}_IND.${ind.port}`, to: `${id}.b` });
    } else {
      nodes.push({ id: `${id}_IND`, type: ind.block!, params: { period: r.period } });
      const input = ind.block!.startsWith('stats.') ? 'value' : 'close';
      edges.push({ from: `${b}.close`, to: `${id}_IND.${input}` }, { from: `${id}_IND.${ind.port}`, to: `${id}.a` });
    }
    return { name: r.name || `edge ${i + 1}`, ref: `${id}.out` };
  });
  const graph: GraphJson = {
    format: 'alfatec.graph/1',
    clock: { timeframe: set.timeframe, anchor: set.timeframe === '1W' ? 'FRI' : null },
    nodes,
    edges,
    outputs: [],
  };
  return { graph, priceRef, refs };
}

export function edgeRequest(set: EdgeSet) {
  const { graph, priceRef, refs } = buildEdgeGraph(set);
  return {
    graph,
    start: set.start,
    end: set.end,
    price_ref: priceRef,
    edges: refs,
    graph_edges: (set.graphEdges ?? []).map((g) => ({
      graph_id: g.graphId,
      version: g.version ?? undefined,
      ref: g.ref,
      label: g.label || g.ref,
      op: g.op,
      values: g.dtype === 'bool' ? [] : g.values,
      pinned: g.dtype === 'bool' || g.pinned === null ? undefined : g.pinned,
    })),
    outcome: { kind: 'horizon', bars: set.horizon },
    direction: set.direction,
  };
}

/** "40, 50, 60" or "40-80/10" (from-to/step) -> sorted unique numbers. */
export function parseValues(text: string): number[] {
  const m = text.trim().match(/^(-?[\d.]+)\s*-\s*(-?[\d.]+)\s*\/\s*([\d.]+)$/);
  let out: number[] = [];
  if (m) {
    const [lo, hi, step] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (step > 0) for (let v = lo; v <= hi + 1e-9 && out.length < 200; v += step) out.push(Number(v.toFixed(10)));
  } else {
    out = text.split(/[,\s]+/).filter(Boolean).map(Number).filter((v) => Number.isFinite(v));
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}
