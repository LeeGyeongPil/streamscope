import { describe, expect, it } from "vitest";
import { assemble, checkJson } from "../../src/core";
import { captureOf } from "../helpers";

describe("tool-argument JSON check (AC-3)", () => {
  it("locates the broken Anthropic fixture argument", () => {
    const a = assemble(captureOf("anthropic", { broken: true }));
    const lookup = a.tools.find((t) => t.name === "lookup")!;
    expect(lookup.args).toBe('{"query":"weather",}');
    expect(lookup.json.ok).toBe(false);
    if (!lookup.json.ok) {
      expect(lookup.json.position).toBe(19);
      expect(lookup.json.line).toBe(1);
      expect(lookup.json.col).toBe(20);
    }
  });

  it("accepts valid JSON and returns the value", () => {
    expect(checkJson('{"a":[1,2,{"b":null}],"c":"\\u00e9"}')).toEqual({ ok: true, value: { a: [1, 2, { b: null }], c: "é" } });
  });

  it("treats empty arguments as {}", () => {
    expect(checkJson("")).toEqual({ ok: true, value: {} });
  });

  it("reports truncated input at the end", () => {
    const r = checkJson('{"a":1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.position).toBe(6);
  });

  it("computes line and column across newlines", () => {
    const r = checkJson('{\n  "a": 1,\n  "b" 2\n}');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.line).toBe(3);
      expect(r.col).toBe(7);
    }
  });

  it("agrees with JSON.parse on valid/invalid for a set of samples", () => {
    const samples = ['{"a":1}', "[1,2,]", '{"a":}', "tru", "nul", '"x', '{"a":1}x', "01", "-", '{"a":"\\x"}', "[]", "  {}  ", '{"a" 1}', "[1 2]"];
    for (const s of samples) {
      let valid = true;
      try {
        JSON.parse(s);
      } catch {
        valid = false;
      }
      expect(checkJson(s).ok, s).toBe(valid);
    }
  });
});
