// Practice page: calls the local mock server with fetch() the way a chat app would.
// It only displays what it received; streamscope observes the same stream from DevTools.
import { langFromLocale, translate } from "/mock/messages.js";

const LANG_KEY = "streamscope-mock-lang";
const FORMATS = [
  ["openai-chat", "OpenAI Chat"],
  ["openai-responses", "OpenAI Responses"],
  ["anthropic", "Anthropic"],
  ["gemini", "Gemini"],
  ["ai-sdk-ui", "AI SDK UI"],
];

// Language precedence: ?lang= > saved choice > browser language (first visit only).
function initialLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "en" || q === "ko") return q;
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "ko") return saved;
  } catch {}
  return langFromLocale(navigator.language);
}

let lang = initialLang();
const t = (key, vars) => translate(lang, key, vars);
const $ = (id) => document.getElementById(id);
const options = { chunk: 7, stall: false, broken: false, error: false, abort: false, cancel: false };
const cards = new Map();

function renderStatic() {
  document.documentElement.lang = lang;
  document.title = t("title");
  $("title").textContent = t("title");
  $("notice").textContent = t("notice");
  $("lang-label").textContent = t("language");
  $("lang").value = lang;

  $("opts").replaceChildren();
  const num = document.createElement("label");
  num.append(t("optChunk") + " ");
  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.value = String(options.chunk);
  input.style.width = "70px";
  input.addEventListener("change", () => (options.chunk = Math.max(1, Number(input.value) || 7)));
  num.append(input);
  $("opts").append(num);
  for (const [key, label] of [["stall", "optStall"], ["broken", "optBroken"], ["error", "optError"], ["abort", "optAbort"], ["cancel", "optCancel"]]) {
    const l = document.createElement("label");
    const c = document.createElement("input");
    c.type = "checkbox";
    c.checked = options[key];
    c.addEventListener("change", () => (options[key] = c.checked));
    l.append(c, " " + t(label));
    $("opts").append(l);
  }

  $("buttons").replaceChildren();
  for (const [id, label] of FORMATS) {
    const b = document.createElement("button");
    b.textContent = label;
    b.dataset.format = id;
    b.addEventListener("click", () => run(id, label));
    $("buttons").append(b);
  }
  const all = document.createElement("button");
  all.textContent = t("runAll");
  all.id = "run-all";
  all.addEventListener("click", () => FORMATS.forEach(([id, label]) => run(id, label)));
  $("buttons").append(all);

  for (const card of cards.values()) card.refresh();
}

function makeCard(label) {
  const el = document.createElement("div");
  el.className = "card";
  const h = document.createElement("h3");
  const note = document.createElement("div");
  const caption = document.createElement("div");
  const pre = document.createElement("pre");
  el.append(h, note, caption, pre);
  $("results").prepend(el);
  const state = { key: "running", vars: {}, bytes: 0 };
  const card = {
    pre,
    state,
    refresh() {
      h.textContent = label;
      note.textContent = `${t("status")}: ${t(state.key, state.vars)} · ${t("bytes", { n: state.bytes })}`;
      caption.textContent = t("received");
      caption.style.color = "#6e7781";
    },
  };
  card.refresh();
  cards.set(el, card);
  return card;
}

async function run(format, label) {
  const card = makeCard(label);
  const q = new URLSearchParams({ chunk: String(options.chunk) });
  if (options.stall) q.set("stall", "250");
  if (options.broken) q.set("broken", "1");
  if (options.error) q.set("error", "1");
  if (options.abort) q.set("abort", "1");
  const controller = new AbortController();
  if (options.cancel) setTimeout(() => controller.abort(), 300);
  try {
    const res = await fetch(`/api/${format}?${q}`, { method: "POST", body: JSON.stringify({ prompt: "hi" }), signal: controller.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      card.state.bytes += value.length;
      card.pre.textContent += decoder.decode(value, { stream: true });
      card.refresh();
    }
    card.state.key = "finished";
  } catch (e) {
    if (e && e.name === "AbortError") card.state.key = "cancelled";
    else {
      card.state.key = "failed";
      card.state.vars = { message: String(e && e.message ? e.message : e) };
    }
  }
  card.refresh();
}

$("lang").addEventListener("change", (e) => {
  lang = e.target.value;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {}
  renderStatic();
});

renderStatic();
