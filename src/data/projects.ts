// Projects index. Long-lived work, not feed posts — kept as data, not markdown.

export interface Project {
  name: string;
  kind: string;
  status: string;
  color: string;
  desc: string;
}

export const PROJECTS: Project[] = [
  {
    name: 'CardDex',
    kind: '鑑定卡媒合 · 產品',
    status: 'LIVE',
    color: 'var(--success)',
    desc: '台灣 PSA／BGS 鑑定卡的交易媒合平台。純媒合、不抽成，平台只收訂閱費。',
  },
  {
    name: 'OpenClaw',
    kind: 'Workflow / AI',
    status: 'BUILDING',
    color: 'var(--brand)',
    desc: '把重複的研究、整理、發布流程，收斂成一條穩定可重跑的工作流。',
  },
  {
    name: 'YouTube 系列',
    kind: '影片 · 創作',
    status: 'ONGOING',
    color: 'var(--info)',
    desc: '交易系統、AI 工具與生活觀察的長影片。網站是它文字版的家。',
  },
  {
    name: 'Haru',
    kind: '個人知識系統',
    status: 'PRIVATE',
    color: 'var(--fg-muted)',
    desc: '我自己的交易研究與筆記系統，網站上的東西多半從這裡長出來。',
  },
];
