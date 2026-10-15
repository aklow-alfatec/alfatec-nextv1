import { cn } from '@/lib/cn';

/** Grade 0-100; higher = more undervalued. */
export function gradeBucket(g: number) {
  return g < 20 ? 0 : g < 40 ? 1 : g < 60 ? 2 : g < 80 ? 3 : 4;
}
export function GradeChip({ grade, className }: { grade: number | null | undefined; className?: string }) {
  if (grade == null || Number.isNaN(grade))
    return <span className={cn('num inline-flex h-6 min-w-9 items-center justify-center rounded-chip bg-line px-2 text-xs text-fg-3', className)}>-</span>;
  return (
    <span
      className={cn('num inline-flex h-6 min-w-9 items-center justify-center rounded-chip px-2 text-xs font-medium text-white', className)}
      style={{ background: `var(--grade-${gradeBucket(grade)})` }}
      title={`Grade ${grade}`}
    >
      {Math.round(grade)}
    </span>
  );
}
