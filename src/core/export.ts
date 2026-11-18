import { assemble } from "./assemble";
import { computeMetrics } from "./metrics";
import { isSensitiveHeader, redactUrl } from "./redact";
import type { Capture, Chunk, StreamscopeExportV1 } from "./types";

export class ExportFormatError extends Error {
  constructor(message: string) {
    super(`Invalid streamscope export: ${message}`);
    this.name = "ExportFormatError";
  }
}

/** Build the shareable `streamscope/v1` file. secret query values are masked and cookie/auth/account-id response headers are dropped; request data is never stored. */
export function toExport(capture: Capture, now: () => Date = () => new Date()): StreamscopeExportV1 {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(capture.headers)) {
    if (!isSensitiveHeader(k)) headers[k.toLowerCase()] = v;
  }
  const assembled = assemble(capture);
  const out: StreamscopeExportV1 = {
    schema: "streamscope/v1",
    exportedAt: now().toISOString(),
    url: redactUrl(capture.url),
    contentType: capture.contentType,
    headers,
    headersMs: capture.headersMs,
    chunks: capture.chunks.map((c) => ({ t: c.t, text: c.text })),
    assembled,
    metrics: computeMetrics(capture, assembled),
  };
  if (capture.status !== undefined) out.status = capture.status;
  if (capture.end) out.end = { ...capture.end };
  if (capture.truncated) out.truncated = true;
  return out;
}

/** Check an unknown value (e.g. parsed JSON from disk) and return it typed. */
export function validateExport(x: unknown): StreamscopeExportV1 {
  if (!x || typeof x !== "object") throw new ExportFormatError("expected a JSON object");
  const o = x as Record<string, unknown>;
  if (o.schema !== "streamscope/v1") {
    throw new ExportFormatError(`unsupported schema ${JSON.stringify(o.schema)} (expected "streamscope/v1")`);
  }
  if (typeof o.url !== "string") throw new ExportFormatError('missing string field "url"');
  if (typeof o.contentType !== "string") throw new ExportFormatError('missing string field "contentType"');
  if (typeof o.headersMs !== "number") throw new ExportFormatError('missing number field "headersMs"');
  if (!o.headers || typeof o.headers !== "object") throw new ExportFormatError('missing object field "headers"');
  if (!Array.isArray(o.chunks)) throw new ExportFormatError('missing array field "chunks"');
  o.chunks.forEach((c: Chunk, i: number) => {
    if (!c || typeof c.t !== "number" || typeof c.text !== "string") {
      throw new ExportFormatError(`chunks[${i}] must be { t: number, text: string }`);
    }
  });
  if (!o.assembled || typeof o.assembled !== "object") throw new ExportFormatError('missing object field "assembled"');
  if (!o.metrics || typeof o.metrics !== "object") throw new ExportFormatError('missing object field "metrics"');
  return x as StreamscopeExportV1;
}
