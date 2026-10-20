import Link from 'next/link';
import { Card } from '@/components/ui';
import type { RunRow } from '@/features/studio/api';
import { RunsTable } from '@/features/studio/runs-list';
import { BACKTEST_TAG, listGraphs, listRuns } from '@/lib/studio-db';
import { currentViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

/** The runs picked for review (tagged ViewInBacktest in Studio Runs). Read on the server, so guests see the list
 *  without the studio APIs. A run opens at /backtest/<id> (settings and results; no graph or downloads); only
 *  full accounts can untick a run. */
export default async function BacktestPage() {
  const full = !((await currentViewer())?.guest ?? true);
  const [rows, graphs] = await Promise.all([listRuns({ tag: BACKTEST_TAG, limit: 500 }), listGraphs()]);
  const names = Object.fromEntries(graphs.map((g) => [String(g.id), String(g.name)]));
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Backtest</h1>
        {full && <Link href="/studio/runs" className="text-sm text-accent hover:underline">All runs →</Link>}
      </div>
      <Card>
        {rows.length === 0 ? (
          <p className="text-sm text-fg-3">
            No backtests to show yet.
            {full && <> Tick <b>Backtest</b> on a run in <Link href="/studio/runs" className="text-accent hover:underline">Runs</Link> to show it here.</>}
          </p>
        ) : (
          <RunsTable rows={rows as unknown as RunRow[]} graphNames={names} canTag={full} linkRuns onlyTagged runHrefBase="/backtest/" />
        )}
      </Card>
    </div>
  );
}
