// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assemble, type Capture } from "../../src/core";
import { ExportButton } from "../../src/panel/components/ExportButton";
import { AssembledView } from "../../src/panel/components/AssembledView";
import { LangContext, translate, type Lang } from "../../src/panel/i18n";
import { captureOf } from "../helpers";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function inLang(lang: Lang, capture: Capture) {
  const ctx = { lang, setLang: () => {}, t: (k: string, v?: Record<string, string | number>) => translate(lang, k, v) };
  return render(
    <LangContext.Provider value={ctx}>
      <AssembledView capture={capture} />
    </LangContext.Provider>,
  );
}

const ENGLISH_NOTICES = /aborted before|Capture truncated|Unknown stream format|Stream failed|Unhandled event|Additional choices/;

describe("notices are translated (Q-2)", () => {
  it("core attaches codes to the diagnostics it generates", () => {
    const cap = captureOf("openai-chat");
    cap.end = { t: 99, status: "aborted" };
    cap.truncated = true;
    const a = assemble(cap);
    expect(a.notices.map((n) => n.code)).toEqual(["aborted", "truncated"]);
    expect(a.warnings).toContain("Stream was aborted before it finished");
  });

  it("Korean view of an aborted + truncated capture has no English warning text and shows the truncation once", () => {
    const cap = captureOf("openai-chat");
    cap.end = { t: 99, status: "aborted" };
    cap.truncated = true;
    const { container } = inLang("ko", cap);
    const text = container.querySelector(".warnings")!.textContent!;
    expect(text).toContain("스트림이 끝나기 전에 중단되었습니다");
    expect(text).not.toMatch(ENGLISH_NOTICES);
    expect(container.textContent!.match(/잘림/g)?.length).toBe(1);
  });

  it("Korean view of an unknown format and a failed stream is translated; provider error text is kept", () => {
    const unknown: Capture = {
      id: "u",
      url: "http://x/y",
      contentType: "text/event-stream",
      headers: {},
      headersMs: 1,
      chunks: [{ t: 1, text: "data: hello\n\n" }],
      end: { t: 2, status: "error", message: "socket hang up" },
    };
    const { container } = inLang("ko", unknown);
    expect(container.textContent).toContain("알 수 없는 스트림 형식");
    expect(container.textContent).toContain("스트림 실패: socket hang up");
    expect(container.textContent).not.toMatch(ENGLISH_NOTICES);
    cleanup();
    const prov = inLang("ko", captureOf("anthropic", { error: true }));
    expect(prov.container.textContent).toContain("overloaded_error: Overloaded");
  });

  it("English view still shows the English sentences", () => {
    const cap = captureOf("openai-chat");
    cap.end = { t: 99, status: "aborted" };
    inLang("en", cap);
    expect(screen.getByText("Stream was aborted before it finished")).toBeTruthy();
  });
});

describe("copy failure feedback (Q-7)", () => {
  beforeEach(() => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
  });
  it("tells the user to use Export when the clipboard is blocked", async () => {
    render(<ExportButton capture={captureOf("openai-chat")} />);
    fireEvent.click(screen.getByText("Copy JSON"));
    expect(await screen.findByText("Copy failed. Use Export instead.")).toBeTruthy();
  });
});
