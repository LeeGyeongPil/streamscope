import type { Capture } from "../core";
import { buildStream } from "../../scripts/mock-formats.mjs";

/** A capture of a mock stream cut into 7-byte chunks, with an optional pause midway. */
function demo(id: string, format: string, opts: { broken?: boolean; error?: boolean; stallMs?: number; headersMs?: number } = {}): Capture {
  const s = buildStream(format, { broken: opts.broken, error: opts.error });
  const headersMs = opts.headersMs ?? 120;
  const chunks: Capture["chunks"] = [];
  let t = headersMs + 60;
  const total = Math.ceil(s.body.length / 7);
  for (let i = 0; i < total; i++) {
    if (opts.stallMs && i === Math.floor(total / 2)) t += opts.stallMs;
    chunks.push({ t: Math.round(t), text: s.body.slice(i * 7, i * 7 + 7) });
    t += 12;
  }
  return {
    id,
    url: `http://localhost:5179/api/${format}`,
    contentType: s.contentType,
    status: 200,
    headers: { "content-type": s.contentType, ...s.headers },
    headersMs,
    chunks,
    end: { t: Math.round(t), status: "done" },
  };
}

/** Built-in captures for `panel.html?demo=1` (no chrome APIs needed). */
export function demoCaptures(): Capture[] {
  return [
    demo("demo-openai-chat", "openai-chat", { headersMs: 180 }),
    demo("demo-openai-responses", "openai-responses", { headersMs: 90 }),
    demo("demo-anthropic", "anthropic", { broken: true, stallMs: 250, headersMs: 140 }),
    demo("demo-gemini", "gemini", { headersMs: 60 }),
    demo("demo-ai-sdk", "ai-sdk-ui", { headersMs: 75 }),
  ];
}
