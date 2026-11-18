import { tryParse } from "./providers/util";
import type { Provider, SseEvent } from "./types";

const ANTHROPIC_TYPES = new Set([
  "message_start",
  "message_delta",
  "message_stop",
  "content_block_start",
  "content_block_delta",
  "content_block_stop",
  "ping",
]);

const AI_SDK_TYPES = new Set([
  "start",
  "start-step",
  "finish-step",
  "text-start",
  "text-delta",
  "text-end",
  "reasoning-start",
  "reasoning-delta",
  "reasoning-end",
  "tool-input-start",
  "tool-input-delta",
  "tool-input-available",
  "tool-output-available",
  "finish",
]);

/**
 * Decide which provider format a stream uses: headers first, then the shape
 * of the first JSON event. OpenAI-compatible servers look like openai-chat.
 */
export function detectProvider(events: SseEvent[], headers: Record<string, string> = {}): Provider {
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === "x-vercel-ai-ui-message-stream") return "ai-sdk-ui";
  }

  for (const ev of events) {
    const j = tryParse(ev.data);
    if (!j) continue;
    const type = typeof j.type === "string" ? j.type : ev.event;
    if (type && ANTHROPIC_TYPES.has(type)) return "anthropic";
    if (type === "error" && j.error && typeof j.error === "object" && "type" in j.error) return "anthropic";
    if (typeof type === "string" && type.startsWith("response.")) return "openai-responses";
    if (type && AI_SDK_TYPES.has(type)) return "ai-sdk-ui";
    if (Array.isArray(j.candidates) || "usageMetadata" in j || "promptFeedback" in j) return "gemini";
    if (Array.isArray(j.choices) || j.object === "chat.completion.chunk") return "openai-chat";
  }
  return "unknown";
}
