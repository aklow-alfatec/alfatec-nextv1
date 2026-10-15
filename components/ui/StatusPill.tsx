import { cn } from '@/lib/cn';

type Status = 'fresh' | 'stale' | 'error' | 'idle';
const dot: Record<Status, string> = { fresh: 'bg-positive', stale: 'bg-warning', error: 'bg-negative', idle: 'bg-fg-3' };
export function StatusPill({ status = 'idle', label, detail, className }:
  { status?: Status; label: string; detail?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2 py-1 text-[11px] text-fg-2', className)}>
      <i className={cn('h-1.5 w-1.5 rounded-full', dot[status])} />
      {label}
      {detail && <span className="num text-fg-3">{detail}</span>}
    </span>
  );
}
