import { engineTarget, resetEngineTarget } from '@/lib/engine-base';

/** Server-side call to the engine API (same target and secret as the /api/engine proxy: local when up). */
export async function engineCall<T>(path: string, body?: unknown, method: 'GET' | 'POST' = 'POST'): Promise<T> {
  const t = await engineTarget();
  let res: Response;
  try {
    res = await fetch(`${t.base}/api/v1${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(t.secret ? { 'X-Engine-Secret': t.secret } : {}) },
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      cache: 'no-store',
    });
  } catch (e) {
    if (t.source === 'local') resetEngineTarget();
    throw e;
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : `engine API ${res.status}`);
  return data as T;
}
