import { getCollection, type CollectionEntry } from 'astro:content';
import { catMeta, MARKETS_CATEGORIES, type Category } from './categories';
import { readingTime, monoDate } from './readingTime';
import { withBase } from './url';

export type Post = CollectionEntry<'writing'>;

// The single source of truth for "what is publishable":
//   - production: only `publish: true`
//   - dev: also show drafts (so you can preview an Obsidian note before flipping
//     publish: true), but they never reach a production build.
function isVisible(post: Post): boolean {
  return post.data.publish || import.meta.env.DEV;
}

/** All visible posts, newest first. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection('writing', isVisible);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Posts whose category belongs on the Markets & Systems page. */
export async function getMarketsPosts(): Promise<Post[]> {
  return (await getPosts()).filter((p) => MARKETS_CATEGORIES.includes(p.data.category));
}

/** The featured post (first `featured: true`), else the most recent. */
export async function getFeatured(): Promise<Post | undefined> {
  const posts = await getPosts();
  return posts.find((p) => p.data.featured) ?? posts[0];
}

export interface PostView {
  slug: string;
  href: string;
  title: string;
  summary: string;
  tags: string[];
  category: Category;
  catLabel: string;
  catColor: string;
  isDraft: boolean;
  dateMono: string;
  readTime: string;
}

/** Map a collection entry to the flat view-model the components render. */
export function toView(post: Post): PostView {
  const meta = catMeta(post.data.category);
  return {
    slug: post.id,
    href: withBase(`/writing/${post.id}`),
    title: post.data.title,
    summary: post.data.summary,
    tags: post.data.tags,
    category: post.data.category,
    catLabel: meta.label,
    catColor: meta.color,
    isDraft: !post.data.publish,
    dateMono: monoDate(post.data.date),
    readTime: post.data.readTime ?? readingTime(post.body ?? ''),
  };
}
