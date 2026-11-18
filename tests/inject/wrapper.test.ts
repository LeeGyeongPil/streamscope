import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CaptureStore } from "../../src/bridge/store";
import { assemble, computeMetrics } from "../../src/core";
import { wrapFetch } from "../../src/inject/wrap";
import { createMockServer, FORMATS } from "./server";
import { buildStream } from "../helpers";

let server: Server;
let base = "";

beforeAll(async () => {
  server = createMockServer();
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
});

function observed() {
  const store = new CaptureStore();
  const f = wrapFetch(globalThis.fetch, (m) => store.apply(m));
  return { store, f };
}

async function waitForEnd(store: CaptureStore, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const c = store.snapshot()[0];
    if (c?.end) return c;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("capture did not end in time");
}

describe("wrapFetch does not change the app (AC-5)", () => {
  for (const format of FORMATS) {
    it(`${format}: 7-byte chunks with a 250 ms stall`, async () => {
      const { store, f } = observed();
      const res = await f(`${base}/api/${format}?chunk=7&gap=0&stall=250`);
      const body = new Uint8Array(await res.arrayBuffer());
      const expected = Buffer.from(buildStream(format).body, "utf8");
      // The app reads exactly the bytes the server sent.
      expect(Buffer.compare(Buffer.from(body), expected)).toBe(0);

      const cap = await waitForEnd(store);
      expect(cap.chunks.map((c) => c.text).join("")).toBe(expected.toString("utf8"));
      expect(cap.end?.status).toBe("done");
      expect(cap.status).toBe(200);
      const a = assemble(cap);
      expect(a.provider).toBe(format === "openai-compat" ? "openai-chat" : format);
      expect(a.text.length).toBeGreaterThan(0);
      expect(a.errors).toEqual([]);
      expect(computeMetrics(cap, a).maxGapMs).toBeGreaterThanOrEqual(240);
    });
  }

  it("assembles the same result as the offline fixture", async () => {
    const { store, f } = observed();
    await (await f(`${base}/api/anthropic?chunk=7&gap=0&broken=1`)).text();
    const a = assemble(await waitForEnd(store));
    expect(a.text).toBe("Hi there");
    expect(a.reasoning).toBe("user wants sse");
    const lookup = a.tools.find((t) => t.name === "lookup")!;
    expect(lookup.json.ok).toBe(false);
  });

  it("does not capture non-stream responses", async () => {
    const { store, f } = observed();
    const res = await f(`${base}/api-json`);
    expect(await res.json()).toEqual({ ok: true });
    await new Promise((r) => setTimeout(r, 30));
    expect(store.size).toBe(0);
  });

  it("an app abort stays an AbortError for the app and is recorded as aborted", async () => {
    const { store, f } = observed();
    const ctl = new AbortController();
    const res = await f(`${base}/api/openai-chat?chunk=7&gap=20`, { signal: ctl.signal });
    const reader = res.body!.getReader();
    await reader.read();
    ctl.abort();
    await expect(
      (async () => {
        for (;;) {
          const r = await reader.read();
          if (r.done) return;
        }
      })(),
    ).rejects.toMatchObject({ name: "AbortError" });
    const cap = await waitForEnd(store);
    expect(cap.end?.status).toBe("aborted");
  });

  it("a connection cut mid-stream is recorded as an error", async () => {
    const { store, f } = observed();
    const res = await f(`${base}/api/openai-chat?chunk=7&gap=3&abort=1`);
    await res.text().catch(() => "");
    const cap = await waitForEnd(store);
    expect(cap.end?.status).toBe("error");
    expect(assemble(cap).errors.length).toBe(1);
  });

  it("propagates errors of the original fetch unchanged", async () => {
    const boom = new TypeError("fetch failed: refused");
    const seen: unknown[] = [];
    const f = wrapFetch((async () => {
      throw boom;
    }) as typeof fetch, (m) => seen.push(m));
    await expect(f("http://127.0.0.1:1/x")).rejects.toBe(boom);
    expect(seen).toEqual([]);
  });

  it("never lets a failing observer callback break the app", async () => {
    const f = wrapFetch(globalThis.fetch, () => {
      throw new Error("observer bug");
    });
    const res = await f(`${base}/api/gemini?chunk=50&gap=0`);
    expect(await res.text()).toBe(buildStream("gemini").body);
  });

  it("passes `this` and arguments through to the original fetch", async () => {
    let seenThis: unknown;
    let seenArgs: unknown[] = [];
    const orig = (async function (this: unknown, ...a: unknown[]) {
      seenThis = this;
      seenArgs = a;
      return new Response("x");
    }) as unknown as typeof fetch;
    const f = wrapFetch(orig, () => {});
    const ctx = { name: "ctx" };
    await f.call(ctx as never, "http://a/b", { method: "POST" });
    expect(seenThis).toBe(ctx);
    expect(seenArgs).toEqual(["http://a/b", { method: "POST" }]);
  });
});
