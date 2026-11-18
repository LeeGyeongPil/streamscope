import type { Capture } from "../core/types";
import type { PanelMessage, WrapMsg } from "./protocol";

export const LIMITS = {
  maxRequests: 50,
  maxBytes: 5 * 1024 * 1024,
  maxChunks: 20_000,
};

export type Limits = { maxRequests: number; maxBytes: number; maxChunks: number };

const encoder = new TextEncoder();

/**
 * Per-tab capture buffer with hard caps. Pure data structure: used by the
 * relay (buffer for backlog) and by the panel (what it renders).
 */
export class CaptureStore {
  private caps = new Map<string, Capture>();
  private bytes = new Map<string, number>();

  constructor(private limits: Limits = LIMITS) {}

  private evict(): void {
    // Map keeps insertion order, so the first key is the oldest request.
    while (this.caps.size > this.limits.maxRequests) {
      const oldest = this.caps.keys().next().value as string;
      this.caps.delete(oldest);
      this.bytes.delete(oldest);
    }
  }

  apply(msg: WrapMsg): void {
    if (msg.kind === "start") {
      this.caps.set(msg.id, {
        id: msg.id,
        url: msg.url,
        contentType: msg.contentType,
        status: msg.status,
        headers: msg.headers,
        headersMs: msg.headersMs,
        chunks: [],
      });
      this.bytes.set(msg.id, 0);
      this.evict();
      return;
    }
    const cap = this.caps.get(msg.id);
    if (!cap) return; // evicted, or "start" was missed
    if (msg.kind === "chunks") {
      for (const c of msg.chunks) {
        if (cap.truncated) return;
        const size = encoder.encode(c.text).length;
        const used = this.bytes.get(msg.id) ?? 0;
        if (used + size > this.limits.maxBytes || cap.chunks.length >= this.limits.maxChunks) {
          cap.truncated = true;
          return;
        }
        this.bytes.set(msg.id, used + size);
        cap.chunks.push(c);
      }
      return;
    }
    cap.end = { t: msg.t, status: msg.status, ...(msg.message !== undefined ? { message: msg.message } : {}) };
  }

  /** Replace or add whole captures (backlog from a relay). */
  merge(captures: Capture[]): void {
    for (const c of captures) {
      this.caps.set(c.id, c);
      let total = 0;
      for (const ch of c.chunks) total += encoder.encode(ch.text).length;
      this.bytes.set(c.id, total);
    }
    this.evict();
  }

  snapshot(): Capture[] {
    return [...this.caps.values()];
  }

  get(id: string): Capture | undefined {
    return this.caps.get(id);
  }

  get size(): number {
    return this.caps.size;
  }

  reset(): void {
    this.caps.clear();
    this.bytes.clear();
  }
}

/** Apply a service-worker message to a panel-side store (live data, backlog or reset). */
export function applyPanelMessage(store: CaptureStore, msg: PanelMessage): void {
  switch (msg.type) {
    case "streamscope:msgs":
      for (const m of msg.messages) store.apply(m);
      break;
    case "streamscope:backlog":
      store.merge(msg.captures);
      break;
    case "streamscope:reset":
      store.reset();
      break;
  }
}
