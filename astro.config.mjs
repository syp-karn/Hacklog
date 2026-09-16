import { defineConfig, passthroughImageService } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode from 'rehype-pretty-code';
import { remarkCodeMeta } from './src/lib/remark-code-meta.ts';
import { robotsTxtIntegration } from './src/lib/seo-integration.ts';
import { CONFIG } from './src/data/config.ts';

/** @type {import('rehype-pretty-code').Options} */
const prettyCodeOptions = {
  theme: {
    light: 'github-light',
    dark: 'github-dark',
  },
  keepBackground: false,
};

// https://astro.build/config
export default defineConfig({
  site: CONFIG.site.url,
  output: 'static',
  image: {
    service: passthroughImageService(),
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    react(),
    mdx({
      remarkPlugins: [remarkGfm, remarkCodeMeta],
      rehypePlugins: [[rehypePrettyCode, prettyCodeOptions]],
      syntaxHighlight: false,
    }),
    sitemap({
      // Keep utility and thin-listing pages out of search indexes:
      // /search is a noindex client-side tool; /tags/* are filtered views of
      // writeups+notes with no unique content of their own.
      filter: (page) =>
        !page.includes("/search") && !page.includes("/tags/"),
    }),
    robotsTxtIntegration(),
  ],
});
