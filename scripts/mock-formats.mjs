// Synthetic stream bodies for the five supported formats.
// Hand-written for this repo from the public event-format documentation; these are
// practice data, not real provider responses. Shared by the mock server and the tests.

/** Render events as SSE text. `eol` lets tests exercise CRLF / CR streams. */
export function renderSse(events, { eol = "\n" } = {}) {
  return events
    .map((e) => {
      const lines = [];
      if (e.comment) lines.push(`: ${e.comment}`);
      if (e.event) lines.push(`event: ${e.event}`);
      for (const part of String(e.data).split("\n")) lines.push(`data: ${part}`);
      return lines.join(eol) + eol + eol;
    })
    .join("");
}

const j = (o) => JSON.stringify(o);

function openaiChat({ error }) {
  const base = { id: "chatcmpl-1", object: "chat.completion.chunk", model: "gpt-mock" };
  const delta = (d, finish = null) => j({ ...base, choices: [{ index: 0, delta: d, finish_reason: finish }] });
  const ev = [
    { data: delta({ role: "assistant", content: "" }) },
    { data: delta({ content: "Hello" }) },
    { data: delta({ content: " world" }) },
    { data: delta({ tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "get_weather", arguments: "" } }] }) },
    { data: delta({ tool_calls: [{ index: 0, function: { arguments: '{"ci' } }] }) },
    { data: delta({ tool_calls: [{ index: 0, function: { arguments: 'ty":"Seoul"}' } }] }) },
  ];
  if (error) ev.push({ data: j({ error: { message: "The server had an error", type: "server_error" } }) });
  ev.push({ data: delta({}, "tool_calls") });
  ev.push({ data: j({ ...base, choices: [], usage: { prompt_tokens: 12, completion_tokens: 9, total_tokens: 21 } }) });
  ev.push({ data: "[DONE]" });
  return { contentType: "text/event-stream", headers: {}, events: ev };
}

function openaiCompat() {
  // Same wire format as OpenAI Chat Completions, different model name (e.g. a local server).
  const base = { id: "cmpl-9", object: "chat.completion.chunk", model: "llama-local" };
  const mk = (d, f = null) => j({ ...base, choices: [{ index: 0, delta: d, finish_reason: f }] });
  return {
    contentType: "text/event-stream",
    headers: {},
    events: [{ data: mk({ role: "assistant" }) }, { data: mk({ content: "Hi" }) }, { data: mk({ content: " there" }) }, { data: mk({}, "stop") }, { data: "[DONE]" }],
  };
}

function anthropic({ broken, error }) {
  const e = (type, body) => ({ event: type, data: j({ type, ...body }) });
  const args = broken ? ['{"query":', '"weather"', ",}"] : ['{"query":', '"weather"', "}"];
  const ev = [
    e("message_start", { message: { id: "msg_1", type: "message", role: "assistant", model: "claude-mock", usage: { input_tokens: 10, output_tokens: 1 } } }),
    e("content_block_start", { index: 0, content_block: { type: "thinking", thinking: "" } }),
    e("ping", {}),
    e("content_block_delta", { index: 0, delta: { type: "thinking_delta", thinking: "user wants " } }),
    e("content_block_delta", { index: 0, delta: { type: "thinking_delta", thinking: "sse" } }),
    e("content_block_stop", { index: 0 }),
    e("content_block_start", { index: 1, content_block: { type: "text", text: "" } }),
    e("content_block_delta", { index: 1, delta: { type: "text_delta", text: "Hi " } }),
    e("content_block_delta", { index: 1, delta: { type: "text_delta", text: "there" } }),
    e("content_block_stop", { index: 1 }),
  ];
  if (error) {
    ev.push(e("error", { error: { type: "overloaded_error", message: "Overloaded" } }));
    return { contentType: "text/event-stream", headers: {}, events: ev };
  }
  ev.push(e("content_block_start", { index: 2, content_block: { type: "tool_use", id: "toolu_1", name: "lookup", input: {} } }));
  for (const a of args) ev.push(e("content_block_delta", { index: 2, delta: { type: "input_json_delta", partial_json: a } }));
  ev.push(e("content_block_stop", { index: 2 }));
  ev.push(e("message_delta", { delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 22 } }));
  ev.push(e("message_stop", {}));
  return { contentType: "text/event-stream", headers: {}, events: ev };
}

