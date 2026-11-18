import { describe, expect, it } from "vitest";
import { MARK, PANEL_PORT_PREFIX, type PanelMessage, type RelayMessage, type WrapMsg } from "../../src/bridge/protocol";
import { applyPanelMessage, CaptureStore, LIMITS } from "../../src/bridge/store";
import { startRelay, type RelayDeps } from "../../src/content/relay";
import { startRouter, type PortLike, type RouterDeps } from "../../src/background/sw";

/** In-memory stand-in for chrome.runtime / chrome.tabs with a service worker and per-tab relays. */
function makeHub() {
  const swMessage: Array<(msg: unknown, sender: { tab?: { id?: number } }) => void> = [];
  const swConnect: Array<(port: PortLike) => void> = [];
  const relayListeners = new Map<number, Array<(msg: unknown) => void>>();

  const swDeps: RouterDeps = {
    runtime: {
      onMessage: { addListener: (fn) => void swMessage.push(fn) },
      onConnect: { addListener: (fn) => void swConnect.push(fn) },
    },
    tabs: {
      sendMessage: async (tabId, msg) => {
        for (const fn of relayListeners.get(tabId) ?? []) fn(msg);
      },
    },
  };
  const router = startRouter(swDeps);

  function addTab(tabId: number, isTop = true) {
    const winListeners: Array<(ev: { source: unknown; data: unknown }) => void> = [];
    const self = { id: `window-${tabId}-${Math.random()}` };
    const deps: RelayDeps = {
      win: { addEventListener: (_t, fn) => void winListeners.push(fn) },
      self,
      runtime: {
        sendMessage: (m: RelayMessage) => {
          for (const fn of swMessage) fn(m, { tab: { id: tabId } });
        },
        onMessage: {
          addListener: (fn) => {
            const list = relayListeners.get(tabId) ?? [];
            list.push(fn);
            relayListeners.set(tabId, list);
          },
        },
      },
      isTop,
    };
    const store = startRelay(deps);
    return {
      store,
      self,
      /** Simulate the page's MAIN-world script posting to its window. */
      post(data: unknown, source: unknown = self) {
        for (const fn of winListeners) fn({ source, data });
      },
    };
  }

  function connectPanel(tabId: number) {
    const store = new CaptureStore();
    const received: PanelMessage[] = [];
    const disconnect: Array<() => void> = [];
    const port: PortLike = {
      name: `${PANEL_PORT_PREFIX}${tabId}`,
      postMessage: (m) => {
        received.push(m);
        applyPanelMessage(store, m);
      },
      onDisconnect: { addListener: (fn) => void disconnect.push(fn) },
    };
    for (const fn of swConnect) fn(port);
    return { store, received, disconnect: () => disconnect.forEach((f) => f()) };
  }

  return { addTab, connectPanel, router };
}

const start = (id: string): WrapMsg => ({ kind: "start", id, url: `http://x/${id}`, contentType: "text/event-stream", status: 200, headers: {}, headersMs: 5 });
const chunk = (id: string, text: string, t = 10): WrapMsg => ({ kind: "chunks", id, chunks: [{ t, text }] });
const end = (id: string): WrapMsg => ({ kind: "end", id, t: 20, status: "done" });
const page = (...messages: WrapMsg[]) => ({ [MARK]: 1, messages });

