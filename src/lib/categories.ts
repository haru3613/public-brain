// Category metadata — label + colour token — ported from the design's catMeta().
// `color` is a CSS custom property reference so themes/accent stay centralized.

export type Category = 'system' | 'markets' | 'project' | 'treehole' | 'life';

export interface CategoryMeta {
  label: string;
  /** CSS color value (a var() reference into global.css tokens). */
  color: string;
}

const META: Record<Category, CategoryMeta> = {
  system: { label: '系統', color: 'var(--brand)' },
  markets: { label: 'Markets', color: 'var(--info)' },
  project: { label: 'Projects', color: 'var(--grade-ur)' },
  treehole: { label: '樹洞', color: 'var(--grade-ssr)' },
  life: { label: '生活', color: 'var(--grade-sr)' },
};

export function catMeta(cat: Category): CategoryMeta {
  return META[cat] ?? META.system;
}

// Filter tabs for the Writing page (label shown in the pill row).
export const FILTER_TABS: { key: 'all' | Category; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'system', label: '系統 / AI' },
  { key: 'markets', label: 'Markets & Systems' },
  { key: 'project', label: 'Projects' },
  { key: 'treehole', label: '樹洞' },
  { key: 'life', label: '生活' },
];

// Categories that belong on the "Markets & Systems" page (the technical ones).
export const MARKETS_CATEGORIES: Category[] = ['markets', 'system'];
