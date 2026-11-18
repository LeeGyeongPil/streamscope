// Practice mock server: serves the five stream formats over real HTTP chunked responses
// plus a tiny test page. Not a real provider: it imitates public event formats.
//
//   node scripts/mock-server.mjs [--lang en|ko] [--port 5179]
//
// Query options on /api/<format>:
//   chunk=7    bytes per network chunk (cuts lines and JSON in the middle)
//   gap=15     milliseconds between chunks
//   stall=250  extra pause (ms) in the middle of the stream
//   broken=1   Anthropic tool arguments are invalid JSON
//   error=1    add a mid-stream error event (anthropic, openai-chat, openai-responses)
//   abort=1    cut the connection halfway

import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { buildStream } from "./mock-formats.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Terminal messages, one table for both languages (keys must match). */
export const MESSAGES = {
  en: {
    title: "streamscope practice mock server",
    notice: "Practice mock: these streams imitate public event formats, they are not real provider responses.",
    listening: "Listening on {url}",
    open: "Open {url} in Chrome (with the extension loaded) and press a button.",
    load: "Load the extension: chrome://extensions -> Developer mode -> Load unpacked -> {dist}",
    devtools: "Then open DevTools -> \"LLM Streams\" on the mock page.",
    noDist: "dist/ not found. Run `npm run build` first (npm start does it for you).",
    portBusy: "Port {port} is already in use. Set another one: STREAMSCOPE_PORT=5180 npm run mock",
    badLang: "Unsupported language \"{value}\". Use --lang en or --lang ko.",
    badPort: "Invalid port \"{value}\". Use a number from 1 to 65535.",
  },
  ko: {
    title: "streamscope 연습용 목(mock) 서버",
    notice: "연습용 목(mock): 공개 문서의 이벤트 형식을 흉내 낸 스트림이며 실제 공급자 응답이 아닙니다.",
    listening: "{url} 에서 대기 중",
    open: "확장을 로드한 Chrome 에서 {url} 을 열고 버튼을 눌러 보세요.",
    load: "확장 로드: chrome://extensions -> 개발자 모드 -> 압축해제된 확장 프로그램 로드 -> {dist}",
    devtools: "그다음 목 페이지에서 DevTools -> \"LLM Streams\" 패널을 여세요.",
    noDist: "dist/ 가 없습니다. 먼저 `npm run build` 를 실행하세요(npm start 는 자동으로 합니다).",
    portBusy: "포트 {port} 가 이미 사용 중입니다. 다른 포트로 실행하세요: STREAMSCOPE_PORT=5180 npm run mock",
    badLang: "지원하지 않는 언어 \"{value}\" 입니다. --lang en 또는 --lang ko 를 쓰세요.",
    badPort: "잘못된 포트 \"{value}\" 입니다. 1~65535 사이 숫자를 쓰세요.",
  },
};

/** Fill {name} placeholders. */
export function format(template, values = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
}

/**
 * Language precedence: --lang > STREAMSCOPE_LANG > LC_ALL > LC_MESSAGES > LANG.
 * Anything that does not start with "ko" is English.
 */
export function resolveLang(argv = [], env = {}) {
  let flag;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--lang") flag = argv[i + 1];
    else if (a.startsWith("--lang=")) flag = a.slice("--lang=".length);
  }
  if (flag !== undefined) {
    if (flag !== "en" && flag !== "ko") throw new Error(format(MESSAGES.en.badLang, { value: flag }));
    return flag;
  }
  for (const v of [env.STREAMSCOPE_LANG, env.LC_ALL, env.LC_MESSAGES, env.LANG]) {
    if (v && v.trim()) return v.trim().toLowerCase().startsWith("ko") ? "ko" : "en";
  }
  return "en";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flag = (v) => v === "1" || v === "true";

function num(v, dflt, min, max) {
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
}

async function sendStream(url, res) {
  const format_ = url.pathname.slice("/api/".length);
  const q = url.searchParams;
  let stream;
  try {
    stream = buildStream(format_, { broken: flag(q.get("broken")), error: flag(q.get("error")) });
  } catch (e) {
    res.writeHead(404, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ error: e.message }));
    return;
  }
  const size = num(q.get("chunk"), 7, 1, 100000);
  const gap = num(q.get("gap"), 15, 0, 5000);
  const stall = num(q.get("stall"), 0, 0, 30000);
  const body = Buffer.from(stream.body, "utf8");
  const pieces = [];
  for (let i = 0; i < body.length; i += size) pieces.push(body.subarray(i, i + size));

  res.writeHead(200, {
    "content-type": stream.contentType,
    "cache-control": "no-cache",
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "x-vercel-ai-ui-message-stream",
    ...stream.headers,
  });
  res.flushHeaders();
  const middle = Math.floor(pieces.length / 2);
  for (let i = 0; i < pieces.length; i++) {
    if (res.destroyed) return;
    if (flag(q.get("abort")) && i === middle) {
      res.destroy();
      return;
    }
    if (stall && i === middle) await sleep(stall);
    res.write(pieces[i]);
    if (gap) await sleep(gap);
  }
  res.end();
}

const STATIC = {
  "/": ["mock/index.html", "text/html; charset=utf-8"],
  "/mock/page.js": ["mock/page.js", "text/javascript; charset=utf-8"],
  "/mock/messages.js": ["mock/messages.js", "text/javascript; charset=utf-8"],
};

/** Create (but do not start) the mock HTTP server. */
export function createMockServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname.startsWith("/api/")) return await sendStream(url, res);
      if (url.pathname === "/api-json") {
        res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
        res.end('{"ok":true}');
        return;
      }
      const entry = STATIC[url.pathname];
      if (entry) {
        res.writeHead(200, { "content-type": entry[1] });
        res.end(await readFile(join(root, entry[0])));
        return;
      }
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    } catch (e) {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end(String(e && e.message ? e.message : e));
    }
  });
}

/** Command-line entry. Returns the listening server (or null on a usage error). */
export async function main(argv = process.argv.slice(2), env = process.env, out = console) {
  let lang;
  try {
    lang = resolveLang(argv, env);
  } catch (e) {
    out.error(e.message);
    process.exitCode = 2;
    return null;
  }
  const m = MESSAGES[lang];
  let portArg = env.STREAMSCOPE_PORT ?? "5179";
  const pi = argv.indexOf("--port");
  if (pi >= 0) portArg = argv[pi + 1];
  const port = Number(portArg);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    out.error(format(m.badPort, { value: portArg }));
    process.exitCode = 2;
    return null;
  }
  const server = createMockServer();
  return await new Promise((resolveP) => {
    server.once("error", (err) => {
      out.error(err.code === "EADDRINUSE" ? format(m.portBusy, { port }) : String(err.message));
      process.exitCode = 1;
      resolveP(null);
    });
    // Bind to loopback only: the mock is for local practice.
    server.listen(port, "127.0.0.1", () => {
      const url = `http://localhost:${port}`;
      out.log(m.title);
      out.log(m.notice);
      out.log(format(m.listening, { url }));
      out.log(format(m.load, { dist: join(root, "dist") }));
      out.log(format(m.open, { url }));
      out.log(m.devtools);
      if (!existsSync(join(root, "dist", "manifest.json"))) out.warn(m.noDist);
      resolveP(server);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
