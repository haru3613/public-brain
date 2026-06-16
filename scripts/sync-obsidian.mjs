#!/usr/bin/env node
/**
 * Obsidian → site publishing flow.
 *
 * Scans an Obsidian vault for notes whose frontmatter has `publish: true`,
 * validates the required fields, and copies them into src/content/writing/.
 * The site only ever builds `publish: true` notes — this is the one-way gate.
 *
 *   node scripts/sync-obsidian.mjs            # dry-run (default) — shows what would change
 *   node scripts/sync-obsidian.mjs --apply    # actually write into src/content/writing
 *
 * Config via env:
 *   OBSIDIAN_VAULT   path to the vault root
 *                    (default: ~/Library/Mobile Documents/iCloud~md~obsidian/Documents)
 *   OBSIDIAN_SUBDIR  only scan this subfolder of the vault (optional, e.g. "Writing")
 *
 * Required frontmatter: title, date, category, summary, publish
 * Optional: tags (array), featured (bool), slug (string — overrides filename)
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, basename, extname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEST = join(ROOT, 'src', 'content', 'writing');
const APPLY = process.argv.includes('--apply');

const VAULT =
  process.env.OBSIDIAN_VAULT ||
  join(homedir(), 'Library', 'Mobile Documents', 'iCloud~md~obsidian', 'Documents');
const SCAN_ROOT = process.env.OBSIDIAN_SUBDIR ? join(VAULT, process.env.OBSIDIAN_SUBDIR) : VAULT;

const VALID_CATEGORIES = ['system', 'markets', 'project', 'treehole', 'life'];

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

/** Minimal frontmatter parser — handles the flat schema we publish. */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: null, body: raw };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val === 'true' || val === 'false') {
      data[key] = val === 'true';
    } else if (val.startsWith('[') && val.endsWith(']')) {
      data[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      data[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return { data, body: raw.slice(match[0].length) };
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validate(data) {
  const errors = [];
  for (const field of ['title', 'date', 'category', 'summary']) {
    if (data[field] === undefined || data[field] === '') errors.push(`missing "${field}"`);
  }
  if (data.category && !VALID_CATEGORIES.includes(data.category)) {
    errors.push(`category "${data.category}" not in ${VALID_CATEGORIES.join('/')}`);
  }
  return errors;
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

    const errors = validate(data);
    const rel = relative(VAULT, file);
    if (errors.length) {
      failed++;
      console.log(`${c.red('✗')} ${rel}\n  ${c.red(errors.join('; '))}`);
      continue;
    }

    const slug = data.slug ? slugify(data.slug) : slugify(basename(file, '.md'));
    const dest = join(DEST, `${slug}.md`);

    // Surface Obsidian-only syntax the site can't resolve, so it's a conscious choice.
    const warnings = [];
    if (/!\[\[.+?\]\]/.test(body)) warnings.push('embeds ![[...]] (not resolved on the site)');
    if (/(^|[^!])\[\[.+?\]\]/.test(body)) warnings.push('wikilinks [[...]] (not resolved)');

    published++;
    console.log(`${c.green('✓')} ${rel} ${c.dim('→')} ${c.bold(`writing/${slug}.md`)}`);
    if (warnings.length) console.log(`  ${c.yellow('! ' + warnings.join('; '))}`);

    if (APPLY) await writeFile(dest, raw, 'utf8');
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
