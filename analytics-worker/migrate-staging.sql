-- Staging migration: readable time columns, geo on visitors, drop engagement columns.
-- Preserves every existing row. Not re-runnable (SQLite errors if a column already
-- exists) — that is fine, it only needs to run once.

-- 1. visitors: readable time twins + geo (additive, old rows get NULL geo)
ALTER TABLE visitors ADD COLUMN first_seen_at TEXT;
ALTER TABLE visitors ADD COLUMN last_seen_at TEXT;
ALTER TABLE visitors ADD COLUMN country TEXT;
ALTER TABLE visitors ADD COLUMN region TEXT;
ALTER TABLE visitors ADD COLUMN city TEXT;

-- Backfill the readable times from the epoch-ms values already stored (IST).
UPDATE visitors SET
  first_seen_at = strftime('%Y-%m-%d %H:%M:%S', first_seen / 1000, 'unixepoch', '+5 hours', '+30 minutes'),
  last_seen_at  = strftime('%Y-%m-%d %H:%M:%S', last_seen  / 1000, 'unixepoch', '+5 hours', '+30 minutes')
WHERE first_seen_at IS NULL;

-- 2. pageviews: rebuild without the engagement columns, backfilling `time`
--    from the stored epoch-ms `ts`. Twelve-step-reduced: no indices depend on
--    the dropped columns and staging data is tiny.
CREATE TABLE pageviews_new (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  time               TEXT,
  vid                TEXT,
  sid                TEXT,
  path               TEXT,
  ref_host           TEXT,
  ts                 INTEGER,
  country            TEXT,
  city               TEXT,
  region             TEXT,
  asn                INTEGER,
  as_org             TEXT,
  colo               TEXT,
  tls_version        TEXT,
  http_protocol      TEXT,
  ip_hash            TEXT,
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
  canvas_hash        TEXT,
  audio_hash         TEXT,
  fonts_count        INTEGER,
  fonts_hash         TEXT,
  os_hint            TEXT,
  os_version_hint    TEXT,
  browser_hint       TEXT,
  engine_hint        TEXT,
  bot_score          REAL,
  color_scheme       TEXT,
  reduced_motion     INTEGER,
  touch_points       INTEGER,
  pointer            TEXT,
  codec_hash         TEXT,
  voices_hash        TEXT,
  domrect_hash       TEXT,
  webgl_params_hash  TEXT,
  rtc_local_ips      TEXT,
  rtc_public_ip      TEXT,
  rtc_mdns_protected INTEGER
);

INSERT INTO pageviews_new
  (id, time, vid, sid, path, ref_host, ts, country, city, region, asn, as_org, colo,
   tls_version, http_protocol, ip_hash, ua, lang, languages, tz, local_hour, screen,
   pixel_ratio, refresh_hz, cores, mem_gb, net_type, downlink_mbps, gpu,
   canvas_hash, audio_hash, fonts_count, fonts_hash, os_hint, os_version_hint,
   browser_hint, engine_hint, bot_score, color_scheme, reduced_motion, touch_points,
   pointer, codec_hash, voices_hash, domrect_hash, webgl_params_hash,
   rtc_local_ips, rtc_public_ip, rtc_mdns_protected)
SELECT
  id, strftime('%Y-%m-%d %H:%M:%S', ts / 1000, 'unixepoch', '+5 hours', '+30 minutes'), vid, sid, path, ref_host, ts,
  country, city, region, asn, as_org, colo, tls_version, http_protocol, ip_hash, ua,
  lang, languages, tz, local_hour, screen, pixel_ratio, refresh_hz, cores, mem_gb,
  net_type, downlink_mbps, gpu, canvas_hash, audio_hash, fonts_count, fonts_hash,
  os_hint, os_version_hint, browser_hint, engine_hint, bot_score, color_scheme,
  reduced_motion, touch_points, pointer, codec_hash, voices_hash, domrect_hash,
  webgl_params_hash, rtc_local_ips, rtc_public_ip, rtc_mdns_protected
FROM pageviews
ORDER BY id;

DROP TABLE pageviews;
ALTER TABLE pageviews_new RENAME TO pageviews;

-- 3. Recreate the indices the rebuild dropped.
CREATE INDEX IF NOT EXISTS idx_pv_vid      ON pageviews(vid);
CREATE INDEX IF NOT EXISTS idx_pv_sid      ON pageviews(sid);
CREATE INDEX IF NOT EXISTS idx_pv_path_ts  ON pageviews(path, ts);
CREATE INDEX IF NOT EXISTS idx_pv_ts       ON pageviews(ts);
CREATE INDEX IF NOT EXISTS idx_pv_country  ON pageviews(country);
