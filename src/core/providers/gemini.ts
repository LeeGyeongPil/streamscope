import type { ProviderResult, SseEvent } from "../types";
import { Builder, errorText, normalizeFinish, num, tryParse } from "./util";

/** Gemini `streamGenerateContent?alt=sse` chunks. */
export function assembleGemini(events: SseEvent[]): ProviderResult {
  const b = new Builder();
  let toolCount = 0;
  events.forEach((ev, i) => {
    const j = tryParse(ev.data);
    if (!j) return;
    if (j.error) {
      b.errors.push(errorText(j.error));
      return;
    }
    const cands: any[] = j.candidates ?? [];
    if (cands.length > 1) {
      const msg = "Additional candidates are ignored";
      b.extraChoices(msg);
    }
    const c = cands[0];
    if (c) {
      for (const part of c.content?.parts ?? []) {
        if (typeof part.text === "string") {
          if (part.thought) b.addReasoning(i, part.text);
          else b.addText(i, part.text);
        } else if (part.functionCall) {
          // Gemini sends function arguments complete, not as fragments.
          const key = String(toolCount++);
          b.tool(key, { id: part.functionCall.id, name: part.functionCall.name });
          b.setArgs(i, key, JSON.stringify(part.functionCall.args ?? {}));
        }
      }
      if (c.finishReason) b.finish = { raw: c.finishReason, normalized: normalizeFinish(c.finishReason) };
    }
    const u = j.usageMetadata;
    if (u && typeof u === "object") {
      b.usage = { raw: u, input: num(u.promptTokenCount), output: num(u.candidatesTokenCount), total: num(u.totalTokenCount) };
    }
  });
  return b.result();
}
