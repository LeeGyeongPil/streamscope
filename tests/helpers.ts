import { buildStream, renderSse } from "../scripts/mock-formats.mjs";
import type { Capture } from "../src/core";

/** Seeded PRNG so "random" cuts are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cut `text` at the given sorted positions into chunks with t = 10 * index + 5. */
export function cutAt(text: string, cuts: number[]): { t: number; text: string }[] {
  const pts = [0, ...cuts, text.length];
  const out: { t: number; text: string }[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    if (pts[i + 1]! > pts[i]!) out.push({ t: out.length * 10 + 5, text: text.slice(pts[i], pts[i + 1]) });
  }
  return out;
}

/** Capture of a mock stream cut into `size`-character chunks, 10 ms apart. */
export function captureOf(format: string, opts: { broken?: boolean; error?: boolean; size?: number } = {}): Capture {
  const s = buildStream(format, opts);
  const size = opts.size ?? 7;
  const cuts: number[] = [];
  for (let p = size; p < s.body.length; p += size) cuts.push(p);
  const chunks = cutAt(s.body, cuts);
  const last = chunks[chunks.length - 1]!.t;
  return {
    id: `t-${format}`,
    url: `http://localhost/api/${format}`,
    contentType: s.contentType,
    headers: { "content-type": s.contentType, ...s.headers },
    headersMs: 3,
    chunks,
    end: { t: last + 1, status: "done" },
  };
}

export { buildStream, renderSse };
