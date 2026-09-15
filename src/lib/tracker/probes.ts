/**
 * Passive device/environment probes for the Hacklog tracker.
 *
 * Ported (condensed) from the "cookie" reference site — tier-0 and tier-1
 * passive probes only. Everything here runs without permissions, prompts,
 * or user-visible side effects, on plain page load.
 */

import type { Probe, Signal } from './types';
import { hash, sig } from './util';

// ---------------------------------------------------------------- platform --

/** UA, Client Hints (high-entropy values are volunteered, no permission). */
export const platformProbe: Probe = {
  id: 'platform',
  title: 'Platform',
  tier: 0,
  async run() {
    const n = navigator as Navigator & {
      userAgentData?: {
        platform?: string;
        mobile?: boolean;
        getHighEntropyValues?: (h: string[]) => Promise<Record<string, unknown>>;
      };
    };

    const out: Signal[] = [
      sig('platform.ua', 'User-Agent', navigator.userAgent),
      sig('platform.platform', 'navigator.platform', navigator.platform),
      sig('platform.languages', 'Languages', navigator.languages, {
        display: navigator.languages?.join(', '),
      }),
      sig('platform.cookieEnabled', 'Cookies enabled', navigator.cookieEnabled),
      sig('platform.webdriver', 'navigator.webdriver', navigator.webdriver ?? false),
    ];

    if (n.userAgentData?.getHighEntropyValues) {
      try {
        const hints = await n.userAgentData.getHighEntropyValues([
          'architecture', 'bitness', 'model', 'platformVersion', 'fullVersionList',
        ]);
        out.push(
          sig('platform.arch', 'CPU architecture', hints.architecture ?? null),
          sig('platform.model', 'Device model', hints.model || null),
          sig('platform.osVersion', 'OS version', hints.platformVersion ?? null),
          sig('platform.fullVersions', 'Full browser versions', hints.fullVersionList ?? null, {
            display: Array.isArray(hints.fullVersionList)
              ? (hints.fullVersionList as Array<{ brand: string; version: string }>)
                  .map((b) => `${b.brand} ${b.version}`).join(', ')
              : undefined,
          }),
        );
      } catch { /* hint request rejected */ }
    }

    return out;
  },
};

// ----------------------------------------------------------------- display --

/** Screen geometry, pixel ratio, and via rAF the actual refresh rate. */
export const displayProbe: Probe = {
  id: 'display',
  title: 'Display',
  tier: 0,
  async run() {
    const s = screen;
    const out: Signal[] = [
      sig('display.resolution', 'Screen resolution', [s.width, s.height], {
        display: `${s.width} × ${s.height}`,
      }),
      sig('display.pixelRatio', 'Device pixel ratio', devicePixelRatio),
      sig('display.colorDepth', 'Colour depth', s.colorDepth),
      sig('display.viewport', 'Viewport', [innerWidth, innerHeight], {
        display: `${innerWidth} × ${innerHeight}`,
      }),
      sig('display.orientation', 'Orientation', s.orientation?.type ?? null),
    ];

    // Refresh rate: sample rAF deltas, take the median (survives dropped frames).
    const hz = await new Promise<number>((resolve) => {
      const times: number[] = [];
      let last = performance.now();
      let frames = 0;
      const tick = (now: number) => {
        times.push(now - last);
        last = now;
        if (++frames < 22) requestAnimationFrame(tick);
        else {
          const sorted = times.slice(2).sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)] || 16.7;
          resolve(Math.round(1000 / median));
        }
      };
      requestAnimationFrame(tick);
      setTimeout(() => resolve(0), 900);
    });
    out.push(sig('display.refreshHz', 'Refresh rate', hz, { display: hz ? `${hz} Hz` : 'unknown' }));

    return out;
  },
};

// ---------------------------------------------------------------- hardware --

/** CPU, memory, input capability, connection quality. */
export const hardwareProbe: Probe = {
  id: 'hw',
  title: 'Hardware',
  tier: 0,
  async run() {
    const n = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    };

    const out: Signal[] = [
      sig('hw.cores', 'CPU cores', navigator.hardwareConcurrency ?? null),
      sig('hw.memory', 'Device memory (GB, bucketed)', n.deviceMemory ?? null),
      sig('hw.touchPoints', 'Max touch points', navigator.maxTouchPoints ?? 0),
      sig('hw.pointerCoarse', 'Coarse pointer', matchMedia('(pointer: coarse)').matches),
      sig('hw.hover', 'Hover capable', matchMedia('(hover: hover)').matches),
    ];

    if (n.connection) {
      out.push(
        sig('hw.netType', 'Connection type', n.connection.effectiveType ?? null),
        sig('hw.downlink', 'Downlink (Mbps)', n.connection.downlink ?? null),
        sig('hw.rtt', 'Round-trip time (ms)', n.connection.rtt ?? null),
        sig('hw.saveData', 'Save-Data', n.connection.saveData ?? null),
      );
    }

    return out;
  },
};

