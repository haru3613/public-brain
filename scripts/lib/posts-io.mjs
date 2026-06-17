/**
 * Shared post I/O for authoring tools (the MCP server + the Obsidian sync).
 * Pure Node, zero dependencies. The build-time source of truth for the schema
 * is src/content.config.ts (Zod); this mirrors it for authoring-time checks.
 */

import { readdir, readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CATEGORIES = ['system', 'markets', 'project', 'treehole', 'life'];

// repo/src/content/writing — resolved relative to THIS file, so it's correct
// no matter which tool imports it.
export const WRITING_DIR = fileURLToPath(new URL('../../src/content/writing/', import.meta.url));

export function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "2026-06-14" from a Date or ISO-ish string; defaults to today (UTC). */
export function isoDate(value) {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.valueOf())) throw new Error(`invalid date: ${value}`);
  return d.toISOString().slice(0, 10);
}

// Tags that are internal to Harvey's vault and shouldn't surface on the site.
const INTERNAL_TAGS = new Set(['創作素材', 'index', 'ai-agent']);

/** Title from an Obsidian filename: drop extension and a leading "NN - " prefix. */
export function titleFromFilename(name) {
  return String(name)
    .replace(/\.mdx?$/, '')
    .replace(/^\s*\d+\s*[-–—]\s*/, '')
    .trim();
}

/** Drop internal tags; keep the rest, de-duplicated. */
export function cleanTags(tags = []) {
  return tags.filter((t) => !INTERNAL_TAGS.has(t)).filter((t, i, a) => a.indexOf(t) === i);
}

/**
 * Normalize an Obsidian note body for the site: drop the leading H1 (title lives
 * in frontmatter) and everything from a trailing「📱 社群草稿」block onward, then
 * trim stray separators/blank lines.
 */
