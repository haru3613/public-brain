#!/usr/bin/env node
/**
 * Obsidian → site publishing flow.
 *
 * Scans an Obsidian vault for notes marked `publish: true`, transforms each from
 * Harvey's note convention into the site schema, and writes them into
 * src/content/writing/. `publish: true` is the one-way gate.
 *
 *   node scripts/sync-obsidian.mjs            # dry-run (default) — shows what would change
 *   node scripts/sync-obsidian.mjs --apply    # actually write into src/content/writing
 *
 * To publish a note, add just three things to its frontmatter:
 *   publish: true
 *   category: system|markets|project|treehole|life
 *   summary: "一句話摘要"        # optional — auto-derived from the 1st paragraph if absent
 *
 * Everything else is mapped automatically:
 *   - title:  frontmatter `title`, else the filename (minus a leading "NN - ")
 *   - date:   frontmatter `date`, else `created`
 *   - tags:   frontmatter `tags`, minus internal ones (創作素材/index/ai-agent)
 *   - body:   minus the leading H1 and any trailing「📱 社群草稿」block
 *   - slug:   frontmatter `slug` (recommended for clean URLs), else slugified title
 *   Optional passthrough: featured (bool), readTime (string).
 *
 * Config via env:
 *   OBSIDIAN_VAULT   vault root (default: ~/Library/Mobile Documents/iCloud~md~obsidian/Documents)
 *   OBSIDIAN_SUBDIR  only scan this subfolder (optional, e.g. "AI Agent 心法")
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, basename, extname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  CATEGORIES,
  slugify,
  parseFrontmatter,
  buildMarkdown,
  cleanNoteBody,
  titleFromFilename,
  firstParagraph,
  cleanTags,
} from './lib/posts-io.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEST = join(ROOT, 'src', 'content', 'writing');
const APPLY = process.argv.includes('--apply');

const VAULT =
  process.env.OBSIDIAN_VAULT ||
  join(homedir(), 'Library', 'Mobile Documents', 'iCloud~md~obsidian', 'Documents');
const SCAN_ROOT = process.env.OBSIDIAN_SUBDIR ? join(VAULT, process.env.OBSIDIAN_SUBDIR) : VAULT;

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/** Recursively collect .md files, skipping dotfolders and Obsidian internals. */
async function walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(c.red(`✗ Cannot read ${dir}: ${err.message}`));
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (extname(entry.name) === '.md') {
      files.push(full);
    }
  }
  return files;
}

// Transform a vault note (Harvey's convention) into site-schema fields.
// Returns { fields, slug, errors, warnings } — fields is omitted if errors exist.
function buildPost(data, body, file) {
  const errors = [];
  const warnings = [];

  const title = (data.title && String(data.title).trim()) || titleFromFilename(basename(file));
  const date = data.date || data.created;
  const category = data.category;
  let summary = data.summary && String(data.summary).trim();
  if (!summary) {
    summary = firstParagraph(body);
    if (summary) warnings.push('summary auto-derived from 1st paragraph — add `summary:` for control');
  }

  if (!title) errors.push('no title (none derivable from filename)');
  if (!date) errors.push('no `date` or `created`');
  if (!category) errors.push(`missing \`category\` (one of ${CATEGORIES.join('/')})`);
  else if (!CATEGORIES.includes(category)) errors.push(`category "${category}" not in ${CATEGORIES.join('/')}`);
  if (!summary) errors.push('no `summary` and no paragraph to derive one from');

  const slug = slugify(data.slug || title || basename(file, extname(file)));
  if (!slug) errors.push('could not derive a slug');

  if (/!\[\[.+?\]\]/.test(body)) warnings.push('embeds ![[...]] not resolved on the site');
  if (/(^|[^!])\[\[.+?\]\]/.test(body)) warnings.push('wikilinks [[...]] not resolved');

  if (errors.length) return { errors, warnings, slug };

  const fields = {
    title,
    date,
    category,
    tags: cleanTags(data.tags),
    summary,
    publish: true,
    featured: data.featured === true,
    readTime: data.readTime,
    body: cleanNoteBody(body),
  };
  return { fields, slug, errors, warnings };
}

async function main() {
  console.log(c.bold('\nObsidian → site sync'));
  console.log(c.dim(`  vault : ${SCAN_ROOT}`));
  console.log(c.dim(`  dest  : ${relative(ROOT, DEST)}`));
  console.log(c.dim(`  mode  : ${APPLY ? 'APPLY (writing files)' : 'dry-run (no writes)'}\n`));

  const files = await walk(SCAN_ROOT);
  if (files.length === 0) {
    console.log(c.yellow('No markdown files found. Set OBSIDIAN_VAULT / OBSIDIAN_SUBDIR.'));
    return;
  }

  let published = 0;
  let skipped = 0;
  let failed = 0;

  if (APPLY) await mkdir(DEST, { recursive: true });

  for (const file of files) {
    const raw = await readFile(file, 'utf8');
    const { data, body } = parseFrontmatter(raw);
    if (!data || data.publish !== true) {
      skipped++;
      continue;
    }

    const { fields, slug, errors, warnings } = buildPost(data, body, file);
    const rel = relative(VAULT, file);
    if (errors.length) {
      failed++;
      console.log(`${c.red('✗')} ${rel}\n  ${c.red(errors.join('; '))}`);
      continue;
    }

    published++;
    console.log(
      `${c.green('✓')} ${rel} ${c.dim('→')} ${c.bold(`writing/${slug}.md`)} ${c.dim(`[${fields.category}]`)}`
    );
    if (warnings.length) console.log(`  ${c.yellow(`! ${warnings.join('; ')}`)}`);

    if (APPLY) await writeFile(join(DEST, `${slug}.md`), buildMarkdown(fields), 'utf8');
  }

  console.log(
    `\n${c.bold('Summary')}  ` +
      `${c.green(`${published} publishable`)} · ` +
      `${c.dim(`${skipped} skipped`)} · ` +
      `${failed ? c.red(`${failed} invalid`) : c.dim('0 invalid')}`
  );
  if (!APPLY && published > 0) {
    console.log(c.dim('Re-run with --apply to copy these into src/content/writing.\n'));
  }
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(c.red(err.stack || String(err)));
  process.exit(1);
});
