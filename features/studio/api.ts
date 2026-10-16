import type { BlockSpec, GraphJson, GraphMeta, GraphRecord, GraphVersion, Issue } from './types';

/** All calls go through the Next route handler /api/engine, which adds the server-side secret. */
const BASE = '/api/engine';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function detailText(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const d = (body as { detail: unknown }).detail;
    if (typeof d === 'string') return d;
    try {
      return JSON.stringify(d);
    } catch {
      /* fall through */
    }
  }
  return fallback;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (e) {
    throw new ApiError(0, `Cannot reach the engine API (${(e as Error).message})`, null);
  }
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) throw new ApiError(res.status, detailText(body, `HTTP ${res.status}`), body);
  return body as T;
}

export interface ValidateResult {
  valid: boolean;
  hash: string | null;
  issues: Issue[];
}

export interface TradeRow {
  entry: string;
  exit: string;
  side: string;
  qty: number | null;
  entry_price: number | null;
  exit_price: number | null;
  pnl: number | null;
  return: number | null;
  bars: number;
  reason: string | null;
}

/** One strategy node's results (backend app/engine/runs.strategy_reports). */
export interface StrategyReport {
  node: string;
  type: string;
  price_ref: string | null;
  metrics: Record<string, number>;
  benchmark: Record<string, number> | null;
  trade_stats: Record<string, number> | null;
  trades: TradeRow[];
  open_position: number;
  curve: { index: string[]; equity: (number | null)[]; benchmark: (number | null)[] | null; drawdown: (number | null)[] };
}

/** One plottable series of a run (backend app/engine/results/catalogue.py). */
export interface SeriesInfo {
  ref: string;
  node: string;
  port: string;
  block_type: string;
  block_label: string;
  dtype: 'float' | 'int' | 'bool';
  kind: 'price' | 'grade_pct' | 'part_score' | 'bool' | 'pct_100' | 'other';
  min: number | null;
  max: number | null;
}

export interface PreviewResult {
  index: string[];
  outputs: string[];
  values: Record<string, (number | string | boolean | null)[]>;
  warnings: Issue[];
  strategies?: StrategyReport[];
  /** every numeric / bool series of the run (with the graph's block types), for the chart picker */
  catalogue?: SeriesInfo[];
}

/** Columns thinned like GET /runs/{id}?columns=: ts plus one array per column. */
export interface ColumnsResult {
  points: number;
  total: number;
  ts: string[];
  columns: Record<string, (number | null)[]>;
}

export type JobStatus = 'queued' | 'running' | 'stopping' | 'stopped' | 'done' | 'failed';

