import { cn } from '@/lib/cn';
import { GRADE_ZONES, gradeZone, inkOn, partScoreColor, readingInfo, type Zone } from '@/lib/grade-zones';

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

const zoneRange = (z: Zone) => (z.max === 100 ? `${z.min}+` : z.min === 0 ? `under ${z.max}` : `${z.min}–${z.max}`);

/** Grade zone legend (nextv0 zones): one coloured card per zone, label in bold, range below. */
export function GradeZoneLegend({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {GRADE_ZONES.map((z) => (
        <div
          key={z.label}
          className={cn('rounded-chip leading-tight', compact ? 'px-1.5 py-0.5' : 'px-2.5 py-1', !z.color && 'bg-line text-fg')}
          style={z.color ? { background: z.color, color: inkOn(z.color) } : undefined}
        >
          <div className={cn('font-semibold', compact ? 'text-[10px]' : 'text-[11px]')}>{z.label}</div>
          <div className={cn('num opacity-80', compact ? 'text-[9px]' : 'text-[10px]')}>{zoneRange(z)}</div>
        </div>
      ))}
    </div>
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
