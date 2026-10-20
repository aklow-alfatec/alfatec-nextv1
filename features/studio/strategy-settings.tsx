'use client';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { isCapitalBlocks, isTriggerList, paramsByNode, triggerText, triggerTiming, type RunParams, type TriggerLike } from './run-params';

const money = (v: unknown) => (typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : String(v));

function Triggers({ triggers }: { triggers: TriggerLike[] }) {
  return (
    <ul className="space-y-0.5">
      {triggers.map((t, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-2">
          <span className={t.action === 'short' ? 'text-negative' : 'text-positive'}>{triggerText(t)}</span>
          {triggerTiming(t) && <span className="text-[11px] text-fg-3">{triggerTiming(t)}</span>}
        </li>
      ))}
    </ul>
  );
}

function Value({ name, value }: { name: string; value: unknown }) {
  if (isCapitalBlocks(value)) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {value.map((b, i) => (
          <div key={String(b.id ?? i)} className="rounded-control border border-line p-2">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-medium">Block {i + 1}</span>
              <span className="num text-xs text-fg-2">{b.allocation_percentage ?? 100}% of the fund</span>
            </div>
            <Triggers triggers={b.triggers ?? []} />
          </div>
        ))}
      </div>
    );
  }
  if (isTriggerList(value)) return <Triggers triggers={value} />;
  if (name === 'initial_fund' || name === 'initial') return <span className="num">{money(value)}</span>;
  return <code className="break-all text-xs text-fg-2">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</code>;
}

const LABEL: Record<string, string> = { initial_fund: 'Starting fund', initial: 'Starting fund', blocks: 'Capital blocks', triggers: 'Triggers' };

/** The settings this run injected into its graph (engine_runs.params), in words where it knows the shape. */
export function StrategySettings({ params, graphHref }: { params: RunParams | null | undefined; graphHref?: string }) {
  const byNode = paramsByNode(params);
  const nodes = Object.keys(byNode);
  return (
    <Card
      title="Strategy settings"
      actions={graphHref && nodes.length ? <Link href={graphHref} className="text-xs text-accent hover:underline">Graph with these settings →</Link> : undefined}
    >
      {nodes.length === 0 ? (
        <p className="text-sm text-fg-2">This run used the graph&apos;s saved settings.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-fg-3">Set for this run only, on top of the graph&apos;s saved settings (the graph itself is unchanged).</p>
          {nodes.map((n) => (
            <div key={n} className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-fg-2">{n}</div>
              {Object.entries(byNode[n]).map(([k, v]) => (
                <div key={k} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
                  <span className="text-fg-2">{LABEL[k] ?? k}</span>
                  <Value name={k} value={v} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
