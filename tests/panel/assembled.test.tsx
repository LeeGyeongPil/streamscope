// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AssembledView, caretLines } from "../../src/panel/components/AssembledView";
import { RequestList } from "../../src/panel/components/RequestList";
import { captureOf } from "../helpers";

afterEach(cleanup);

describe("Assembled view (AC-3)", () => {
  it("shows the broken tool-argument error and a caret at the position", () => {
    render(<AssembledView capture={captureOf("anthropic", { broken: true })} />);
    const tool = screen.getByTestId("tool-call");
    expect(within(tool).getByText("lookup")).toBeTruthy();
    expect(within(tool).getByText("Invalid JSON at position 19 (line 1, col 20)")).toBeTruthy();
    const caret = within(tool).getByTestId("json-caret");
    expect(caret.textContent).toBe('{"query":"weather",}\n' + " ".repeat(19) + "^");
    expect(screen.getByTestId("assembled-text").textContent).toBe("Hi there");
    expect(screen.getByTestId("assembled-reasoning").textContent).toBe("user wants sse");
  });

  it("shows valid arguments without an error", () => {
    render(<AssembledView capture={captureOf("anthropic")} />);
    expect(screen.getByText("Valid JSON")).toBeTruthy();
    expect(screen.queryByTestId("json-caret")).toBeNull();
  });

  it("lists mid-stream errors", () => {
    render(<AssembledView capture={captureOf("anthropic", { error: true })} />);
    expect(screen.getByText("overloaded_error: Overloaded")).toBeTruthy();
  });

  it("caretLines picks the right line for multi-line arguments", () => {
    expect(caretLines('{\n  "a" 1\n}', 2, 7)).toEqual({ source: '  "a" 1', caret: "      ^" });
  });
});

describe("Request list badges (AC-3)", () => {
  it("marks a stream with an error event as error and a normal one as done", () => {
    const caps = [captureOf("anthropic", { error: true }), captureOf("openai-responses", { error: true }), captureOf("gemini")];
    render(<RequestList captures={caps} selectedId={null} onSelect={() => {}} />);
    const rows = screen.getAllByTestId("request-row");
    const statuses = rows.map((r) => r.querySelector("[data-status]")!.getAttribute("data-status"));
    expect(statuses).toEqual(["error", "error", "done"]);
    expect(rows[0]!.textContent).toContain("anthropic");
  });

  it("shows aborted and still-streaming states", () => {
    const aborted = captureOf("openai-chat");
    aborted.end = { t: 50, status: "aborted" };
    const open = captureOf("gemini");
    delete open.end;
    render(<RequestList captures={[aborted, open]} selectedId={null} onSelect={() => {}} />);
    const statuses = screen.getAllByTestId("request-row").map((r) => r.querySelector("[data-status]")!.getAttribute("data-status"));
    expect(statuses).toEqual(["aborted", "streaming"]);
  });
});
