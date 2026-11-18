import type { Capture, Chunk, EndStatus } from "../core/types";

/** Marker property on window.postMessage payloads from the MAIN-world wrapper. */
export const MARK = "__streamscope";

/** Events the page-side wrapper reports about one streaming response. */
export type WrapMsg =
  | {
      kind: "start";
      id: string;
      url: string;
      contentType: string;
      status: number;
      headers: Record<string, string>;
      headersMs: number;
    }
  | { kind: "chunks"; id: string; chunks: Chunk[] }
  | { kind: "end"; id: string; t: number; status: EndStatus; message?: string };

/** window.postMessage payload: MAIN-world wrapper -> ISOLATED relay. */
export type PagePost = { [MARK]: 1; messages: WrapMsg[] };

/** relay -> service worker (chrome.runtime.sendMessage). */
export type RelayMessage =
  | { type: "streamscope:msgs"; messages: WrapMsg[] }
  | { type: "streamscope:backlog"; captures: Capture[] }
  | { type: "streamscope:reset" };

/** service worker -> relay (chrome.tabs.sendMessage). */
export type BacklogRequest = { type: "streamscope:backlog-request" };

/** service worker -> panel port. Same shapes as RelayMessage. */
export type PanelMessage = RelayMessage;

export const PANEL_PORT_PREFIX = "panel:";
