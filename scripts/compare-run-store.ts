/**
 * Parity check for lib/run-store.ts: a run's series catalogue, thinned columns and events read from Storage must
 * match the engine API (runs.py). Read-only on both sides.
 *
 *   npx -y tsx@4.19.2 --env-file=.env.local scripts/compare-run-store.ts [API base, default ENGINE_LOCAL_URL or ENGINE_API_URL]
 */
import sql from '@/lib/db';
import { catalogue, downsample, eventsJson, loadRun } from '@/lib/run-store';

const base = (process.argv[2] || process.env.ENGINE_LOCAL_URL || process.env.ENGINE_API_URL || '').replace(/\/$/, '');
const secret = process.env.ENGINE_LOCAL_SECRET ?? process.env.ENGINE_API_SECRET;

async function api(path: string) {
  const r = await fetch(`${base}/api/v1${path}`, { headers: secret ? { 'X-Engine-Secret': secret } : {} });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

/** numbers equal to 7 significant digits (both sides round to 8); everything else exactly */
function same(a: unknown, b: unknown, path = ''): string | null {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b || Math.abs(a - b) <= 1e-7 * Math.max(Math.abs(a), Math.abs(b)) ? null : `${path}: ${a} != ${b}`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: length ${a.length} != ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = same(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    if (ka.join() !== kb.join()) return `${path}: keys ${ka.join()} != ${kb.join()}`;
    for (const k of ka) {
      const d = same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`;
}

async function main() {
  if (!base) throw new Error('no API base');
  const runs = await sql<{ id: string }[]>`select id::text as id from engine_runs where status = 'done' and artifact_path is not null
    order by created_at desc limit 6`;
  let bad = 0;
  for (const { id } of runs) {
    const run = await loadRun(id);
    const checks: [string, unknown, unknown][] = [];
    const cat = catalogue(run);
    checks.push(['catalogue', cat, (await api(`/runs/${id}/series-catalogue`)).series]);
    const refs = cat.slice(0, 8).map((c) => String(c.ref));
    const q = (mp: number, extra = '') => `/runs/${id}?columns=${encodeURIComponent(refs.join(','))}&max_points=${mp}&events_limit=0&exports=false${extra}`;
    checks.push(['columns 1500', downsample(run, 1500, refs), (await api(q(1500))).series]);
    checks.push(['columns 97', downsample(run, 97, refs), (await api(q(97))).series]);
    checks.push(['columns span', downsample(run, 200, refs, '2015-01-01', '2020-06-30'), (await api(q(200, '&start=2015-01-01&end=2020-06-30'))).series]);
    checks.push(['events', eventsJson(run, 50), (await api(`/runs/${id}?include_series=false&events_limit=50&exports=false`)).events]);
    for (const [name, mine, theirs] of checks) {
      const d = same(mine, theirs);
      if (d) bad++;
      console.log(`${id.slice(0, 8)} ${name.padEnd(13)} ${d ? `DIFF ${d.slice(0, 200)}` : 'same'}`);
    }
  }
  await sql.end();
  console.log(bad ? `${bad} differences` : 'all same');
  process.exit(bad ? 1 : 0);
}

void main();
