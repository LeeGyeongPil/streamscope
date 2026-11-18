import { MARK, type PagePost, type WrapMsg } from "../bridge/protocol";
import { wrapFetch } from "./wrap";

// MAIN-world entry: runs inside the page at document_start, before app code.
// Messages are batched every 16 ms so very fast streams do not flood postMessage.
const w = window as unknown as { __streamscopeInstalled?: boolean; fetch: typeof fetch };

if (!w.__streamscopeInstalled && typeof w.fetch === "function") {
  w.__streamscopeInstalled = true;
  let queue: WrapMsg[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    timer = null;
    const messages = queue;
    queue = [];
    if (messages.length) {
      const payload: PagePost = { [MARK]: 1, messages };
      window.postMessage(payload, window.location.origin === "null" ? "*" : window.location.origin);
    }
  };

  const post = (msg: WrapMsg) => {
    queue.push(msg);
    // Start/end go out promptly (in order); chunk bursts share one timer.
    if (msg.kind !== "chunks") {
      if (timer) clearTimeout(timer);
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, 16);
    }
  };

  w.fetch = wrapFetch(w.fetch.bind(window), post);
}
