import { describe, expect, it } from "vitest";
import { assemble, computeMetrics } from "../../src/core";
import type { Capture } from "../../src/core";

const delta = (s: string) => `data: {"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"${s}"}}]}\n\n`;

function synthetic(): Capture {
  return {
    id: "m",
    url: "http://x",
    contentType: "text/event-stream",
    headers: {},
    headersMs: 40,
    chunks: [
      { t: 100, text: delta("a") },
      { t: 105, text: delta("b") },
      { t: 110, text: delta("c") },
      { t: 360, text: delta("d") },
      { t: 365, text: delta("e") },
    ],
    end: { t: 370, status: "done" },
  };
}

describe("latency metrics (AC-4)", () => {
  it("computes headers, TTFT, max gap, stalls and total", () => {
    const cap = synthetic();
    const a = assemble(cap);
    const m = computeMetrics(cap, a, { stallMs: 200 });
    expect(m).toMatchObject({ headersMs: 40, ttftMs: 100, maxGapMs: 250, maxGapAfterChunk: 2, stalls: 1, totalMs: 370, chunks: 5, events: 5 });
    expect(computeMetrics(cap, a).stalls).toBe(0);
    expect(computeMetrics(cap, a, { stallMs: 1000 }).stalls).toBe(0);
  });

  it("counts bytes as UTF-8", () => {
    const cap = synthetic();
    cap.chunks = [{ t: 1, text: "data: é\n\n" }];
    expect(computeMetrics(cap, assemble(cap)).bytes).toBe(10);
  });

  it("uses the first tool-argument chunk as TTFT when there is no text", () => {
    const cap: Capture = {
      ...synthetic(),
      chunks: [
        { t: 50, text: 'data: {"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}\n\n' },
        {
          t: 120,
          text: 'data: {"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"c","function":{"name":"f","arguments":"{\\"a\\""}}]}}]}\n\n',
        },
      ],
      end: { t: 130, status: "done" },
    };
    expect(computeMetrics(cap, assemble(cap)).ttftMs).toBe(120);
  });

  it("gives ttftMs null when nothing was produced", () => {
    const cap: Capture = { ...synthetic(), chunks: [{ t: 10, text: ": keep-alive\n\n" }], end: { t: 20, status: "done" } };
    const m = computeMetrics(cap, assemble(cap));
    expect(m.ttftMs).toBeNull();
    expect(m.maxGapAfterChunk).toBe(-1);
    expect(m.totalMs).toBe(20);
  });

  it("falls back to the last chunk time while the stream is still open", () => {
    const cap = synthetic();
    delete cap.end;
    expect(computeMetrics(cap, assemble(cap)).totalMs).toBe(365);
  });
});
