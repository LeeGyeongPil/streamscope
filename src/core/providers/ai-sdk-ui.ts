import type { NormalizedFinish, ProviderResult, SseEvent } from "../types";
import { Builder, errorText, tryParse } from "./util";

function finishKind(raw: string): NormalizedFinish {
  if (raw === "finish" || raw === "stop") return "stop";
  if (raw === "tool-calls") return "tool_calls";
  if (raw === "length") return "length";
  if (raw === "error") return "error";
  return "other";
}

/** Vercel AI SDK UI message stream (v1 protocol, JSON parts over SSE). */
export function assembleAiSdkUi(events: SseEvent[]): ProviderResult {
  const b = new Builder();
  events.forEach((ev, i) => {
    const j = tryParse(ev.data);
    if (!j) return;
    switch (j.type) {
      case "text-delta":
        b.addText(i, j.delta);
        break;
      case "reasoning-delta":
        b.addReasoning(i, j.delta);
        break;
      case "tool-input-start":
        b.tool(String(j.toolCallId), { id: j.toolCallId, name: j.toolName });
        break;
      case "tool-input-delta":
        b.addArgs(i, String(j.toolCallId), j.inputTextDelta);
        break;
      case "tool-input-available": {
        const key = String(j.toolCallId);
        b.tool(key, { id: j.toolCallId, name: j.toolName });
        if (!b.hasArgs(key) && j.input !== undefined) b.setArgs(i, key, JSON.stringify(j.input));
        break;
      }
      case "finish": {
        const raw = typeof j.finishReason === "string" ? j.finishReason : "finish";
        b.finish = { raw, normalized: finishKind(raw) };
        break;
      }
      case "error":
        b.errors.push(errorText(j.errorText ?? j));
        break;
      case "start":
      case "start-step":
      case "finish-step":
      case "text-start":
      case "text-end":
      case "reasoning-start":
      case "reasoning-end":
      case "tool-output-available":
      case "tool-output-error":
      case "abort":
        break;
      default:
        if (typeof j.type === "string" && !/^(data-|source-|file)/.test(j.type)) b.unknownEvent(j.type);
    }
  });
  return b.result();
}
