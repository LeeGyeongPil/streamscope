import { MARK, type BacklogRequest, type PagePost, type RelayMessage } from "../bridge/protocol";
import { CaptureStore } from "../bridge/store";

/** The slice of the chrome / window APIs the relay needs (so tests can fake them). */
export type RelayDeps = {
  win: {
    addEventListener(type: "message", fn: (ev: { source: unknown; data: unknown }) => void): void;
  };
  /** The relay's own window; only messages whose source is this window are accepted. */
  self: unknown;
  runtime: {
    sendMessage(msg: RelayMessage): Promise<unknown> | void;
    onMessage: { addListener(fn: (msg: unknown) => void): void };
  };
  isTop: boolean;
};

/**
 * ISOLATED-world relay: validates page messages, keeps this frame's capped
 * buffer (so a panel opened later can ask for a backlog) and forwards live data.
 */
export function startRelay(deps: RelayDeps): CaptureStore {
  const store = new CaptureStore();
  const send = (m: RelayMessage) => {
    try {
      const r = deps.runtime.sendMessage(m);
      if (r && typeof (r as Promise<unknown>).catch === "function") (r as Promise<unknown>).catch(() => {});
    } catch {
      // Extension was reloaded or the worker is unavailable; nothing to do.
    }
  };

  deps.win.addEventListener("message", (ev) => {
    if (ev.source !== deps.self) return; // only our own window
    const d = ev.data as Partial<PagePost> | null;
    if (!d || typeof d !== "object" || d[MARK] !== 1 || !Array.isArray(d.messages)) return;
    for (const m of d.messages) store.apply(m);
    send({ type: "streamscope:msgs", messages: d.messages });
  });

  deps.runtime.onMessage.addListener((msg) => {
    if ((msg as BacklogRequest | null)?.type === "streamscope:backlog-request") {
      send({ type: "streamscope:backlog", captures: store.snapshot() });
    }
  });

  // A fresh top-level page load means the previous page's streams are gone.
  if (deps.isTop) send({ type: "streamscope:reset" });
  return store;
}

if (typeof chrome !== "undefined" && chrome.runtime?.id && typeof window !== "undefined") {
  startRelay({
    win: window,
    self: window,
    runtime: chrome.runtime as unknown as RelayDeps["runtime"],
    isTop: window === window.top,
  });
}
