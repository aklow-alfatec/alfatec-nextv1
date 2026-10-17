/**
 * Which engine API the server talks to. When ENGINE_LOCAL_URL is set (local development) and a backend there
 * answers its health check as alfatec-backend, nextv1 uses it; otherwise ENGINE_API_URL (the cloud server).
 * The choice is cached for a few seconds, so starting or stopping the local backend switches over by itself.
 * Leave ENGINE_LOCAL_URL unset on Vercel.
 */

export interface EngineTarget {
  base: string;
  secret?: string;
  source: 'local' | 'cloud';
}

const PROBE_TIMEOUT_MS = 600;
const CACHE_MS = 15_000;

let cached: { at: number; local: boolean } | null = null;

const trim = (u: string) => u.replace(/\/$/, '');

/** True when `base` answers GET /api/v1/health with {"status": "healthy", "service": "alfatec-backend"}. */
export async function isAlfatecEngine(base: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  try {
    const r = await fetch(`${trim(base)}/api/v1/health`, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return false;
    const b = (await r.json()) as { status?: string; service?: string };
    return b.status === 'healthy' && b.service === 'alfatec-backend';
  } catch {
    return false;
  }
}

async function localUp(local: string): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.local;
  const up = await isAlfatecEngine(local);
  cached = { at: Date.now(), local: up };
  return up;
}

/** Base URL (without /api/v1) and secret for the next engine call. Throws when neither is available. */
export async function engineTarget(): Promise<EngineTarget> {
  const local = process.env.ENGINE_LOCAL_URL;
  if (local && (await localUp(local))) {
    return { base: trim(local), secret: process.env.ENGINE_LOCAL_SECRET ?? process.env.ENGINE_API_SECRET, source: 'local' };
  }
  const cloud = process.env.ENGINE_API_URL;
  if (!cloud) {
    throw new Error(local ? `local engine at ${local} is not answering and ENGINE_API_URL is not configured`
      : 'ENGINE_API_URL is not configured');
  }
  return { base: trim(cloud), secret: process.env.ENGINE_API_SECRET, source: 'cloud' };
}

/** Forget the cached choice (e.g. after a local call failed), so the next call probes again. */
export function resetEngineTarget() {
  cached = null;
}
