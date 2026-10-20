import type { GraphJson } from './types';

/**
 * A run's own settings ({"node.param": value}, engine_runs.params) applied on top of its graph, as the engine
 * does before it runs (alfatec-backend experiments/runner.py apply_params): the part after the node id may be a
 * dotted path into nested params, with numbers as list indexes ("TRIGGERS.blocks.0.triggers.0.threshold_grade").
 */
export type RunParams = Record<string, unknown>;

function setPath(obj: unknown, path: string[], value: unknown): unknown {
  if (!path.length) return value;
  const [head, ...rest] = path;
  if (Array.isArray(obj) && /^\d+$/.test(head)) {
    const copy = [...obj];
    copy[Number(head)] = setPath(copy[Number(head)], rest, value);
    return copy;
  }
  const base = obj && typeof obj === 'object' ? (obj as Record<string, unknown>) : {};
  return { ...base, [head]: setPath(base[head], rest, value) };
}

/** Copy of `graph` with the run's settings written into its nodes; keys naming a missing node are ignored. */
export function applyRunParams(graph: GraphJson, params: RunParams | null | undefined): GraphJson {
  if (!params || !Object.keys(params).length) return graph;
  const nodes = graph.nodes.map((n) => {
    let p: unknown = n.params ?? {};
    for (const [key, value] of Object.entries(params)) {
      const [nodeId, ...path] = key.split('.');
      if (nodeId === n.id && path.length) p = setPath(p, path, value);
    }
    return p === n.params ? n : { ...n, params: p as Record<string, unknown> };
  });
  return { ...graph, nodes };
}

/** The nodes a run's settings change, with the settings for each ({node: {param path: value}}). */
export function paramsByNode(params: RunParams | null | undefined): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    const i = key.indexOf('.');
    if (i <= 0) continue;
    (out[key.slice(0, i)] ??= {})[key.slice(i + 1)] = value;
  }
  return out;
}

// ------------------------------------------------------------------ capital blocks and triggers in words
export interface TriggerLike {
  threshold_grade?: number;
  comparison?: string;
  action?: string;
  action_proportion?: number;
  attack_weeks?: number | null;
  cooldown_weeks?: number | null;
  trigger_on?: string;
}
export interface CapitalBlockLike {
  id?: string | number | null;
  allocation_percentage?: number;
  triggers?: TriggerLike[];
}

const isTrigger = (t: unknown): t is TriggerLike => !!t && typeof t === 'object' && 'threshold_grade' in t;
/** True for nextv0-style capital blocks (strategy.nextv0_policy / signal.grade_triggers `blocks`). */
export const isCapitalBlocks = (v: unknown): v is CapitalBlockLike[] =>
  Array.isArray(v) && v.length > 0 && v.every((b) => b && typeof b === 'object' && Array.isArray((b as CapitalBlockLike).triggers));
export const isTriggerList = (v: unknown): v is TriggerLike[] => Array.isArray(v) && v.length > 0 && v.every(isTrigger);

/** "Buy when the grade is above 96" / "Sell when the grade is below 30" (long = buy, short = sell, as nextv0). */
export function triggerText(t: TriggerLike): string {
  const verb = t.action === 'short' ? 'Sell' : 'Buy';
  const cmp = t.comparison === 'less_than' ? 'below' : 'above';
  const share = t.action_proportion !== undefined && t.action_proportion !== 1 ? ` (${Math.round(t.action_proportion * 100)}%)` : '';
  return `${verb}${share} when the grade is ${cmp} ${t.threshold_grade}`;
}

export function triggerTiming(t: TriggerLike): string {
  const bits: string[] = [];
  if (t.attack_weeks) bits.push(`after ${t.attack_weeks} week${t.attack_weeks === 1 ? '' : 's'}`);
  if (t.cooldown_weeks) bits.push(`${t.cooldown_weeks} week${t.cooldown_weeks === 1 ? '' : 's'} cooldown`);
  return bits.join(', ');
}

// ------------------------------------------------------------------ settings that differ from the saved graph
/** JSON with object keys sorted, so the same value compares equal whatever order its keys were written in. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

export interface ParamDiff {
  /** run settings, {"NODE.setting": value}: what a run sends */
  params: RunParams;
  /** per node, the settings that differ, with the saved graph's value of each */
  byNode: Record<string, Record<string, unknown>>;
}

/** Top-level settings of `nodes` that differ from the same node in `base` (nodes missing from base are ignored). */
export function diffParams(base: GraphJson, nodes: { id: string; params?: Record<string, unknown> }[]): ParamDiff {
  const saved = new Map(base.nodes.map((n) => [n.id, (n.params ?? {}) as Record<string, unknown>]));
  const out: ParamDiff = { params: {}, byNode: {} };
  for (const n of nodes) {
    const b = saved.get(n.id);
    if (!b) continue;
    for (const [k, v] of Object.entries(n.params ?? {})) {
      if (stableJson(v) === stableJson(b[k])) continue;
      out.params[`${n.id}.${k}`] = v;
      (out.byNode[n.id] ??= {})[k] = b[k];
    }
  }
  return out;
}

/** Same blocks, connections and settings (positions and other layout ignored). */
export function sameGraph(a: GraphJson, b: GraphJson): boolean {
  const shape = (g: GraphJson) => stableJson({
    nodes: [...g.nodes].sort((x, y) => x.id.localeCompare(y.id)).map((n) => ({ id: n.id, type: n.type, params: n.params ?? {} })),
    edges: [...g.edges].map((e) => `${e.from}>${e.to}`).sort(),
  });
  return shape(a) === shape(b);
}
