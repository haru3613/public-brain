import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// The `writing` collection is the published surface of the Obsidian vault.
// Frontmatter mirrors what the publishing flow writes:
//   title, date, tags, summary, publish, category, (featured)
// Only `publish: true` notes are ever rendered — see src/lib/posts.ts.
const writing = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    publish: z.boolean().default(false),
    category: z.enum(['system', 'markets', 'project', 'treehole', 'life']),
    featured: z.boolean().default(false),
    // Optional editorial read-time (e.g. "7 分鐘"). Falls back to an estimate
    // computed from the body when omitted — see src/lib/posts.ts.
    readTime: z.string().optional(),
  }),
});

export const collections = { writing };