// ------------------------------------------------------------- environment --

/** Timezone, locale quirks, accessibility media queries (dark mode, motion...). */
export const environmentProbe: Probe = {
  id: 'env',
  title: 'Environment',
  tier: 0,
  async run() {
    const dtf = Intl.DateTimeFormat().resolvedOptions();
    const mq = (q: string) => matchMedia(q).matches;

    return [
      sig('env.timezone', 'Timezone', dtf.timeZone),
      sig('env.tzOffset', 'UTC offset (minutes)', -new Date().getTimezoneOffset()),
      sig('env.locale', 'Locale', dtf.locale),
      sig('env.localTime', 'Local time', new Date().toString()),
      sig('env.hour', 'Local hour (0-23)', new Date().getHours()),
      sig('env.colorScheme', 'Prefers colour scheme', mq('(prefers-color-scheme: dark)') ? 'dark' : 'light'),
      sig('env.reducedMotion', 'Prefers reduced motion', mq('(prefers-reduced-motion: reduce)')),
      sig('env.contrast', 'Prefers contrast',
        mq('(prefers-contrast: more)') ? 'more' : mq('(prefers-contrast: less)') ? 'less' : 'no-preference'),
      sig('env.forcedColors', 'Forced colours', mq('(forced-colors: active)')),
      sig('env.colorGamut', 'Colour gamut',
        mq('(color-gamut: rec2020)') ? 'rec2020' : mq('(color-gamut: p3)') ? 'p3' : 'srgb'),
    ];
  },
};

// ------------------------------------------------------------------ codecs --

/** Codec support — a decent proxy for OS version and hardware tier. */
export const codecProbe: Probe = {
  id: 'codecs',
  title: 'Codecs',
  tier: 0,
  async run() {
    const v = document.createElement('video');
    const a = document.createElement('audio');
    const CANDIDATES: Array<[string, string, HTMLMediaElement]> = [
      ['h264', 'video/mp4; codecs="avc1.42E01E"', v],
      ['hevc', 'video/mp4; codecs="hvc1.1.6.L93.B0"', v],
      ['av1', 'video/mp4; codecs="av01.0.08M.08"', v],
      ['vp9', 'video/webm; codecs="vp9"', v],
      ['aac', 'audio/mp4; codecs="mp4a.40.2"', a],
      ['flac', 'audio/flac', a],
      ['opus', 'audio/webm; codecs="opus"', a],
    ];

    const support: Record<string, string> = {};
    for (const [name, type, el] of CANDIDATES) support[name] = el.canPlayType(type) || 'no';

    return [
      sig('codecs.support', 'Codec support', support, {
        display: Object.entries(support).filter(([, r]) => r !== 'no').map(([k]) => k).join(', '),
      }),
      sig('codecs.hash', 'Codec fingerprint', JSON.stringify(support)),
    ];
  },
};

// ------------------------------------------------------------------ voices --

/** Installed speech voices: OS + language-pack fingerprint. */
export const voiceProbe: Probe = {
  id: 'voices',
  title: 'Speech voices',
  tier: 1,
  async run() {
    const voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const got = speechSynthesis.getVoices();
      if (got.length) return resolve(got);
      const t = setTimeout(() => resolve(speechSynthesis.getVoices()), 600);
      speechSynthesis.onvoiceschanged = () => { clearTimeout(t); resolve(speechSynthesis.getVoices()); };
    });

    const names = voices.map((v) => `${v.name}|${v.lang}`);
    const langs = [...new Set(voices.map((v) => v.lang))].sort();

    return [
      sig('voices.count', 'Installed voices', voices.length),
      sig('voices.langs', 'Voice languages', langs, { display: langs.join(', ') }),
      sig('voices.hash', 'Voice list', names, { display: names.slice(0, 8).join(', ') }),
    ];
  },
};

// --------------------------------------------------------------------- gpu --

