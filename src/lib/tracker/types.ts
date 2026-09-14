/**
 * Hacklog tracker — shared contracts.
 *
 * Modeled on the "cookie" reference site's Signal/Probe architecture,
 * trimmed to what Hacklog actually collects (passive + WebRTC IP, no
 * port scans / extension enumeration / permission probing).
 *
 * A Signal is one raw measurement. A beacon is what actually leaves the
 * browser, shaped exactly for the analytics-worker D1 tables.
 */

/** One raw measurement taken from the browser. */
export interface Signal {
  /** stable dotted id, e.g. "gpu.renderer" */
  id: string;
  /** human label, e.g. "GPU renderer" */
  label: string;
  value: unknown;
  /** set when the probe failed or the API is unavailable */
  error?: string;
  /** wall-clock ms the measurement took */
  ms?: number;
}

export type SignalMap = Record<string, Signal>;

export interface Probe {
  id: string;
  title: string;
  /** 0 = instant/zero side effect, 1 = slower rasterisation work */
  tier: 0 | 1;
  run(): Promise<Signal[]>;
}

/** The one JSON body the tracker sends to the collector (pageview + pagehide engagement). */
export interface BeaconPayload {
  v: 1;
  type: 'pageview' | 'engagement';
  /** visitor id: fingerprint digest ⊕ random (pseudonymous, cookieless) */
  vid: string;
  /** session id, regenerated after 30 min idle */
  sid: string;
  path: string;
  ref: string;
  /** local visitor clock (ms), server re-stamps arrival with its own time */
  ts: number;
  /** true when the beacon is the final flush on pagehide */
  final?: boolean;

  // — engagement (engagement beacon, or pageview when 0) —
  dwell_ms?: number;
  scroll_depth?: number;
  read_wpm?: number;
  tab_aways?: number;
  clicks?: number;

  // — device/env snapshot (pageview beacon only) —
  ua?: string;
  lang?: string;
  languages?: string;
  tz?: string;
  local_hour?: number;
  screen?: string;
  pixel_ratio?: number;
  refresh_hz?: number;
  cores?: number;
  mem_gb?: number;
  net_type?: string;
  downlink_mbps?: number;
  gpu?: string;
  canvas_hash?: string;
  audio_hash?: string;
  fonts_count?: number;
  fonts_hash?: string;
  os_hint?: string;
  os_version_hint?: string;
  browser_hint?: string;
  engine_hint?: string;
  bot_score?: number;
  color_scheme?: 'dark' | 'light';
  reduced_motion?: boolean;
  touch_points?: number;
  pointer?: string;
  codec_hash?: string;
  voices_hash?: string;
  domrect_hash?: string;
  webgl_params_hash?: string;
  // WebRTC leak (can be null when protected/unavailable)
  rtc_local_ips?: string[];
  rtc_public_ip?: string | null;
  rtc_mdns_protected?: boolean;
}
