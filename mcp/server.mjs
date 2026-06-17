#!/usr/bin/env node
/**
 * public-brain MCP server.
 *
 * Lets an AI agent author and publish posts to the public-brain site over MCP
 * (stdio transport). It operates on the same content directory and schema the
 * site builds from, so anything it writes is a first-class post.
 *
 * Tools: list_posts, read_post, create_post, update_post, set_publish,
 *        delete_post, publish_and_deploy
 *
 * Register with a client (example — Claude Code / Claude Desktop):
 *   {
 *     "mcpServers": {
 *       "public-brain": { "command": "node", "args": ["<repo>/mcp/server.mjs"] }
 *     }
 *   }
 *
 * NOTE: stdout is the JSON-RPC channel — never write to it. Diagnostics go to stderr.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CATEGORIES,
  listPosts,
  readPost,
  createPost,
  updatePost,
  setPublish,
  deletePost,
} from '../scripts/lib/posts-io.mjs';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const execFileP = promisify(execFile);
const CATEGORY_HELP = `One of: ${CATEGORIES.join(', ')} (系統 / Markets / Projects / 樹洞 / 生活).`;

const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });

/** Wrap a handler so thrown errors become clean MCP error results. */
const guard = (fn) => async (args) => {
  try {
    return await fn(args);
  } catch (err) {
    return fail(`Error: ${err.message}`);
  }
};

async function git(args) {
  const { stdout } = await execFileP('git', args, { cwd: REPO_ROOT });
  return stdout.trim();
}

const server = new McpServer({ name: 'public-brain', version: '0.1.0' });

server.registerTool(
  'list_posts',
  {
    title: 'List posts',
    description:
      'List all posts on the site with their slug, title, date, category and publish status. ' +
      'Use this first to see what exists before creating or updating.',
    inputSchema: {
      publish: z.boolean().optional().describe('Filter by publish status (omit for all).'),
      category: z.enum(CATEGORIES).optional().describe('Filter by category.'),
    },
  },
  guard(async ({ publish, category }) => {
    let posts = await listPosts();
    if (publish !== undefined) posts = posts.filter((p) => p.publish === publish);
    if (category) posts = posts.filter((p) => p.category === category);
    if (posts.length === 0) return ok('No posts match.');
    const lines = posts.map(
      (p) =>
        `- ${p.slug}  [${p.publish ? 'published' : 'draft'}]  ${p.date}  ${p.category}` +
        `${p.featured ? '  ★featured' : ''}\n    ${p.title}`
    );
    return ok(`${posts.length} post(s):\n${lines.join('\n')}`);
  })
);

server.registerTool(
  'read_post',
  {
    title: 'Read a post',
    description: 'Read one post by slug — returns its frontmatter fields and full markdown body.',
    inputSchema: { slug: z.string().describe('The post slug (filename without extension).') },
  },
  guard(async ({ slug }) => {
    const { data, body } = await readPost(slug);
    return ok(`Frontmatter:\n${JSON.stringify(data, null, 2)}\n\nBody:\n${body}`);
  })
);

server.registerTool(
  'create_post',
  {
    title: 'Create a post',
    description:
      'Create a new post. Writes a markdown file the site builds from. By default it is a DRAFT ' +
      '(publish:false) — call set_publish, or pass publish:true, when it is ready. The body is ' +
      'Markdown: use `###` for section headings, `####` for bold sub-leads, `>` for pull-quotes.',
    inputSchema: {
      title: z.string().describe('Post title.'),
      category: z.enum(CATEGORIES).describe(CATEGORY_HELP),
      summary: z.string().describe('One-line summary, shown in lists and RSS.'),
      body: z.string().describe('Post body in Markdown.'),
      tags: z.array(z.string()).optional().describe('Optional tags.'),
      date: z.string().optional().describe('ISO date (YYYY-MM-DD). Defaults to today.'),
      publish: z.boolean().optional().describe('Publish immediately. Default false (draft).'),
      featured: z.boolean().optional().describe('Promote to the featured slot on the home page.'),
      readTime: z.string().optional().describe('Optional editorial read time, e.g. "7 分鐘".'),
      slug: z.string().optional().describe('Override the URL slug (derived from title otherwise).'),
      overwrite: z.boolean().optional().describe('Replace an existing post with the same slug.'),
    },
  },
  guard(async (args) => {
    const { slug, file } = await createPost(args, { overwrite: args.overwrite === true });
    const state = args.publish ? 'PUBLISHED' : 'draft';
    return ok(`Created ${state} post "${slug}" (${file}). Run publish_and_deploy to push it live.`);
  })
);

