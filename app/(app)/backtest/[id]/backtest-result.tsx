'use client';
import { useState } from 'react';
import { Card } from '@/components/ui';
import type { StrategyReport } from '@/features/studio/api';
import { StaticRunChart } from '@/features/charts/static-run-chart';
import type { StaticChart } from '@/lib/backtest-chart';
import { StrategyResult } from '@/features/studio/results';
import { StrategySettings } from '@/features/studio/strategy-settings';
import type { RunParams } from '@/features/studio/run-params';

/** Settings and results of a run, without the graph link, indicator chart or downloads. */
export function BacktestResult({ params, strategies, charts }: { params: RunParams | null; strategies: StrategyReport[]; charts: (StaticChart | null)[] }) {
  const [pick, setPick] = useState(0);
  const k = Math.min(pick, strategies.length - 1);
  const report = strategies[k];
  const chart = charts[k];
  return (
    <>
      <StrategySettings params={params} />
      {report ? (
        <Card
          title="Results"
          actions={
            strategies.length > 1 ? (
              <select className="rounded border border-line-2 bg-bg px-1 py-0.5 text-xs" value={pick} onChange={(e) => setPick(Number(e.target.value))}>
                {strategies.map((s, k) => <option key={s.node} value={k}>{s.node}</option>)}
              </select>
            ) : undefined
          }
        >
          <StrategyResult report={report} chartHeight={320} chart={chart ? <StaticRunChart key={k} {...chart} /> : undefined} />
        </Card>
      ) : (
        <Card><p className="text-sm text-fg-2">This backtest has no strategy results.</p></Card>
      )}
    </>
  );
}
