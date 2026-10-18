/**
 * Dashboard sections. A pipeline's section comes from its symbol's assets.asset_type (one value per symbol,
 * edited on the Data page); a pipeline tag `section:<key>` overrides it for that pipeline only.
 * asset_type values were normalised to ASSET_TYPES on 2026-10-18 (alfatec-backend scripts/tidy_asset_types.py).
 */

export const ASSET_TYPES = ['COMMODITY', 'INDEX', 'ETF', 'STOCK', 'CURRENCY', 'TREASURY', 'ECONOMIC', 'INDICATOR'] as const;

export const SECTIONS = [
  { key: 'commodity', label: 'Commodity', types: ['COMMODITY', 'PRECIOUS METAL'] },
  { key: 'index', label: 'Index', types: ['INDEX'] },
  { key: 'etf', label: 'ETF', types: ['ETF'] },
  { key: 'stocks', label: 'Stocks', types: ['STOCK'] },
  { key: 'other', label: 'Other', types: [] as string[] },
] as const;

export type SectionKey = (typeof SECTIONS)[number]['key'];

const TAG = 'section:';

/** Section key for an asset type (case-insensitive), or the pipeline's `section:<key>` tag when it has one. */
export function sectionOf(assetType: string | null | undefined, tags: string[] = []): SectionKey {
  const tagged = tags.find((t) => t.toLowerCase().startsWith(TAG))?.slice(TAG.length).toLowerCase();
  if (tagged && SECTIONS.some((s) => s.key === tagged)) return tagged as SectionKey;
  const t = (assetType ?? '').trim().toUpperCase();
  return (SECTIONS.find((s) => (s.types as readonly string[]).includes(t))?.key ?? 'other') as SectionKey;
}

/** Tags to show next to a pipeline (the section tag is not one of them). */
export const displayTags = (tags: string[]) => tags.filter((t) => !t.toLowerCase().startsWith(TAG));

/** Items grouped in section order; empty sections left out. */
export function groupBySection<T extends { section: SectionKey }>(items: T[]) {
  return SECTIONS.map((s) => ({ ...s, items: items.filter((i) => i.section === s.key) })).filter((g) => g.items.length > 0);
}
