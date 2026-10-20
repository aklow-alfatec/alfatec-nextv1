import sql from '@/lib/db';

/**
 * Studio reads straight from the database (P20), so browsing graphs, versions, runs and experiments never
 * wakes the engine API. Every function returns the same JSON as its API endpoint (alfatec-backend
 * app/api/endpoints/graphs_store.py, runs.py, jobs.py); scripts/compare-studio-reads.ts checks that.
 * Writes, previews, run series and anything computed stay on the API.
 */

type Row = Record<string, unknown>;
type Json = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ?? null);
const pick = (r: Row, keys: string[]) => Object.fromEntries(keys.map((k) => [k, iso(r[k])]));

/** summary without the stored out-of-sample curve (served only by the experiment detail view) */
function withoutCurve(summary: unknown) {
  if (summary && typeof summary === 'object' && 'oos_curve' in summary) {
    const { oos_curve: _drop, ...rest } = summary as Json;
    return rest;
  }
  return summary ?? null;
}

// ------------------------------------------------------------------ graphs (PostgresGraphStore)
const GRAPH_LIST = ['id', 'name', 'symbol', 'format', 'graph_hash', 'legacy_pipeline', 'active', 'tags',
  'created_by', 'created_at', 'updated_at', 'current_version'];

function graphJson(r: Row, keys: string[]) {
  const out = pick(r, keys);
  out.tags = Array.isArray(r.tags) ? r.tags : [];
  return out;
}

export async function listGraphs() {
  const rows = await sql`select id::text as id, name, symbol, format, graph_hash, legacy_pipeline, active, tags,
    created_by, created_at, updated_at, current_version from public.graphs order by updated_at desc`;
  return rows.map((r) => graphJson(r, GRAPH_LIST));
}

export async function getGraph(id: string) {
  if (!isUuid(id)) return null;
  const [r] = await sql`select id::text as id, name, symbol, format, graph, graph_hash, legacy_pipeline, active, tags,
    created_by, created_at, updated_at, current_version from public.graphs where id = ${id}::uuid`;
  return r ? graphJson(r, [...GRAPH_LIST.slice(0, 4), 'graph', ...GRAPH_LIST.slice(4)]) : null;
}

export async function graphVersions(id: string) {
  if (!isUuid(id)) return null;
  const [g] = await sql`select 1 from public.graphs where id = ${id}::uuid`;
  if (!g) return null;
  const rows = await sql`select id::text as id, version, graph_hash, note, created_by, created_at
    from public.graph_versions where graph_id = ${id}::uuid order by version desc`;
  // the store's row formatter adds tags: [] to version rows too
  return rows.map((r) => ({ ...pick(r, ['id', 'version', 'graph_hash', 'note', 'created_by', 'created_at']), tags: [] }));
}

export async function graphVersion(id: string, version: number) {
  if (!isUuid(id) || !Number.isInteger(version)) return null;
  const [r] = await sql`select id::text as id, version, graph, graph_hash, note, created_by, created_at
    from public.graph_versions where graph_id = ${id}::uuid and version = ${version}`;
  return r ? { ...pick(r, ['id', 'version', 'graph', 'graph_hash', 'note', 'created_by', 'created_at']), tags: [] } : null;
}

// ------------------------------------------------------------------ runs (runs.py LIST_COLUMNS, jobs.py status_view)
const RUN_LIST = ['id', 'graph_id', 'graph_version_id', 'experiment_id', 'kind', 'status', 'timeframe',
  'start_date', 'end_date', 'summary', 'artifact_path', 'engine_version', 'graph_hash',
  'data_fingerprint', 'progress', 'error', 'created_at', 'finished_at', 'tags'];
const runSelect = () => sql`id::text as id, graph_id::text as graph_id, graph_version_id::text as graph_version_id,
  experiment_id::text as experiment_id, kind, status, timeframe, start_date::text as start_date,
  end_date::text as end_date, summary, artifact_path, engine_version, graph_hash, data_fingerprint, progress,
  error, created_at, finished_at, params, worker_id, heartbeat_at, tags`;

export interface ListQuery {
  graph_id?: string | null;
  kind?: string | null;
  status?: string | null;
  experiment_id?: string | null;
  /** runs carrying this tag (engine_runs.tags, M13), e.g. BACKTEST_TAG */
  tag?: string | null;
  limit?: number;
  offset?: number;
}

function clampLimit(q: ListQuery) {
  return { limit: Math.min(500, Math.max(1, q.limit ?? 50)), offset: Math.max(0, q.offset ?? 0) };
}

export async function listRuns(q: ListQuery) {
  for (const k of ['graph_id', 'experiment_id'] as const) if (q[k] && !isUuid(q[k]!)) return [];
  const { limit, offset } = clampLimit(q);
  const rows = await sql`select ${runSelect()} from engine_runs where true
    ${q.graph_id ? sql`and graph_id = ${q.graph_id}::uuid` : sql``}
    ${q.experiment_id ? sql`and experiment_id = ${q.experiment_id}::uuid` : sql``}
    ${q.kind ? sql`and kind = ${q.kind}` : sql``}
    ${q.status ? sql`and status = ${q.status}` : sql``}
    ${q.tag ? sql`and ${q.tag} = any(tags)` : sql``}
    order by created_at desc limit ${limit} offset ${offset}`;
  return rows.map((r) => pick(r, RUN_LIST));
}

