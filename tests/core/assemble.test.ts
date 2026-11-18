import { describe, expect, it } from "vitest";
import { assemble, detectProvider, parseSSE } from "../../src/core";
import type { Capture } from "../../src/core";
import { captureOf, renderSse } from "../helpers";

const argsOf = (a: ReturnType<typeof assemble>, name: string) => a.tools.find((t) => t.name === name);

describe("provider detection and assembly (AC-2)", () => {
  it("openai-chat: text, tool arguments, finish and usage", () => {
    const a = assemble(captureOf("openai-chat"));
    expect(a.provider).toBe("openai-chat");
    expect(a.text).toBe("Hello world");
    expect(argsOf(a, "get_weather")?.args).toBe('{"city":"Seoul"}');
    expect(argsOf(a, "get_weather")?.json).toEqual({ ok: true, value: { city: "Seoul" } });
    expect(a.finish).toEqual({ raw: "tool_calls", normalized: "tool_calls" });
    expect(a.usage?.total).toBe(21);
    expect(a.usage).toMatchObject({ input: 12, output: 9 });
  });

  it("anthropic: reasoning, text, tool, usage", () => {
    const a = assemble(captureOf("anthropic"));
    expect(a.provider).toBe("anthropic");
    expect(a.text).toBe("Hi there");
    expect(a.reasoning).toBe("user wants sse");
    expect(a.finish?.raw).toBe("tool_use");
    expect(a.usage).toMatchObject({ input: 10, output: 22, total: 32 });
    expect(a.errors).toEqual([]);
    expect(a.warnings).toEqual([]);
  });

  it("openai-responses: text, function call, completed", () => {
    const a = assemble(captureOf("openai-responses"));
    expect(a.provider).toBe("openai-responses");
    expect(a.text).toBe("Sure!");
    expect(argsOf(a, "search")?.args).toBe('{"k":1}');
    expect(a.finish).toEqual({ raw: "completed", normalized: "tool_calls" });
    expect(a.usage?.total).toBe(12);
  });

  it("gemini: complete functionCall arguments and STOP", () => {
    const a = assemble(captureOf("gemini"));
    expect(a.provider).toBe("gemini");
    expect(a.text).toBe("Gemini");
    expect(argsOf(a, "f")?.json).toEqual({ ok: true, value: { x: 1 } });
    expect(a.finish?.raw).toBe("STOP");
    expect(a.usage).toMatchObject({ input: 4, output: 6, total: 10 });
  });

  it("ai-sdk-ui: detected from the response header", () => {
    const cap = captureOf("ai-sdk-ui");
    expect(cap.headers["x-vercel-ai-ui-message-stream"]).toBe("v1");
    const a = assemble(cap);
    expect(a.provider).toBe("ai-sdk-ui");
    expect(a.text).toBe("AI SDK");
    expect(argsOf(a, "weather")?.args).toBe('{"c":"x"}');
  });

  it("ai-sdk-ui: also detected from the part shape when the header is missing", () => {
    const cap = captureOf("ai-sdk-ui");
    cap.headers = {};
    expect(assemble(cap).provider).toBe("ai-sdk-ui");
  });

  it("OpenAI-compatible server (other model name) is openai-chat", () => {
    const a = assemble(captureOf("openai-compat"));
    expect(a.provider).toBe("openai-chat");
    expect(a.text).toBe("Hi there");
    expect(a.finish?.normalized).toBe("stop");
  });

  it("unknown JSON is 'unknown' and raw events stay available", () => {
    const text = renderSse([{ data: '{"foo":1}' }, { data: '{"bar":2}' }]);
    const cap: Capture = {
      id: "u",
      url: "http://x/y",
      contentType: "text/event-stream",
      headers: {},
      headersMs: 1,
      chunks: [{ t: 5, text }],
    };
    const a = assemble(cap);
    expect(a.provider).toBe("unknown");
    expect(a.eventCount).toBe(2);
    expect(a.warnings[0]).toMatch(/Unknown stream format/);
    expect(parseSSE(cap.chunks).map((e) => e.data)).toEqual(['{"foo":1}', '{"bar":2}']);
  });

  it("detectProvider reads the first JSON event and ignores [DONE]", () => {
    expect(detectProvider([{ t: 0, data: "[DONE]" }], {})).toBe("unknown");
    expect(detectProvider([{ t: 0, data: '{"type":"response.created"}' }], {})).toBe("openai-responses");
  });

  it("assembly does not depend on how the stream was chunked", () => {
    for (const f of ["openai-chat", "anthropic", "openai-responses", "gemini", "ai-sdk-ui"]) {
      expect(assemble(captureOf(f, { size: 3 }))).toEqual(assemble(captureOf(f, { size: 1000 })));
    }
  });

  it("surfaces mid-stream error events", () => {
    const a = assemble(captureOf("anthropic", { error: true }));
    expect(a.errors).toEqual(["overloaded_error: Overloaded"]);
    const r = assemble(captureOf("openai-responses", { error: true }));
    expect(r.errors[0]).toMatch(/boom/);
    expect(r.finish?.normalized).toBe("error");
    const o = assemble(captureOf("openai-chat", { error: true }));
    expect(o.errors[0]).toMatch(/server had an error/);
  });

  it("warns about aborted streams and extra choices", () => {
    const cap = captureOf("openai-chat");
    cap.end = { t: 99, status: "aborted" };
    expect(assemble(cap).warnings).toContain("Stream was aborted before it finished");
    const multi: Capture = {
      ...cap,
      end: undefined,
      chunks: [
        {
          t: 1,
          text: renderSse([{ data: '{"object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"a"}},{"index":1,"delta":{"content":"b"}}]}' }]),
        },
      ],
    };
    const a = assemble(multi);
    expect(a.text).toBe("a");
    expect(a.warnings).toContain("Additional choices (n>1) are ignored");
  });
});
