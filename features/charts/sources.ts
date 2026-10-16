import { engineApi, type PreviewResult, type SeriesInfo } from '../studio/api';
import { graphColumns, type AddedSeries, type GraphColumns } from './build';
import { toSeconds } from './data';
import type { IndicatorSpec } from './layout';

/** Where the chart gets its series: a saved run (fetched on demand) or an editor preview (already in memory). */
export interface ChartSource {
  catalogue: SeriesInfo[];
  /** Thinned columns of the run's graph, all on one time grid. */
  loadColumns(refs: string[]): Promise<GraphColumns>;
  /** Indicators the graph does not have, by layout id. Absent when the source cannot compute them (preview). */
  loadIndicators?(specs: { id: string; indicator: IndicatorSpec }[]): Promise<Record<string, AddedSeries>>;
}

export const MAX_POINTS = 2000;

export async function runSource(runId: string): Promise<ChartSource> {
  const cat = await engineApi.seriesCatalogue(runId);
  return {
    catalogue: cat.series,
    async loadColumns(refs) {
      const r = await engineApi.runColumns(runId, refs, { max_points: MAX_POINTS });
      // yes / no columns arrive as true / false
      const cols = Object.fromEntries(Object.entries(r.columns).map(([k, v]) => [k, v.map((x) => (typeof x === 'boolean' ? Number(x) : x))]));
      return graphColumns(r.ts, cols);
    },
    async loadIndicators(specs) {
      const body = specs.map((s) => ({
        type: s.indicator.type,
        params: s.indicator.params,
        input: s.indicator.input,
        output: s.indicator.output,
        label: s.indicator.label,
      }));
      const r = await engineApi.runIndicators(runId, body, { max_points: MAX_POINTS });
      const t = r.index.map(toSeconds);
      const out: Record<string, AddedSeries> = {};
      for (const s of specs) if (r.series[s.indicator.label]) out[s.id] = { t, v: r.series[s.indicator.label] };
      return out;
    },
  };
}

/** The preview response already holds every output the graph computed: the chart reads columns from it, no second run. */
export function previewSource(p: PreviewResult): ChartSource | null {
  if (!p.catalogue?.length) return null;
  const have = new Set(Object.keys(p.values));
  const n = p.index.length;
  const pos = n <= MAX_POINTS ? null : Array.from({ length: MAX_POINTS }, (_, i) => Math.round((i * (n - 1)) / (MAX_POINTS - 1)));
  const thin = <T,>(a: T[]): T[] => (pos ? pos.map((i) => a[i]) : a);
  const ts = thin(p.index);
  return {
    catalogue: p.catalogue.filter((s) => have.has(s.ref)),
    async loadColumns(refs) {
      const cols: Record<string, (number | null)[]> = {};
      for (const r of refs) {
        const v = p.values[r];
        if (v) cols[r] = thin(v).map((x) => (typeof x === 'boolean' ? Number(x) : typeof x === 'number' ? x : null));
      }
      return graphColumns(ts, cols);
    },
  };
}
