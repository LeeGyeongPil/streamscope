import { detectProvider } from "./detect";
import { assembleAiSdkUi } from "./providers/ai-sdk-ui";
import { assembleAnthropic } from "./providers/anthropic";
import { assembleGemini } from "./providers/gemini";
import { assembleOpenAIChat } from "./providers/openai-chat";
import { assembleOpenAIResponses } from "./providers/openai-responses";
import { parseSSE } from "./sse";
import type { Assembled, Capture, Notice, ProviderResult } from "./types";

/** Rebuild the final message, tool calls, finish reason and usage from a capture. */
export function assemble(capture: Capture): Assembled {
  const events = parseSSE(capture.chunks);
  const provider = detectProvider(events, capture.headers);
  let r: ProviderResult;
  switch (provider) {
    case "openai-chat":
      r = assembleOpenAIChat(events);
      break;
    case "openai-responses":
      r = assembleOpenAIResponses(events);
      break;
    case "anthropic":
      r = assembleAnthropic(events);
      break;
    case "gemini":
      r = assembleGemini(events);
      break;
    case "ai-sdk-ui":
      r = assembleAiSdkUi(events);
      break;
    default:
      r = {
        text: "",
        reasoning: "",
        tools: [],
        finish: null,
        usage: null,
        errors: [],
        warnings: [],
        notices: [],
        firstOutputEvent: events.length ? 0 : null,
      };
  }
  const note = (n: Notice) => {
    (n.level === "error" ? r.errors : r.warnings).push(n.text);
    r.notices.push(n);
  };
  if (provider === "unknown" && events.length) {
    note({ level: "warning", code: "unknownFormat", text: "Unknown stream format: showing raw events and timing only" });
  }
  if (capture.end?.status === "error") {
    const arg = capture.end.message ?? "network error";
    note({ level: "error", code: "streamFailed", arg, text: `Stream failed: ${arg}` });
  }
  if (capture.end?.status === "aborted") {
    note({ level: "warning", code: "aborted", text: "Stream was aborted before it finished" });
  }
  if (capture.truncated) {
    note({ level: "warning", code: "truncated", text: "Capture truncated: size limit reached, later chunks are not stored" });
  }
  return { provider, ...r, eventCount: events.length };
}
