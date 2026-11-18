import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MESSAGES, createMockServer, main, resolveLang } from "../../scripts/mock-server.mjs";

describe("mock server language rules (AC-8)", () => {
  it("--lang beats everything", () => {
    expect(resolveLang(["--lang", "ko"], { STREAMSCOPE_LANG: "en", LANG: "en_US.UTF-8" })).toBe("ko");
    expect(resolveLang(["--lang=en"], { STREAMSCOPE_LANG: "ko" })).toBe("en");
  });

  it("STREAMSCOPE_LANG beats LC_ALL / LC_MESSAGES / LANG", () => {
    expect(resolveLang([], { STREAMSCOPE_LANG: "ko", LC_ALL: "en_US.UTF-8" })).toBe("ko");
    expect(resolveLang([], { STREAMSCOPE_LANG: "en", LANG: "ko_KR.UTF-8" })).toBe("en");
  });

  it("then LC_ALL > LC_MESSAGES > LANG", () => {
    expect(resolveLang([], { LC_ALL: "ko_KR.UTF-8", LC_MESSAGES: "en_US", LANG: "en_US" })).toBe("ko");
    expect(resolveLang([], { LC_MESSAGES: "ko_KR.UTF-8", LANG: "en_US" })).toBe("ko");
    expect(resolveLang([], { LANG: "ko_KR.UTF-8" })).toBe("ko");
  });

  it("anything that is not Korean is English", () => {
    expect(resolveLang([], {})).toBe("en");
    expect(resolveLang([], { LANG: "fr_FR.UTF-8" })).toBe("en");
    expect(resolveLang([], { LC_ALL: "C", LANG: "ko_KR.UTF-8" })).toBe("en");
  });

  it("rejects unsupported --lang values with a hint", () => {
    expect(() => resolveLang(["--lang", "fr"], {})).toThrow(/--lang en or --lang ko/);
  });

  it("message tables have the same keys and placeholders", () => {
    expect(Object.keys(MESSAGES.ko).sort()).toEqual(Object.keys(MESSAGES.en).sort());
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const k of Object.keys(MESSAGES.en)) expect(ph(MESSAGES.ko[k as keyof typeof MESSAGES.ko]), k).toBe(ph(MESSAGES.en[k as keyof typeof MESSAGES.en]));
  });
});

describe("mock server startup output", () => {
  function capture() {
    const lines: string[] = [];
    const out = { log: (s: string) => lines.push(s), warn: (s: string) => lines.push(s), error: (s: string) => lines.push(s) };
    return { lines, out };
  }

  it("rejects an invalid port with a message in the chosen language", async () => {
    for (const [lang, needle] of [
      ["ko", "1~65535"],
      ["en", "1 to 65535"],
    ] as const) {
      const { lines, out } = capture();
      const server = await main(["--lang", lang, "--port", "0"], {}, out as unknown as Console);
      expect(server).toBeNull();
      expect(lines.join("\n")).toContain(needle);
    }
    process.exitCode = 0;
  });

  it("starts on a free port, says it is a practice mock, and binds to loopback", async () => {
    const probe = createMockServer();
    await new Promise<void>((r) => probe.listen(0, "127.0.0.1", () => r()));
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((r) => probe.close(() => r()));

    for (const [lang, needle] of [
      ["ko", "연습용 목(mock)"],
      ["en", "Practice mock"],
    ] as const) {
      const { lines, out } = capture();
      const server = await main(["--lang", lang, "--port", String(port)], {}, out as unknown as Console);
      expect(server).not.toBeNull();
      expect(lines.join("\n")).toContain(needle);
      expect((server!.address() as AddressInfo).address).toBe("127.0.0.1");
      await new Promise<void>((r) => server!.close(() => r()));
    }
  });

  it("explains a busy port in the chosen language", async () => {
    const busy = createMockServer();
    await new Promise<void>((r) => busy.listen(0, "127.0.0.1", () => r()));
    const port = (busy.address() as AddressInfo).port;
    const { lines, out } = capture();
    const server = await main(["--port", String(port)], { STREAMSCOPE_LANG: "ko" }, out as unknown as Console);
    expect(server).toBeNull();
    expect(lines.join("\n")).toContain("이미 사용 중");
    process.exitCode = 0;
    await new Promise<void>((r) => busy.close(() => r()));
  });
});

describe("mock page is served", () => {
  let server: ReturnType<typeof createMockServer>;
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

  it("serves the page, its scripts and rejects unknown paths and formats", async () => {
    expect((await fetch(`${base}/`)).headers.get("content-type")).toContain("text/html");
    expect((await fetch(`${base}/mock/page.js`)).status).toBe(200);
    expect((await fetch(`${base}/mock/messages.js`)).status).toBe(200);
    expect((await fetch(`${base}/package.json`)).status).toBe(404);
    const bad = await fetch(`${base}/api/nope`);
    expect(bad.status).toBe(404);
    expect(await bad.text()).toMatch(/Unknown format/);
  });
});
