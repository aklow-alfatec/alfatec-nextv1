import { auth } from '@/auth';
import { engineCall } from '@/lib/engine-server';
import { currentViewer } from '@/lib/viewer';
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
    experiment_id: u.searchParams.get('experiment_id'), limit: n('limit'), offset: n('offset'),
  };
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
    if (!sub) return (await runDetail(id).then((r) => r && Response.json(r))) ?? notFound('run not found');
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
    return Response.json({ detail: `database read failed: ${(e as Error).message}` }, { status: 500 });
  }
}
