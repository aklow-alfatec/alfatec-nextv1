import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card } from '@/components/ui';
import type { RunDetail } from '@/features/studio/api';
import { BACKTEST_TAG, getGraph, runDetail } from '@/lib/studio-db';
import { currentViewer } from '@/lib/viewer';
import { BacktestResult } from './backtest-result';

export const dynamic = 'force-dynamic';

/** One run from the Backtest page, for every account including guests: its strategy settings and results.
 *  No graph view, indicator chart or downloads (those stay in Studio). Only runs tagged ViewInBacktest open here. */
export default async function BacktestRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row, viewer] = await Promise.all([runDetail(id), currentViewer()]);
  const run = row as unknown as RunDetail | null;
  if (!run || !(run.tags ?? []).includes(BACKTEST_TAG)) notFound();
  const graph = await getGraph(run.graph_id);
  const full = !(viewer?.guest ?? true);
  const name = run.tags?.find((t) => t.startsWith('name:'))?.slice(5);
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/backtest" className="text-sm text-fg-2 hover:underline">Backtest</Link>
        <span className="text-fg-3">/</span>
        <h1 className="text-xl font-semibold">{String(graph?.name ?? 'Backtest')}</h1>
        {name && <span className="rounded-chip bg-[#EA7A12]/15 px-2 py-0.5 text-[11px] font-medium text-[#EA7A12]">{name}</span>}
        <span className="num text-sm text-fg-2">{run.start_date?.slice(0, 10)} to {run.end_date?.slice(0, 10)}</span>
        {full && <Link href={`/studio/runs/${id}`} className="ml-auto text-sm text-accent hover:underline">Open in Studio →</Link>}
      </div>
      {run.status !== 'done' ? (
        <Card><p className="text-sm text-fg-2">This backtest has not finished ({run.status}).</p></Card>
      ) : (
        <BacktestResult params={run.params} strategies={run.summary?.strategies ?? []} />
      )}
    </div>
  );
}
