import { cn } from '@/lib/cn';
import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ title, actions, className, children, ...p }:
  Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { title?: ReactNode; actions?: ReactNode }) {
  return (
    <section {...p} className={cn('rounded-card border border-line bg-surface', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
