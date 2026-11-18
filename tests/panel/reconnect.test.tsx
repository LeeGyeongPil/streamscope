// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PANEL_PORT_PREFIX, type PanelMessage } from "../../src/bridge/protocol";
import { RECONNECT_DELAY_MS, useCaptures } from "../../src/panel/useCaptures";

type FakePort = { name: string; disconnected: boolean; emit(m: PanelMessage): void; drop(): void };

/** chrome.runtime.connect stand-in that remembers every port and lets a test close one like a stopped worker. */
function fakeChrome() {
  const ports: FakePort[] = [];
  const connect = vi.fn(({ name }: { name: string }) => {
    const msg: Array<(m: PanelMessage) => void> = [];
    const dis: Array<() => void> = [];
    const p: FakePort = {
      name,
      disconnected: false,
      emit: (m) => msg.forEach((f) => f(m)),
      drop: () => dis.forEach((f) => f()),
    };
    ports.push(p);
    return {
      name,
      onMessage: { addListener: (f: (m: PanelMessage) => void) => void msg.push(f) },
      onDisconnect: { addListener: (f: () => void) => void dis.push(f) },
      disconnect: () => {
        p.disconnected = true;
      },
    };
  });
  vi.stubGlobal("chrome", { runtime: { connect }, devtools: { inspectedWindow: { tabId: 9 } } });
  return { ports, connect };
}

const start = (id: string): PanelMessage => ({
  type: "streamscope:msgs",
  messages: [{ kind: "start", id, url: `http://x/${id}`, contentType: "text/event-stream", status: 200, headers: {}, headersMs: 1 }],
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("panel reconnects when the service worker closes its port (Q-1)", () => {
  it("opens a new port after a disconnect and keeps receiving", () => {
    const { ports, connect } = fakeChrome();
    const { result } = renderHook(() => useCaptures(""));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(ports[0]!.name).toBe(`${PANEL_PORT_PREFIX}9`);

    act(() => ports[0]!.drop());
    expect(result.current.reconnecting).toBe(true);
    expect(connect).toHaveBeenCalledTimes(1);

    act(() => void vi.advanceTimersByTime(RECONNECT_DELAY_MS + 1));
    expect(connect).toHaveBeenCalledTimes(2);
    expect(result.current.reconnecting).toBe(false);

    act(() => {
      ports[1]!.emit(start("after-restart"));
      vi.advanceTimersByTime(100);
    });
    expect(result.current.captures.map((c) => c.id)).toEqual(["after-restart"]);
  });

  it("keeps earlier captures across a reconnect", () => {
    const { ports } = fakeChrome();
    const { result } = renderHook(() => useCaptures(""));
    act(() => {
      ports[0]!.emit(start("before"));
      vi.advanceTimersByTime(100);
      ports[0]!.drop();
      vi.advanceTimersByTime(RECONNECT_DELAY_MS + 1);
      ports[1]!.emit(start("after"));
      vi.advanceTimersByTime(100);
    });
    expect(result.current.captures.map((c) => c.id)).toEqual(["before", "after"]);
  });

  it("does not reconnect after unmount", () => {
    const { ports, connect } = fakeChrome();
    const { unmount } = renderHook(() => useCaptures(""));
    act(() => ports[0]!.drop());
    unmount();
    vi.advanceTimersByTime(RECONNECT_DELAY_MS * 4);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("closes the port on unmount without scheduling a retry", () => {
    const { ports, connect } = fakeChrome();
    const { unmount } = renderHook(() => useCaptures(""));
    unmount();
    expect(ports[0]!.disconnected).toBe(true);
    vi.advanceTimersByTime(RECONNECT_DELAY_MS * 4);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
