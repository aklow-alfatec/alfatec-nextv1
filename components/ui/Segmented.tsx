'use client';
import { cn } from '@/lib/cn';

export function Segmented<T extends string>({ options, value, onChange, className }:
  { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="group" className={cn('inline-flex rounded-control border border-line-2 bg-bg p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('h-7 rounded-chip px-3 text-xs font-medium transition-colors',
            o.value === value ? 'bg-raised text-fg shadow-sm' : 'text-fg-3 hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
