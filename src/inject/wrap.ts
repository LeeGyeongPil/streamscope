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

function endStatus(err: unknown): { status: "aborted" | "error"; message: string } {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  const message = err instanceof Error ? err.message : String(err);
  return { status: name === "AbortError" ? "aborted" : "error", message };
}

/**
 * Pass the original body through a pull-based stream that mirrors every chunk to `post`.
 * Cancelling the app's stream cancels the original body too, so the connection closes
 * exactly as it would without the wrapper. Exactly one `end` message is posted.
 */
function observeBody(body: ReadableStream<Uint8Array>, id: string, t0: number, now: () => number, post: Post): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let ended = false;
  const safePost = (msg: WrapMsg): void => {
    try {
      post(msg);
    } catch {
      // Observer failures must never reach the app.
    }
  };
  const finish = (status: "done" | "aborted" | "error", message?: string): void => {
    if (ended) return;
    ended = true;
    const rest = decoder.decode();
    if (rest) safePost({ kind: "chunks", id, chunks: [{ t: now() - t0, text: rest }] });
    safePost(
      message === undefined
        ? { kind: "end", id, t: now() - t0, status }
        : { kind: "end", id, t: now() - t0, status, message },
    );
  };
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            finish("done");
            controller.close();
            return;
          }
          const text = decoder.decode(value, { stream: true });
          if (text) safePost({ kind: "chunks", id, chunks: [{ t: now() - t0, text }] });
          controller.enqueue(value);
        } catch (err) {
          const e = endStatus(err);
          finish(e.status, e.message);
          controller.error(err);
        }
      },
      async cancel(reason) {
        finish("aborted");
        await reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
}

/** Rebuild the response around the observed body, keeping url, redirected and type. */
function rebuild(res: Response, body: ReadableStream<Uint8Array>): Response {
  const out = new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
  for (const key of ["url", "redirected", "type"] as const) {
    Object.defineProperty(out, key, { value: res[key], configurable: true });
  }
  return out;
}

/**
 * Wrap a fetch function so streaming responses are mirrored to `post`.
 * The app gets an equivalent Response (same status, headers, url, bytes) whose body is
 * mirrored to `post`; cancelling it cancels the original connection.
 * Errors from the original fetch propagate unchanged.
 */
export function wrapFetch(orig: FetchFn, post: Post, now: () => number = () => performance.now()): FetchFn {
  const wrapped = async function (this: unknown, ...args: Parameters<FetchFn>): Promise<Response> {
    const t0 = now();
    const res = await Reflect.apply(orig, this, args);
    let result: Response = res;
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
        if (res.body) {
          result = rebuild(res, observeBody(res.body, id, t0, now, post));
        } else {
          post({ kind: "end", id, t: now() - t0, status: "done" });
        }
      }
    } catch {
      // Swallow observer failures; the app still gets its original response.
    }
    return result;
  };
  return wrapped as FetchFn;
}
