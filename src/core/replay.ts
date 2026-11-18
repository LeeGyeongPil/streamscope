/**
 * Dependency-free replay helper. Copy this single file into your own project
 * to feed an exported streamscope/v1 stream to your parser in tests.
 */
export type ReplayChunk = { t: number; text: string };
export type ReplayExport = {
  schema: "streamscope/v1";
  contentType: string;
  status?: number;
  headers: Record<string, string>;
  chunks: ReplayChunk[];
  end?: { t: number; status: "done" | "aborted" | "error"; message?: string };
};

export function toChunks(exp: ReplayExport): ReplayChunk[] {
  if (!exp || exp.schema !== "streamscope/v1" || !Array.isArray(exp.chunks)) {
    throw new Error('Not a streamscope export: expected { schema: "streamscope/v1", chunks: [...] }');
  }
  return exp.chunks;
}

/**
 * Build a streaming `Response` from an export. `speed` 1 keeps the recorded
 * gaps, 2 is twice as fast, 0 delivers everything immediately.
 */
export function toResponse(exp: ReplayExport, opts: { speed?: number } = {}): Response {
  const speed = opts.speed ?? 1;
  const chunks = toChunks(exp);
  const encoder = new TextEncoder();
  let i = 0;
  let prevT = chunks.length ? chunks[0]!.t : 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      const c = chunks[i++]!;
      if (speed > 0 && c.t > prevT) await new Promise((r) => setTimeout(r, (c.t - prevT) / speed));
      prevT = c.t;
      controller.enqueue(encoder.encode(c.text));
    },
  });
  const headers = new Headers(exp.headers);
  if (!headers.has("content-type")) headers.set("content-type", exp.contentType || "text/event-stream");
  return new Response(body, { status: exp.status ?? 200, headers });
}
