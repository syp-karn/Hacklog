/**
 * Hacklog tracker — entry point.
 *
 * Collects the user-selected signal set (device/env + WebRTC IPs + behaviour),
 * builds a cookieless visitor id, and beacons everything to the collector
 * Worker on the analytics subdomain. No cookies, no prompts.
 *
 * Transport: two beacons per pageview —
 *   1. 'pageview'   on load, carries the device/env snapshot
 *   2. 'engagement' on pagehide, carries accumulated behaviour
 *
 * Geo/ASN/TLS never come from the client — the Worker stamps those from the
 * request itself (cf object) at write time.
 */

import type { BeaconPayload, SignalMap } from './types';
import { runProbes } from './util';
import {
  platformProbe, displayProbe, hardwareProbe, environmentProbe,
  codecProbe, voiceProbe, gpuProbe, canvasProbe, audioProbe, domRectProbe,
  fontProbe, liesProbe, automationProbe, metaProbe,
} from './probes';
import { webrtcProbe } from './webrtc';
import { recall, sessionId, browserHint } from './persist';
import { behaviorCapture } from './behavior';

/**
 * Where beacons go. Both halves are injected at BUILD time from the
 * environment (see .env.example) — deliberately not written in this file,
 * because this repository is public. `PUBLIC_` is Astro/Vite's opt-in for
 * exposing a value to browser code.
 *
 * The path is still obscurity, not cryptographic secrecy: it necessarily
 * ends up inside the shipped JS bundle, so anyone who reads dist/ can find
 * it. It only has to defeat scanners, fuzzers and casual repo readers.
 * Real access control lives on the read side (STATS_PATH + STATS_TOKEN).
 */
const COLLECT_ORIGIN = import.meta.env.PUBLIC_ANALYTICS_ORIGIN ?? '';
const COLLECT_PATH = import.meta.env.PUBLIC_ANALYTICS_COLLECT_PATH ?? '';
const COLLECT_ENDPOINT = COLLECT_ORIGIN && COLLECT_PATH ? `${COLLECT_ORIGIN}${COLLECT_PATH}` : '';

if (!COLLECT_ENDPOINT) {
  // Loud on purpose: a silently dead tracker is worse than a noisy build.
  console.warn(
    '[hacklog] analytics disabled — set PUBLIC_ANALYTICS_ORIGIN and ' +
      'PUBLIC_ANALYTICS_COLLECT_PATH at build time (see .env.example).',
  );
}

const PASSIVE_PROBES = [
  platformProbe, displayProbe, hardwareProbe, environmentProbe,
  codecProbe, voiceProbe, gpuProbe, canvasProbe, audioProbe, domRectProbe,
  fontProbe, liesProbe, automationProbe, metaProbe, webrtcProbe,
];

function bez(s: SignalMap, id: string): unknown {
  return s[id]?.value;
}

function bezStr(s: SignalMap, id: string): string | undefined {
  const v = s[id]?.value;
  if (v == null || v === '') return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch { return undefined; }
}

