// Server-side only (uses the GitHub token).
/**
 * Starts the backend's "Backtest worker" GitHub Actions workflow (alfatec-backend .github/workflows/
 * backtest-worker.yml) right after a backtest or experiment is queued, so the job runs within about a minute
 * instead of waiting for the workflow's fallback schedule.
 *
 *   GITHUB_DISPATCH_TOKEN   fine-grained token, repository alfatec-backend, permission "Actions: Read and write"
 *   GITHUB_WORKER_REPO      default aklow-alfatec/alfatec-backend
 *   GITHUB_WORKER_WORKFLOW  default backtest-worker.yml
 *   GITHUB_WORKER_REF       default main
 *
 * Without the token nothing is started (local development: the local worker picks the job up).
 */
export async function startWorker(): Promise<{ started: boolean; detail: string }> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return { started: false, detail: 'GITHUB_DISPATCH_TOKEN not set' };
  const repo = process.env.GITHUB_WORKER_REPO || 'aklow-alfatec/alfatec-backend';
  const workflow = process.env.GITHUB_WORKER_WORKFLOW || 'backtest-worker.yml';
  const ref = process.env.GITHUB_WORKER_REF || 'main';
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref }),
      cache: 'no-store',
    });
    // 204: started. A second start while one is running just waits for it (the workflow's concurrency group).
    return res.status === 204 ? { started: true, detail: 'worker started' } : { started: false, detail: `GitHub ${res.status}: ${(await res.text()).slice(0, 200)}` };
  } catch (e) {
    return { started: false, detail: (e as Error).message };
  }
}

/** True for engine API calls that queue a job: POST /runs and POST /experiments. */
export const queuesJob = (method: string, path: string[]) =>
  method.toUpperCase() === 'POST' && path.length === 1 && (path[0] === 'runs' || path[0] === 'experiments');
