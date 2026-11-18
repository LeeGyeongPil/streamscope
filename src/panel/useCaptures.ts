import { useEffect, useMemo, useRef, useState } from "react";
import type { Capture } from "../core";
import { PANEL_PORT_PREFIX, type PanelMessage } from "../bridge/protocol";
import { applyPanelMessage, CaptureStore } from "../bridge/store";
import { demoCaptures } from "./demo-data";

export type CaptureSource = { captures: Capture[]; mode: "live" | "demo"; reconnecting: boolean; clear(): void };

/** Wait before reopening the port after the service worker closed it. */
export const RECONNECT_DELAY_MS = 250;

/** Which tab to watch: DevTools' inspected tab, `?tab=<id>`, or none (demo data). */
function resolveTabId(search: string): number | null {
  const c = (globalThis as { chrome?: typeof chrome }).chrome;
  const q = new URLSearchParams(search).get("tab");
  if (q && Number.isInteger(Number(q))) return Number(q);
  const id = c?.devtools?.inspectedWindow?.tabId;
  return typeof id === "number" ? id : null;
}

/**
 * Connects to the service worker for live captures, or serves built-in demo data
 * (`?demo=1`, or whenever there is no chrome extension API).
 */
export function useCaptures(search: string = globalThis.location?.search ?? ""): CaptureSource {
  const demoMode = new URLSearchParams(search).get("demo") === "1";
  const tabId = demoMode ? null : resolveTabId(search);
  const store = useRef(new CaptureStore());
  const [version, setVersion] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (tabId === null) return;
    const c = (globalThis as { chrome?: typeof chrome }).chrome;
    if (!c?.runtime?.connect) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Batch UI updates: streams can deliver hundreds of chunks per second.
    const bump = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setVersion((v) => v + 1);
      }, 50);
    };
    let port: chrome.runtime.Port | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    // MV3 workers are stopped when idle, which closes the port: reopen it. The page-side
    // relay still holds the data and resends it as a backlog on every new connection.
    const connect = () => {
      const p = c.runtime.connect({ name: `${PANEL_PORT_PREFIX}${tabId}` });
      port = p;
      setReconnecting(false);
      p.onMessage.addListener((msg: PanelMessage) => {
        applyPanelMessage(store.current, msg);
        bump();
      });
      p.onDisconnect.addListener(() => {
        if (closed) return;
        port = null;
        setReconnecting(true);
        retry = setTimeout(() => {
          retry = null;
          if (!closed) connect();
        }, RECONNECT_DELAY_MS);
      });
    };
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      if (retry) clearTimeout(retry);
      port?.disconnect();
    };
  }, [tabId]);

  const demo = useMemo(() => (tabId === null ? demoCaptures() : []), [tabId]);
  void version; // re-render trigger; captures are read from the mutable store below
  return {
    captures: tabId === null ? demo : store.current.snapshot(),
    mode: tabId === null ? "demo" : "live",
    reconnecting: tabId !== null && reconnecting,
    clear: () => {
      store.current.reset();
      setVersion((v) => v + 1);
    },
  };
}
