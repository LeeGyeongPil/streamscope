import { checkJson } from "../json-check";
import type { NormalizedFinish, Notice, ProviderResult, ToolCall } from "../types";

export type Json = Record<string, any>;

/** Parse an SSE data payload; returns null for non-JSON (e.g. `[DONE]`). */
export function tryParse(data: string): Json | null {
  const trimmed = data.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const v = JSON.parse(trimmed);
    return v && typeof v === "object" ? (v as Json) : null;
  } catch {
    return null;
  }
}

export function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

type ToolDraft = { id: string; name: string; args: string };

/** Collects streamed output while remembering which event produced the first output. */
export class Builder {
  text = "";
  reasoning = "";
  finish: ProviderResult["finish"] = null;
  usage: ProviderResult["usage"] = null;
  errors: string[] = [];
  warnings: string[] = [];
  notices: Notice[] = [];
  firstOutputEvent: number | null = null;
  private tools = new Map<string, ToolDraft>();
  private order: string[] = [];

  /** Mark event `i` as carrying output if it hasn't been marked yet. */
  private mark(i: number): void {
    if (this.firstOutputEvent === null) this.firstOutputEvent = i;
  }

  addText(i: number, s: unknown): void {
    if (typeof s === "string" && s) {
      this.text += s;
      this.mark(i);
    }
  }

  addReasoning(i: number, s: unknown): void {
    if (typeof s === "string" && s) {
      this.reasoning += s;
      this.mark(i);
    }
  }

  /** Create or update a tool call keyed by `key`. */
  tool(key: string, patch: { id?: string; name?: string }): void {
    let t = this.tools.get(key);
    if (!t) {
      t = { id: "", name: "", args: "" };
      this.tools.set(key, t);
      this.order.push(key);
    }
    if (patch.id) t.id = patch.id;
    if (patch.name) t.name = patch.name;
  }

  addArgs(i: number, key: string, s: unknown): void {
    if (typeof s === "string" && s) {
      this.tool(key, {});
      this.tools.get(key)!.args += s;
      this.mark(i);
    }
  }

  /** Replace args wholesale (providers that send complete arguments). */
  setArgs(i: number, key: string, s: string): void {
    this.tool(key, {});
    this.tools.get(key)!.args = s;
    this.mark(i);
  }

  hasArgs(key: string): boolean {
    return (this.tools.get(key)?.args ?? "") !== "";
  }

  hasTools(): boolean {
    return this.order.length > 0;
  }

  result(): ProviderResult {
    const tools: ToolCall[] = this.order.map((k, n) => {
      const t = this.tools.get(k)!;
      return { id: t.id || `call_${n}`, name: t.name, args: t.args, json: checkJson(t.args) };
    });
    return {
      text: this.text,
      reasoning: this.reasoning,
      tools,
      finish: this.finish,
      usage: this.usage,
      errors: this.errors,
      warnings: this.warnings,
      notices: this.notices,
      firstOutputEvent: this.firstOutputEvent,
    };
  }

  /** Warn once about an event type the provider module does not understand. */
  unknownEvent(type: string): void {
    const msg = `Unhandled event type: ${type}`;
    if (!this.warnings.includes(msg) && this.warnings.length < 20) {
      this.warnings.push(msg);
      this.notices.push({ level: "warning", code: "unhandledEvent", arg: type, text: msg });
    }
  }

  /** Warn once that extra choices/candidates are dropped. */
  extraChoices(msg: string): void {
    if (this.warnings.includes(msg)) return;
    this.warnings.push(msg);
    this.notices.push({ level: "warning", code: "extraChoices", text: msg });
  }
}

export function normalizeFinish(raw: string): NormalizedFinish {
  switch (raw) {
    case "stop":
    case "end_turn":
    case "stop_sequence":
    case "STOP":
    case "completed":
      return "stop";
    case "length":
    case "max_tokens":
    case "MAX_TOKENS":
    case "max_output_tokens":
      return "length";
    case "tool_calls":
    case "tool_use":
    case "function_call":
      return "tool_calls";
    case "error":
    case "failed":
      return "error";
    default:
      return "other";
  }
}

export function errorText(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const o = v as Json;
    const msg = o.message ?? o.errorText ?? o.error;
    const type = o.type ?? o.code ?? o.status;
    if (typeof msg === "string") return type ? `${type}: ${msg}` : msg;
    return JSON.stringify(v);
  }
  return String(v);
}
