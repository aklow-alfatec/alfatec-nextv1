import { cn } from '@/lib/cn';
import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

export const Table = ({ className, ...p }: HTMLAttributes<HTMLTableElement>) => (
  <div className="overflow-x-auto"><table {...p} className={cn('w-full border-collapse text-sm', className)} /></div>
);
export const THead = (p: HTMLAttributes<HTMLTableSectionElement>) => <thead {...p} />;
export const TBody = (p: HTMLAttributes<HTMLTableSectionElement>) => <tbody {...p} />;
export const TR = ({ className, ...p }: HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...p} className={cn('border-b border-line last:border-0 hover:bg-raised/60', className)} />
);
export const TH = ({ className, align, ...p }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'right' }) => (
  <th {...p} className={cn('px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-3', align === 'right' ? 'text-right' : 'text-left', className)} />
);
export const TD = ({ className, num, ...p }: TdHTMLAttributes<HTMLTableCellElement> & { num?: boolean }) => (
  <td {...p} className={cn('px-3 py-2', num && 'num text-right', className)} />
);
