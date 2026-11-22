'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/** Admins: draw a second grade line from another pipeline of the same asset (sets ?compare=NAME). */
export function CompareSelect({ options, current }: { options: { name: string; active: boolean }[]; current: string | null }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-1.5 text-xs text-fg-2">
      Compare with
      <select
        className="rounded-control border border-line-2 bg-surface px-1.5 py-1 text-xs text-fg"
        value={current ?? ''}
        onChange={(e) => {
          const q = new URLSearchParams(params.toString());
          if (e.target.value) q.set('compare', e.target.value);
          else q.delete('compare');
          router.push(`${path}?${q.toString()}`, { scroll: false });
        }}
      >
        <option value="">none</option>
        {options.map((o) => (
          <option key={o.name} value={o.name}>{o.name}{o.active ? ' (active)' : ''}</option>
        ))}
      </select>
    </label>
  );
}
