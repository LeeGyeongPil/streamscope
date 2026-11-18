import { assemble, computeMetrics, type Assembled, type Capture, type Metrics } from "../core";

export type Analysis = { assembled: Assembled; metrics: Metrics; status: "streaming" | "done" | "aborted" | "error" };

const cache = new WeakMap<Capture, { sig: string; value: Analysis }>();

/** Assemble + measure a capture, recomputing only when it grew or ended. */
export function analyze(capture: Capture): Analysis {
  const sig = `${capture.chunks.length}:${capture.end?.status ?? "open"}:${capture.truncated ? 1 : 0}`;
  const hit = cache.get(capture);
  if (hit && hit.sig === sig) return hit.value;
  const assembled = assemble(capture);
  const metrics = computeMetrics(capture, assembled);
  const status = assembled.errors.length > 0 ? "error" : (capture.end?.status ?? "streaming");
  const value: Analysis = { assembled, metrics, status };
  cache.set(capture, { sig, value });
  return value;
}
