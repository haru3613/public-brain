#!/usr/bin/env node
/**
 * One-off importer: the Obsidian「AI Agent 心法」series → site posts.
 *
 * Maps Harvey's note convention (created / tags / status, filename title,
 * trailing「📱 社群草稿」block) onto the site schema. Summaries are his own
 * one-line hooks from the folder README; bodies are his, minus the H1 and the
 * social-draft tail. Replaces the placeholder seed posts.
 *
 *   node scripts/import-aiagent.mjs            # dry-run (default)
 *   node scripts/import-aiagent.mjs --apply    # write + replace seeds
 *
 * Vault folder via env AIAGENT_DIR (defaults to the iCloud Obsidian path).
 */
import { readFile, readdir, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseFrontmatter, buildMarkdown, cleanNoteBody, cleanTags, WRITING_DIR } from './lib/posts-io.mjs';

const APPLY = process.argv.includes('--apply');
const SRC =
  process.env.AIAGENT_DIR ||
  join(homedir(), 'Library', 'Mobile Documents', 'iCloud~md~obsidian', 'Documents', 'AI Agent 心法');

// slug / title / category / summary(=his README hook) / featured / date.
// Order = README; dates descend so 01 sits at the top of the list, 09 oldest.
const MAP = [
  { n: '01', file: '01 - 把 AI 的工作環境當工程設計.md', slug: 'design-the-ai-environment',
    title: '把 AI 的工作環境當工程設計', category: 'system', featured: true, date: '2026-06-14',
    summary: '我不再「叫 AI 寫 code」，我開始「設計一個讓 AI 自己能跑的環境」。' },
  { n: '02', file: '02 - AI 不能幫自己打分.md', slug: 'ai-cant-grade-its-own-work',
    title: 'AI 不能幫自己打分', category: 'system', date: '2026-06-13',
    summary: '我學到最貴的一課：絕對不要讓「寫程式的 AI」幫自己驗收。' },
  { n: '03', file: '03 - 我寫了一個 AI 專案經理.md', slug: 'i-built-an-ai-project-manager',
    title: '我寫了一個 AI 專案經理', category: 'project', date: '2026-06-12',
    summary: '我一個人管不了那麼多 side project，所以我寫了一個 AI PM 幫我管。' },
  { n: '04', file: '04 - 養成系 AI 助理 Haru.md', slug: 'raising-haru',
    title: '養成系 AI 助理 Haru', category: 'project', date: '2026-06-11',
    summary: '我在養一個會自己訂目標、會自我反省、但永遠不敢改自己核心規則的 AI 助理。' },
  { n: '05', file: '05 - 我的整套 AI 開發閉環.md', slug: 'my-ai-development-loop',
    title: '我的整套 AI 開發閉環', category: 'project', date: '2026-06-10',
    summary: 'Obsidian 當腦、Linear 當規格、AI PM 當調度、排程當手 — 一個會自己跑的開發迴圈。' },
  { n: '06', file: '06 - cron 把資料寫成 0 之後.md', slug: 'when-cron-wrote-zeros',
    title: 'cron 把資料寫成 0 之後', category: 'system', date: '2026-06-09',
    summary: '一個排程把我 5500 筆資料默默清成 0，我從那次學到「重算型任務的防呆三道閘」。' },
  { n: '07', file: '07 - 先 research 再動手.md', slug: 'research-before-building',
    title: '先 research 再動手', category: 'system', date: '2026-06-08',
    summary: '我蓋完整套架構才發現整條路是死的 — 從此我逼自己「動手前先查清楚現在到底能不能做」。' },
  { n: '08', file: '08 - 為什麼我的 AI 自動化只跑便宜模型.md', slug: 'cheap-models-only',
    title: '為什麼我的 AI 自動化只跑便宜模型', category: 'system', date: '2026-06-07',
    summary: '自動化跑貴模型會破產 — 我怎麼用便宜模型撐起整套自動化，還有「AI 審 AI」的誠實問題。' },
  { n: '09', file: '09 - 讓 Claude 當老師教我的 AI 助理.md', slug: 'claude-as-teacher',
    title: '讓 Claude 當老師教我的 AI 助理', category: 'system', date: '2026-06-06',
    summary: '我讓一個強模型現場當老師、教我的助理量化知識，但規定它「要先上網查證才能教」。' },
];

// Series-specific: prepend "AI" and cap at 3 tags.
const tagsFrom = (data) => ['AI', ...cleanTags(data.tags)].filter((t, i, a) => a.indexOf(t) === i).slice(0, 3);

async function main() {
  console.log(`\nImport「AI Agent 心法」→ site  (${APPLY ? 'APPLY' : 'dry-run'})`);
  console.log(`  src : ${SRC}\n`);

  const built = [];
  for (const m of MAP) {
    const raw = await readFile(join(SRC, m.file), 'utf8');
    const { data, body } = parseFrontmatter(raw);
    const md = buildMarkdown({
      title: m.title,
      date: m.date ?? data.created,
      category: m.category,
      tags: tagsFrom(data),
      summary: m.summary,
      publish: true,
      featured: m.featured,
      body: cleanNoteBody(body),
    });
    built.push({ slug: m.slug, md });
    console.log(`  ✓ ${m.n} → ${m.slug}.md  [${m.category}]  ${m.title}`);
  }

  const keep = new Set(built.map((b) => b.slug));
  const existing = (await readdir(WRITING_DIR)).filter((f) => /\.mdx?$/.test(f));
  const toRemove = existing.filter((f) => !keep.has(f.replace(/\.mdx?$/, '')));
  console.log(`\n  replacing ${toRemove.length} placeholder seed(s): ${toRemove.join(', ') || '(none)'}`);

  if (!APPLY) {
    console.log('\n  dry-run — re-run with --apply to write.\n');
    return;
  }

  await mkdir(WRITING_DIR, { recursive: true });
  for (const b of built) await writeFile(join(WRITING_DIR, `${b.slug}.md`), b.md, 'utf8');
  for (const f of toRemove) await unlink(join(WRITING_DIR, f));
  console.log(`\n  wrote ${built.length}, removed ${toRemove.length}. Done.\n`);
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(1);
});