/** WebGL vendor/renderer + GL parameters; WebGPU adapter info when present. */
export const gpuProbe: Probe = {
  id: 'gpu',
  title: 'GPU',
  tier: 0,
  async run() {
    const out: Signal[] = [];
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null;

    if (!gl) {
      out.push(sig('gpu.vendor', 'GPU vendor', null, { error: 'WebGL unavailable' }));
      return out;
    }

    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

    out.push(
      sig('gpu.vendor', 'GPU vendor', vendor ?? null),
      sig('gpu.renderer', 'GPU renderer', renderer ?? null),
    );

    const params: Record<string, unknown> = {};
    try {
      params.MAX_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      params.MAX_RENDERBUFFER_SIZE = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
      params.SHADING_LANGUAGE_VERSION = gl.getParameter(gl.SHADING_LANGUAGE_VERSION);
      params.VERSION = gl.getParameter(gl.VERSION);
    } catch { /* param unsupported on this driver */ }
    out.push(sig('gpu.paramsHash', 'WebGL parameters (hash)', hash(JSON.stringify(params))));

    return out;
  },
};

// ------------------------------------------------------------------ canvas --

/** 2D canvas fingerprint: mixed-font/emoji text render + shapes, hashed. */
export const canvasProbe: Probe = {
  id: 'canvas',
  title: 'Canvas',
  tier: 1,
  async run() {
    const out: Signal[] = [];
    try {
      const c = document.createElement('canvas');
      c.width = 280;
      c.height = 60;
      const ctx = c.getContext('2d')!;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f60';
      ctx.fillRect(0, 0, 100, 30);
      ctx.fillStyle = '#069';
      ctx.font = '16px "Arial"';
      ctx.fillText('hacklog 🕵️ CW#$%^&*() 1.0', 4, 20);
      ctx.font = 'italic 12px "Times New Roman"';
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('the quick brown fox', 4, 45);
      const grad = ctx.createLinearGradient(0, 0, 280, 0);
      grad.addColorStop(0, 'magenta');
      grad.addColorStop(1, 'cyan');
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.arc(220, 30, 20, 0, Math.PI * 2);
      ctx.stroke();

      out.push(sig('canvas.hash', 'Canvas fingerprint', hash(c.toDataURL())));

      const ref = 'The quick brown Æøå fox jumps 0123456789';
      const m = ctx.measureText(ref);
      out.push(sig('canvas.textMetrics', 'Text metrics', {
        width: m.width,
        ascent: m.actualBoundingBoxAscent,
        descent: m.actualBoundingBoxDescent,
      }));
    } catch (err) {
      out.push(sig('canvas.hash', 'Canvas fingerprint', null, {
        error: err instanceof Error ? err.message : String(err),
      }));
    }
    return out;
  },
};

// ------------------------------------------------------------------- audio --

/** OfflineAudioContext oscillator→compressor fingerprint (inaudible). */
export const audioProbe: Probe = {
  id: 'audio',
  title: 'Audio',
  tier: 1,
  async run() {
    try {
      const Ctx = (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext
        ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      if (!Ctx) throw new Error('OfflineAudioContext unavailable');

      const ctx = new Ctx(1, 44100, 44100);
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 10000;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -50;
      compressor.knee.value = 40;
      compressor.ratio.value = 12;
      compressor.attack.value = 0;
      compressor.release.value = 0.25;

      osc.connect(compressor);
      compressor.connect(ctx.destination);
      osc.start(0);

      const rendered = await Promise.race([
        ctx.startRendering(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000)),
      ]);
      if (!rendered) throw new Error('render timed out');

      const data = rendered.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += Math.abs(data[i]);

      return [
        sig('audio.hash', 'Audio fingerprint', hash(sum.toString())),
        sig('audio.sampleRate', 'Audio sample rate', ctx.sampleRate),
      ];
    } catch (err) {
      return [sig('audio.hash', 'Audio fingerprint', null, {
        error: err instanceof Error ? err.message : String(err),
      })];
    }
  },
};

// ----------------------------------------------------------------- domrect --

