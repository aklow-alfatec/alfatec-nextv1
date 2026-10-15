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

export interface PreviewResult {
  index: string[];
  outputs: string[];
  values: Record<string, (number | string | boolean | null)[]>;
  warnings: Issue[];
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
  convertLegacy: (pipeline: string) =>
    call<{ graph: GraphJson; hash: string; name: string; symbol: string | null }>(
      `/graphs/convert-legacy/${encodeURIComponent(pipeline)}`,
      { method: 'POST' },
    ),
};
