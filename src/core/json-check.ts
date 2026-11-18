import type { JsonCheck } from "./types";

type Fail = { error: string; position: number };

/** Minimal JSON grammar scanner that reports the first offending position. */
function scan(s: string): Fail | null {
  let i = 0;
  const ws = () => {
    while (i < s.length && " \t\n\r".includes(s[i]!)) i++;
  };
  const fail = (error: string, position = i): Fail => ({ error, position });
  const end = (): Fail => fail("Unexpected end of JSON input", s.length);

  function value(): Fail | null {
    ws();
    if (i >= s.length) return end();
    const c = s[i]!;
    if (c === "{") return object();
    if (c === "[") return array();
    if (c === '"') return string();
    if (c === "-" || (c >= "0" && c <= "9")) return number();
    for (const lit of ["true", "false", "null"]) {
      if (s.startsWith(lit, i)) {
        i += lit.length;
        return null;
      }
      if (lit.startsWith(s.slice(i)) && s.length - i < lit.length) return end();
    }
    return fail(`Unexpected token '${c}'`);
  }
  function string(): Fail | null {
    i++;
    while (i < s.length) {
      const c = s[i]!;
      if (c === '"') {
        i++;
        return null;
      }
      if (c === "\\") {
        i++;
        if (i >= s.length) return end();
        const e = s[i]!;
        if (e === "u") {
          for (let k = 1; k <= 4; k++) {
            if (i + k >= s.length) return fail("Unexpected end of JSON input", s.length);
            if (!/[0-9a-fA-F]/.test(s[i + k]!)) return fail("Bad Unicode escape", i + k);
          }
          i += 4;
        } else if (!'"\\/bfnrt'.includes(e)) {
          return fail("Bad escaped character");
        }
      } else if (c < " ") {
        return fail("Bad control character in string literal");
      }
      i++;
    }
    return end();
  }
  function number(): Fail | null {
    const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i));
    if (!m) {
      if (i + 1 >= s.length) return end();
      return fail("Invalid number", i + 1);
    }
    i += m[0].length;
    return null;
  }
  function object(): Fail | null {
    i++;
    ws();
    if (i >= s.length) return end();
    if (s[i] === "}") {
      i++;
      return null;
    }
    for (;;) {
      ws();
      if (i >= s.length) return end();
      if (s[i] !== '"') return fail("Expected double-quoted property name");
      let r = string();
      if (r) return r;
      ws();
      if (i >= s.length) return end();
      if (s[i] !== ":") return fail("Expected ':' after property name");
      i++;
      r = value();
      if (r) return r;
      ws();
      if (i >= s.length) return end();
      if (s[i] === ",") {
        i++;
        continue;
      }
      if (s[i] === "}") {
        i++;
        return null;
      }
      return fail("Expected ',' or '}' after property value");
    }
  }
  function array(): Fail | null {
    i++;
    ws();
    if (i >= s.length) return end();
    if (s[i] === "]") {
      i++;
      return null;
    }
    for (;;) {
      const r = value();
      if (r) return r;
      ws();
      if (i >= s.length) return end();
      if (s[i] === ",") {
        i++;
        continue;
      }
      if (s[i] === "]") {
        i++;
        return null;
      }
      return fail("Expected ',' or ']' after array element");
    }
  }

  const r = value();
  if (r) return r;
  ws();
  if (i < s.length) return fail("Unexpected non-whitespace character after JSON");
  return null;
}

/** Convert a 0-based offset to 1-based line and column. */
function lineCol(s: string, position: number): { line: number; col: number } {
  let line = 1;
  let last = -1;
  for (let k = 0; k < position && k < s.length; k++) {
    if (s[k] === "\n") {
      line++;
      last = k;
    }
  }
  return { line, col: position - last };
}

/**
 * Check accumulated tool-call arguments. Empty text is treated as `{}` (tools
 * without parameters often stream no argument text at all).
 */
export function checkJson(text: string): JsonCheck {
  if (text.trim() === "") return { ok: true, value: {} };
  const bad = scan(text);
  if (!bad) {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch (e) {
      // Scanner and engine disagree: report the end of input rather than guess.
      const position = text.length;
      return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON", position, ...lineCol(text, position) };
    }
  }
  return { ok: false, error: bad.error, position: bad.position, ...lineCol(text, bad.position) };
}