/** Sub-pixel layout geometry: rasteriser rounding leaks into rects. */
export const domRectProbe: Probe = {
  id: 'domrect',
  title: 'DOM geometry',
  tier: 1,
  async run() {
    try {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed; left:-9999px; top:-9999px; visibility:hidden;';
      document.body.appendChild(host);

      const specs = [
        'width:33.33px; height:17.7px; transform: rotate(0.3deg) translateX(0.15px);',
        'width:100.1px; height:50.05px; transform: skew(0.2deg, 0.1deg);',
        'width:12.34px; height:56.78px; font-size:13.37px; letter-spacing:0.05px;',
      ];

      const rects: Array<Record<string, number>> = [];
      for (const style of specs) {
        const el = document.createElement('div');
        el.textContent = 'AaBbYyZz';
        el.style.cssText = style;
        host.appendChild(el);
        const r = el.getBoundingClientRect();
        rects.push({ x: r.x, y: r.y, width: r.width, height: r.height });
      }
      document.body.removeChild(host);

      return [sig('domrect.hash', 'DOM geometry fingerprint', hash(JSON.stringify(rects)))];
    } catch (err) {
      return [sig('domrect.hash', 'DOM geometry fingerprint', null, {
        error: err instanceof Error ? err.message : String(err),
      })];
    }
  },
};

// ------------------------------------------------------------------- fonts --

const FONT_CANDIDATES: string[] = [
  // Windows
  'Cambria Math', 'Nirmala UI', 'Segoe UI', 'Segoe Fluent Icons', 'Segoe MDL2 Assets',
  'Calibri', 'Cambria', 'Candara', 'Consolas', 'Constantia', 'Corbel', 'Malgun Gothic',
  'Microsoft YaHei', 'MingLiU-ExtB', 'MS Gothic', 'MS Mincho', 'Myanmar Text', 'SimSun', 'Sylfaen',
  // macOS
  'Helvetica Neue', 'Luminari', 'Galvji', 'Geneva', 'Menlo', '.SF NS', 'Apple Color Emoji',
  'Avenir', 'Avenir Next', 'American Typewriter', 'Baskerville', 'Big Caslon', 'Chalkboard SE',
  'Charter', 'Didot', 'Futura', 'Gill Sans', 'Hoefler Text', 'Marker Felt', 'Monaco', 'Optima',
  'Palatino', 'PingFang SC', 'Skia', 'Zapfino',
  // Linux
  'Ubuntu', 'DejaVu Sans', 'Liberation Sans', 'Noto Color Emoji', 'Cantarell', 'DejaVu Serif',
  'DejaVu Sans Mono', 'Liberation Serif', 'Liberation Mono', 'Noto Sans', 'Noto Serif',
  'FreeSans', 'Nimbus Sans', 'Ubuntu Mono', 'Roboto',
  // Software fingerprints
  'Latin Modern Roman', 'Latin Modern Math', 'CMU Serif', 'TeX Gyre Termes', 'XITS', 'STIX Two Math',
  'Bookman Old Style', 'Book Antiqua', 'Century Gothic', 'Franklin Gothic Medium', 'Rockwell',
  'Myriad Pro', 'Minion Pro', 'Trajan Pro',
  'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Source Code Pro', 'Hack', 'Iosevka',
];

const GENERIC_BASELINES = ['monospace', 'sans-serif', 'serif'] as const;
const PROBE_STRINGS = [
  'mmmmmmmmmmlli-.,WQ@#gjpqy0123456789',
  'ABCDEFabcdef你好こんにちは한국어',
];
const PROBE_SIZE = '72px';
const THRESHOLD = 0.75;
// A name no real system ships; if it "detects", the environment lies.
const SENTINEL = 'ZZName_NoSuchFontEver_9137xQ';

const WINDOWS_TELLS = ['Cambria Math', 'Nirmala UI', 'Segoe UI', 'Segoe Fluent Icons', 'Segoe MDL2 Assets'];
const MACOS_TELLS = ['Helvetica Neue', 'Luminari', 'Galvji', 'Menlo', '.SF NS', 'Apple Color Emoji'];
const LINUX_TELLS = ['Ubuntu', 'DejaVu Sans', 'Liberation Sans', 'Noto Color Emoji', 'Cantarell'];

/** Measure-based font detection (canvas width deltas, no document.fonts.check). */
function detectFonts(candidates: string[]): string[] | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const baseline: Record<string, number[]> = {};
  for (const base of GENERIC_BASELINES) {
    baseline[base] = PROBE_STRINGS.map((str) => {
      ctx.font = `${PROBE_SIZE} ${base}`;
      return ctx.measureText(str).width;
    });
  }

  const present = (name: string): boolean => {
    for (const base of GENERIC_BASELINES) {
      for (let i = 0; i < PROBE_STRINGS.length; i++) {
        ctx.font = `${PROBE_SIZE} "${name}", ${base}`;
        const w = ctx.measureText(PROBE_STRINGS[i]).width;
        if (Math.abs(w - baseline[base][i]) < THRESHOLD) return false;
      }
    }
    return true;
  };

  if (present(SENTINEL)) return null; // environment lies about font availability
  return candidates.filter(present);
}

