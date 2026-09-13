# Hacklog Analytics — Cloudflare Worker + D1

Self-hosted, cookieless analytics collector for poorvaj.tech. The Astro site
(`src/lib/tracker/`) fingerprints passively and beacons two events per pageview;
this Worker validates them, stamps server-side truth (geo/ASN/TLS/IP-hash from
`request.cf`), and stores everything in D1 (free-tier SQLite).

```
Browser tracker (Layout.astro script)
  │  sendBeacon ×2 (pageview, engagement)
  ▼
POST https://analytics.poorvaj.tech/a62534db8dff824a71f1190a7be06663
  │  validate + enrich (country/city/ASN/TLS/ip_hash)
  ▼
D1: visitors + pageviews
  ▲
GET /api/stats?q=...&token=...   ← your queries
```

## Deploy

```bash
cd analytics-worker

# 1. Create the D1 database (prints a database_id)
npx wrangler d1 create hacklog-analytics

# 2. Paste the database_id into wrangler.toml

# 3. Apply the schema
npx wrangler d1 execute hacklog-analytics --file schema.sql

# 4. Secrets
npx wrangler secret put STATS_TOKEN      # any long random string — for /api/stats
npx wrangler secret put COLLECT_SALT     # any long random string — IP-hash salt
npx wrangler secret put COLLECT_PATH     # optional — override the collect path (rotate: update tracker too)

# 5a. Route on your Cloudflare zone (recommended): uncomment `routes` in
#     wrangler.toml, point DNS "analytics" at the worker, then
npx wrangler deploy

# 5b. Or deploy to workers.dev first for testing
npx wrangler versions upload
```

## Verify

```bash
# health
curl https://analytics.poorvaj.tech/healthz

# fake a pageview (origin must be https://poorvaj.tech when set;
# the path below is the unguessable collect hash — generic probes get 404)
curl -X POST https://analytics.poorvaj.tech/a62534db8dff824a71f1190a7be06663 \
  -H 'content-type: text/plain' \
  -H 'origin: https://poorvaj.tech' \
  -d '{"v":1,"type":"pageview","vid":"abcdef1234567890","sid":"123456abcdef7890","path":"/","ref":"","ts":1730000000000,"ua":"test"}'
# → 204

# stats
curl 'https://analytics.poorvaj.tech/api/stats?q=summary&token=YOUR_TOKEN'
```

## Queries available

`q=` one of: `summary` `visitors-per-day` `top-pages` `countries` `cities`
`browsers` `os` `devices` `languages` `timezones` `local-hours` `networks`
`asns` `referrers` `color-scheme` `gpu` `bots` `rtc-leaks` `reading`
`returning`

Examples:

```bash
curl '.../api/stats?q=top-pages&token=...'
curl '.../api/stats?q=rtc-leaks&token=...'
curl '.../api/stats?q=reading&token=...'
```

## Direct SQL

```bash
# visitors per day
npx wrangler d1 execute hacklog-analytics --command \
  "SELECT date(ts/1000,'unixepoch') d, COUNT(DISTINCT vid) v FROM pageviews GROUP BY d ORDER BY d"

# how far people read each writeup
npx wrangler d1 execute hacklog-analytics --command \
  "SELECT path, AVG(scroll_depth), AVG(dwell_ms)/60000.0 FROM pageviews WHERE path LIKE '/writeups/%' GROUP BY path"

# export everything
npx wrangler d1 export hacklog-analytics --output dump.sql
```

## Secret collect path

The collect endpoint lives at a 32-hex-char unguessable path (SHA-256-derived
hash), not `/api/collect`. Anything else — including the old API paths — gets an
indistinguishable 404, so port scanners and fuzzers come up empty.

- Worker default: `/a62534db8dff824a71f1190a7be06663` (in `src/index.js`)
- Override at runtime with the `COLLECT_PATH` secret; if you rotate it, update
  `COLLECT_ENDPOINT` in `src/lib/tracker/main.ts` and redeploy the site.
- Note: the path ships in the site's JS bundle, so it's obscurity for
  scanners, not cryptographic secrecy. True access control stays on the stats
  endpoint via `STATS_TOKEN`.

## Privacy posture (keep this honest)

- **No cookies** — identity is fingerprint ⊕ random, stored in localStorage/
  IndexedDB/Cache Storage on the visitor's device.
- **No raw IPs** — `cf-connecting-ip` is hashed with a rotating daily salt
  (`COLLECT_SALT`); the raw value never touches disk.
- **WebRTC IPs are the exception you opted into** — `rtc_public_ip` /
  `rtc_local_ips` columns hold what ICE leaked. `rtc_mdns_protected` tells you
  how many visitors are masked. Treat these columns as the sensitive ones.
- **Bots flagged, not trusted** — `bot_score >= 0.3` rows are your scraper
  traffic; filter them in queries.
- If you ever want to publish this dataset or feel generous, the honest move is
  a disclosure line in the footer + honouring `DNT`/`Sec-GPC` in the tracker.

## Data dictionary

See `schema.sql` — every column the tracker sends is there, with the
server-stamped ones marked.
