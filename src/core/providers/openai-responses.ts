import type { ProviderResult, SseEvent } from "../types";
import { Builder, errorText, normalizeFinish, num, tryParse } from "./util";

// Lifecycle events that carry no output and are not worth a warning.
const QUIET = /^response\.(created|queued|in_progress|content_part\.|output_text\.done|function_call_arguments\.done|reasoning)/;

/** OpenAI Responses API semantic events (type names start with "response."). */
export function assembleOpenAIResponses(events: SseEvent[]): ProviderResult {
  const b = new Builder();
  events.forEach((ev, i) => {
    const j = tryParse(ev.data);
    if (!j) return;
    const type: string = j.type ?? ev.event ?? "";
    switch (type) {
      case "response.output_text.delta":
        b.addText(i, j.delta);
        break;
      case "response.reasoning_summary_text.delta":
      case "response.reasoning_text.delta":
        b.addReasoning(i, j.delta);
        break;
      case "response.output_item.added":
      case "response.output_item.done": {
        const item = j.item ?? {};
        if (item.type === "function_call") {
          const key = String(j.output_index ?? item.id ?? "0");
          b.tool(key, { id: item.call_id ?? item.id, name: item.name });
          // The done item carries the full arguments; use it only if no deltas arrived.
          if (type.endsWith("done") && typeof item.arguments === "string" && !b.hasArgs(key)) {
            b.setArgs(i, key, item.arguments);
          }
        }
        break;
      }
      case "response.function_call_arguments.delta":
        b.addArgs(i, String(j.output_index ?? j.item_id ?? "0"), j.delta);
        break;
      case "response.completed":
      case "response.incomplete":
      case "response.failed": {
        const r = j.response ?? {};
        if (type === "response.failed") {
          b.errors.push(errorText(r.error ?? "response.failed"));
          b.finish = { raw: "failed", normalized: "error" };
        } else if (type === "response.incomplete") {
          const reason = r.incomplete_details?.reason ?? "incomplete";
          const n = normalizeFinish(reason);
          b.finish = { raw: reason, normalized: n === "other" ? "length" : n };
        } else {
          b.finish = { raw: "completed", normalized: b.hasTools() ? "tool_calls" : "stop" };
        }
        const u = r.usage;
        if (u && typeof u === "object") {
          b.usage = { raw: u, input: num(u.input_tokens), output: num(u.output_tokens), total: num(u.total_tokens) };
        }
        break;
      }
      case "error":
        b.errors.push(errorText(j.error ?? j));
        break;
      default:
        if (type && !QUIET.test(type)) b.unknownEvent(type);
    }
  });
  return b.result();
}
