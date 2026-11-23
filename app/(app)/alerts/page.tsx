import Link from 'next/link';
import { notFound } from 'next/navigation';
import { activePipelines, fridays, lastFinalFriday, ongoingAlerts } from '@/lib/grades';
import { limitBreaches } from '@/lib/limit-alerts';
import { isAdminRole } from '@/lib/session-user';
import { currentViewer } from '@/lib/viewer';
import { LimitBreach } from './limit-breach';
import { OngoingAlert } from './ongoing-alert';

export const dynamic = 'force-dynamic';

const fmtDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shift = (d: string, days: number) => {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + days);
  return x.toISOString().slice(0, 10);
};

/** The week's alerts (moved from the Dashboard): component grades that moved by more than one point (Ongoing alert)
 *  and pairs beyond a channel line by more than the alert range (Limit breach, docs/featureAsk-001.md). Full accounts
 *  only: both name grading components, which guests never see. */
export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const viewer = await currentViewer();
  if (!viewer || viewer.guest) notFound();
  const admin = isAdminRole(viewer.role);
  const { week: wParam } = await searchParams;
  const latest = lastFinalFriday();
  const week = wParam && /^\d{4}-\d{2}-\d{2}$/.test(wParam) && wParam <= latest ? wParam : latest;
  const prev = fridays(week, 2)[0];
  const pipes = await activePipelines();
  const symbols = pipes.map((p) => p.symbol);
  const [alerts, breaches] = await Promise.all([ongoingAlerts(symbols, prev, week), limitBreaches(week)]);
  const titles = new Map(pipes.map((p) => [p.symbol, p.title]));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Alerts · week of {fmtDay(week)}</h1>
          <p className="text-sm text-fg-2">
            {alerts.length} component grade move{alerts.length === 1 ? '' : 's'} · {breaches.length} limit breach{breaches.length === 1 ? '' : 'es'}
            {breaches.some((b) => b.isNew) && <> ({breaches.filter((b) => b.isNew).length} new)</>}
          </p>
        </div>
        <div className="ml-auto flex gap-2 text-sm">
          <Link className="rounded-control border border-line-2 px-3 py-1.5 hover:bg-raised" href={`/alerts?week=${shift(week, -7)}`}>Previous week</Link>
          {week < latest && <Link className="rounded-control border border-line-2 px-3 py-1.5 hover:bg-raised" href={`/alerts?week=${shift(week, 7)}`}>Next week</Link>}
        </div>
      </div>

      {alerts.length > 0 ? (
        <OngoingAlert
          prevDate={prev}
          date={week}
          items={alerts.map((a) => ({ symbol: a.symbol, title: titles.get(a.symbol) ?? a.symbol, part: a.node.replace(/_GRADE$/, ''), from: a.from as number, to: a.to as number, delta: a.delta }))}
        />
      ) : (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-fg-3">Ongoing alert: no component grade moved by more than 1 point, {fmtDay(prev)} → {fmtDay(week)}.</p>
      )}

      {breaches.length > 0 ? (
        <LimitBreach items={breaches} date={week} titles={Object.fromEntries(titles)} canOpenChannel={admin} />
      ) : (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-fg-3">Limit breach: no pair is beyond its channel by more than the alert range this week.</p>
      )}
    </div>
  );
}
