import sql from './db';
import { gradeFromJson, readingFromJson } from './grades';

/** Server-side only. Data for the symbol page: asset, prices, the active pipeline, weekly payloads, runs. */

export interface AssetInfo {
  symbol: string;
  name: string | null;
  asset_type: string | null;
  category: string | null;
  pull_method: string | null;
  publication_lag_days: number | null;
}

export interface PipelineNode {
  cmd: string;
  outnode: string;
  params: Record<string, unknown>;
}

export interface Component {
  node: string;            // e.g. BPGDM_GRADE
  input: string | null;    // the node it grades, e.g. BPGDM
  cmd: string;
  describe: string;        // plain-language rule
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 10) : new Date(d).toISOString().slice(0, 10));
const parse = (j: unknown) => (typeof j === 'string' ? JSON.parse(j) : j) as { nodes?: Record<string, unknown> } | null;

export async function assetInfo(symbol: string): Promise<AssetInfo | null> {
  const rows = await sql<AssetInfo[]>`
    SELECT symbol, name, asset_type, category, pull_method, publication_lag_days FROM assets WHERE symbol = ${symbol}`;
  return rows[0] ?? null;
}

export async function prices(symbol: string, start: string): Promise<{ date: string; close: number }[]> {
  const rows = await sql<{ date: Date; close: string }[]>`
    SELECT date, last_close AS close FROM stock_data WHERE symbol = ${symbol} AND date >= ${start} ORDER BY date`;
  return rows.map((r) => ({ date: iso(r.date), close: Number(r.close) }));
}

/** Date of the symbol's first stored grade (daily_indicator_json), or null when it has none. */
export async function firstGradeDate(symbol: string): Promise<string | null> {
  const [r] = await sql<{ d: Date | null }[]>`SELECT min(date) AS d FROM daily_indicator_json WHERE symbol = ${symbol}`;
  return r?.d ? iso(r.d) : null;
}

