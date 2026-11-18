// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportButton, exportJson } from "../../src/panel/components/ExportButton";
import { captureOf } from "../helpers";

const now = () => new Date(2026, 10, 18, 18, 30, 5);
let blobs: Blob[] = [];
let downloads: string[] = [];

beforeEach(() => {
  blobs = [];
  downloads = [];
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b);
    return "blob:fake";
  });
  URL.revokeObjectURL = vi.fn();
  // Capture the file name the button asks the browser to save as.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function readBlob(b: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(b);
  });
}

describe("Export button (AC-7)", () => {
  it("downloads the same JSON as toExport", async () => {
    const cap = captureOf("anthropic", { broken: true });
    cap.headers["set-cookie"] = "sid=secret";
    render(<ExportButton capture={cap} now={now} />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(blobs.length).toBe(1);
    expect(blobs[0]!.type).toBe("application/json");
    const text = await readBlob(blobs[0]!);
    expect(text).toBe(exportJson(cap, now));
    const parsed = JSON.parse(text);
    expect(parsed.schema).toBe("streamscope/v1");
    expect(text).not.toContain("secret");
    expect(downloads).toEqual(["streamscope-anthropic-20261118-183005.json"]);
  });

  it("copies the JSON to the clipboard", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const cap = captureOf("gemini");
    render(<ExportButton capture={cap} now={now} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy JSON" }));
    await screen.findByRole("button", { name: "Copied" });
    expect(writeText).toHaveBeenCalledWith(exportJson(cap, now));
  });

  it("warns that the file contains the response body", () => {
    render(<ExportButton capture={captureOf("gemini")} />);
    expect(screen.getByText(/contains the response body/)).toBeTruthy();
  });
});
