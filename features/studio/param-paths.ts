import type { GraphJson } from './types';

/** One numeric setting found in a graph: "NODE.param" or a dotted path into nested params,
 * e.g. "TRIGGERS.blocks.0.triggers.1.threshold_grade" (same keys the engine's apply_params takes). */
export interface NumericParam {
  key: string;
  node: string;
  path: string;
  value: number;
  integer: boolean;
}

const MAX_PER_NODE = 60; // skip giant lookup tables

export function numericParams(graph: GraphJson): NumericParam[] {
  const out: NumericParam[] = [];
  for (const n of graph.nodes) {
    const found: NumericParam[] = [];
    const walk = (v: unknown, path: string) => {
      if (found.length > MAX_PER_NODE) return;
      if (typeof v === 'number' && Number.isFinite(v)) {
        found.push({ key: `${n.id}.${path}`, node: n.id, path, value: v, integer: Number.isInteger(v) });
      } else if (Array.isArray(v)) {
        v.forEach((x, i) => walk(x, `${path}.${i}`));
      } else if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) walk(x, path ? `${path}.${k}` : k);
      }
    };
    walk(n.params ?? {}, '');
    if (found.length <= MAX_PER_NODE) out.push(...found);
  }
  return out;
}

/** Copy of `graph` with one "NODE.path" set (mirror of app/engine/experiments/runner.set_param_path). */
export function setParam(graph: GraphJson, key: string, value: unknown): GraphJson {
  const g: GraphJson = JSON.parse(JSON.stringify(graph));
  const dot = key.indexOf('.');
  const node = g.nodes.find((n) => n.id === key.slice(0, dot));
  if (!node) throw new Error(`graph has no node for ${key}`);
  const parts = key.slice(dot + 1).split('.');
  let cur: Record<string, unknown> | unknown[] = (node.params ??= {});
  parts.forEach((p, i) => {
    const k: string | number = Array.isArray(cur) ? Number(p) : p;
    if (i === parts.length - 1) (cur as Record<string | number, unknown>)[k] = value;
    else cur = (cur as Record<string | number, unknown>)[k] as Record<string, unknown> | unknown[];
  });
  return g;
}

/** A sensible starting range around the current value. Grades (0..100) get +-20 in steps of 5. */
export function suggestRange(p: NumericParam): { low: number; high: number; step: number } {
  const v = p.value;
  if (/threshold_grade$/.test(p.path) || (/grade/i.test(p.path) && v >= 0 && v <= 100)) {
    return { low: Math.max(0, v - 20), high: Math.min(100, v + 20), step: 5 };
  }
  if (p.integer) {
    const span = Math.max(2, Math.round(Math.abs(v) * 0.5));
    const step = Math.max(1, Math.round(span / 4));
    return { low: Math.max(v > 0 ? 1 : v - span, v - span), high: v + span, step };
  }
  const span = Math.abs(v) * 0.5 || 1;
  return { low: +(v - span).toFixed(6), high: +(v + span).toFixed(6), step: +(span / 4).toFixed(6) };
}

export function gridCount(d: { low: number; high: number; step: number }): number {
  if (!(d.step > 0) || d.high < d.low) return 0;
  return Math.floor((d.high - d.low) / d.step + 1e-9) + 1;
}

/** Readable label for a parameter key: "TRIGGERS: enter threshold_grade" when the trigger has an id. */
export function paramLabel(graph: GraphJson, key: string): string {
  const m = key.match(/^([^.]+)\.blocks\.(\d+)\.triggers\.(\d+)\.(\w+)$/);
  if (m) {
    const node = graph.nodes.find((n) => n.id === m[1]);
    const blocks = (node?.params as { blocks?: { triggers?: { id?: string; action?: string; comparison?: string }[] }[] } | undefined)?.blocks;
    const trig = blocks?.[Number(m[2])]?.triggers?.[Number(m[3])];
    if (trig) return `${m[1]} · trigger "${trig.id}" (${trig.action} when ${trig.comparison === 'less_than' ? 'below' : 'above'}) · ${m[4]}`;
  }
  return key.replace('.', ' · ');
}
