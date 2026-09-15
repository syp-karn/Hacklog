#!/usr/bin/env node
/**
 * Print a complete set of secrets without installing anything.
 *
 *   node analytics-worker/scripts/new-secrets.mjs
 *
 * For manual rotation. `scripts/setup.mjs` is the guided version that also
 * creates the databases, applies the schema and installs everything.
 *
 * Run it twice if you want independent production and staging sets — reusing
 * one collect path across environments means leaking the test path burns the
 * live one.
 */

import { makeSecretSet } from './secrets.mjs';

const { COLLECT_PATH, STATS_PATH, STATS_TOKEN, COLLECT_SALT } = makeSecretSet();

console.log(`
Generated ${new Date().toISOString()}
==============================================================================

# ── 1. Worker secrets (run in analytics-worker/) ──────────────────────────────
#    add --env staging for the staging worker
npx wrangler secret put COLLECT_PATH
#   → ${COLLECT_PATH}

npx wrangler secret put STATS_PATH
#   → ${STATS_PATH}

npx wrangler secret put STATS_TOKEN
#   → ${STATS_TOKEN}

npx wrangler secret put COLLECT_SALT
#   → ${COLLECT_SALT}

# ── 2. Site build environment (.env in the repo root) ─────────────────────────
#    (workers.dev hostname unless you moved the zone to Cloudflare)
PUBLIC_ANALYTICS_ORIGIN=https://<worker>.<your-sub>.workers.dev
PUBLIC_ANALYTICS_COLLECT_PATH=${COLLECT_PATH}

# ── 3. Read your stats ───────────────────────────────────────────────────────
curl -H 'x-stats-token: ${STATS_TOKEN}' \\
  'https://<worker>.<your-sub>.workers.dev${STATS_PATH}?q=summary'

==============================================================================
Rotating COLLECT_PATH means redeploying the SITE too (the path is baked into
the bundle at build time) — otherwise beacons keep going to the old path.
`);
