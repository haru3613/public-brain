import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Update this once a domain is chosen — it is used for RSS, sitemap, and
// canonical/OG absolute URLs. Override locally with the SITE_URL env var.
const SITE = process.env.SITE_URL ?? 'https://publicbrain.example';

// https://astro.build
export default defineConfig({
  site: SITE,
  output: 'static',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
