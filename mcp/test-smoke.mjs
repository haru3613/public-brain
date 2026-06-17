#!/usr/bin/env node
/**
 * Smoke test: drive the public-brain MCP server with a real MCP client over
 * stdio. Creates a temp post, lists/reads/publishes it, then deletes it so the
 * content dir is left clean. Run: node mcp/test-smoke.mjs
 */
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER = fileURLToPath(new URL('./server.mjs', import.meta.url));
const SLUG = 'zzz-mcp-smoke-test'; // slug-safe (slugify would normalize underscores/caps)

const text = (r) => r.content.map((c) => c.text).join('\n');
let pass = 0;
const check = (name, cond, detail = '') => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    console.log(`  ✗ ${name} ${detail}`);
    process.exitCode = 1;
  }
};

const transport = new StdioClientTransport({ command: 'node', args: [SERVER] });
const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(transport);

try {
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  console.log('Tools:', names.join(', '));
  check(
    'all 7 tools present',
    ['create_post', 'delete_post', 'list_posts', 'publish_and_deploy', 'read_post', 'set_publish', 'update_post'].every(
      (n) => names.includes(n)
    )
  );

  // clean any leftover from a prior failed run
  await client.callTool({ name: 'delete_post', arguments: { slug: SLUG } }).catch(() => {});

  const created = await client.callTool({
    name: 'create_post',
    arguments: {
      title: 'MCP 煙霧測試',
      slug: SLUG,
      category: 'system',
      summary: '這是一篇 MCP smoke test 文章，跑完會自動刪除。',
      body: '測試內文。\n\n### 一個段落\n\n> 引言。',
      tags: ['test'],
    },
  });
  check('create_post → draft', /Created draft/.test(text(created)), text(created));

  const badCat = await client.callTool({
    name: 'create_post',
    arguments: { title: 'x', slug: 'x', category: 'nope', summary: 's', body: 'b' },
  });
  check('create_post rejects bad category', badCat.isError === true && /category/.test(text(badCat)));

  const listed = await client.callTool({ name: 'list_posts', arguments: { publish: false } });
  check('list_posts shows the draft', text(listed).includes(SLUG), text(listed));

  const read = await client.callTool({ name: 'read_post', arguments: { slug: SLUG } });
  check('read_post returns body', text(read).includes('測試內文'), text(read));

  const published = await client.callTool({ name: 'set_publish', arguments: { slug: SLUG, publish: true } });
  check('set_publish → published', /PUBLISHED/.test(text(published)));

  const onlyPublished = await client.callTool({ name: 'list_posts', arguments: { publish: true } });
  check('now appears in published list', text(onlyPublished).includes(SLUG));

  const updated = await client.callTool({
    name: 'update_post',
    arguments: { slug: SLUG, summary: '改過的摘要。' },
  });
  check('update_post patches', /Updated post/.test(text(updated)));
  const reread = await client.callTool({ name: 'read_post', arguments: { slug: SLUG } });
  check('patch persisted + body preserved', text(reread).includes('改過的摘要') && text(reread).includes('測試內文'));

  const deleted = await client.callTool({ name: 'delete_post', arguments: { slug: SLUG } });
  check('delete_post removes file', /Deleted/.test(text(deleted)));
  const gone = await client.callTool({ name: 'read_post', arguments: { slug: SLUG } });
  check('post is gone', gone.isError === true);

  console.log(`\n${pass} checks passed.`);
} finally {
  // ensure no temp file survives a mid-test failure
  await client.callTool({ name: 'delete_post', arguments: { slug: SLUG } }).catch(() => {});
  await client.close();
}
