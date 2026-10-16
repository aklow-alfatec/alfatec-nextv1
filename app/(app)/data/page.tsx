import Link from 'next/link';
import { Card } from '@/components/ui';
import { expectedDays, listAssets } from '@/lib/assets';
import { isAdminRole, sessionUser } from '@/lib/session-user';
import { AssetsTable } from './assets-table';
import { DataEntry } from './data-entry';

export const dynamic = 'force-dynamic';

export default async function DataPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: t } = await searchParams;
  const tab = t === 'entry' ? 'entry' : 'assets';
  const [assets, user] = await Promise.all([listAssets(), sessionUser()]);
  const admin = isAdminRole(user?.role);
  const today = Date.now();
  const behind: Record<string, number> = {};
  for (const a of assets) {
    if (!a.last_date) continue;
    const days = Math.floor((today - Date.parse(a.last_date)) / 864e5);
    if (days > expectedDays(a) + 3) behind[a.symbol] = days;   // +3: weekends and holidays
  }
  const seg = (on: boolean) => `px-3 py-1 text-sm ${on ? 'bg-raised text-fg' : 'text-fg-2 hover:text-fg'}`;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold">Assets and data</h1>
          <p className="text-sm text-fg-2">{assets.length} assets · {Object.keys(behind).length} behind their usual schedule</p>
        </div>
        <div className="ml-auto flex overflow-hidden rounded-control border border-line-2">
          <Link href="/data" className={seg(tab === 'assets')}>Assets</Link>
          <Link href="/data?tab=entry" className={seg(tab === 'entry')}>Enter data</Link>
        </div>
      </div>
      {tab === 'assets' ? (
        <Card>
          <AssetsTable assets={assets} behind={behind} admin={admin} />
          <p className="mt-2 text-[11px] text-fg-3">
            &quot;Behind&quot;: the latest row is older than the asset&apos;s usual gap (daily 5 days, weekly COT / NAAIM 10, monthly series a month plus their publication lag plus a week, manual 35) plus 3.
            Lag = days after a value&apos;s date before it is published; the engine waits that long before using it.
          </p>
        </Card>
      ) : (
        <DataEntry symbols={assets.map((a) => a.symbol)} admin={admin} />
      )}
    </div>
  );
}