function bezNum(s: SignalMap, id: string): number | undefined {
  const v = s[id]?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function bezHash(s: SignalMap, id: string): string | undefined {
  const v = s[id]?.value;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function bezArr(s: SignalMap, id: string): string[] | undefined {
  const v = s[id]?.value;
  return Array.isArray(v) && v.length ? v.map(String).slice(0, 8) : undefined;
}

function basePayload(type: BeaconPayload['type']): BeaconPayload {
  return {
    v: 1,
    type,
    vid: window.__hlVid ?? '',
    sid: sessionId() || window.__hlSid || '',
    path: location.pathname,
    ref: document.referrer || '',
    ts: Date.now(),
  };
}

/** Fire-and-forget beacon; text/plain body avoids a CORS preflight. */
function send(payload: BeaconPayload): void {
  if (!COLLECT_ENDPOINT) return;
  try {
    const body = JSON.stringify(payload);
    const blob = new Blob([body], { type: 'text/plain' });
    if (navigator.sendBeacon && navigator.sendBeacon(COLLECT_ENDPOINT, blob)) return;
    // Fallback for old browsers / oversized payloads.
    fetch(COLLECT_ENDPOINT, { method: 'POST', body: blob, keepalive: true, mode: 'no-cors' })
      .catch(() => { /* analytics must never break the page */ });
  } catch { /* analytics must never break the page */ }
}

/** Device/env snapshot from the gathered signals. */
function deviceSnapshot(s: SignalMap): Partial<BeaconPayload> {
  return {
    ua: navigator.userAgent,
    lang: bezStr(s, 'env.locale'),
    languages: bezStr(s, 'platform.languages'),
    tz: bezStr(s, 'env.timezone'),
    local_hour: bezNum(s, 'env.hour'),
    screen: bezStr(s, 'display.resolution'),
    pixel_ratio: bezNum(s, 'display.pixelRatio'),
    refresh_hz: bezNum(s, 'display.refreshHz'),
    cores: bezNum(s, 'hw.cores'),
    mem_gb: bezNum(s, 'hw.memory'),
    net_type: bezStr(s, 'hw.netType'),
    downlink_mbps: bezNum(s, 'hw.downlink'),
    gpu: bezStr(s, 'gpu.renderer'),
    canvas_hash: bezHash(s, 'canvas.hash'),
    audio_hash: bezHash(s, 'audio.hash'),
    fonts_count: bezNum(s, 'fonts.count'),
    fonts_hash: bezHash(s, 'fonts.hash'),
    os_hint: bezStr(s, 'fonts.impliedOS'),
    os_version_hint: bezStr(s, 'fonts.impliedOSVersion'),
    browser_hint: browserHint(s),
    engine_hint: bezStr(s, 'lies.jsEngine'),
    bot_score: bezNum(s, 'bot.score'),
    color_scheme: (bezStr(s, 'env.colorScheme') === 'dark' ? 'dark' : 'light'),
    reduced_motion: bez(s, 'env.reducedMotion') === true,
    touch_points: bezNum(s, 'hw.touchPoints'),
    codec_hash: bezHash(s, 'codecs.hash'),
    voices_hash: bezHash(s, 'voices.hash'),
    domrect_hash: bezHash(s, 'domrect.hash'),
    webgl_params_hash: bezHash(s, 'gpu.paramsHash'),
    rtc_local_ips: bezArr(s, 'webrtc.localIPs'),
    rtc_public_ip: (bezStr(s, 'webrtc.publicIP') ?? null) as string | null,
    rtc_mdns_protected: bez(s, 'webrtc.mdnsProtected') === true,
  };
}

async function main(): Promise<void> {
  // Behaviour watching starts immediately so it accumulates during probe time.
  behaviorCapture.attach();

  const signals = await runProbes(PASSIVE_PROBES);

  // Resolve visitor identity (reads + re-seeds the multi-backend tag).
  const visit = await recall(signals);
  window.__hlVid = visit.vid;
  window.__hlSid = sessionId();

  // Beacon 1: pageview + device snapshot.
  send({ ...basePayload('pageview'), ...deviceSnapshot(signals) });

  // Beacon 2: engagement, flushed when the page is hidden for the last time.
  const flush = () => {
    if (document.visibilityState !== 'hidden') return;
    // Only ever flushed once per load — remove after firing.
    document.removeEventListener('visibilitychange', onVis);
    send({ ...basePayload('engagement'), final: true, ...behaviorCapture.engagement() });
  };
  const onVis = () => flush();
  document.addEventListener('visibilitychange', onVis);
  // Belt and braces: mobile Safari sometimes skips visibilitychange on close.
  addEventListener('pagehide', () => {
    send({ ...basePayload('engagement'), final: true, ...behaviorCapture.engagement() });
  }, { once: true });
}

main().catch(() => { /* analytics must never break the page */ });

// Ambient declarations for the identity handoff between modules.
declare global {
  interface Window {
    __hlVid?: string;
    __hlSid?: string;
  }
}
