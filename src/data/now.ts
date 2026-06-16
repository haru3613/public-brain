// "Now" — what I'm currently working on. Edit freely; surfaced on the home page.
// `color` is a CSS var() so it tracks the theme.

export interface NowItem {
  name: string;
  desc: string;
  status: string;
  color: string;
}

export const NOW_UPDATED = '2026 / 06';

export const NOW: NowItem[] = [
  { name: 'CardDex', desc: '台灣 PSA / BGS 鑑定卡媒合平台', status: '開發中', color: 'var(--brand)' },
  { name: 'OpenClaw', desc: '研究與寫作流程自動化', status: '進行中', color: 'var(--info)' },
  { name: 'YouTube', desc: '交易系統 · AI 工具 · 生活觀察', status: '更新中', color: 'var(--success)' },
];
