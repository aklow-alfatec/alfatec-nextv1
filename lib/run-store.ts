// Server-side only (reads the service role key).
import { parquetMetadata, parquetReadObjects, parquetSchema } from 'hyparquet';
import blockMeta from './block-meta.json';

/**
 * A finished run's files read straight from Supabase Storage (bucket engine-runs, runs/{id}/), so the studio's run
 * view needs no engine API. Mirrors alfatec-backend app/api/endpoints/runs.py: downsample() for the thinned
 * columns, results/catalogue.py for the series catalogue, _export_links() for the download links. Added
 * indicators are computed by the engine and stay on the API.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server only). lib/block-meta.json comes from
 * alfatec-backend `python -m scripts.export_block_meta`.
 */

const BUCKET = 'engine-runs';
const DEFAULT_FILES = ['manifest.json', 'series.parquet', 'events.parquet'];
const PRICE_PORTS = new Set(['open', 'high', 'low', 'close']);
const META = blockMeta as Record<string, { label: string; outputs: Record<string, string> }>;

type Json = Record<string, unknown>;
type Cell = number | boolean | string | null | unknown;

export interface StoredRun {
  manifest: Json;
  ts: Date[];
  /** column name -> values; object columns already decoded from JSON */
  columns: Record<string, Cell[]>;
  /** column name -> 'bool' | 'number' | 'other', from the Parquet schema */
  kinds: Record<string, 'bool' | 'number' | 'other'>;
  events: Json[];
}

export class StorageNotConfigured extends Error {}

function storage() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new StorageNotConfigured('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set');
  return { base: `${url}/storage/v1`, headers: { Authorization: `Bearer ${key}`, apikey: key } };
}

const prefix = (runId: string) => `runs/${runId}`;

async function download(path: string): Promise<ArrayBuffer | null> {
  const s = storage();
  const res = await fetch(`${s.base}/object/${BUCKET}/${path}`, { headers: s.headers, cache: 'no-store' });
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`storage ${res.status} reading ${path}`);
  return res.arrayBuffer();
}

function physicalKinds(buf: ArrayBuffer): Record<string, 'bool' | 'number' | 'other'> {
  const out: Record<string, 'bool' | 'number' | 'other'> = {};
  for (const c of parquetSchema(parquetMetadata(buf)).children) {
    const e = c.element;
    const logical = (e.logical_type as { type?: string } | undefined)?.type ?? e.converted_type;
    out[e.name] = e.type === 'BOOLEAN' ? 'bool'
      : ['DOUBLE', 'FLOAT', 'INT32', 'INT64'].includes(String(e.type)) && !/TIMESTAMP|DATE|TIME/.test(String(logical ?? '')) ? 'number'
      : 'other';
  }
  return out;
}

