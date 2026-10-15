import { cn } from '@/lib/cn';
import type { HTMLAttributes } from 'react';

type Tone = 'neutral' | 'accent' | 'positive' | 'negative' | 'info' | 'warning';
const tones: Record<Tone, string> = {
  neutral: 'bg-line text-fg-2',
  accent: 'bg-accent/15 text-accent',
  positive: 'bg-positive/15 text-positive',
  negative: 'bg-negative/15 text-negative',
  info: 'bg-info/15 text-info',
  warning: 'bg-warning/15 text-warning',
};
export function Badge({ tone = 'neutral', className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span {...p} className={cn('inline-flex items-center rounded-chip px-2 py-0.5 text-[11px] font-medium', tones[tone], className)} />;
}