describe("routing, backlog and caps (AC-6)", () => {
  it("sends tab A captures only to tab A's panel", () => {
    const hub = makeHub();
    const a = hub.addTab(1);
    const b = hub.addTab(2);
    const panelA = hub.connectPanel(1);
    const panelB = hub.connectPanel(2);
    a.post(page(start("a1"), chunk("a1", "data: {}\n\n"), end("a1")));
    expect(panelA.store.snapshot().map((c) => c.id)).toEqual(["a1"]);
    expect(panelB.store.snapshot()).toEqual([]);
    b.post(page(start("b1")));
    expect(panelB.store.snapshot().map((c) => c.id)).toEqual(["b1"]);
    expect(panelA.store.snapshot().map((c) => c.id)).toEqual(["a1"]);
  });

  it("a panel opened after the streams finished gets everything through backlog", () => {
    const hub = makeHub();
    const a = hub.addTab(7);
    a.post(page(start("r1"), chunk("r1", "data: one\n\n"), end("r1")));
    a.post(page(start("r2"), chunk("r2", "data: two\n\n"), end("r2")));
    const panel = hub.connectPanel(7);
    const caps = panel.store.snapshot();
    expect(caps.map((c) => c.id)).toEqual(["r1", "r2"]);
    expect(caps[0]!.chunks[0]!.text).toBe("data: one\n\n");
    expect(caps[1]!.end?.status).toBe("done");
  });

  it("collects backlog from every frame of the tab", () => {
    const hub = makeHub();
    const top = hub.addTab(3, true);
    const frame = hub.addTab(3, false);
    top.post(page(start("t1")));
    frame.post(page(start("f1")));
    const panel = hub.connectPanel(3);
    expect(panel.store.snapshot().map((c) => c.id).sort()).toEqual(["f1", "t1"]);
  });

  it("evicts the oldest request when the 51st arrives", () => {
    const hub = makeHub();
    const a = hub.addTab(1);
    const panel = hub.connectPanel(1);
    for (let i = 1; i <= LIMITS.maxRequests + 1; i++) a.post(page(start(`q${i}`)));
    for (const s of [a.store, panel.store]) {
      const ids = s.snapshot().map((c) => c.id);
      expect(ids.length).toBe(50);
      expect(ids[0]).toBe("q2");
      expect(ids).not.toContain("q1");
    }
    // A later panel's backlog respects the cap too.
    expect(hub.connectPanel(1).store.size).toBe(50);
  });

  it("marks a request over 5 MB as truncated and keeps the first part", () => {
    const store = new CaptureStore();
    store.apply(start("big"));
    const mb = "x".repeat(1024 * 1024);
    for (let i = 0; i < 6; i++) store.apply(chunk("big", mb, i));
    const cap = store.get("big")!;
    expect(cap.truncated).toBe(true);
    expect(cap.chunks.length).toBe(5);
    store.apply(end("big"));
    expect(store.get("big")!.end?.status).toBe("done"); // end is still recorded
  });

  it("marks a request over 20000 chunks as truncated", () => {
    const store = new CaptureStore();
    store.apply(start("many"));
    store.apply({ kind: "chunks", id: "many", chunks: Array.from({ length: LIMITS.maxChunks + 5 }, (_, i) => ({ t: i, text: "a" })) });
    const cap = store.get("many")!;
    expect(cap.truncated).toBe(true);
    expect(cap.chunks.length).toBe(LIMITS.maxChunks);
  });

  it("ignores page messages without the marker or from another window", () => {
    const hub = makeHub();
    const a = hub.addTab(1);
    const panel = hub.connectPanel(1);
    a.post({ messages: [start("no-marker")] });
    a.post({ [MARK]: 2, messages: [start("wrong-marker")] });
    a.post({ [MARK]: 1, messages: "nope" });
    a.post(null);
    a.post("string");
    a.post(page(start("foreign")), { id: "iframe-or-other-window" });
    expect(a.store.size).toBe(0);
    expect(panel.store.size).toBe(0);
    a.post(page(start("ok")));
    expect(panel.store.snapshot().map((c) => c.id)).toEqual(["ok"]);
  });

  it("clears the tab buffer when the page reloads", () => {
    const hub = makeHub();
    const first = hub.addTab(1);
    const panel = hub.connectPanel(1);
    first.post(page(start("old"), end("old")));
    expect(panel.store.size).toBe(1);
    const reloaded = hub.addTab(1); // new top-level page load: fresh relay sends reset
    expect(panel.store.size).toBe(0);
    expect(reloaded.store.size).toBe(0);
  });

  it("a subframe load does not clear the tab", () => {
    const hub = makeHub();
    const top = hub.addTab(1);
    const panel = hub.connectPanel(1);
    top.post(page(start("keep")));
    hub.addTab(1, false);
    expect(panel.store.size).toBe(1);
  });

  it("stops routing to a disconnected panel and drops other-tab ports", () => {
    const hub = makeHub();
    const a = hub.addTab(1);
    const panel = hub.connectPanel(1);
    expect(hub.router.portCount(1)).toBe(1);
    panel.disconnect();
    expect(hub.router.portCount(1)).toBe(0);
    a.post(page(start("late")));
    expect(panel.store.size).toBe(0);
  });
});
