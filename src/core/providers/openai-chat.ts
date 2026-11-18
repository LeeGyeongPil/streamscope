import type { ProviderResult, SseEvent } from "../types";
import { Builder, errorText, normalizeFinish, num, tryParse } from "./util";

/** OpenAI Chat Completions chunks (also used by OpenAI-compatible servers). */
export function assembleOpenAIChat(events: SseEvent[]): ProviderResult {
  const b = new Builder();
  events.forEach((ev, i) => {
    const j = tryParse(ev.data);
    if (!j) return;
    if (j.error) {
      b.errors.push(errorText(j.error));
      return;
    }
    for (const choice of j.choices ?? []) {
      if ((choice.index ?? 0) !== 0) {
        const msg = "Additional choices (n>1) are ignored";
        b.extraChoices(msg);
        continue;
      }
      const d = choice.delta ?? {};
      b.addText(i, d.content);
      b.addReasoning(i, d.reasoning_content ?? d.reasoning);
      for (const tc of d.tool_calls ?? []) {
        const key = String(tc.index ?? 0);
        b.tool(key, { id: tc.id, name: tc.function?.name });
        b.addArgs(i, key, tc.function?.arguments);
      }
      if (choice.finish_reason) {
        b.finish = { raw: choice.finish_reason, normalized: normalizeFinish(choice.finish_reason) };
      }
    }
    if (j.usage && typeof j.usage === "object") {
      const u = j.usage;
      b.usage = { raw: u, input: num(u.prompt_tokens), output: num(u.completion_tokens), total: num(u.total_tokens) };
    }
  });
  return b.result();
}
