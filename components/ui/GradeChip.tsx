import { cn } from '@/lib/cn';
import { gradeZone, inkOn, partScoreColor, readingInfo } from '@/lib/grade-zones';

/** Grade 0-100 band index (kept for callers that need a bucket number). */
export function gradeBucket(g: number) {
  return g < 20 ? 0 : g < 40 ? 1 : g < 60 ? 2 : g < 80 ? 3 : 4;
}

const base = 'num inline-flex h-6 min-w-9 items-center justify-center rounded-chip px-2 text-xs font-medium';

/** Grade % chip in nextv0's zone colours (96 / 90 / 80 undervalued blues, 40-80 normal, 36 / 30 / <30 overvalued pinks). */
export function GradeChip({ grade, className }: { grade: number | null | undefined; className?: string }) {
  if (grade == null || Number.isNaN(grade)) return <span className={cn(base, 'bg-line text-fg-3', className)}>-</span>;
  const z = gradeZone(grade);
  return (
    <span
      className={cn(base, !z.color && 'bg-line text-fg', className)}
      style={z.color ? { background: z.color, color: inkOn(z.color) } : undefined}
      title={`Grade ${Math.round(grade)} · ${z.label}`}
    >
      {Math.round(grade)}
    </span>
  );
}

/** Part score 1..5 in nextv0's heatmap colours (5 = undervalued). */
export function PartScoreChip({ score, className }: { score: number | null | undefined; className?: string }) {
  const c = partScoreColor(score);
  if (!c) return <span className={cn(base, 'bg-line text-fg-3', className)}>-</span>;
  return (
    <span className={cn(base, className)} style={{ background: c, color: inkOn(c) }} title={`Part score ${score} (5 = undervalued, 1 = overvalued)`}>
      {score}
    </span>
  );
}

/** Reading (-3..+3) as nextv0's overview cards show it: their label and colour. */
export function ReadingTag({ reading, className }: { reading: number | null | undefined; className?: string }) {
  const r = readingInfo(reading);
  return (
    <span
      className={cn('inline-flex items-center whitespace-nowrap rounded-chip px-2 py-0.5 text-[10.5px] font-semibold tracking-wide', !r.color && 'bg-line text-fg-3', className)}
      style={r.color ? { background: r.color, color: inkOn(r.color) } : undefined}
    >
      {r.label}
    </span>
  );
}