export async function activePipelineFor(symbol: string): Promise<{ name: string; nodes: PipelineNode[]; tags: string[] } | null> {
  const rows = await sql<{ pipelinedata: unknown; tags: string[] | null }[]>`
    SELECT pipelinedata, tags FROM pipeline WHERE active = TRUE AND pipelinedata->>'symbol' = ${symbol} LIMIT 1`;
  if (!rows.length) return null;
  const d = (typeof rows[0].pipelinedata === 'string' ? JSON.parse(rows[0].pipelinedata) : rows[0].pipelinedata) as { name: string; nodes: PipelineNode[] };
  return { name: d.name, nodes: d.nodes ?? [], tags: rows[0].tags ?? [] };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The graded parts of a pipeline, in the order its daily adder lists them. */
export function components(nodes: PipelineNode[]): Component[] {
  const adder = nodes.find((n) => n.cmd === 'nodeAdderChain');
  const order = (adder?.params?.innodes as string[] | undefined) ?? nodes.filter((n) => n.outnode.endsWith('_GRADE') && !n.outnode.endsWith('DAILY_GRADE')).map((n) => n.outnode);
  return order.map((name) => {
    const n = nodes.find((x) => x.outnode === name);
    const p = (n?.params ?? {}) as Record<string, unknown>;
    let describe = n?.cmd ?? 'grader';
    if (n?.cmd === 'monthlyGraderChain') {
      const t = (p.lookuptable as number[][] | undefined) ?? [];
      describe = `Month of the year: ${t.map((row, i) => `score ${i + 1} in ${row.map((m) => MONTHS[m - 1]).join('/')}`).join(', ')}`;
    } else if (n?.cmd === 'linearGraderTimeVaryingChain') {
      describe = `${p.in1} against bands that move over time${p.scaling === 'log' ? ' (log scale)' : ''}`;
    } else if (n?.cmd?.startsWith('linearGrader')) {
      describe = `${p.in1} against fixed bands ${Array.isArray(p.thresholds) ? (p.thresholds as number[]).join(' / ') : ''}`;
    } else if (n?.cmd === 'indicatorGraderChain') {
      describe = `${p.in1} sentiment`;
    }
    return { node: name, input: typeof p.in1 === 'string' ? p.in1 : null, cmd: n?.cmd ?? '', describe };
  });
}

export interface WeekPayload {
  date: string;
  grade: number | null;
  reading: number | null;
  points: number | null;
  max: number | null;
  nodes: Record<string, unknown>;
}

/** One payload per Friday (latest row in the 6 days up to it), oldest first. */
export async function weeklyPayloads(symbol: string, weeks: string[]): Promise<Record<string, WeekPayload>> {
  if (!weeks.length) return {};
  const lo = new Date(`${weeks[0]}T00:00:00Z`);
  lo.setUTCDate(lo.getUTCDate() - 6);
  const rows = await sql<{ date: Date; jsondata: unknown }[]>`
    SELECT date, jsondata FROM daily_indicator_json
    WHERE symbol = ${symbol} AND date >= ${lo.toISOString().slice(0, 10)} AND date <= ${weeks[weeks.length - 1]} ORDER BY date`;
  const list = rows.map((r) => ({ date: iso(r.date), payload: r.jsondata }));
  const out: Record<string, WeekPayload> = {};
  for (const w of weeks) {
    const l = new Date(`${w}T00:00:00Z`);
    l.setUTCDate(l.getUTCDate() - 6);
    const ls = l.toISOString().slice(0, 10);
    const hit = [...list].reverse().find((r) => r.date <= w && r.date >= ls);
    if (!hit) continue;
    const nodes = (parse(hit.payload)?.nodes ?? {}) as Record<string, unknown>;
    const daily = Object.entries(nodes).find(([k]) => k.endsWith('_DAILY_GRADE'))?.[1] as Record<string, unknown> | undefined;
    out[w] = {
      date: hit.date,
      grade: gradeFromJson(hit.payload),
      reading: readingFromJson(hit.payload, symbol),
      points: daily && typeof daily === 'object' && Number.isFinite(Number(daily.value)) ? Number(daily.value) : null,
      max: daily && typeof daily === 'object' && Number.isFinite(Number(daily.max)) ? Number(daily.max) : null,
      nodes,
    };
  }
  return out;
}

export interface SymbolRun {
  kind: 'RUN' | 'EXP';
  id: string;
  name: string;
  status: string;
  created_at: string;
  cagr: number | null;
  sharpe: number | null;
  total_return: number | null;
}

/** Backtests and experiments of graphs on this symbol, newest first. */
export async function runsForSymbol(symbol: string, limit = 8): Promise<SymbolRun[]> {
  const [runs, exps] = await Promise.all([
    sql<{ id: string; name: string; status: string; created_at: Date; summary: Record<string, number> | null }[]>`
      SELECT r.id::text, g.name, r.status, r.created_at, r.summary FROM engine_runs r JOIN graphs g ON g.id = r.graph_id
      WHERE g.symbol = ${symbol} AND r.kind = 'backtest' ORDER BY r.created_at DESC LIMIT ${limit}`.catch(() => []),
    sql<{ id: string; name: string | null; status: string; created_at: Date; summary: Record<string, any> | null }[]>`
      SELECT e.id::text, e.name, e.status, e.created_at, e.summary FROM experiments e JOIN graphs g ON g.id = e.graph_id
      WHERE g.symbol = ${symbol} ORDER BY e.created_at DESC LIMIT ${limit}`.catch(() => []),
  ]);
  const toNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return [
    ...runs.map((r) => ({ kind: 'RUN' as const, id: r.id, name: r.name, status: r.status, created_at: r.created_at.toISOString(),
      cagr: toNum(r.summary?.cagr), sharpe: toNum(r.summary?.sharpe), total_return: toNum(r.summary?.total_return) })),
    ...exps.map((e) => ({ kind: 'EXP' as const, id: e.id, name: e.name ?? 'experiment', status: e.status, created_at: e.created_at.toISOString(),
      cagr: toNum(e.summary?.oos_performance?.cagr), sharpe: toNum(e.summary?.oos_performance?.sharpe), total_return: toNum(e.summary?.oos_performance?.total_return) })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
}

/** Saved studio graph converted from this symbol's active pipeline (for "Open graph in studio"). */
export async function graphForPipeline(pipelineName: string): Promise<{ id: string; name: string } | null> {
  const rows = await sql<{ id: string; name: string }[]>`
    SELECT id::text, name FROM graphs WHERE legacy_pipeline = ${pipelineName} ORDER BY updated_at DESC LIMIT 1`.catch(() => []);
  return rows[0] ?? null;
}
