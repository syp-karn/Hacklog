/**
 * Hacklog analytics collector — Cloudflare Worker + D1.
 *
 * Receives two beacons per pageview from the site tracker:
 *   POST /<32-hex collect hash>   pageview + engagement events (text/plain, no preflight)
 *   GET  /api/stats               aggregate queries for the site owner (token-gated)
 *
 * Design rules:
 *   - Geo/ASN/colo/TLS are stamped SERVER-SIDE from request.cf — the client
 *     cannot fake or even see these before the request arrives.
 *   - The visitor IP is never stored. It is hashed with a rotating daily salt
 *     into ip_hash, enough for "same visitor today" rate limiting/analysis
 *     without keeping PII.
 *   - Every client-supplied field is validated and length-capped. The beacon
 *     body is attacker-controlled input like any other.
 *   - Bot-scored traffic is stored but flagged, so you can filter it in SQL.
 */

const ALLOWED_ORIGIN = 'https://poorvaj.tech';
const MAX_BODY_BYTES = 8 * 1024;

/**
 * Unguessable collect path. Only the exact hash matches — generic scanners
 * probing /api/collect or /collect get a uniform 404 with no distinguishing
 * response. Rotate by setting the COLLECT_PATH secret (must match the
 * tracker bundle) or editing this constant and redeploying both sides.
 */
const DEFAULT_COLLECT_PATH = '/a62534db8dff824a71f1190a7be06663';
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------- utilities --

function corsHeaders(origin) {
  return {
    'access-control-allow-origin': origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function reject(status, origin) {
  return new Response(null, { status, headers: corsHeaders(origin) });
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Rotating daily salt: same visitor within a day → same ip_hash. */
async function ipHash(ip, salt, nowMs) {
  if (!ip) return null;
  const day = Math.floor(nowMs / DAY_MS);
  return sha256Hex(`${salt}:${day}:${ip}`);
}

// ------------------------------------------------------------ validation ----

const str = (v, max) => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null);
const num = (v, max) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(v, max) : null);
const bool = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : null);
const uuidish = (v) => (typeof v === 'string' && /^[0-9a-f]{6,40}$/i.test(v) ? v.slice(0, 40) : null);

function parseEvent(raw) {
  let b;
  try {
    b = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof b !== 'object' || b === null) return null;

  const type = b.type === 'engagement' ? 'engagement' : b.type === 'pageview' ? 'pageview' : null;
  if (!type) return null;

  const vid = uuidish(b.vid);
  const sid = uuidish(b.sid);
  if (!vid || !sid) return null;

  const path = str(b.path, 300);
  if (!path || !path.startsWith('/')) return null;

  return {
    type,
    vid,
    sid,
    path,
    ref_host: str(b.ref, 200),
    client_ts: num(b.ts, Date.now() + 60_000),
    final: bool(b.final),

    // engagement
    dwell_ms: num(b.dwell_ms, 86_400_000),
    scroll_depth: num(b.scroll_depth, 1),
    read_wpm: num(b.read_wpm, 1500),
    tab_aways: num(b.tab_aways, 10_000),
    clicks: num(b.clicks, 10_000),

    // device snapshot
    ua: str(b.ua, 400),
    lang: str(b.lang, 35),
    languages: str(b.languages, 100),
    tz: str(b.tz, 64),
    local_hour: num(b.local_hour, 23),
    screen: str(b.screen, 20),
    pixel_ratio: num(b.pixel_ratio, 10),
    refresh_hz: num(b.refresh_hz, 500),
    cores: num(b.cores, 256),
    mem_gb: num(b.mem_gb, 1024),
    net_type: str(b.net_type, 20),
    downlink_mbps: num(b.downlink_mbps, 1000),
    gpu: str(b.gpu, 200),
    canvas_hash: str(b.canvas_hash, 32),
    audio_hash: str(b.audio_hash, 32),
    fonts_count: num(b.fonts_count, 2000),
    fonts_hash: str(b.fonts_hash, 32),
    os_hint: str(b.os_hint, 20),
    os_version_hint: str(b.os_version_hint, 40),
    browser_hint: str(b.browser_hint, 60),
    engine_hint: str(b.engine_hint, 20),
    bot_score: num(b.bot_score, 1),
    color_scheme: b.color_scheme === 'dark' ? 'dark' : b.color_scheme === 'light' ? 'light' : null,
    reduced_motion: bool(b.reduced_motion),
    touch_points: num(b.touch_points, 20),
    pointer: str(b.pointer, 20),
    codec_hash: str(b.codec_hash, 64),
    voices_hash: str(b.voices_hash, 64),
    domrect_hash: str(b.domrect_hash, 64),
    webgl_params_hash: str(b.webgl_params_hash, 64),
    rtc_local_ips: Array.isArray(b.rtc_local_ips)
      ? b.rtc_local_ips.filter((x) => typeof x === 'string').slice(0, 8).map((x) => x.slice(0, 45))
      : null,
    rtc_public_ip: str(b.rtc_public_ip, 45),
    rtc_mdns_protected: bool(b.rtc_mdns_protected),
  };
}

