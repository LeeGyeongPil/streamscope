import type { ProviderResult, SseEvent } from "../types";
import { Builder, errorText, normalizeFinish, num, tryParse } from "./util";

/** Anthropic Messages streaming events. */
export function assembleAnthropic(events: SseEvent[]): ProviderResult {
  const b = new Builder();
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let rawUsage: Record<string, unknown> = {};
  events.forEach((ev, i) => {
    const j = tryParse(ev.data);
    if (!j) return;
    const type: string = j.type ?? ev.event ?? "";
    switch (type) {
      case "message_start": {
        const u = j.message?.usage;
        if (u) {
          rawUsage = { ...rawUsage, ...u };
          inputTokens = num(u.input_tokens) ?? inputTokens;
          outputTokens = num(u.output_tokens) ?? outputTokens;
        }
        break;
      }
      case "content_block_start": {
        const cb = j.content_block ?? {};
        if (cb.type === "tool_use" || cb.type === "server_tool_use") {
          b.tool(String(j.index), { id: cb.id, name: cb.name });
        }
        break;
      }
      case "content_block_delta": {
        const d = j.delta ?? {};
        if (d.type === "text_delta") b.addText(i, d.text);
        else if (d.type === "thinking_delta") b.addReasoning(i, d.thinking);
        else if (d.type === "input_json_delta") b.addArgs(i, String(j.index), d.partial_json);
        break;
      }
      case "message_delta": {
        const stop = j.delta?.stop_reason;
        if (stop) b.finish = { raw: stop, normalized: normalizeFinish(stop) };
        const u = j.usage;
        if (u) {
          rawUsage = { ...rawUsage, ...u };
          inputTokens = num(u.input_tokens) ?? inputTokens;
          outputTokens = num(u.output_tokens) ?? outputTokens;
        }
        break;
      }
      case "error":
        b.errors.push(errorText(j.error ?? j));
        break;
      case "ping":
      case "content_block_stop":
      case "message_stop":
        break;
      default:
        if (type) b.unknownEvent(type);
    }
  });
  if (inputTokens !== undefined || outputTokens !== undefined) {
    const total = inputTokens !== undefined && outputTokens !== undefined ? inputTokens + outputTokens : undefined;
    b.usage = { raw: rawUsage, input: inputTokens, output: outputTokens, total };
  }
  return b.result();
}
