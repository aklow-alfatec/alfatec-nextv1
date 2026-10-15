import type { BlockSpec, GraphJson, GraphMeta, GraphRecord, Issue } from './types';

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

export interface PreviewResult {
  index: string[];
  outputs: string[];
  values: Record<string, (number | string | boolean | null)[]>;
  warnings: Issue[];
  strategies?: StrategyReport[];
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
  remove: (id: string) => call<void>(`/graphs/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  queueRun: (body: { graph_id: string; start: string; end: string; params?: Record<string, unknown> }) =>
    call<{ id: string; status: JobStatus }>('/runs', { method: 'POST', body: JSON.stringify(body) }),
  runs: (q: { graph_id?: string; status?: string; limit?: number } = {}) => {
    const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return call<RunRow[]>(`/runs${s.toString() ? `?${s}` : ''}`);
  },
  run: (id: string) => call<RunDetail>(`/runs/${encodeURIComponent(id)}?include_series=false&events_limit=0`),
  runStatus: (id: string) => call<{ id: string; status: JobStatus; progress: RunRow['progress']; error: string | null }>(`/runs/${encodeURIComponent(id)}/status`),
  stopRun: (id: string) => call<unknown>(`/runs/${encodeURIComponent(id)}/stop`, { method: 'POST' }),
  convertLegacy: (pipeline: string) =>
    call<{ graph: GraphJson; hash: string; name: string; symbol: string | null }>(
      `/graphs/convert-legacy/${encodeURIComponent(pipeline)}`,
      { method: 'POST' },
    ),
};
