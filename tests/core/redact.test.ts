import { describe, expect, it } from "vitest";
import { isSensitiveHeader, redactUrl, toExport } from "../../src/core";
import { pathOf } from "../../src/panel/components/RequestList";
import { captureOf } from "../helpers";

describe("secret masking (Q-3)", () => {
  it("masks secret query values and keeps the rest", () => {
    expect(redactUrl("https://g.example/v1:streamGenerateContent?alt=sse&key=SECRET")).toBe("https://g.example/v1:streamGenerateContent?alt=sse&key=***");
    expect(redactUrl("https://x/y?API_KEY=a&q=1&access_token=b#frag")).toBe("https://x/y?API_KEY=***&q=1&access_token=***#frag");
    expect(redactUrl("https://x/y?%6Bey=SECRET")).toBe("https://x/y?%6Bey=***");
    expect(redactUrl("https://x/y?a=1&flag")).toBe("https://x/y?a=1&flag");
    expect(redactUrl("/relative/path")).toBe("/relative/path");
  });

  it("export JSON never contains the key from the URL", () => {
    const cap = captureOf("gemini");
    cap.url = "https://g.example/v1beta/models/m:streamGenerateContent?alt=sse&key=SECRET";
    const json = JSON.stringify(toExport(cap));
    expect(json).not.toContain("SECRET");
    expect(JSON.parse(json).url).toContain("key=***");
  });

  it("the request list shows the masked path", () => {
    expect(pathOf("https://g.example/v1/m?alt=sse&key=SECRET")).toBe("/v1/m?alt=sse&key=***");
  });

  it("drops account-identifying and secret response headers from exports", () => {
    const cap = captureOf("openai-chat");
    Object.assign(cap.headers, {
      "openai-organization": "org-123",
      "openai-project": "proj_1",
      "Set-Cookie": "sid=1",
      "x-request-id": "req_1",
    });
    const h = toExport(cap).headers;
    expect(Object.keys(h)).not.toContain("openai-organization");
    expect(Object.keys(h)).not.toContain("openai-project");
    expect(Object.keys(h)).not.toContain("set-cookie");
    expect(h["x-request-id"]).toBe("req_1");
    expect(isSensitiveHeader("content-type")).toBe(false);
  });
});
