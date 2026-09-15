/// <reference types="astro/client" />

/**
 * Build-time environment (Astro/Vite). Only `PUBLIC_`-prefixed values reach
 * the browser; everything else stays server-side.
 *
 * These two are what keep the collector's location out of this public repo.
 * Set them in `.env` locally and in your host's build environment in CI.
 */
interface ImportMetaEnv {
  /** Origin of the analytics Worker, e.g. https://analytics.example.com */
  readonly PUBLIC_ANALYTICS_ORIGIN?: string;
  /** Secret collect path, e.g. /9f2c… (must match the COLLECT_PATH secret) */
  readonly PUBLIC_ANALYTICS_COLLECT_PATH?: string;
  /**
   * "1" on preview/staging builds: emits `noindex, nofollow` on every page so
   * a test deployment never ends up in a search index next to the real site.
   */
  readonly PUBLIC_NOINDEX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
