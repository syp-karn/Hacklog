import { writeFileSync } from "node:fs";
import type { AstroIntegration } from "astro";
import { CONFIG } from "../data/config";

/**
 * Emits robots.txt at build time so the sitemap URL always matches
 * CONFIG.site.url — no second place for the domain to drift.
 */
export function robotsTxtIntegration(): AstroIntegration {
  return {
    name: "robots-txt",
    hooks: {
      "astro:build:done": ({ dir, logger }) => {
        const robots = [
          "User-agent: *",
          "Allow: /",
          "",
          `Sitemap: ${CONFIG.site.url}/sitemap-index.xml`,
          "",
        ].join("\n");

        const file = new URL("robots.txt", dir);
        writeFileSync(file, robots, "utf-8");
        logger.info(`robots.txt -> sitemap ${CONFIG.site.url}/sitemap-index.xml`);
      },
    },
  };
}
