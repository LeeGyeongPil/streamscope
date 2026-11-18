import { PANEL_PORT_PREFIX, type PanelMessage, type RelayMessage } from "../bridge/protocol";

export type PortLike = {
  name: string;
  postMessage(msg: PanelMessage): void;
  onDisconnect: { addListener(fn: () => void): void };
};

export type RouterDeps = {
  runtime: {
    onMessage: { addListener(fn: (msg: unknown, sender: { tab?: { id?: number } }) => void): void };
    onConnect: { addListener(fn: (port: PortLike) => void): void };
  };
  tabs: { sendMessage(tabId: number, msg: unknown): Promise<unknown> | void };
};

/**
 * Stateless router: relay messages go to the panel ports of the same tab only.
 * Data lives in the page-side relay, so a sleeping MV3 worker loses nothing.
 */
export function startRouter(deps: RouterDeps): { portCount(tabId: number): number } {
  const ports = new Map<number, Set<PortLike>>();

  deps.runtime.onConnect.addListener((port) => {
    if (!port.name.startsWith(PANEL_PORT_PREFIX)) return;
    const tabId = Number(port.name.slice(PANEL_PORT_PREFIX.length));
    if (!Number.isInteger(tabId)) return;
    let set = ports.get(tabId);
    if (!set) {
      set = new Set();
      ports.set(tabId, set);
    }
    set.add(port);
    port.onDisconnect.addListener(() => {
      set!.delete(port);
      if (set!.size === 0) ports.delete(tabId);
    });
    // Ask every frame's relay in this tab to resend what it buffered.
    try {
      const r = deps.tabs.sendMessage(tabId, { type: "streamscope:backlog-request" });
      if (r && typeof (r as Promise<unknown>).catch === "function") (r as Promise<unknown>).catch(() => {});
    } catch {
      // Tab without a relay (e.g. chrome:// page): nothing to replay.
    }
  });

  deps.runtime.onMessage.addListener((msg, sender) => {
    const tabId = sender.tab?.id;
    const type = (msg as RelayMessage | null)?.type;
    if (tabId === undefined || typeof type !== "string" || !type.startsWith("streamscope:")) return;
    const set = ports.get(tabId);
    if (!set) return;
    for (const p of set) {
      try {
        p.postMessage(msg as PanelMessage);
      } catch {
        set.delete(p);
      }
    }
  });

  return { portCount: (tabId) => ports.get(tabId)?.size ?? 0 };
}

if (typeof chrome !== "undefined" && chrome.runtime?.id) {
  startRouter({
    runtime: chrome.runtime as unknown as RouterDeps["runtime"],
    tabs: chrome.tabs as unknown as RouterDeps["tabs"],
  });
}
