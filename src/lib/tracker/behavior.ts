/**
 * Behavioural capture for Hacklog analytics.
 *
 * Accumulates events over the whole visit and is read at flush time.
 * Everything is passive — pointer motion, scroll, visibility. The reference
 * site's keystroke sampler is deliberately NOT ported (no reason to log
 * typing on a blog).
 */

import type { Signal } from './types';

interface MoveSample { x: number; y: number; t: number; }

class BehaviorCapture {
  private started = performance.now();
  private pointerType: 'mouse' | 'trackpad' | 'touch' | 'pen' | 'none' = 'none';
  private sawTouch = false;
  private sawPen = false;
  private wheels: Array<{ dy: number; mode: number }> = [];
  private moves: MoveSample[] = [];
  private lastMove: MoveSample | null = null;
  private pathLen = 0;
  private clicks = 0;
  private keyboardNavCount = 0;
  private pointerNavCount = 0;
  private maxScroll = 0;
  private tabAways = 0;
  private attached = false;

  attach() {
    if (this.attached) return;
    this.attached = true;

    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') { this.sawTouch = true; this.pointerType = 'touch'; }
      else if (e.pointerType === 'pen') { this.sawPen = true; this.pointerType = 'pen'; }
      else if (this.pointerType === 'none' || this.pointerType === 'mouse') this.pointerType = 'mouse';

      const s = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (this.lastMove) {
        this.pathLen += Math.hypot(s.x - this.lastMove.x, s.y - this.lastMove.y);
      }
      if (this.moves.length < 4000) this.moves.push(s);
      this.lastMove = s;
    }, { passive: true });

    addEventListener('wheel', (e) => {
      if (this.wheels.length < 600) this.wheels.push({ dy: e.deltaY, mode: e.deltaMode });
    }, { passive: true });

    addEventListener('pointerdown', () => { this.clicks++; }, { passive: true });

    addEventListener('keydown', (e) => {
      if (e.key === 'Tab' || e.key === 'Enter' || e.key.startsWith('Arrow')) this.keyboardNavCount++;
    }, { passive: true });

    addEventListener('click', () => { this.pointerNavCount++; }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.tabAways++;
    });

    addEventListener('scroll', () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      if (max > 0) {
        const depth = scrollY / max;
        this.maxScroll = Math.max(this.maxScroll, depth);
      }
    }, { passive: true });
  }

  /** Mouse vs trackpad vs touch from wheel-delta shape (median magnitude). */
  private classifyPointer(): { type: string; why: string } {
    if (this.sawPen) return { type: 'stylus', why: 'pen pointer events' };
    if (this.pointerType === 'touch') return { type: 'touchscreen', why: 'touch pointer events' };

    if (this.wheels.length < 3) return { type: this.pointerType, why: 'barely scrolled' };

    const pixel = this.wheels.filter((w) => w.mode === 0);
    const lineMode = this.wheels.filter((w) => w.mode === 1);
    if (!pixel.length && lineMode.length) return { type: 'mouse', why: 'line-mode wheel notches' };

    const mags = pixel.map((w) => Math.abs(w.dy)).filter((x) => x > 0).sort((a, b) => a - b);
    if (!mags.length) return { type: this.pointerType, why: 'no usable scroll deltas' };
    const median = mags[Math.floor(mags.length / 2)];
    const anyFractional = pixel.some((w) => !Number.isInteger(w.dy));
    const distinct = new Set(pixel.map((w) => Math.abs(Math.round(w.dy)))).size;

    // macOS trackpads emit fractional pixel deltas — a dead giveaway.
    if (anyFractional) return { type: 'trackpad', why: 'fractional scroll deltas' };
    if (median >= 90 && distinct <= 4) return { type: 'mouse', why: 'big repeating wheel notches' };
    return { type: 'trackpad', why: 'small varied scroll deltas' };
  }

  /** Reading-speed estimate from scroll depth over dwell time. */
  private reading(): { wpm: number; depth: number; skimmed: boolean } {
    const depth = Math.min(1, this.maxScroll);
    const words = (document.body.innerText || '').trim().split(/\s+/).length;
    const dwell = (performance.now() - this.started) / 1000 / 60;
    const wordsRead = words * depth;
    const wpm = dwell > 0 ? Math.round(wordsRead / dwell) : 0;
    const skimmed = depth > 0.5 && wpm > 700;
    return { wpm, depth, skimmed };
  }

  snapshot(): Signal[] {
    const p = this.classifyPointer();
    const r = this.reading();

    return [
      { id: 'bhv.pointer', label: 'Pointer device', value: p.type, display: `${p.type} (${p.why})` },
      { id: 'bhv.dwellSec', label: 'Time on page (s)', value: Math.round((performance.now() - this.started) / 1000) },
      { id: 'bhv.scrollDepth', label: 'Scroll depth', value: +r.depth.toFixed(2) },
      { id: 'bhv.wpm', label: 'Reading speed (wpm)', value: r.wpm },
      { id: 'bhv.skimmed', label: 'Skimmed rather than read', value: r.skimmed },
      { id: 'bhv.clicks', label: 'Clicks', value: this.clicks },
      { id: 'bhv.keyboardNav', label: 'Keyboard navigations', value: this.keyboardNavCount },
      { id: 'bhv.pointerNav', label: 'Pointer navigations', value: this.pointerNavCount },
      { id: 'bhv.tabAways', label: 'Times you looked away', value: this.tabAways },
    ];
  }

  /** Plain object form for the engagement beacon. */
  engagement(): {
    dwell_ms: number;
    scroll_depth: number;
    read_wpm: number;
    tab_aways: number;
    clicks: number;
  } {
    const r = this.reading();
    return {
      dwell_ms: Math.round(performance.now() - this.started),
      scroll_depth: +r.depth.toFixed(2),
      read_wpm: r.wpm,
      tab_aways: this.tabAways,
      clicks: this.clicks,
    };
  }

  /** Pointer classification for the device snapshot. */
  pointerClass(): string {
    return this.classifyPointer().type;
  }
}

export const behaviorCapture = new BehaviorCapture();