/** Font list → OS + OS-version inference and a stable font fingerprint. */
export const fontProbe: Probe = {
  id: 'fonts',
  title: 'Fonts',
  tier: 1,
  async run() {
    const detected = detectFonts(FONT_CANDIDATES);
    if (detected === null) {
      return [
        sig('fonts.count', 'Font count', 0),
        sig('fonts.hash', 'Font fingerprint', null, {
          error: 'font detection unreliable in this environment',
        }),
      ];
    }
    const detectedSet = new Set(detected);
    const sorted = [...detected].sort();

    // OS inference: bucket by OS-tell fonts, most hits wins.
    const buckets: Array<{ os: 'windows' | 'macos' | 'linux'; hits: string[] }> = [
      { os: 'windows', hits: WINDOWS_TELLS.filter((f) => detectedSet.has(f)) },
      { os: 'macos', hits: MACOS_TELLS.filter((f) => detectedSet.has(f)) },
      { os: 'linux', hits: LINUX_TELLS.filter((f) => detectedSet.has(f)) },
    ];
    buckets.sort((a, b) => b.hits.length - a.hits.length);

    let impliedOS: 'windows' | 'macos' | 'linux' | 'unknown' = 'unknown';
    if (buckets[0].hits.length > 0 && buckets[0].hits.length > buckets[1].hits.length) {
      impliedOS = buckets[0].os;
    }

    let impliedOSVersion: string | null = null;
    if (detectedSet.has('Segoe Fluent Icons')) impliedOSVersion = 'Windows 11';
    else if (detectedSet.has('Segoe MDL2 Assets')) impliedOSVersion = 'Windows 10';

    return [
      sig('fonts.count', 'Font count', sorted.length),
      sig('fonts.hash', 'Font fingerprint', hash(sorted.join('|'))),
      sig('fonts.impliedOS', 'Implied OS', impliedOS),
      sig('fonts.impliedOSVersion', 'Implied OS version', impliedOSVersion),
    ];
  },
};

// -------------------------------------------------------------------- lies --

/** Tamper/tell checklist: patched natives, injected globals, Brave, engine ID. */
export const liesProbe: Probe = {
  id: 'lies',
  title: 'Lies',
  tier: 0,
  async run() {
    const out: Signal[] = [];
    let tamperCount = 0;

    // Native functions must end in "[native code]" — patched ones don't.
    const fnTargets: Array<[string, unknown]> = [
      ['Function.prototype.toString', Function.prototype.toString],
      ['HTMLCanvasElement.prototype.toDataURL', HTMLCanvasElement.prototype.toDataURL],
      ['WebGLRenderingContext.prototype.getParameter', (window as { WebGLRenderingContext?: { prototype: { getParameter?: unknown } } }).WebGLRenderingContext?.prototype?.getParameter],
      ['Date.prototype.getTimezoneOffset', Date.prototype.getTimezoneOffset],
      ['Element.prototype.getBoundingClientRect', Element.prototype.getBoundingClientRect],
    ];
    for (const [, fn] of fnTargets) {
      try {
        if (typeof fn !== 'function') continue;
        const s = Function.prototype.toString.call(fn);
        if (!/\{\s*\[native code\]\s*\}\s*$/.test(s)) tamperCount++;
      } catch { /* not conclusive */ }
    }
    out.push(sig('lies.tamperCount', 'Tampered native functions', tamperCount));

    // Injected extension globals: diff window against a pristine iframe's.
    try {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed; width:0; height:0; overflow:hidden; visibility:hidden;';
      const iframe = document.createElement('iframe');
      wrap.appendChild(iframe);
      document.body.appendChild(wrap);
      const cleanWin = iframe.contentWindow as (Window & typeof globalThis) | null;
      if (cleanWin) {
        const cleanKeys = new Set(Object.getOwnPropertyNames(cleanWin));
        const win = window as unknown as Record<string, unknown>;
        const litter = Object.getOwnPropertyNames(window).filter((k) => {
          if (cleanKeys.has(k)) return false;
          if (!/^[A-Za-z_$][\w$]*$/.test(k)) return false;
          let v: unknown;
          try { v = win[k]; } catch { return false; }
          if (v == null || v instanceof Node) return false;
          if (typeof HTMLCollection !== 'undefined' && v instanceof HTMLCollection) return false;
          if (typeof NodeList !== 'undefined' && v instanceof NodeList) return false;
          return true;
        });
        out.push(sig('lies.clientLitter', 'Injected window globals', litter.slice(0, 40)));
      }
      document.body.removeChild(wrap);
    } catch { /* ignore */ }

    out.push(sig('lies.brave', 'Brave detected', Boolean((navigator as Navigator & { brave?: unknown }).brave)));

    // JS engine from error-message dialects — unmasks UA spoofing.
    const messages: string[] = [];
    const grab = (f: () => void) => { try { f(); } catch (err) { messages.push(err instanceof Error ? err.message : String(err)); } };
    grab(() => { (null as unknown as Record<number, unknown>)[0]; });
    grab(() => { (1).toFixed(-1); });
    grab(() => { decodeURIComponent('%'); });
    const text = messages.join(' | ');
    const engine = /Cannot read propert(y|ies) of null/i.test(text) || /is not a function/i.test(text) ? 'v8'
      : /null has no properties|can't access property/i.test(text) ? 'spidermonkey'
      : /null is not an object/i.test(text) ? 'javascriptcore'
      : 'unknown';
    out.push(sig('lies.jsEngine', 'JS engine (from error text)', engine));

    return out;
  },
};