const decode = (v: unknown) => {
  if (typeof v !== 'string') return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

// a finished run never changes: keep the last few parsed in memory (as the API's _load_run)
const CACHE = new Map<string, StoredRun>();
const CACHE_SIZE = 3;

export async function loadRun(runId: string): Promise<StoredRun> {
  const hit = CACHE.get(runId);
  if (hit) {
    CACHE.delete(runId);
    CACHE.set(runId, hit);
    return hit;
  }
  const [m, s, e] = await Promise.all(DEFAULT_FILES.map((n) => download(`${prefix(runId)}/${n}`)));
  if (!m || !s) throw new Error(`run ${runId}: manifest.json or series.parquet missing in storage`);
  const manifest = JSON.parse(new TextDecoder().decode(m)) as Json;
  const files = (manifest.files ?? {}) as Json;
  if (files.series && files.series !== 'series.parquet') throw new Error(`run ${runId}: unexpected series file ${String(files.series)}`);
  const rows = (await parquetReadObjects({ file: s })) as Json[];
  const kinds = physicalKinds(s);
  const tags = (manifest.columns ?? {}) as Record<string, string>;
  const names = Object.keys(kinds).filter((k) => k !== 'ts');
  const columns: Record<string, Cell[]> = {};
  for (const n of names) columns[n] = tags[n] === 'object' ? rows.map((r) => decode(r[n])) : rows.map((r) => (r[n] ?? null) as Cell);
  const ts = rows.map((r) => (r.ts instanceof Date ? r.ts : new Date(String(r.ts))));
  const events = e ? ((await parquetReadObjects({ file: e })) as Json[]) : [];
  const run = { manifest, ts, columns, kinds, events };
  CACHE.set(runId, run);
  while (CACHE.size > CACHE_SIZE) CACHE.delete(CACHE.keys().next().value as string);
  return run;
}

// ------------------------------------------------------------------ downsample (runs.py downsample)
/** pandas isoformat of a naive UTC timestamp: 2005-01-07T00:00:00 */
export const isoNaive = (d: Date) => d.toISOString().slice(0, 19);

/** numpy round(): halves to the nearest even integer */
function roundHalfEven(x: number) {
  const f = Math.floor(x);
  const r = x - f;
  if (r > 0.5) return f + 1;
  if (r < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** Floats to 8 significant digits (as _short). */
const short = (v: Cell) => (typeof v === 'number' ? (Number.isFinite(v) ? Number(v.toPrecision(8)) : null) : v);

/** series.loc[start:end] with pandas' partial-date strings: a date-only end takes the whole day. */
function span(ts: Date[], start?: string | null, end?: string | null): [number, number] {
  const t0 = start ? Date.parse(/T|\s/.test(start) ? `${start.replace(' ', 'T')}Z` : `${start}T00:00:00Z`) : -Infinity;
  const t1 = end ? (/T|\s/.test(end) ? Date.parse(`${end.replace(' ', 'T')}Z`) : Date.parse(`${end}T00:00:00Z`) + 86_400_000 - 1) : Infinity;
  if (Number.isNaN(t0) || Number.isNaN(t1)) throw new RangeError('start / end must be dates');
  let i = 0;
  while (i < ts.length && ts[i].getTime() < t0) i++;
  let j = ts.length;
  while (j > i && ts[j - 1].getTime() > t1) j--;
  return [i, j];
}

export function downsample(run: StoredRun, maxPoints: number, want?: string[] | null, start?: string | null, end?: string | null) {
  const [i0, i1] = span(run.ts, start, end);
  const n = i1 - i0;
  let pos: number[];
  if (n <= maxPoints) pos = Array.from({ length: n }, (_, k) => k);
  else {
    const step = (n - 1) / (maxPoints - 1);
    pos = [...new Set(Array.from({ length: maxPoints }, (_, k) => roundHalfEven(k * step)))].sort((a, b) => a - b);
  }
  const cols = Object.keys(run.columns).filter((c) => !want?.length || want.includes(c));
  return {
    points: pos.length,
    total: n,
    ts: pos.map((p) => isoNaive(run.ts[i0 + p])),
    columns: Object.fromEntries(cols.map((c) => [c, pos.map((p) => short(run.columns[c][i0 + p]))])),
  };
}

// ------------------------------------------------------------------ catalogue (results/catalogue.py)
function kindOf(blockType: string, port: string, dtype: string, finite: number[]) {
  if (dtype === 'bool') return 'bool';
  if (blockType === 'data.bars' && PRICE_PORTS.has(port)) return 'price';
  const real = finite.filter((v) => v !== -1);
  if (port === 'pct' && blockType.toLowerCase().includes('adder')) return 'grade_pct';
  if (port === 'grade' && real.length && Math.min(...real) >= 0 && Math.max(...real) <= 5) return 'part_score';
  if (dtype === 'float' && finite.length) {
    const lo = Math.min(...finite);
    const hi = Math.max(...finite);
    if (lo >= 0 && hi <= 100 && hi - lo >= 30) return 'pct_100';
  }
  return 'other';
}

export function catalogue(run: StoredRun) {
  const graph = (run.manifest.graph ?? {}) as { nodes?: { id: string; type: string }[] };
  const types = new Map((graph.nodes ?? []).map((n) => [n.id, n.type]));
  const tags = (run.manifest.columns ?? {}) as Record<string, string>;
  const out: Json[] = [];
  for (const col of Object.keys(run.columns)) {
    const pk = run.kinds[col];
    if (tags[col] === 'object' || (pk !== 'bool' && pk !== 'number')) continue;
    const cut = col.lastIndexOf('.');
    const node = cut > 0 ? col.slice(0, cut) : '';
    const port = col.slice(cut + 1);
    if (!node || !types.has(node)) continue;
    const btype = types.get(node)!;
    const info = META[btype] ?? { label: btype, outputs: {} };
    let dtype = pk === 'bool' ? 'bool' : info.outputs[port] ?? 'float';
    if (dtype === 'object') dtype = 'float';
    const finite: number[] = [];
    for (const v of run.columns[col]) {
      const x = typeof v === 'boolean' ? Number(v) : typeof v === 'number' ? v : NaN;
      if (Number.isFinite(x)) finite.push(x);
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of finite) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    out.push({ ref: col, node, port, block_type: btype, block_label: info.label, dtype, kind: kindOf(btype, port, dtype, finite),
      min: finite.length ? lo : null, max: finite.length ? hi : null });
  }
  return out;
}

// ------------------------------------------------------------------ events and download links
export function eventsJson(run: StoredRun, limit: number) {
  return run.events.slice(0, limit).map((r) => {
    const out: Json = {};
    for (const [k, v] of Object.entries(r)) {
      out[k] = k === 'ts' && v instanceof Date ? isoNaive(v) : typeof v === 'number' && !Number.isFinite(v) ? null : typeof v === 'bigint' ? Number(v) : v;
    }
    return out;
  });
}

/** Signed download links for every file of the run (as _export_links; they expire after expiresIn seconds). */
export async function exportLinks(runId: string, expiresIn = 3600): Promise<Record<string, string | null>> {
  const s = storage();
  let names: string[] = [];
  try {
    const res = await fetch(`${s.base}/object/list/${BUCKET}`, {
      method: 'POST', headers: { ...s.headers, 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ prefix: prefix(runId), limit: 100 }),
    });
    if (res.ok) names = ((await res.json()) as { name?: string; id?: string | null }[]).filter((o) => o.name && o.id).map((o) => o.name!);
  } catch {
    names = [];
  }
  for (const n of DEFAULT_FILES) if (!names.includes(n)) names.push(n);
  const out: Record<string, string | null> = {};
  await Promise.all(names.map(async (n) => {
    try {
      const res = await fetch(`${s.base}/object/sign/${BUCKET}/${prefix(runId)}/${n}`, {
        method: 'POST', headers: { ...s.headers, 'Content-Type': 'application/json' }, cache: 'no-store', body: JSON.stringify({ expiresIn }),
      });
      const j = res.ok ? ((await res.json()) as { signedURL?: string }) : {};
      out[n] = j.signedURL ? `${s.base}${j.signedURL}` : null;
    } catch {
      out[n] = null;
    }
  }));
  return out;
}
