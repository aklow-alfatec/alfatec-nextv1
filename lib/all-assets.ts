// Server-side only. Studio -> All assets: every pipeline (active or not), grouped by asset.
import sql from '@/lib/db';
import { gradeFromJson, latestGrades, readingFromJson } from '@/lib/grades';
import { sectionOf, type SectionKey } from '@/lib/sections';
import { components, type PipelineNode } from '@/lib/symbols';

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 10) : new Date(d).toISOString().slice(0, 10));

export interface PipelineRow {
  name: string;
  active: boolean;
  /** pipeline.last_updated */
  updated: string | null;
  parts: number;
  grade: number | null;
  reading: number | null;
  /** the Friday the grade is from */
  gradedOn: string | null;
  graphId: string | null;
}

export interface AssetGroup {
  symbol: string;
  name: string | null;
  assetType: string | null;
  section: SectionKey;
  lastClose: number | null;
  lastDate: string | null;
  /** the asset's active pipeline (null when it has none) */
  active: PipelineRow | null;
  /** its inactive pipelines, newest first */
  others: PipelineRow[];
}

export async function allAssets(maxDate: string): Promise<AssetGroup[]> {
  const pipes = await sql<{ name: string; symbol: string; active: boolean; last_updated: Date | null; pipelinedata: unknown; tags: string[] | null }[]>`
    SELECT name, symbol, active, last_updated, pipelinedata, tags FROM pipeline ORDER BY symbol, name`;
  const symbols = [...new Set(pipes.map((p) => p.symbol))];
  if (!symbols.length) return [];
  const [activeGrades, inactiveGrades, info, graphs] = await Promise.all([
    latestGrades(symbols, maxDate),
    sql<{ pipeline: string; symbol: string; date: Date; jsondata: unknown }[]>`
      SELECT DISTINCT ON (pipeline) pipeline, symbol, date, jsondata FROM pipeline_grades
      WHERE date <= ${maxDate} ORDER BY pipeline, date DESC`.catch(() => []),
    sql<{ symbol: string; name: string | null; asset_type: string | null; date: Date | null; close: string | null }[]>`
      SELECT a.symbol, a.name, a.asset_type, s.date, s.last_close AS close
      FROM assets a LEFT JOIN LATERAL (
        SELECT date, last_close FROM stock_data WHERE symbol = a.symbol ORDER BY date DESC LIMIT 1) s ON TRUE
      WHERE a.symbol IN ${sql(symbols)}`,
    sql<{ legacy_pipeline: string; id: string }[]>`
      SELECT legacy_pipeline, id::text FROM graphs WHERE legacy_pipeline IS NOT NULL`.catch(() => []),
  ]);
  const inactive = new Map(inactiveGrades.map((r) => [r.pipeline, r]));
  const meta = new Map(info.map((r) => [r.symbol, r]));
  const graphOf = new Map(graphs.map((g) => [g.legacy_pipeline, g.id]));

  const row = (p: (typeof pipes)[number]): PipelineRow => {
    const d = (typeof p.pipelinedata === 'string' ? JSON.parse(p.pipelinedata) : p.pipelinedata) as { nodes?: PipelineNode[] } | null;
    const g = p.active ? activeGrades[p.symbol] : null;
    const ig = !p.active ? inactive.get(p.name) : null;
    return {
      name: p.name,
      active: p.active,
      updated: p.last_updated ? iso(p.last_updated) : null,
      parts: components(d?.nodes ?? []).length,
      grade: g ? g.grade : ig ? gradeFromJson(ig.jsondata) : null,
      reading: g ? g.reading : ig ? readingFromJson(ig.jsondata, p.symbol) : null,
      gradedOn: g ? g.date : ig ? iso(ig.date) : null,
      graphId: graphOf.get(p.name) ?? null,
    };
  };

  return symbols.map((s) => {
    const mine = pipes.filter((p) => p.symbol === s);
    const m = meta.get(s);
    const act = mine.find((p) => p.active);
    return {
      symbol: s,
      name: m?.name ?? null,
      assetType: m?.asset_type ?? null,
      section: sectionOf(m?.asset_type, act?.tags ?? []),
      lastClose: m?.close != null ? Number(m.close) : null,
      lastDate: m?.date ? iso(m.date) : null,
      active: act ? row(act) : null,
      others: mine.filter((p) => !p.active).map(row).sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? '') || b.name.localeCompare(a.name)),
    };
  });
}
