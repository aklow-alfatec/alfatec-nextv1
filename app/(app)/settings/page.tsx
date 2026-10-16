import { Card, StatusPill } from '@/components/ui';
import { listUsers } from '@/lib/assets';
import { isAdminRole, sessionUser } from '@/lib/session-user';
import { UsersTable } from './users-table';

export const dynamic = 'force-dynamic';

async function engineHealth(): Promise<{ ok: boolean; detail: string }> {
  const base = process.env.ENGINE_API_URL;
  if (!base) return { ok: false, detail: 'ENGINE_API_URL not set' };
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/api/v1/health`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    return { ok: r.ok, detail: r.ok ? new URL(base).host : `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, detail: (e as Error).name === 'TimeoutError' ? 'no answer in 4 s' : 'not reachable' };
  }
}

export default async function SettingsPage() {
  const [user, health] = await Promise.all([sessionUser(), engineHealth()]);
  const admin = isAdminRole(user?.role);
  const users = admin ? await listUsers() : [];
  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Your account">
          <dl className="space-y-1 text-sm">
            <div><dt className="text-xs text-fg-3">Name</dt><dd>{user?.name ?? '-'}</dd></div>
            <div><dt className="text-xs text-fg-3">Email</dt><dd>{user?.email ?? '-'}</dd></div>
            <div><dt className="text-xs text-fg-3">Role</dt><dd>{user?.role ?? '-'}</dd></div>
          </dl>
          <p className="mt-2 text-[11px] text-fg-3">Same account as nextv0; change the password there until it moves here.</p>
        </Card>
        <Card title="Services">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-fg-2">Engine API</span><StatusPill status={health.ok ? 'fresh' : 'error'} label={health.ok ? 'up' : 'down'} detail={health.detail} /></div>
            <p className="text-[11px] text-fg-3">Studio runs, experiments, the Edge Lab and re-grading after data entry need the engine API.</p>
          </div>
        </Card>
        <Card title="Email alerts">
          <p className="text-sm text-fg-2">Grade-change emails go to every user after the Friday job and after data is entered by hand (unless unticked there).</p>
        </Card>
      </div>
      {admin && (
        <Card title={`Users (${users.length})`}>
          <UsersTable users={users} me={user?.email ?? null} />
        </Card>
      )}
    </div>
  );
}