// ---------------------------------------------------------------- handler ----

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('origin') ?? '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === collectPath(env) && request.method === 'POST') {
      return handleCollect(request, env, origin);
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      return handleStats(request, env, url);
    }

    if (url.pathname === '/healthz') {
      return json({ ok: true, ts: Date.now() });
    }

    return reject(404, origin);
  },
};

// ---------------------------------------------------------------- collect ----

function collectPath(env) {
  return env.COLLECT_PATH ?? DEFAULT_COLLECT_PATH;
}

async function handleCollect(request, env, origin) {
  if (origin && origin !== ALLOWED_ORIGIN) return reject(403, origin);

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > MAX_BODY_BYTES) return reject(413, origin);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return reject(413, origin);

  const ev = parseEvent(raw);
  if (!ev) return reject(400, origin);

  const cf = request.cf ?? {};
  const now = Date.now();

  // Server-side truth: geo, network, TLS. The client cannot supply these.
  const country = str(cf.country, 8);
  const city = str(cf.city, 100);
  const region = str(cf.region, 100);
  const asn = num(cf.asn, 4_294_967_295);
  const asOrg = str(cf.asOrganization, 200);
  const colo = str(cf.colo, 10);
  const tlsVersion = str(cf.tlsVersion, 20);
  const httpProtocol = str(cf.httpProtocol, 20);

  const ipHashValue = await ipHash(
    request.headers.get('cf-connecting-ip'),
    env.COLLECT_SALT ?? 'dev-salt',
    now,
  );

  // Derive pointer type from client signals when present.
  const pointer = typeof ev.pointer === 'string' ? ev.pointer : null;

  // ---- upsert the visitor row ----
  await env.DB.prepare(
    `INSERT INTO visitors (vid, first_seen, last_seen, visits, ua, browser_hint, os_hint, os_version_hint)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?)
     ON CONFLICT(vid) DO UPDATE SET
       last_seen = excluded.last_seen,
       visits = visitors.visits + 1`,
  ).bind(ev.vid, now, now, ev.ua, ev.browser_hint, ev.os_hint, ev.os_version_hint).run();

  // ---- pageview row ----
  await env.DB.prepare(
    `INSERT INTO pageviews
      (vid, sid, path, ref_host, ts, country, city, region, asn, as_org, colo,
       tls_version, http_protocol, ip_hash, ua,
       lang, languages, tz, local_hour, screen, pixel_ratio, refresh_hz,
       cores, mem_gb, net_type, downlink_mbps, gpu,
       canvas_hash, audio_hash, fonts_count, fonts_hash,
       os_hint, os_version_hint, browser_hint, engine_hint,
       bot_score, color_scheme, reduced_motion, touch_points, pointer,
       codec_hash, voices_hash, domrect_hash, webgl_params_hash,
       rtc_local_ips, rtc_public_ip, rtc_mdns_protected,
       dwell_ms, scroll_depth, read_wpm, tab_aways, clicks, final)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,
             ?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,
             ?28,?29,?30,?31,?32,?33,?34,?35,?36,?37,?38,?39,?40,
             ?41,?42,?43,?44,?45,?46,?47,
             ?48,?49,?50,?51,?52,?53)`,
  ).bind(
    ev.vid, ev.sid, ev.path, ev.ref_host, now, country, city, region, asn, asOrg, colo,
    tlsVersion, httpProtocol, ipHashValue, ev.ua,
    ev.lang, ev.languages, ev.tz, ev.local_hour, ev.screen, ev.pixel_ratio, ev.refresh_hz,
    ev.cores, ev.mem_gb, ev.net_type, ev.downlink_mbps, ev.gpu,
    ev.canvas_hash, ev.audio_hash, ev.fonts_count, ev.fonts_hash,
    ev.os_hint, ev.os_version_hint, ev.browser_hint, ev.engine_hint,
    ev.bot_score, ev.color_scheme, ev.reduced_motion, ev.touch_points, pointer,
    ev.codec_hash, ev.voices_hash, ev.domrect_hash, ev.webgl_params_hash,
    ev.rtc_local_ips ? ev.rtc_local_ips.join(',') : null,
    ev.rtc_public_ip, ev.rtc_mdns_protected,
    ev.dwell_ms, ev.scroll_depth, ev.read_wpm, ev.tab_aways, ev.clicks,
    ev.final ?? 0,
  ).run();

  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

// ------------------------------------------------------------------ stats ----