server.registerTool(
  'update_post',
  {
    title: 'Update a post',
    description:
      'Patch an existing post. Only the fields you pass are changed; everything else is preserved.',
    inputSchema: {
      slug: z.string().describe('Slug of the post to update.'),
      title: z.string().optional(),
      category: z.enum(CATEGORIES).optional().describe(CATEGORY_HELP),
      summary: z.string().optional(),
      body: z.string().optional().describe('Replaces the entire body when provided.'),
      tags: z.array(z.string()).optional(),
      date: z.string().optional().describe('ISO date (YYYY-MM-DD).'),
      publish: z.boolean().optional(),
      featured: z.boolean().optional(),
      readTime: z.string().optional(),
    },
  },
  guard(async ({ slug, ...patch }) => {
    const res = await updatePost(slug, patch);
    return ok(`Updated post "${res.slug}" (${res.file}).`);
  })
);

server.registerTool(
  'set_publish',
  {
    title: 'Publish / unpublish',
    description:
      'Flip a post between published and draft. Only published posts are built, served, and in RSS.',
    inputSchema: {
      slug: z.string().describe('Slug of the post.'),
      publish: z.boolean().describe('true = publish, false = back to draft.'),
    },
  },
  guard(async ({ slug, publish }) => {
    await setPublish(slug, publish);
    return ok(`"${slug}" is now ${publish ? 'PUBLISHED' : 'a draft'}.`);
  })
);

server.registerTool(
  'delete_post',
  {
    title: 'Delete a post',
    description: 'Permanently remove a post file. Cannot be undone (recover via git if committed).',
    inputSchema: { slug: z.string().describe('Slug of the post to delete.') },
  },
  guard(async ({ slug }) => {
    const { file } = await deletePost(slug);
    return ok(`Deleted "${slug}" (${file}).`);
  })
);

server.registerTool(
  'publish_and_deploy',
  {
    title: 'Publish & deploy',
    description:
      'Commit the content changes and push, which triggers the Vercel deploy that takes posts live. ' +
      'Stages ONLY src/content/writing (never unrelated code). Pushes only if the branch has an ' +
      'upstream; otherwise it commits locally and tells you to set a remote.',
    inputSchema: {
      message: z.string().optional().describe('Commit message. Defaults to a generated one.'),
      push: z.boolean().optional().describe('Push after committing. Default true.'),
    },
  },
  guard(async ({ message, push = true }) => {
    await git(['add', 'src/content/writing']);
    // Anything staged?
    try {
      await git(['diff', '--cached', '--quiet']);
      return ok('Nothing to publish — no content changes staged.');
    } catch {
      /* non-zero exit = there ARE staged changes; continue */
    }
    const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
    await git(['commit', '-m', message || 'content: publish post update']);
    const head = await git(['rev-parse', '--short', 'HEAD']);

    if (!push) return ok(`Committed ${head} on ${branch} (not pushed).`);

    let hasUpstream = true;
    try {
      await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    } catch {
      hasUpstream = false;
    }
    if (!hasUpstream) {
      return ok(
        `Committed ${head} on ${branch}, but the branch has no upstream — ` +
          `nothing was pushed. Add a remote and set upstream to enable deploy.`
      );
    }
    await git(['push']);
    return ok(`Committed ${head} and pushed ${branch}. Vercel will deploy the change.`);
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[public-brain] MCP server ready on stdio.');