export interface RunRow {
  id: string;
  graph_id: string;
  graph_version_id: string | null;
  experiment_id: string | null;
  kind: string;
  status: JobStatus;
  timeframe: string | null;
  start_date: string | null;
  end_date: string | null;
  summary: (Record<string, unknown> & { strategies?: StrategyReport[] }) | null;
  progress: { step?: string; done?: number; total?: number; message?: string } | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface ParamDim {
  values?: (number | string)[];
  low?: number;
  high?: number;
  step?: number;
}

export interface ExperimentSpecBody {
  param_space: Record<string, ParamDim>;
  start: string;
  end: string;
  split: { kind: 'rolling' | 'anchored'; train: string; test: string; purge?: string };
  objective: { ref: string; series: 'equity' | 'returns'; metric: string; direction: 'maximize' | 'minimize' };
  optimiser: { kind: 'grid' | 'random' | 'optuna'; n_trials?: number; seed?: number };
}

export interface FoldRow {
  fold_no: number;
  train_start: string;
  train_end: string;
  test_start: string;
  test_end: string;
  best_params: Record<string, unknown> | null;
  train_metrics: Record<string, number> | null;
  test_metrics: Record<string, number> | null;
}

export interface ExperimentRow {
  id: string;
  graph_id: string;
  name: string | null;
  status: JobStatus;
  summary: Record<string, unknown> | null;
  best_params: Record<string, unknown> | null;
  progress: RunRow['progress'];
  error: string | null;
  created_at: string;
  finished_at: string | null;
  spec: Partial<ExperimentSpecBody>;
}

export interface ExperimentDetail extends ExperimentRow {
  folds: FoldRow[];
  best_run_id: string | null;
  oos_curve: { index: string[]; equity: number[]; drawdown: number[]; benchmark: (number | null)[] | null } | null;
}

export type Num = number | null;
export interface EdgeStatRow { n: Num; n_bars: Num; active_share: Num; win_rate: Num; base_rate: Num; lift: Num; avg_win: Num; avg_loss: Num; payoff: Num; expectancy: Num; kelly: Num; t_stat: Num }
export interface GraphUsed { id: string; name: string; version: number | null; version_id: string | null; prefix: string }
export interface EdgeStatsRow {
  name: string;
  group: string | null;
  value: number | null;
  in_stack: boolean;
  stats: EdgeStatRow;
  p_value: Num;
  p_holm: Num;
  stability: { period: string; n: Num; win_rate: Num; base_rate: Num; lift: Num }[];
  share_positive_lift: Num;
}
export interface EdgeStatsResult {
  n_ticks: number;
  n_tests: number;
  effective_n_divisor: number;
  graphs: GraphUsed[];
  edges: EdgeStatsRow[];
}
export interface EdgeOverlapResult { names: string[]; co_occurrence: Num[][]; return_corr: Num[][]; ignored?: string[] }
export interface EdgeStackResult {
  n_edges: number;
  curve: { n_active: number; n: number; win_rate: Num; base_rate: Num; lift: Num; expectancy: Num; p_value: Num; p_holm: Num }[];
  at_least_k: (EdgeStatRow & { k: number })[];
  n_tests?: number;
  ignored?: string[];
}
export interface KellyRow { fraction?: number; label?: string; multiple?: number; cap?: Num; cagr: Num; max_drawdown: Num; final: Num; mean_fraction: Num }
export interface KellyResult {
  k: number;
  weeks_in_position: number;
  curve: KellyRow[];
  optimal: KellyRow;
  estimated: KellyRow[];
  ruin: { label: string; risk_of_ruin: Num; prob_loss: Num; max_drawdown_p05: Num; final_equity_p50: Num }[];
  settings: Record<string, unknown>;
  ignored?: string[];
}

export interface RunDetail extends RunRow {
  params: Record<string, unknown> | null;
  exports?: Record<string, string | null>;
}

export interface SavePayload {
  name: string;
  graph: GraphJson;
  symbol?: string | null;
  legacy_pipeline?: string | null;
  active?: boolean;
  /** saved with the new version when the graph changed */
  note?: string;
}

export const engineApi = {
  blocks: () => call<BlockSpec[]>('/blocks'),
  validate: (graph: GraphJson) => call<ValidateResult>('/graphs/validate', { method: 'POST', body: JSON.stringify(graph) }),
  runPreview: (body: { graph: GraphJson; start: string; end: string; bars?: unknown }) =>
    call<PreviewResult>('/graphs/run-preview', { method: 'POST', body: JSON.stringify(body) }),
  list: () => call<GraphMeta[]>('/graphs'),
  get: (id: string) => call<GraphRecord>(`/graphs/${encodeURIComponent(id)}`),
  create: (p: SavePayload) => call<GraphRecord>('/graphs', { method: 'POST', body: JSON.stringify(p) }),
  update: (id: string, p: Partial<SavePayload>) =>
    call<GraphRecord>(`/graphs/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(p) }),
  versions: (id: string) => call<GraphVersion[]>(`/graphs/${encodeURIComponent(id)}/versions`),
  version: (id: string, n: number) =>
    call<GraphVersion & { graph: GraphJson }>(`/graphs/${encodeURIComponent(id)}/versions/${n}`),
  remove: (id: string) => call<void>(`/graphs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  queueRun: (body: { graph_id: string; start: string; end: string; params?: Record<string, unknown> }) =>
    call<{ id: string; status: JobStatus }>('/runs', { method: 'POST', body: JSON.stringify(body) }),
  runs: (q: { graph_id?: string; status?: string; limit?: number } = {}) => {
    const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return call<RunRow[]>(`/runs${s.toString() ? `?${s}` : ''}`);
  },
  run: (id: string) => call<RunDetail>(`/runs/${encodeURIComponent(id)}?include_series=false&events_limit=0`),
  seriesCatalogue: (id: string) => call<{ run_id: string; series: SeriesInfo[] }>(`/runs/${encodeURIComponent(id)}/series-catalogue`),
  /** Thinned columns of a finished run (no events, no download links). start / end limit the span before thinning. */
  runColumns: async (id: string, columns: string[], q: { max_points?: number; start?: string; end?: string } = {}) => {
    const s = new URLSearchParams({ columns: columns.join(','), max_points: String(q.max_points ?? 1500), events_limit: '0', exports: 'false' });
    if (q.start) s.set('start', q.start);
    if (q.end) s.set('end', q.end);
    const r = await call<{ series: ColumnsResult | null }>(`/runs/${encodeURIComponent(id)}?${s}`);
    return r.series ?? { points: 0, total: 0, ts: [], columns: {} };
  },
  /** Indicators the graph does not contain, computed over the run's period with the run's own graph. */
  runIndicators: (id: string, indicators: Record<string, unknown>[], q: { max_points?: number; start?: string; end?: string } = {}) => {
    const s = new URLSearchParams({ max_points: String(q.max_points ?? 1500) });
    if (q.start) s.set('start', q.start);
    if (q.end) s.set('end', q.end);
    return call<{ run_id: string; index: string[]; points: number; total: number; series: Record<string, (number | null)[]> }>(
      `/runs/${encodeURIComponent(id)}/indicators?${s}`,
      { method: 'POST', body: JSON.stringify({ indicators }) },
    );
  },
  runStatus: (id: string) => call<{ id: string; status: JobStatus; progress: RunRow['progress']; error: string | null }>(`/runs/${encodeURIComponent(id)}/status`),
  stopRun: (id: string) => call<unknown>(`/runs/${encodeURIComponent(id)}/stop`, { method: 'POST' }),
  queueExperiment: (body: { graph_id: string; spec: ExperimentSpecBody; name?: string }) =>
    call<{ id: string; status: JobStatus }>('/experiments', { method: 'POST', body: JSON.stringify(body) }),
  experiments: (q: { graph_id?: string; limit?: number } = {}) => {
    const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return call<ExperimentRow[]>(`/experiments${s.toString() ? `?${s}` : ''}`);
  },
  experiment: (id: string) => call<ExperimentDetail>(`/experiments/${encodeURIComponent(id)}`),
  experimentStatus: (id: string) =>
    call<{ id: string; status: JobStatus; progress: RunRow['progress']; error: string | null }>(`/experiments/${encodeURIComponent(id)}/status`),
  stopExperiment: (id: string) => call<unknown>(`/experiments/${encodeURIComponent(id)}/stop`, { method: 'POST' }),
  // Edge Lab / Kelly (nothing is stored; see app/api/endpoints/edges.py)
  edgeStats: (body: unknown) => call<EdgeStatsResult>('/edges/stats', { method: 'POST', body: JSON.stringify(body) }),
  edgeOverlap: (body: unknown) => call<EdgeOverlapResult>('/edges/overlap', { method: 'POST', body: JSON.stringify(body) }),
  edgeStack: (body: unknown) => call<EdgeStackResult>('/edges/stack', { method: 'POST', body: JSON.stringify(body) }),
  edgeKelly: (body: unknown) => call<KellyResult>('/edges/kelly', { method: 'POST', body: JSON.stringify(body) }),
  convertLegacy: (pipeline: string) =>
    call<{ graph: GraphJson; hash: string; name: string; symbol: string | null }>(
      `/graphs/convert-legacy/${encodeURIComponent(pipeline)}`,
      { method: 'POST' },
    ),
};
