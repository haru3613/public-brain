# Harvey 的公開腦袋 · public brain

> 我的網站是家，社群只是路邊看板。

交易、系統、AI、創作、生活觀察。把「寫作與發布」從「滑 feed」裡拆出來 —
網站是主場，社群只是分發管道。**沒有 like、沒有留言、沒有推薦流。**

Built with [Astro](https://astro.build) + Markdown/MDX, content sourced from Obsidian,
deployed to Vercel. Visual language ported from the CardDex design system (dark
`#0D1117` canvas, champagne-gold `#e5da94` accent, Space Grotesk / DM Sans / Noto Sans TC /
JetBrains Mono).

## Structure

```
src/
  consts.ts              # site name, nav, external links — edit here
  content.config.ts      # writing collection schema (the publish gate)
  content/writing/*.md   # posts (one per file)
  data/now.ts            # the "Now" list (home page)
  data/projects.ts       # the Projects index
  lib/                   # categories, posts query (publish filter), reading time
  components/            # Header, Footer, Now, PostRow, ProjectCard, ArticleListItem
  layouts/Base.astro     # <head>, fonts, header/footer shell
  pages/
    index.astro          # Home — "terminal index" (Home A)
    writing/             # list (with category filter) + [slug] reading page
    markets/             # Markets & Systems list
    projects/            # Projects
    about/               # About / Links
    rss.xml.js           # RSS feed (published posts only)
scripts/sync-obsidian.mjs  # Obsidian → site publishing flow
```

## Develop

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # static output → dist/
npm run preview    # serve the built site
```

> Node 20+ (see `.nvmrc`). In `dev`, draft posts (`publish: false`) are shown with a
> `DRAFT` badge so you can preview before publishing; production builds exclude them.

## Content schema

Every post is a markdown file in `src/content/writing/` with this frontmatter:

```yaml
---
title: "標題"
date: 2026-06-14            # ISO date
category: system           # system | markets | project | treehole | life
tags: ["AI", "workflow"]   # optional
summary: "一句話摘要，用在列表與 RSS。"
publish: true              # only true is ever built / served / in RSS
featured: false            # optional — promotes to the featured slot
readTime: "7 分鐘"          # optional — overrides the auto-computed estimate
---

內文用 Markdown。`###` = 段落小標、`####` = 粗體引言、`>` = pull-quote。
```

The schema is enforced at build time by `src/content.config.ts` (Zod) — a missing or
mistyped field fails the build rather than shipping silently.

## Obsidian → site

Write in Obsidian, mark a note `publish: true`, then run the sync:

```bash
npm run sync          # dry-run: lists publishable notes + warnings (default)
npm run sync:apply    # copies them into src/content/writing/
```

Config via env (`OBSIDIAN_VAULT`, `OBSIDIAN_SUBDIR`). The script never deletes site
content and never copies a note that isn't `publish: true`. Obsidian-only syntax
(`[[wikilinks]]`, `![[embeds]]`) is flagged, not silently dropped.

## Deploy (Vercel)

Static output — Vercel auto-detects Astro (build `astro build`, output `dist/`). Set the
production env var:

- `SITE_URL` — the canonical site origin (used for RSS, sitemap, canonical/OG URLs).

## TODO (from the brief)

- [x] scaffold Astro site
- [x] content schema (`publish: true` gate)
- [x] Obsidian → site publishing workflow (`scripts/sync-obsidian.mjs`)
- [x] Addy-Osmani-style home (Home A — terminal index)
- [x] RSS (`/rss.xml`)
- [ ] choose a domain → set `SITE_URL`, swap YouTube/GitHub hrefs in `src/consts.ts`
- [ ] deploy to Vercel
- [ ] Newsletter — later