/** The tag that puts a run on the Backtest page. */
export const BACKTEST_TAG = 'ViewInBacktest';

/** A run's name, kept as its `name:<text>` tag (as the nextv0 reruns); empty removes it. Returns the new tags. */
export async function setRunName(id: string, name: string): Promise<string[] | null> {
  if (!isUuid(id)) return null;
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 120);
  const [r] = await sql`update engine_runs set tags = array(select t from unnest(tags) t where t not like 'name:%')
      || ${clean ? sql`array[${`name:${clean}`}]::text[]` : sql`'{}'::text[]`}
    where id = ${id}::uuid returning tags`;
  return r ? (r.tags as string[]) : null;
}

/** Add or remove one tag on a run (nextv1 only: the engine API does not read tags). Returns the new tags. */
export async function setRunTag(id: string, tag: string, on: boolean): Promise<string[] | null> {
  if (!isUuid(id)) return null;
  const [r] = on
    ? await sql`update engine_runs set tags = array_append(array_remove(tags, ${tag}), ${tag}) where id = ${id}::uuid returning tags`
    : await sql`update engine_runs set tags = array_remove(tags, ${tag}) where id = ${id}::uuid returning tags`;
  return r ? (r.tags as string[]) : null;
}

async function runRow(id: string) {
  if (!isUuid(id)) return null;
  const [r] = await sql`select ${runSelect()} from engine_runs where id = ${id}::uuid`;
  return r ?? null;
}

const STATUS_COMMON = ['id', 'graph_id', 'status', 'progress', 'worker_id', 'heartbeat_at', 'created_at',
  'finished_at', 'error', 'artifact_path'];

export async function runStatus(id: string) {
  const r = await runRow(id);
  return r ? pick(r, [...STATUS_COMMON, 'start_date', 'end_date', 'summary', 'kind']) : null;
}

/** GET /runs/{id}?include_series=false without the API: the row and params. Download links come from the
 *  API on request (signed Storage URLs), so this returns no `exports`. */
export async function runDetail(id: string) {
  const r = await runRow(id);
  if (!r) return null;
  return { ...pick(r, RUN_LIST), params: r.params ?? null, series: null, events: [] };
}

// ------------------------------------------------------------------ experiments (runs.py _exp_json, get_experiment)
const EXP_LIST = ['id', 'graph_id', 'name', 'status', 'summary', 'best_params', 'progress', 'error',
  'created_at', 'finished_at'];
const expSelect = () => sql`id::text as id, graph_id::text as graph_id, name, spec, status, best_params, summary,
  artifact_path, engine_version, error, progress, heartbeat_at, worker_id, created_at, finished_at`;

function expJson(r: Row) {
  const out = pick(r, EXP_LIST);
  out.summary = withoutCurve(r.summary);
  const { graph: _g, ...spec } = (r.spec ?? {}) as Json;
  out.spec = spec;
  return out;
}

export async function listExperiments(q: ListQuery) {
  if (q.graph_id && !isUuid(q.graph_id)) return [];
  const { limit, offset } = clampLimit(q);
  const rows = await sql`select ${expSelect()} from experiments where true
    ${q.graph_id ? sql`and graph_id = ${q.graph_id}::uuid` : sql``}
    ${q.status ? sql`and status = ${q.status}` : sql``}
    order by created_at desc limit ${limit} offset ${offset}`;
  return rows.map(expJson);
}

async function expRow(id: string) {
  if (!isUuid(id)) return null;
  const [r] = await sql`select ${expSelect()} from experiments where id = ${id}::uuid`;
  return r ?? null;
}

export async function experimentStatus(id: string) {
  const r = await expRow(id);
  if (!r) return null;
  const out = pick(r, [...STATUS_COMMON, 'name', 'summary', 'best_params']);
  out.summary = withoutCurve(r.summary);
  return out;
}

/** GET /experiments/{id}. `needsApi` is true when a finished experiment has no stored curve (finished before
 *  the worker stored it and not backfilled): the caller then asks the API, which reads oos.parquet. */
export async function experimentDetail(id: string): Promise<{ body: Json; needsApi: boolean } | null> {
  const r = await expRow(id);
  if (!r) return null;
  const out: Json = expJson(r);
  const folds = await sql`select fold_no, train_start::text as train_start, train_end::text as train_end,
    test_start::text as test_start, test_end::text as test_end, best_params, train_metrics, test_metrics
    from experiment_folds where experiment_id = ${id}::uuid order by fold_no`;
  const [best] = await sql`select id::text as id from engine_runs where experiment_id = ${id}::uuid
    and kind = 'experiment_best' order by created_at desc limit 1`;
  out.folds = folds.map((f) => ({ ...f }));
  out.best_run_id = best?.id ?? null;
  const stored = (r.summary as Json | null)?.oos_curve ?? null;
  out.oos_curve = stored;
  return { body: out, needsApi: !stored && r.status === 'done' };
}
