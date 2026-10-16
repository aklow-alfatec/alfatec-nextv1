/** Server-side call to the engine API (same base URL and secret as the /api/engine proxy). */
export async function engineCall<T>(path: string, body: unknown): Promise<T> {
  const base = process.env.ENGINE_API_URL;
  if (!base) throw new Error('ENGINE_API_URL is not configured');
  const res = await fetch(`${base.replace(/\/$/, '')}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(process.env.ENGINE_API_SECRET ? { 'X-Engine-Secret': process.env.ENGINE_API_SECRET } : {}) },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(typeof data?.detail === 'string' ? data.detail : `engine API ${res.status}`);
  return data as T;
}
