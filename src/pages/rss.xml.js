import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../consts';

export async function GET(context) {
  // RSS only ever carries published posts — never drafts, regardless of env.
  const posts = (await getCollection('writing', ({ data }) => data.publish)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: post.data.date,
      categories: post.data.tags,
      link: `/writing/${post.id}/`,
    })),
    customData: `<language>zh-Hant</language>`,
  });
}