export function cleanNoteBody(body) {
  const lines = String(body).split('\n');
  const h1 = lines.findIndex((l) => /^#\s+/.test(l));
  if (h1 !== -1) lines.splice(h1, 1);
  const cut = lines.findIndex((l) => l.includes('社群草稿'));
  let kept = cut === -1 ? lines : lines.slice(0, cut);
  while (kept.length && (kept.at(-1).trim() === '' || kept.at(-1).trim() === '---')) kept.pop();
  while (kept.length && kept[0].trim() === '') kept.shift();
  return kept.join('\n');
}

/** First real prose paragraph, for use as an auto-summary fallback. */
export function firstParagraph(body, max = 100) {
  for (const block of String(body).split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t || /^#{1,6}\s/.test(t) || /^[>|\-*]/.test(t) || t.startsWith('```')) continue;
    const clean = t.replace(/\s+/g, ' ').replace(/[*_`#>]/g, '').trim();
    if (!clean) continue;
    return clean.length > max ? `${clean.slice(0, max)}…` : clean;
  }
  return '';
}

/** Minimal YAML-frontmatter parser for the flat post schema. */
export function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].trim();
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

/** Validate authoring fields. Returns an array of human-readable errors. */
export function validatePost(fields) {
  const errors = [];
  if (!fields.title || !String(fields.title).trim()) errors.push('title is required');
  if (!fields.summary || !String(fields.summary).trim()) errors.push('summary is required');
  if (!fields.body || !String(fields.body).trim()) errors.push('body is required');
  if (!fields.category) {
    errors.push('category is required');
  } else if (!CATEGORIES.includes(fields.category)) {
    errors.push(`category "${fields.category}" must be one of ${CATEGORIES.join(' / ')}`);
  }
  if (fields.date !== undefined) {
    try {
      isoDate(fields.date);
    } catch {
      errors.push(`date "${fields.date}" is not a valid date`);
    }
  }
  if (fields.tags !== undefined && !Array.isArray(fields.tags)) {
    errors.push('tags must be an array of strings');
  }
  return errors;
}

const yamlString = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Build a complete markdown file (frontmatter + body) from fields. */
export function buildMarkdown(fields) {
  const lines = ['---'];
  lines.push(`title: ${yamlString(fields.title)}`);
  lines.push(`date: ${isoDate(fields.date)}`);
  lines.push(`category: ${fields.category}`);
  if (fields.tags?.length) lines.push(`tags: [${fields.tags.map(yamlString).join(', ')}]`);
  lines.push(`summary: ${yamlString(fields.summary)}`);
  lines.push(`publish: ${fields.publish === true}`);
  if (fields.readTime) lines.push(`readTime: ${yamlString(fields.readTime)}`);
  if (fields.featured) lines.push('featured: true');
  lines.push('---', '');
  const body = String(fields.body).replace(/\s+$/, '');
  return `${lines.join('\n')}\n${body}\n`;
}

async function listFiles() {
  try {
    const entries = await readdir(WRITING_DIR, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && /\.mdx?$/.test(e.name))
      .map((e) => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function fileForSlug(files, slug) {
  return files.find((f) => basename(f).replace(/\.mdx?$/, '') === slug);
}

/** List all posts with parsed frontmatter, newest first. */
export async function listPosts() {
  const files = await listFiles();
  const posts = [];
  for (const file of files) {
    const raw = await readFile(join(WRITING_DIR, file), 'utf8');
    const { data } = parseFrontmatter(raw);
    posts.push({
      slug: file.replace(/\.mdx?$/, ''),
      file,
      title: data.title ?? '(untitled)',
      date: data.date ?? '',
      category: data.category ?? '',
      publish: data.publish === true,
      featured: data.featured === true,
      tags: data.tags ?? [],
      summary: data.summary ?? '',
    });
  }
  return posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export async function readPost(slug) {
  const files = await listFiles();
  const file = fileForSlug(files, slug);
  if (!file) throw new Error(`post not found: ${slug}`);
  const raw = await readFile(join(WRITING_DIR, file), 'utf8');
  const { data, body } = parseFrontmatter(raw);
  return { slug, file, data, body, raw };
}

export async function postExists(slug) {
  const files = await listFiles();
  return Boolean(fileForSlug(files, slug));
}

/**
 * Create a post. Throws on validation error or (without overwrite) slug clash.
 * Returns { slug, file, path }.
 */
export async function createPost(fields, { overwrite = false } = {}) {
  const errors = validatePost(fields);
  if (errors.length) throw new Error(`invalid post: ${errors.join('; ')}`);

  const slug = slugify(fields.slug || fields.title);
  if (!slug) throw new Error('could not derive a slug from title/slug');
  if (!overwrite && (await postExists(slug))) {
    throw new Error(`post "${slug}" already exists (pass overwrite to replace)`);
  }

  await mkdir(WRITING_DIR, { recursive: true });
  const file = `${slug}.md`;
  const path = join(WRITING_DIR, file);
  await writeFile(path, buildMarkdown(fields), 'utf8');
  return { slug, file, path };
}

/** Patch an existing post's frontmatter and/or body. Returns { slug, file, path }. */
export async function updatePost(slug, patch) {
  const current = await readPost(slug);
  const merged = {
    title: current.data.title,
    date: current.data.date,
    category: current.data.category,
    tags: current.data.tags ?? [],
    summary: current.data.summary,
    publish: current.data.publish === true,
    readTime: current.data.readTime,
    featured: current.data.featured === true,
    body: current.body,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
  };
  const errors = validatePost(merged);
  if (errors.length) throw new Error(`invalid post: ${errors.join('; ')}`);

  const path = join(WRITING_DIR, current.file);
  await writeFile(path, buildMarkdown(merged), 'utf8');
  return { slug, file: current.file, path };
}

export async function setPublish(slug, publish) {
  return updatePost(slug, { publish: publish === true });
}

export async function deletePost(slug) {
  const files = await listFiles();
  const file = fileForSlug(files, slug);
  if (!file) throw new Error(`post not found: ${slug}`);
  await unlink(join(WRITING_DIR, file));
  return { slug, file };
}