function openaiResponses({ error }) {
  const e = (type, body) => ({ event: type, data: j({ type, ...body }) });
  const ev = [
    e("response.created", { response: { id: "resp_1", status: "in_progress" } }),
    e("response.output_text.delta", { output_index: 0, delta: "Su" }),
    e("response.output_text.delta", { output_index: 0, delta: "re!" }),
    e("response.output_item.added", { output_index: 1, item: { type: "function_call", id: "fc_1", call_id: "call_1", name: "search", arguments: "" } }),
    e("response.function_call_arguments.delta", { output_index: 1, item_id: "fc_1", delta: '{"k"' }),
    e("response.function_call_arguments.delta", { output_index: 1, item_id: "fc_1", delta: ":1}" }),
  ];
  if (error) {
    ev.push(e("response.failed", { response: { id: "resp_1", status: "failed", error: { code: "server_error", message: "boom" } } }));
  } else {
    ev.push(e("response.completed", { response: { id: "resp_1", status: "completed", usage: { input_tokens: 7, output_tokens: 5, total_tokens: 12 } } }));
  }
  return { contentType: "text/event-stream", headers: {}, events: ev };
}

function gemini() {
  const chunk = (parts, extra = {}) => j({ candidates: [{ content: { role: "model", parts }, ...extra }], modelVersion: "gemini-mock" });
  return {
    contentType: "text/event-stream",
    headers: {},
    events: [
      { data: chunk([{ text: "Gem" }]) },
      { data: chunk([{ text: "ini" }]) },
      { data: chunk([{ functionCall: { name: "f", args: { x: 1 } } }]) },
      { data: j({ candidates: [{ content: { role: "model", parts: [{ text: "" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6, totalTokenCount: 10 } }) },
    ],
  };
}

function aiSdkUi() {
  return {
    contentType: "text/event-stream",
    headers: { "x-vercel-ai-ui-message-stream": "v1" },
    events: [
      { data: j({ type: "start", messageId: "m1" }) },
      { data: j({ type: "text-start", id: "t1" }) },
      { data: j({ type: "text-delta", id: "t1", delta: "AI " }) },
      { data: j({ type: "text-delta", id: "t1", delta: "SDK" }) },
      { data: j({ type: "text-end", id: "t1" }) },
      { data: j({ type: "tool-input-start", toolCallId: "tc1", toolName: "weather" }) },
      { data: j({ type: "tool-input-delta", toolCallId: "tc1", inputTextDelta: '{"c":' }) },
      { data: j({ type: "tool-input-delta", toolCallId: "tc1", inputTextDelta: '"x"}' }) },
      { data: j({ type: "tool-input-available", toolCallId: "tc1", toolName: "weather", input: { c: "x" } }) },
      { data: j({ type: "finish" }) },
      { data: "[DONE]" },
    ],
  };
}

export const FORMAT_NAMES = ["openai-chat", "openai-responses", "anthropic", "gemini", "ai-sdk-ui"];

/**
 * Build a stream for a format name (one of FORMAT_NAMES, or "openai-compat").
 * `broken` makes the Anthropic tool arguments invalid JSON; `error` adds a
 * mid-stream error event (openai-chat, anthropic, openai-responses).
 */
export function buildStream(format, opts = {}) {
  const o = { broken: false, error: false, ...opts };
  const table = {
    "openai-chat": openaiChat,
    "openai-compat": openaiCompat,
    "openai-responses": openaiResponses,
    anthropic,
    gemini,
    "ai-sdk-ui": aiSdkUi,
  };
  const make = table[format];
  if (!make) throw new Error(`Unknown format "${format}". Use one of: ${Object.keys(table).join(", ")}`);
  const s = make(o);
  return { contentType: s.contentType, headers: s.headers, events: s.events, body: renderSse(s.events) };
}
