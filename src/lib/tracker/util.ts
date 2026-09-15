/**
 * Small helpers: FNV-1a hashing and generic probe plumbing.
 */

import type { Probe, Signal, SignalMap } from './types';

/** FNV-1a, small, fast, dependency-free — same primitive the reference site uses. */
export function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const sig = (id: string, label: string, value: unknown, extra: Partial<Signal> = {}): Signal => ({
  id, label, value, ...extra,
});

/** Wrap a probe so a thrown error becomes an error Signal instead of killing the run. */
async function safeRun(probe: Probe): Promise<Signal[]> {
  const t0 = performance.now();
  try {
    const out = await probe.run();
    const ms = performance.now() - t0;
    return out.map((s) => ({ ...s, ms: s.ms ?? ms }));
  } catch (err) {
    return [
      sig(`${probe.id}.__error`, probe.title, null, {
        error: err instanceof Error ? err.message : String(err),
        ms: performance.now() - t0,
      }),
    ];
  }
}

/**
 * Run probes tier by tier (0 then 1), everything within a tier concurrently.
 * Errors never propagate; a failed probe just yields an error signal.
 */
export async function runProbes(probes: Probe[]): Promise<SignalMap> {
  const all: SignalMap = {};
  for (const tier of [0, 1] as const) {
    const batch = probes.filter((p) => p.tier === tier);
    if (!batch.length) continue;
    await Promise.all(batch.map(async (probe) => {
      const signals = await safeRun(probe);
      for (const s of signals) all[s.id] = s;
    }));
  }
  return all;
}

export { sig };
