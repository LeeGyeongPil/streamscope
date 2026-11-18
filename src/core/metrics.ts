import { parseSSE } from "./sse";
import type { Assembled, Capture, Metrics } from "./types";

const encoder = new TextEncoder();

export type MetricsOptions = { stallMs?: number };

/** Latency numbers from chunk arrival times (all in ms since fetch() started). */
export function computeMetrics(capture: Capture, assembled: Assembled, opts: MetricsOptions = {}): Metrics {
  const stallMs = opts.stallMs ?? 1000;
  const { chunks } = capture;

  let ttftMs: number | null = null;
  if (assembled.firstOutputEvent !== null) {
    const ev = parseSSE(chunks)[assembled.firstOutputEvent];
    ttftMs = ev ? ev.t : null;
  }

  let maxGapMs = 0;
  let maxGapAfterChunk = -1;
  let stalls = 0;
  for (let i = 1; i < chunks.length; i++) {
    const gap = chunks[i]!.t - chunks[i - 1]!.t;
    if (gap > maxGapMs || maxGapAfterChunk === -1) {
      maxGapMs = gap;
      maxGapAfterChunk = i - 1;
    }
    if (gap >= stallMs) stalls++;
  }

  const lastT = chunks.length ? chunks[chunks.length - 1]!.t : capture.headersMs;
  let bytes = 0;
  for (const c of chunks) bytes += encoder.encode(c.text).length;

  return {
    headersMs: capture.headersMs,
    ttftMs,
    maxGapMs,
    maxGapAfterChunk,
    stalls,
    totalMs: capture.end ? capture.end.t : lastT,
    chunks: chunks.length,
    events: assembled.eventCount,
    bytes,
  };
}
