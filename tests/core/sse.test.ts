import { describe, expect, it } from "vitest";
import { parseSSE } from "../../src/core";
import { FORMAT_NAMES } from "../../scripts/mock-formats.mjs";
import { buildStream, cutAt, mulberry32, renderSse } from "../helpers";

// `done` = how many characters of the terminator the parser needs before it dispatches.
type Fixture = { name: string; text: string; terminator: string; done?: number };

const fixtures: Fixture[] = [];
for (const f of [...FORMAT_NAMES, "openai-compat"]) {
  fixtures.push({ name: f, text: buildStream(f).body, terminator: "\n\n" });
}
fixtures.push({ name: "anthropic-broken", text: buildStream("anthropic", { broken: true }).body, terminator: "\n\n" });
const anthropicEvents = buildStream("anthropic").events;
fixtures.push({ name: "crlf", text: renderSse(anthropicEvents, { eol: "\r\n" }), terminator: "\r\n\r\n", done: 3 });
fixtures.push({ name: "cr-only", text: renderSse(anthropicEvents, { eol: "\r" }), terminator: "\r\r" });
fixtures.push({
  name: "comments-and-multiline",
  text: renderSse([
    { comment: "keep-alive", data: '{"a":1}' },
    { event: "multi", data: "line one\nline two\nline three" },
    { data: "[DONE]" },
  ]),
  terminator: "\n\n",
});

const strip = (events: ReturnType<typeof parseSSE>) => events.map((e) => ({ event: e.event, data: e.data }));

function randomCuts(rnd: () => number, len: number): number[] {
  const k = 1 + Math.floor(rnd() * 8);
  return Array.from({ length: k }, () => 1 + Math.floor(rnd() * (len - 1))).sort((a, b) => a - b);
}

describe("parseSSE is independent of chunk boundaries (AC-1)", () => {
  for (const fx of fixtures) {
    it(`${fx.name}: 200 seeded random cuts give the same events`, () => {
      const whole = strip(parseSSE([{ t: 0, text: fx.text }]));
      expect(whole.length).toBeGreaterThan(0);
      const rnd = mulberry32(1234 + fx.name.length);
      for (let n = 0; n < 200; n++) {
        expect(strip(parseSSE(cutAt(fx.text, randomCuts(rnd, fx.text.length))))).toEqual(whole);
      }
    });
  }

  it("also holds when every chunk is a single character", () => {
    for (const fx of fixtures) {
      const cuts = Array.from({ length: fx.text.length - 1 }, (_, i) => i + 1);
      expect(strip(parseSSE(cutAt(fx.text, cuts)))).toEqual(strip(parseSSE([{ t: 0, text: fx.text }])));
    }
  });

  it("stamps each event with the time of the chunk that completed it", () => {
    for (const fx of fixtures) {
      const rnd = mulberry32(99 + fx.name.length);
      for (let n = 0; n < 50; n++) {
        const chunks = cutAt(fx.text, randomCuts(rnd, fx.text.length));
        const events = parseSSE(chunks);
        // Expected: the chunk holding the last character of each blank-line terminator.
        const ends: number[] = [];
        let from = 0;
        for (;;) {
          const idx = fx.text.indexOf(fx.terminator, from);
          if (idx < 0) break;
          ends.push(idx + (fx.done ?? fx.terminator.length) - 1);
          from = idx + fx.terminator.length;
        }
        const chunkEnds: number[] = [];
        let off = 0;
        for (const c of chunks) {
          off += c.text.length;
          chunkEnds.push(off);
        }
        const expected = ends.map((e) => chunks[chunkEnds.findIndex((ce) => ce > e)]!.t);
        expect(events.map((e) => e.t)).toEqual(expected);
      }
    }
  });

  it("keeps multi-line data joined with a newline and ignores comments", () => {
    const events = parseSSE([{ t: 1, text: renderSse([{ comment: "x", event: "multi", data: "a\nb" }]) }]);
    expect(events).toEqual([{ t: 1, event: "multi", data: "a\nb" }]);
  });
});
