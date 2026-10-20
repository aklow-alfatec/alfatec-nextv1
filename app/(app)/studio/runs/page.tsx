'use client';
import Link from 'next/link';
import { RunsList } from '@/features/studio/runs-list';

export default function RunsPage() {
  return (
    <RunsList
      title="Runs"
      links={<Link href="/studio/old-backtests" className="text-sm text-accent hover:underline">Old nextv0 backtests →</Link>}
      empty={<>No runs yet. Open a saved graph, go to the Run preview tab and press <b>Run full backtest</b>.</>}
    />
  );
}
