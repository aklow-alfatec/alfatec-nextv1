import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Forwards /api/engine/<path> -> ${ENGINE_API_URL}/api/v1/<path>, adding the server-side secret.
async function forward(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) return Response.json({ detail: 'Unauthorized' }, { status: 401 });

  const base = process.env.ENGINE_API_URL;
  if (!base) return Response.json({ detail: 'ENGINE_API_URL is not configured' }, { status: 500 });

  const { path } = await ctx.params;
  const url = new URL(req.url);
  const target = `${base.replace(/\/$/, '')}/api/v1/${path.map(encodeURIComponent).join('/')}${url.search}`;

  const headers = new Headers();
  headers.set('Content-Type', req.headers.get('content-type') ?? 'application/json');
  headers.set('Accept', 'application/json');
  if (process.env.ENGINE_API_SECRET) headers.set('X-Engine-Secret', process.env.ENGINE_API_SECRET);

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
    return Response.json({ detail: `Engine API unreachable: ${(e as Error).message}` }, { status: 502 });
  }
  if (upstream.status === 204) return new Response(null, { status: 204 });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
