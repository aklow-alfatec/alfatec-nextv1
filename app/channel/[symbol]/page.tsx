import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChannelChart } from '@/features/charts/channel-chart';
import { channelData } from '@/lib/channel-data';
import { isAdminRole } from '@/lib/session-user';
import { currentViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ symbol: string }>; searchParams: Promise<{ node?: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const { node } = await searchParams;
  return { title: `${decodeURIComponent(symbol)} · ${(node ?? '').replace(/_GRADE$/, '')} channel` };
}

const pctTxt = (v: number | null) => (v === null ? '-' : `${(v * 100).toFixed(2)}%`);
const fmt = (v: number | null) =>
  v === null ? '-' : v.toLocaleString(undefined, { maximumFractionDigits: Math.abs(v) < 1 ? 5 : Math.abs(v) < 100 ? 4 : 2 });
const diff = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : (a - b) / Math.abs(b));

/** Channel chart of one grading component, opened in its own window from the symbol page heatmap, the grade
 *  breakdown and the Dashboard's Limit breach rows (docs/featureAsk-002.md). Admin and superadmin only; anyone else
 *  gets not found. */
export default async function ChannelPage({ params, searchParams }: {
  params: Promise<{ symbol: string }>; searchParams: Promise<{ node?: string; pipeline?: string }>;
}) {
  const v = await currentViewer();
  if (!v || !isAdminRole(v.role)) notFound();
  const { symbol: raw } = await params;
  const { node, pipeline } = await searchParams;
  const symbol = decodeURIComponent(raw);
  if (!node) notFound();
  const data = await channelData(symbol, node, pipeline);
  if (!data) notFound();

  const bad = data.fridays.filter((f) => !f.valueOk || !f.thresholdsOk);
  const lagged = data.fridays.filter((f) => f.valueOk && f.value !== null && f.computed !== null && Math.abs(diff(f.computed, f.value) ?? 0) > 0.005).length;
  const last = data.fridays[data.fridays.length - 1];
  const source = data.kind === 'ratio' ? `${data.in1} ÷ ${data.in2}` : data.kind === 'minus' ? `${data.in1} − ${data.in2}` : data.in1;

  return (
    <div className="flex h-screen flex-col bg-bg p-3 text-fg">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-2">
        <h1 className="text-lg font-semibold">{symbol} · {data.label}</h1>
        <span className="text-xs text-fg-2">{source} · {data.scaling} scale · graph {data.pipeline} · alert range {Math.round(data.alertRange * 100)}%</span>
        {last && <span className="num text-xs text-fg-2">last graded {last.date}: {fmt(last.value)}, score {last.score ?? '-'}</span>}
        <span className={`ml-auto text-xs ${bad.length ? 'text-negative' : 'text-positive'}`}>
          {data.fridays.length} graded Fridays · {bad.length ? `${bad.length} disagree with the prices or the lines` : 'all agree with the prices and the lines'}
          {lagged > 0 && <span className="text-fg-2"> · {lagged} match only with the publication lag</span>}
        </span>
      </header>
      <div className="min-h-0 flex-1">
        <ChannelChart data={data} />
      </div>
      {bad.length > 0 && (
        <details className="mt-2 max-h-[28vh] overflow-auto rounded-card border border-line bg-surface p-2 text-xs" open={bad.length <= 12}>
          <summary className="cursor-pointer font-medium text-negative">Fridays that disagree ({bad.length})</summary>
          <table className="mt-1 w-full">
            <thead className="text-fg-3">
              <tr>
                <th className="py-1 text-left font-medium">Friday</th>
                <th className="py-1 text-right font-medium">Graded value</th>
                <th className="py-1 text-right font-medium">From prices</th>
                <th className="py-1 text-right font-medium">Difference</th>
                <th className="py-1 text-right font-medium">With publication lag</th>
                <th className="py-1 text-right font-medium">Thresholds off by</th>
                <th className="py-1 text-right font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {bad.map((f) => (
                <tr key={f.date} className="border-t border-line">
                  <td className="num py-1">{f.date}</td>
                  <td className="num py-1 text-right">{fmt(f.value)}</td>
                  <td className="num py-1 text-right">{fmt(f.computed)}</td>
                  <td className={`num py-1 text-right ${f.valueOk ? '' : 'text-negative'}`}>{pctTxt(diff(f.value, f.computed))}</td>
                  <td className="num py-1 text-right">{fmt(f.computedLagged)}</td>
                  <td className={`num py-1 text-right ${f.thresholdsOk ? '' : 'text-negative'}`}>{pctTxt(f.thresholdDiff)}</td>
                  <td className="num py-1 text-right">{f.score ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10.5px] text-fg-3">
            A Friday disagrees when its graded value is more than 0.5% from the value computed from today&apos;s prices (as dated, or
            with the sides&apos; publication lag), or a stored threshold is more than 0.1% from the line definition. Usual causes:
            prices revised or re-pulled since grading, a changed unit, or the lines edited after grading.
          </p>
        </details>
      )}
    </div>
  );
}
