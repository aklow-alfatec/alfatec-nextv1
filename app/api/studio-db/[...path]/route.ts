import { auth } from '@/auth';
import { engineCall } from '@/lib/engine-server';
import { currentViewer } from '@/lib/viewer';
import { catalogue, downsample, eventsJson, exportLinks, loadRun, StorageNotConfigured } from '@/lib/run-store';
import {
  experimentDetail, experimentStatus, getGraph, graphVersion, graphVersions, listExperiments, listGraphs, listRuns,
  runDetail, runStatus, type ListQuery,
} from '@/lib/studio-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/studio-db/<path>: the studio's read-only engine API paths answered from the database (P20), with
// the same JSON as the engine API, so browsing never wakes it. features/studio/api.ts decides which paths
// come here; everything else still goes through /api/engine.

const notFound = (detail: string) => Response.json({ detail }, { status: 404 });

function listQuery(u: URL): ListQuery {
  const n = (k: string) => (u.searchParams.has(k) ? Number(u.searchParams.get(k)) : undefined);
  return {
    graph_id: u.searchParams.get('graph_id'), kind: u.searchParams.get('kind'), status: u.searchParams.get('status'),
    experiment_id: u.searchParams.get('experiment_id'), tag: u.searchParams.get('tag'), limit: n('limit'), offset: n('offset'),
  };
}

const done = (r: Record<string, unknown>) => r.status === 'done' && !!r.artifact_path;
const clampInt = (v: string | null, def: number, lo: number, hi: number) => {
  const n = v === null ? def : Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.trunc(n))) : def;
};

/** GET /runs/{id}: as runs.py get_run, the series and events read from Storage (lib/run-store.ts). */
async function runWithSeries(id: string, u: URL): Promise<Response> {
  const row = await runDetail(id);
  if (!row) return notFound('run not found');
  const q = u.searchParams;
  const includeSeries = q.get('include_series') !== 'false';
  const eventsLimit = clampInt(q.get('events_limit'), 500, 0, 10000);
  const wantExports = q.get('exports') !== 'false';
  if (!done(row)) return Response.json({ ...row, series: null, events: [], exports: {} });
  // the run row alone: no Storage read needed
  if (!includeSeries && eventsLimit === 0 && !wantExports) return Response.json(row);
  const run = await loadRun(id);
  const m = run.manifest;
  const columns = q.get('columns')?.split(',').map((c) => c.trim()).filter(Boolean) ?? null;
  let series = null;
  if (includeSeries) {
    try {
      series = downsample(run, clampInt(q.get('max_points'), 500, 2, 20000), columns, q.get('start'), q.get('end'));
    } catch {
      return Response.json({ detail: 'start / end must be dates' }, { status: 422 });
    }
  }
  return Response.json({
    ...row,
    manifest: Object.fromEntries(['run_id', 'clock', 'range', 'rows', 'outputs', 'data'].map((k) => [k, m[k] ?? null])),
    series,
    events: eventsJson(run, eventsLimit),
    events_total: run.events.length,
    exports: wantExports ? await exportLinks(id, clampInt(q.get('expires_in'), 3600, 60, 86400)) : {},
  });
}

async function runCatalogue(id: string): Promise<Response> {
  const row = await runDetail(id);
  if (!row) return notFound('run not found');
  if (!done(row)) return Response.json({ detail: 'run has not finished' }, { status: 409 });
  return Response.json({ run_id: id, series: catalogue(await loadRun(id)) });
}

async function answer(path: string[], u: URL): Promise<Response> {
  const [root, id, sub, n] = path;
  if (root === 'graphs') {
    if (!id) return Response.json(await listGraphs());
    if (!sub) return (await getGraph(id).then((g) => g && Response.json(g))) ?? notFound('graph not found');
    if (sub === 'versions' && n === undefined) {
      return (await graphVersions(id).then((v) => v && Response.json(v))) ?? notFound('graph not found');
    }
    if (sub === 'versions' && path.length === 4) {
      return (await graphVersion(id, Number(n)).then((v) => v && Response.json(v))) ?? notFound('version not found');
    }
  }
  if (root === 'runs' && path.length <= 3) {
    if (!id) return Response.json(await listRuns(listQuery(u)));
    if (sub === 'status') return (await runStatus(id).then((r) => r && Response.json(r))) ?? notFound('not found');
    if (sub === 'series-catalogue') return runCatalogue(id);
    if (!sub) return runWithSeries(id, u);
  }
  if (root === 'experiments' && path.length <= 3) {
    if (!id) return Response.json(await listExperiments(listQuery(u)));
    if (sub === 'status') return (await experimentStatus(id).then((r) => r && Response.json(r))) ?? notFound('not found');
    if (!sub) {
      const d = await experimentDetail(id);
      if (!d) return notFound('experiment not found');
      // finished before the worker stored the curve and not backfilled: the API reads it from Storage
      return Response.json(d.needsApi ? await engineCall(`/experiments/${encodeURIComponent(id)}`, undefined, 'GET') : d.body);
    }
  }
  return notFound('not served from the database');
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ detail: 'Unauthorized' }, { status: 401 });
  if ((await currentViewer())?.guest ?? true) return Response.json({ detail: 'Not available on this account' }, { status: 403 });
  const { path } = await ctx.params;
  try {
    return await answer(path, new URL(req.url));
  } catch (e) {
    if (e instanceof StorageNotConfigured) return Response.json({ detail: e.message }, { status: 503 });
    return Response.json({ detail: `database read failed: ${(e as Error).message}` }, { status: 500 });
  }
}
