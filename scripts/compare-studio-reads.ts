/**
 * P20 parity check: every read the studio now takes from the database (lib/studio-db.ts) must return the same
 * JSON as the engine API endpoint it replaces. Read-only on both sides.
 *
 *   npx -y tsx@4.19.2 --env-file=.env.local scripts/compare-studio-reads.ts [API base, default ENGINE_LOCAL_URL or ENGINE_API_URL]
 *
 * Timestamps are compared as instants (Python prints +00:00 microseconds, JS prints Z milliseconds). The run
 * detail is compared on the database's keys only: the API adds manifest, events_total and exports (from Storage).
 */
import {
  experimentDetail, experimentStatus, getGraph, graphVersion, graphVersions, listExperiments, listGraphs, listRuns,
  runDetail, runStatus,
} from '@/lib/studio-db';
import sql from '@/lib/db';

const base = (process.argv[2] || process.env.ENGINE_LOCAL_URL || process.env.ENGINE_API_URL || '').replace(/\/$/, '');
const secret = process.env.ENGINE_LOCAL_SECRET ?? process.env.ENGINE_API_SECRET;
const TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

async function api(path: string) {
  const r = await fetch(`${base}/api/v1${path}`, { headers: secret ? { 'X-Engine-Secret': secret } : {} });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

function norm(v: unknown): unknown {
  if (typeof v === 'string' && TS.test(v)) return new Date(v).getTime();
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]));
  }
  return v;
}

function firstDiff(a: unknown, b: unknown, path = ''): string | null {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b || Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(a)) ? null : `${path}: ${a} != ${b}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} != ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a), kb = Object.keys(b);
    const missing = ka.filter((k) => !kb.includes(k)).concat(kb.filter((k) => !ka.includes(k)));
    if (missing.length) return `${path}: keys differ (${missing.join(', ')})`;
    for (const k of ka) {
      const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
}

let checked = 0;
const failures: string[] = [];

async function same(label: string, fromDb: unknown, apiPath: string, onlyDbKeys = false) {
  let fromApi = await api(apiPath);
  if (onlyDbKeys && fromDb && typeof fromDb === 'object') {
    fromApi = Object.fromEntries(Object.keys(fromDb).map((k) => [k, (fromApi as Record<string, unknown>)[k]]));
  }
  const d = firstDiff(norm(fromDb), norm(fromApi));
  checked++;
  if (d) failures.push(`${label}${d}`);
}

async function main() {
  if (!base) throw new Error('no API base: pass it or set ENGINE_LOCAL_URL / ENGINE_API_URL');
  console.log(`comparing database reads with ${base}`);

  const graphs = await listGraphs();
  await same('GET /graphs', graphs, '/graphs');
  for (const g of graphs.slice(0, 20)) {
    const id = g.id as string;
    await same(`GET /graphs/${id}`, await getGraph(id), `/graphs/${id}`);
    const vs = (await graphVersions(id)) ?? [];
    await same(`GET /graphs/${id}/versions`, vs, `/graphs/${id}/versions`);
    if (vs.length) await same(`GET /graphs/${id}/versions/1`, await graphVersion(id, 1), `/graphs/${id}/versions/1`);
  }

  const runs = await listRuns({ limit: 500 });
  await same('GET /runs?limit=500', runs, '/runs?limit=500');
  await same('GET /runs?kind=experiment_best', await listRuns({ kind: 'experiment_best' }), '/runs?kind=experiment_best');
  for (const r of runs.slice(0, 50)) {
    const id = r.id as string;
    await same(`GET /runs/${id}/status`, await runStatus(id), `/runs/${id}/status`);
    await same(`GET /runs/${id} (row)`, await runDetail(id), `/runs/${id}?include_series=false&events_limit=0&exports=false`, true);
  }

  const exps = await listExperiments({ limit: 500 });
  await same('GET /experiments', exps, '/experiments?limit=500');
  for (const e of exps) {
    const id = e.id as string;
    await same(`GET /experiments/${id}/status`, await experimentStatus(id), `/experiments/${id}/status`);
    const d = await experimentDetail(id);
    if (d?.needsApi) console.log(`  note: ${id} has no stored curve (the route asks the API for it)`);
    else await same(`GET /experiments/${id}`, d?.body, `/experiments/${id}`);
  }

  console.log(`${checked} comparisons, ${failures.length} different`);
  for (const f of failures.slice(0, 30)) console.log(`  DIFF ${f}`);
  await sql.end();
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(2);
});
