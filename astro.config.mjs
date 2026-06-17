import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Deploy target config — overridable by env so the same build works on GitHub
// Pages (subpath), Vercel (root), or a custom domain (root).
//   SITE_URL   origin used for RSS, sitemap, canonical/OG absolute URLs
//   BASE_PATH  base path the site is served under ("/" for root, "/public-brain"
//              for a GitHub Pages project site). Set BASE_PATH=/ on Vercel.
const SITE = process.env.SITE_URL ?? 'https://haru3613.github.io';
const BASE = process.env.BASE_PATH ?? '/public-brain';

// https://astro.build
export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
