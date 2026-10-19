import { Card, StatusPill } from '@/components/ui';
import { isSuperadmin } from '@/lib/access';
import { listUsers } from '@/lib/assets';
import { isAlfatecEngine } from '@/lib/engine-base';
import { listGuests } from '@/lib/guests';
import { isAdminRole } from '@/lib/session-user';
import { currentViewer } from '@/lib/viewer';
import { mailConfigured } from '@/lib/mailer';
import { GuestsCard } from './guests-card';
import { PasswordCard } from './password-card';
import { UsersTable } from './users-table';

export const dynamic = 'force-dynamic';

/** Local backend when ENGINE_LOCAL_URL answers; the cloud server is pinged only on "check now" (?check=1),
 *  since a ping starts it when it is scaled to zero. */
async function engineHealth(check: boolean): Promise<{ ok: boolean | null; label: string; detail: string }> {
  const local = process.env.ENGINE_LOCAL_URL;
  if (local && (await isAlfatecEngine(local))) return { ok: true, label: 'local', detail: new URL(local).host };
  const base = process.env.ENGINE_API_URL;
  if (!base) return { ok: false, label: 'down', detail: local ? `local ${new URL(local).host} not answering; ENGINE_API_URL not set` : 'ENGINE_API_URL not set' };
  const host = new URL(base).host;
  if (!check) return { ok: null, label: 'cloud', detail: `${host} (starts on demand)` };
  const up = await isAlfatecEngine(base, 20000);
  return { ok: up, label: up ? 'cloud up' : 'down', detail: up ? host : `${host} not answering in 20 s` };
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ check?: string }> }) {
  const { check } = await searchParams;
  const user = await currentViewer();
  const guest = user?.guest ?? true;
  // decided on the effective role, so a superadmin in guest mode sees what a guest sees
  const admin = isAdminRole(user?.role);
  const superadmin = isSuperadmin(user?.role);
  const [health, users, guests] = await Promise.all([
    guest ? null : engineHealth(check === '1'),
    admin ? listUsers() : [],
    superadmin ? listGuests() : [],
  ]);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Your account">
          <dl className="space-y-1 text-sm">
            <div><dt className="text-xs text-fg-3">Name</dt><dd>{user?.name ?? '-'}</dd></div>
            <div><dt className="text-xs text-fg-3">Email</dt><dd>{user?.email ?? '-'}</dd></div>
            {!guest && <div><dt className="text-xs text-fg-3">Role</dt><dd>{user?.role ?? '-'}</dd></div>}
          </dl>
          <p className="mt-2 text-[11px] text-fg-3">
            {guest ? 'Your account is for this app only.' : 'Same account and password as nextv0.'}
          </p>
        </Card>
        <PasswordCard />
        {health && (
          <Card title="Services">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-fg-2">Engine API</span><span className="flex items-center gap-2"><StatusPill status={health.ok === null ? 'idle' : health.ok ? 'fresh' : 'error'} label={health.label} detail={health.detail} />{health.ok === null && <a href="?check=1" className="text-[11px] text-accent hover:underline">check now</a>}</span></div>
              <p className="text-[11px] text-fg-3">Studio runs, experiments, the Edge Lab and re-grading after data entry need the engine API.</p>
            </div>
          </Card>
        )}
        {!guest && (
          <Card title="Email alerts">
            <p className="text-sm text-fg-2">Grade-change emails go to every user after the Friday job and after data is entered by hand (unless unticked there).</p>
          </Card>
        )}
      </div>
      {superadmin && <GuestsCard guests={guests} mailOk={mailConfigured()} />}
      {admin && (
        <Card title={`Users (${users.length})`}>
          <UsersTable users={users} me={user?.email ?? null} />
        </Card>
      )}
    </div>
  );
}