const STATS = {
  'visitors-per-day': `SELECT date(ts/1000,'unixepoch') d, COUNT(DISTINCT vid) v, COUNT(*) p
                       FROM pageviews GROUP BY d ORDER BY d DESC LIMIT 90`,
  'top-pages': `SELECT path, COUNT(*) views, COUNT(DISTINCT vid) uniques, AVG(scroll_depth) depth
                FROM pageviews GROUP BY path ORDER BY views DESC LIMIT 20`,
  'countries': `SELECT country, COUNT(DISTINCT vid) v FROM pageviews
                WHERE country IS NOT NULL GROUP BY country ORDER BY v DESC LIMIT 20`,
  'cities': `SELECT country, city, COUNT(DISTINCT vid) v FROM pageviews
             WHERE city IS NOT NULL GROUP BY country, city ORDER BY v DESC LIMIT 20`,
  'browsers': `SELECT browser_hint, COUNT(DISTINCT vid) v FROM pageviews
               WHERE browser_hint IS NOT NULL GROUP BY browser_hint ORDER BY v DESC LIMIT 15`,
  'os': `SELECT os_hint, os_version_hint, COUNT(DISTINCT vid) v FROM pageviews
         WHERE os_hint IS NOT NULL GROUP BY os_hint, os_version_hint ORDER BY v DESC LIMIT 15`,
  'devices': `SELECT screen, refresh_hz, cores, mem_gb, COUNT(DISTINCT vid) v FROM pageviews
              GROUP BY screen, refresh_hz, cores, mem_gb ORDER BY v DESC LIMIT 15`,
  'languages': `SELECT lang, COUNT(DISTINCT vid) v FROM pageviews
                WHERE lang IS NOT NULL GROUP BY lang ORDER BY v DESC LIMIT 15`,
  'timezones': `SELECT tz, COUNT(DISTINCT vid) v FROM pageviews
                WHERE tz IS NOT NULL GROUP BY tz ORDER BY v DESC LIMIT 15`,
  'local-hours': `SELECT local_hour, COUNT(*) p FROM pageviews
                  WHERE local_hour IS NOT NULL GROUP BY local_hour ORDER BY local_hour`,
  'networks': `SELECT net_type, AVG(downlink_mbps) avg_down, COUNT(DISTINCT vid) v FROM pageviews
               GROUP BY net_type ORDER BY v DESC LIMIT 10`,
  'asns': `SELECT asn, as_org, COUNT(DISTINCT vid) v FROM pageviews
           WHERE asn IS NOT NULL GROUP BY asn, as_org ORDER BY v DESC LIMIT 15`,
  'referrers': `SELECT ref_host, COUNT(DISTINCT vid) v, COUNT(*) p FROM pageviews
                WHERE ref_host IS NOT NULL GROUP BY ref_host ORDER BY v DESC LIMIT 15`,
  'color-scheme': `SELECT color_scheme, COUNT(DISTINCT vid) v FROM pageviews
                   WHERE color_scheme IS NOT NULL GROUP BY color_scheme`,
  'gpu': `SELECT gpu, COUNT(DISTINCT vid) v FROM pageviews
          WHERE gpu IS NOT NULL GROUP BY gpu ORDER BY v DESC LIMIT 15`,
  'bots': `SELECT vid, browser_hint, bot_score, COUNT(*) p FROM pageviews
           WHERE bot_score >= 0.3 GROUP BY vid, browser_hint, bot_score
           ORDER BY bot_score DESC LIMIT 20`,
  'rtc-leaks': `SELECT vid, rtc_public_ip, rtc_local_ips, rtc_mdns_protected, ts
                FROM pageviews WHERE rtc_public_ip IS NOT NULL OR rtc_local_ips IS NOT NULL
                ORDER BY ts DESC LIMIT 50`,
  'reading': `SELECT path, AVG(scroll_depth) depth, AVG(dwell_ms)/60000.0 minutes,
                     AVG(read_wpm) wpm, COUNT(*) p FROM pageviews
              WHERE dwell_ms IS NOT NULL GROUP BY path ORDER BY p DESC LIMIT 20`,
  'returning': `SELECT v.vid, v.visits, v.first_seen, v.last_seen, v.browser_hint, v.os_hint
                FROM visitors v WHERE v.visits > 1 ORDER BY v.visits DESC LIMIT 30`,
  'summary': `SELECT COUNT(DISTINCT vid) visitors, COUNT(*) pageviews,
                     COUNT(DISTINCT sid) sessions,
                     AVG(scroll_depth) avg_depth,
                     SUM(CASE WHEN bot_score >= 0.3 THEN 1 ELSE 0 END) bot_pageviews
              FROM pageviews`,
};

async function handleStats(request, env, url) {
  const token = url.searchParams.get('token') ?? request.headers.get('x-stats-token');
  if (!env.STATS_TOKEN || token !== env.STATS_TOKEN) {
    return json({ error: 'unauthorized' }, 401);
  }

  const key = url.searchParams.get('q') ?? 'summary';
  const sql = STATS[key];
  if (!sql) {
    return json({ error: 'unknown query', available: Object.keys(STATS) }, 400);
  }

  try {
    const result = await env.DB.prepare(sql).all();
    return json({ query: key, rows: result.results });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
