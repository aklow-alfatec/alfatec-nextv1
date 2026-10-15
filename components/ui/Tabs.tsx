'use client';
import { cn } from '@/lib/cn';

export function Tabs<T extends string>({ tabs, value, onChange, className }:
  { tabs: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cn('flex border-b border-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cn('-mb-px px-3 py-2 text-xs font-medium border-b-2 transition-colors',
            t.value === value ? 'border-accent text-fg' : 'border-transparent text-fg-3 hover:text-fg')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
