import type { WrapMsg } from "../bridge/protocol";

export type Post = (msg: WrapMsg) => void;
type FetchFn = typeof fetch;

let counter = 0;

function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${counter}`;
}

function isLlmStream(res: Response): boolean {
  const ct = res.headers.get("content-type") ?? "";
  return ct.toLowerCase().includes("text/event-stream") || res.headers.has("x-vercel-ai-ui-message-stream");
}

/** Read a cloned response to the end and report timed chunks. Never throws. */
async function observe(clone: Response, id: string, t0: number, now: () => number, post: Post): Promise<void> {
  try {
    const body = clone.body;
    if (!body) {
      post({ kind: "end", id, t: now() - t0, status: "done" });
      return;
    }
    const reader = body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) post({ kind: "chunks", id, chunks: [{ t: now() - t0, text }] });
    }
    const rest = decoder.decode();
    if (rest) post({ kind: "chunks", id, chunks: [{ t: now() - t0, text: rest }] });
    post({ kind: "end", id, t: now() - t0, status: "done" });
  } catch (err) {
    const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
    const message = err instanceof Error ? err.message : String(err);
    post({ kind: "end", id, t: now() - t0, status: name === "AbortError" ? "aborted" : "error", message });
  }
}

/**
 * Wrap a fetch function so streaming responses are mirrored to `post`.
 * The caller's Response is returned untouched; we only read a clone.
 * Errors from the original fetch propagate unchanged.
 */
export function wrapFetch(orig: FetchFn, post: Post, now: () => number = () => performance.now()): FetchFn {
  const wrapped = async function (this: unknown, ...args: Parameters<FetchFn>): Promise<Response> {
    const t0 = now();
    const res = await Reflect.apply(orig, this, args);
    try {
      if (isLlmStream(res) && !res.bodyUsed) {
        const id = newId();
        const headers: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          headers[k.toLowerCase()] = v;
        });
        const first = args[0];
        const url = res.url || (typeof first === "string" ? first : first instanceof URL ? first.href : (first as Request).url);
        post({
          kind: "start",
          id,
          url,
          contentType: res.headers.get("content-type") ?? "",
          status: res.status,
          headers,
          headersMs: now() - t0,
        });
        // Fire and forget: observing must never delay or break the app.
        void observe(res.clone(), id, t0, now, post);
      }
    } catch {
      // Swallow observer failures; the app still gets its original response.
    }
    return res;
  };
  return wrapped as FetchFn;
}
