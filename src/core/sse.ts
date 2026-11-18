import { createParser } from "eventsource-parser";
import type { Chunk, SseEvent } from "./types";

/**
 * Parse SSE from timed chunks. Chunk boundaries may fall anywhere (mid-line,
 * mid-JSON); each event gets the time of the chunk that completed it.
 */
export function parseSSE(chunks: Chunk[]): SseEvent[] {
  const events: SseEvent[] = [];
  let currentT = 0;
  const parser = createParser({
    onEvent(message) {
      const ev: SseEvent = { t: currentT, data: message.data };
      if (message.event !== undefined) ev.event = message.event;
      if (message.id !== undefined) ev.id = message.id;
      events.push(ev);
    },
  });
  for (const chunk of chunks) {
    currentT = chunk.t;
    parser.feed(chunk.text);
  }
  return events;
}
