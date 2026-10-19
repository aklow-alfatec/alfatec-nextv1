import { auth } from '@/auth';
import { engineTarget, resetEngineTarget } from '@/lib/engine-base';
import { currentViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Forwards /api/engine/<path> -> <engine>/api/v1/<path>, adding the server-side secret. <engine> is the local
// backend when ENGINE_LOCAL_URL answers its health check, else ENGINE_API_URL (lib/engine-base.ts).
async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ detail: 'Unauthorized' }, { status: 401 });
  if ((await currentViewer())?.guest ?? true) return Response.json({ detail: 'Not available on this account' }, { status: 403 });

  let engine;
  try {
    engine = await engineTarget();
  } catch (e) {
    return Response.json({ detail: (e as Error).message }, { status: 500 });
  }

  const { path } = await ctx.params;
  const url = new URL(req.url);
  const target = `${engine.base}/api/v1/${path.map(encodeURIComponent).join('/')}${url.search}`;

  const headers = new Headers();
  headers.set('Content-Type', req.headers.get('content-type') ?? 'application/json');
  headers.set('Accept', 'application/json');
  if (engine.secret) headers.set('X-Engine-Secret', engine.secret);

  const hasBody = !['GET', 'HEAD', 'DELETE'].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.text() : undefined,
      cache: 'no-store',
    });
  } catch (e) {
    if (engine.source === 'local') resetEngineTarget();
    return Response.json({ detail: `Engine API (${engine.source}) unreachable: ${(e as Error).message}` }, { status: 502 });
  }
  if (upstream.status === 204) return new Response(null, { status: 204, headers: { 'X-Engine-Source': engine.source } });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json', 'X-Engine-Source': engine.source },
  });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
