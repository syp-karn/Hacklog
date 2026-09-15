-- Hacklog analytics — D1 schema (apply with wrangler d1 execute hacklog-analytics --file schema.sql)
--
-- Timestamps: epoch-ms columns (ts, first_seen, last_seen) drive queries; the
-- *_at TEXT twins next to them are human-readable UTC ('YYYY-MM-DD HH:MM:SS')
-- so the D1 console shows visit times directly. One pageview = one row: the
-- tracker no longer sends an engagement beacon and the worker ignores the
-- 'engagement' type, so there are no engagement columns here.

CREATE TABLE IF NOT EXISTS visitors (
  vid              TEXT PRIMARY KEY,      -- fingerprint ⊕ random (pseudonymous)
  first_seen       INTEGER,               -- epoch ms
  last_seen        INTEGER,               -- epoch ms
  first_seen_at    TEXT,                  -- 'YYYY-MM-DD HH:MM:SS' UTC
  last_seen_at     TEXT,                  -- 'YYYY-MM-DD HH:MM:SS' UTC
  visits           INTEGER DEFAULT 1,
  ua               TEXT,
  browser_hint     TEXT,
  os_hint          TEXT,
  os_version_hint  TEXT,
  country          TEXT,                  -- from request.cf at write time
  region           TEXT,
  city             TEXT
);

CREATE TABLE IF NOT EXISTS pageviews (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  time               TEXT,                -- 'YYYY-MM-DD HH:MM:SS' UTC, leftmost for the console
  vid                TEXT,
  sid                TEXT,                -- session id (30-min idle)
  path               TEXT,
  ref_host           TEXT,
  ts                 INTEGER,             -- server epoch ms

  -- server-stamped network truth (from request.cf — client cannot set these)
  country            TEXT,
  city               TEXT,
  region             TEXT,
  asn                INTEGER,
  as_org             TEXT,
  colo               TEXT,
  tls_version        TEXT,
  http_protocol      TEXT,
  ip_hash            TEXT,                 -- daily-salted SHA-256, never the raw IP

  -- client device/environment snapshot
  ua                 TEXT,
  lang               TEXT,
  languages          TEXT,
  tz                 TEXT,
  local_hour         INTEGER,
  screen             TEXT,
  pixel_ratio        REAL,
  refresh_hz         INTEGER,
  cores              INTEGER,
  mem_gb             INTEGER,
  net_type           TEXT,
  downlink_mbps      REAL,
  gpu                TEXT,

  -- fingerprint component hashes
  canvas_hash        TEXT,
  audio_hash         TEXT,
  fonts_count        INTEGER,
  fonts_hash         TEXT,
  os_hint            TEXT,
  os_version_hint    TEXT,
  browser_hint       TEXT,
  engine_hint        TEXT,                 -- v8 / spidermonkey / javascriptcore

  -- quality signals
  bot_score          REAL,
  color_scheme       TEXT,
  reduced_motion     INTEGER,
  touch_points       INTEGER,
  pointer            TEXT,

  -- additional fingerprint hashes
  codec_hash         TEXT,
  voices_hash        TEXT,
  domrect_hash       TEXT,
  webgl_params_hash  TEXT,

  -- WebRTC leak
  rtc_local_ips      TEXT,                 -- comma-joined
  rtc_public_ip      TEXT,
  rtc_mdns_protected INTEGER
);

CREATE INDEX IF NOT EXISTS idx_pv_vid      ON pageviews(vid);
CREATE INDEX IF NOT EXISTS idx_pv_sid      ON pageviews(sid);
CREATE INDEX IF NOT EXISTS idx_pv_path_ts  ON pageviews(path, ts);
CREATE INDEX IF NOT EXISTS idx_pv_ts       ON pageviews(ts);
CREATE INDEX IF NOT EXISTS idx_pv_country  ON pageviews(country);
