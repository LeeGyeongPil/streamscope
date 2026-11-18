// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGES as MOCK_PAGE } from "../../mock/messages.js";
import { App } from "../../src/panel/App";
import { LANGS, MESSAGES, langFromLocale, loadLang } from "../../src/panel/i18n";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fakeChrome(opts: { stored?: string; ui?: string }) {
  const data: Record<string, string> = opts.stored ? { lang: opts.stored } : {};
  const set = vi.fn(async (o: Record<string, string>) => void Object.assign(data, o));
  const chromeStub = {
    storage: { local: { get: vi.fn(async (k: string) => (k in data ? { [k]: data[k] } : {})), set } },
    i18n: { getUILanguage: () => opts.ui ?? "en-US" },
  };
  vi.stubGlobal("chrome", chromeStub);
  return { set, data };
}

const keys = (o: object) => Object.keys(o).sort();

describe("dictionaries (AC-8)", () => {
  it("panel en/ko have the same keys and no empty values", () => {
    expect(keys(MESSAGES.ko)).toEqual(keys(MESSAGES.en));
    for (const lang of LANGS) for (const [k, v] of Object.entries(MESSAGES[lang])) expect(v.trim(), `${lang}.${k}`).not.toBe("");
  });

  it("placeholders match between languages", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const k of Object.keys(MESSAGES.en)) expect(ph(MESSAGES.ko[k]!), k).toBe(ph(MESSAGES.en[k]!));
  });

  it("_locales en and ko have the same keys", () => {
    const read = (l: string) => JSON.parse(readFileSync(`public/_locales/${l}/messages.json`, "utf8"));
    expect(keys(read("ko"))).toEqual(keys(read("en")));
    for (const l of ["en", "ko"]) for (const v of Object.values(read(l)) as { message: string }[]) expect(v.message.trim()).not.toBe("");
  });

  it("mock page en/ko have the same keys and no empty values", () => {
    expect(keys(MOCK_PAGE.ko)).toEqual(keys(MOCK_PAGE.en));
    for (const l of ["en", "ko"] as const) for (const v of Object.values(MOCK_PAGE[l])) expect(String(v).trim()).not.toBe("");
  });
});

describe("language choice (AC-8)", () => {
  it("a stored 'ko' renders Korean tab labels", async () => {
    fakeChrome({ stored: "ko", ui: "en-US" });
    render(<App search="?demo=1" />);
    expect(await screen.findByRole("tab", { name: "조립 결과" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "타임라인" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "원시 이벤트" })).toBeTruthy();
  });

  it("choosing English in the menu stores 'en' and switches the labels", async () => {
    const { set, data } = fakeChrome({ stored: "ko" });
    render(<App search="?demo=1" />);
    await screen.findByRole("tab", { name: "조립 결과" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "en" } });
    expect(await screen.findByRole("tab", { name: "Assembled" })).toBeTruthy();
    expect(set).toHaveBeenCalledWith({ lang: "en" });
    expect(data.lang).toBe("en");
  });

  it("with nothing stored the UI language decides: ko-KR -> Korean, fr -> English", async () => {
    expect(langFromLocale("ko-KR")).toBe("ko");
    expect(langFromLocale("ko_KR.UTF-8")).toBe("ko");
    expect(langFromLocale("fr")).toBe("en");
    expect(langFromLocale(undefined)).toBe("en");

    fakeChrome({ ui: "ko-KR" });
    expect(await loadLang("")).toBe("ko");
    vi.unstubAllGlobals();
    fakeChrome({ ui: "fr" });
    expect(await loadLang("")).toBe("en");
  });

  it("?lang= beats the saved choice (for screenshots) without saving it", async () => {
    const { set } = fakeChrome({ stored: "en" });
    render(<App search="?demo=1&lang=ko" />);
    expect(await screen.findByRole("tab", { name: "조립 결과" })).toBeTruthy();
    expect(set).not.toHaveBeenCalled();
  });

  it("falls back to localStorage outside the extension", async () => {
    localStorage.setItem("lang", "ko");
    expect(await loadLang("")).toBe("ko");
    localStorage.clear();
  });

  it("the demo panel states that the data is a practice mock", async () => {
    fakeChrome({ stored: "en" });
    render(<App search="?demo=1" />);
    expect(await screen.findByText(/not real provider responses/)).toBeTruthy();
  });
});
