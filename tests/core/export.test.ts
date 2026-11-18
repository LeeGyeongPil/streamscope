import { describe, expect, it } from "vitest";
import { ExportFormatError, assemble, parseSSE, toExport, validateExport } from "../../src/core";
import type { Capture } from "../../src/core";
import { toChunks, toResponse } from "../../src/core/replay";
import { buildStream, captureOf } from "../helpers";

/** Read a Response body the way the page wrapper would, producing a Capture. */
async function recapture(res: Response): Promise<Capture> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const chunks: { t: number; text: string }[] = [];
  const t0 = performance.now();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push({ t: performance.now() - t0, text: decoder.decode(value, { stream: true }) });
  }
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => (headers[k] = v));
  return { id: "r", url: "replay", contentType: headers["content-type"] ?? "", headers, headersMs: 0, chunks, end: { t: performance.now() - t0, status: "done" } };
}

describe("export and replay (AC-7)", () => {
  it("builds a streamscope/v1 file without set-cookie", () => {
    const cap = captureOf("anthropic", { broken: true });
    cap.headers["Set-Cookie"] = "sid=secret";
    const exp = toExport(cap, () => new Date("2026-11-18T00:00:00Z"));
    expect(exp.schema).toBe("streamscope/v1");
    expect(exp.exportedAt).toBe("2026-11-18T00:00:00.000Z");
    expect(Object.keys(exp.headers).map((h) => h.toLowerCase())).not.toContain("set-cookie");
    expect(JSON.stringify(exp)).not.toContain("secret");
    expect(validateExport(JSON.parse(JSON.stringify(exp)))).toBeTruthy();
    expect(exp.metrics.chunks).toBe(cap.chunks.length);
  });

  for (const format of ["openai-chat", "anthropic", "openai-responses", "gemini", "ai-sdk-ui"]) {
    it(`${format}: replay at speed 0 re-assembles to the same result`, async () => {
      const cap = captureOf(format);
      const exp = toExport(cap);
      const again = await recapture(toResponse(exp, { speed: 0 }));
      expect(assemble(again)).toEqual(exp.assembled);
      expect(again.chunks.map((c) => c.text).join("")).toBe(buildStream(format).body);
    });
  }

  it("replay keeps recorded gaps at speed 1 (scaled by speed)", async () => {
    const cap = captureOf("gemini", { size: 400 });
    cap.chunks = cap.chunks.map((c, i) => ({ ...c, t: i * 60 }));
    const exp = toExport(cap);
    const t0 = performance.now();
    await recapture(toResponse(exp, { speed: 2 }));
    const took = performance.now() - t0;
    expect(took).toBeGreaterThanOrEqual((cap.chunks.length - 1) * 30 - 15);
    expect(took).toBeLessThan((cap.chunks.length - 1) * 60 + 200);
  });

  it("round-trips through JSON text", () => {
    const exp = toExport(captureOf("openai-chat"));
    const back = validateExport(JSON.parse(JSON.stringify(exp)));
    expect(parseSSE(toChunks(back)).length).toBe(exp.assembled.eventCount);
  });

  it("throws ExportFormatError for files missing required fields", () => {
    const good = JSON.parse(JSON.stringify(toExport(captureOf("gemini"))));
    expect(() => validateExport(null)).toThrow(ExportFormatError);
    expect(() => validateExport({ ...good, schema: "other" })).toThrow(/unsupported schema/);
    for (const key of ["url", "contentType", "headersMs", "headers", "chunks", "assembled", "metrics"]) {
      const bad = { ...good };
      delete bad[key];
      expect(() => validateExport(bad), key).toThrow(ExportFormatError);
    }
    expect(() => validateExport({ ...good, chunks: [{ t: "x", text: 1 }] })).toThrow(/chunks\[0\]/);
  });

  it("toChunks rejects non-exports with a helpful message", () => {
    expect(() => toChunks({} as never)).toThrow(/Not a streamscope export/);
  });
});
