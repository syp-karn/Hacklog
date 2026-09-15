/**
 * Cookieless visitor identification for Hacklog analytics.
 *
 * A visitor ID = fingerprint digest ⊕ random per-device ID, stored across
 * four backends at once (localStorage, sessionStorage, IndexedDB, Cache
 * Storage). Clearing any one backend leaves the others holding the same
 * vid; the next visit re-seeds the wiped ones. No cookies — the evercookie
 * pattern from the reference site, reduced to a durable pseudonymous tag.
 *
 * Session IDs regenerate after 30 idle minutes (sessionStorage survives
 * page reloads within a tab but is cleared when the tab closes, so we
 * ALSO time-decay it via a timestamp to behave like an analytics session).
 */

import { hash } from './util';
import type { SignalMap } from './types';

const KEY = 'hl.v1';
const DB = 'hl-analytics';
const STORE = 'kv';
const CACHE = 'hl-analytics-v1';
const CACHE_URL = '/__hl_id';
const SESSION_IDLE_MS = 30 * 60 * 1000;

export interface Visit {
  vid: string;
  first: number;
  count: number;
  persisted: boolean;
}

interface Stored {
  vid: string;
  first: number;
  count: number;
  /** last active time, for session idle expiry */
  seen: number;
  /** current session id */
  sid: string;
}

function randomId(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Stable short digest of the fingerprintable signals (before random ⊕). */
export function fingerprintDigest(signals: SignalMap): string {
  const STABLE = [
    'gpu.renderer', 'canvas.hash', 'audio.hash', 'fonts.hash',
    'display.resolution', 'display.pixelRatio', 'hw.cores', 'hw.memory',
    'platform.os', 'voices.hash', 'codecs.hash', 'deep.mathHash',
  ];
  const parts = STABLE.map((id) => `${id}=${signals[id]?.value ?? ''}`);
  return hash(parts.join('|'));
}

/** Browser+OS short label for the visitors table. */
export function browserHint(signals: SignalMap): string {
  const ua = String(signals['platform.ua']?.value ?? '');
  const engine = String(signals['lies.jsEngine']?.value ?? '');
  const brand = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Unknown';
  return engine === 'unknown' ? brand : `${brand} (${engine})`;
}

// ---- backends -------------------------------------------------------------

interface Backend {
  name: string;
  get(): Promise<string | null>;
  set(v: string): Promise<void>;
  del(): Promise<void>;
}

const local: Backend = {
  name: 'localStorage',
  async get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  async set(v) { try { localStorage.setItem(KEY, v); } catch { /* blocked */ } },
  async del() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
};

const session: Backend = {
  name: 'sessionStorage',
  async get() { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  async set(v) { try { sessionStorage.setItem(KEY, v); } catch { /* blocked */ } },
  async del() { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } },
};

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const indexed: Backend = {
  name: 'IndexedDB',
  async get() {
    try {
      const db = await idb();
      return await new Promise<string | null>((resolve) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        r.onsuccess = () => resolve((r.result as string) ?? null);
        r.onerror = () => resolve(null);
      });
    } catch { return null; }
  },
  async set(v) {
    try {
      const db = await idb();
      db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, KEY);
    } catch { /* ignore */ }
  },
  async del() {
    try {
      const db = await idb();
      db.transaction(STORE, 'readwrite').objectStore(STORE).delete(KEY);
    } catch { /* ignore */ }
  },
};

const cacheApi: Backend = {
  name: 'Cache Storage',
  async get() {
    try {
      const c = await caches.open(CACHE);
      const res = await c.match(CACHE_URL);
      return res ? await res.text() : null;
    } catch { return null; }
  },
  async set(v) {
    try {
      const c = await caches.open(CACHE);
      await c.put(CACHE_URL, new Response(v));
    } catch { /* ignore */ }
  },
  async del() { try { await caches.delete(CACHE); } catch { /* ignore */ } },
};

const BACKENDS = [local, session, indexed, cacheApi];

async function writeAll(rec: Stored): Promise<void> {
  const payload = JSON.stringify(rec);
  await Promise.all(BACKENDS.map((b) => b.set(payload)));
}

/**
 * Resolve the visitor identity: read every backend, adopt the strongest
 * survivor (highest visit count — the copy that has been around longest),
 * re-seed wiped backends, and roll a fresh session id if >30 min idle.
 */
export async function recall(signals: SignalMap): Promise<Visit> {
  const digest = fingerprintDigest(signals);

  const found = await Promise.all(BACKENDS.map(async (b) => ({ backend: b, raw: await b.get() })));
  const persisted = found.some((f) => f.raw);

  let record: Stored | null = null;
  let bestCount = -1;
  for (const f of found) {
    if (!f.raw) continue;
    try {
      const parsed = JSON.parse(f.raw) as Stored;
      if (parsed?.vid && parsed.count > bestCount) {
        record = parsed;
        bestCount = parsed.count;
      }
    } catch { /* corrupt copy, try next backend */ }
  }

  const now = Date.now();
  let visit: Visit;
  let rec: Stored;

  if (record) {
    const newSession = !record.sid || now - (record.seen ?? 0) > SESSION_IDLE_MS;
    rec = {
      vid: record.vid,
      first: record.first,
      count: newSession ? record.count + 1 : record.count,
      seen: now,
      sid: newSession ? randomId() : record.sid,
    };
    visit = { vid: rec.vid, first: rec.first, count: rec.count, persisted };
  } else {
    // vid = fingerprint ⊕ random: stable per device+browser, unique per install.
    const vid = `${digest}${randomId()}`;
    rec = { vid, first: now, count: 1, seen: now, sid: randomId() };
    visit = { vid, first: now, count: 1, persisted };
  }

  await writeAll(rec);
  currentSessionId = rec.sid;
  currentVisitCount = rec.count;
  currentFirstSeen = rec.first;
  return visit;
}

// Module-level session context for the beacon builder.
let currentSessionId = '';
let currentVisitCount = 1;
let currentFirstSeen = 0;

export function sessionId(): string {
  return currentSessionId;
}

export function visitCount(): number {
  return currentVisitCount;
}

export function firstSeen(): number {
  return currentFirstSeen;
}