// --------------------------------------------------------------------- bot --

/** Weighted headless/automation checklist + VM renderer detection. */
export const automationProbe: Probe = {
  id: 'bot',
  title: 'Automation',
  tier: 0,
  async run() {
    const ua = navigator.userAgent || '';
    const w = window as unknown as Record<string, unknown>;
    let renderer: string | null = null;
    try {
      const c = document.createElement('canvas');
      const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        renderer = (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) as string;
      }
    } catch { /* ignore */ }

    interface Check { hit: boolean; weight: number; }
    const checks: Check[] = [
      { hit: navigator.webdriver === true, weight: 0.9 },
      { hit: /HeadlessChrome/i.test(ua), weight: 0.9 },
      {
        hit: (() => {
          try {
            if (!('Notification' in window) || !navigator.permissions?.query) return false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return Notification.permission === 'denied' && (navigator.permissions.query({ name: 'notifications' as any }) instanceof Promise);
          } catch { return false; }
        })(),
        weight: 0.6,
      },
      { hit: !/Mobi|Android|iPhone|iPad/i.test(ua) && navigator.plugins?.length === 0, weight: 0.35 },
      { hit: /Chrome\//.test(ua) && !/Edg\/|OPR\//.test(ua) && !w.chrome, weight: 0.5 },
      { hit: screen.height === screen.availHeight && innerWidth === screen.width, weight: 0.25 },
      { hit: renderer ? /SwiftShader|llvmpipe/i.test(renderer) : false, weight: 0.5 },
      { hit: navigator.languages?.length === 0, weight: 0.3 },
    ];

    const score = checks.reduce((sum, c) => sum + (c.hit ? c.weight : 0), 0);
    const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
    const normalized = maxScore > 0 ? Math.min(1, score / maxScore) : 0;

    const vmRenderer = renderer ? /VMware|VirtualBox|Parallels|QEMU|virgl/i.test(renderer) : false;

    return [
      sig('bot.score', 'Automation score', +normalized.toFixed(2)),
      sig('bot.headless', 'Likely headless/automated', normalized >= 0.3),
      sig('bot.vm', 'Virtual machine detected', vmRenderer),
    ];
  },
};

// ------------------------------------------------------------------- meta --

/** Session meta: referrer, multiple monitors, storage quota. */
export const metaProbe: Probe = {
  id: 'meta',
  title: 'Session',
  tier: 1,
  async run() {
    const out: Signal[] = [];

    try {
      const ref = document.referrer || '';
      out.push(sig('nav.referrer', 'Referrer', ref || '(none, typed in or bookmarked)'));
    } catch { /* ignore */ }

    try {
      if ('isExtended' in screen) {
        out.push(sig('meta.multiMonitor', 'Multiple screens', (screen as Screen & { isExtended?: boolean }).isExtended === true));
      }
    } catch { /* ignore */ }

    try {
      const est = await navigator.storage?.estimate?.();
      if (est?.quota) {
        out.push(sig('meta.storageQuota', 'Storage quota (bytes)', est.quota));
      }
    } catch { /* ignore */ }

    return out;
  },
};
