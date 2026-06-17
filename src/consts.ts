// Site-wide configuration. Edit here, not in components.

export const SITE = {
  /** Owner name — shown in the logo, hero, and footer. */
  name: 'Harvey',
  /** Site title used in <title> and metadata. */
  title: 'Harvey 的公開腦袋',
  /** One-line role line under the hero (mono). */
  role: '交易系統 · AI 工具 · 創作 · 生活觀察',
  /** Used for meta description / RSS channel description. */
  description:
    '交易、系統、AI、創作、生活觀察。把寫作從滑 feed 裡拆出來 — 網站是家，社群只是路邊看板。沒有 like、沒有留言、沒有推薦流。',
  /** The manifesto. */
  tagline: '我的網站是家，社群只是路邊看板。',
} as const;

// Primary navigation. The prototype stubbed Markets/Projects/About back to the
// home page; the real site gives each section its own route per the spec.
export const NAV: { label: string; href: string }[] = [
  { label: 'Now', href: '/' },
  { label: 'Writing', href: '/writing' },
  { label: 'Markets', href: '/markets' },
  { label: 'Projects', href: '/projects' },
  { label: 'About', href: '/about' },
];

// External + feed links. Swap the hrefs once finalized.
export const LINKS = {
  youtube: 'https://youtube.com',
  github: 'https://github.com/haru3613',
  rss: '/rss.xml',
} as const;
