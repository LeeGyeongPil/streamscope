import type { Capture, Notice, ToolCall } from "../../core";
import { analyze } from "../analysis";
import { useLang } from "../i18n";

/** The line of `args` that holds the error, plus a caret line pointing at the column. */
export function caretLines(args: string, line: number, col: number): { source: string; caret: string } {
  const source = args.split("\n")[line - 1] ?? "";
  return { source, caret: " ".repeat(Math.max(0, col - 1)) + "^" };
}

function ToolView({ tool }: { tool: ToolCall }) {
  const { t } = useLang();
  const j = tool.json;
  return (
    <div className="tool" data-testid="tool-call">
      <div className="tool-head">
        <strong>{tool.name || "(unnamed)"}</strong> <code>{tool.id}</code>
      </div>
      <div className="label">{t("argsLabel")}</div>
      <pre className="args">{tool.args || "(empty)"}</pre>
      {j.ok ? (
        <div className="json-ok">{t("jsonValid")}</div>
      ) : (
        <div className="json-bad" role="alert">
          <div>{t("jsonInvalid", { position: j.position, line: j.line, col: j.col })}</div>
          <div className="json-detail">{t("jsonDetail", { error: j.error })}</div>
          {(() => {
            const c = caretLines(tool.args, j.line, j.col);
            return (
              <pre className="caret-block" data-testid="json-caret">
                {c.source}
                {"\n"}
                {c.caret}
              </pre>
            );
          })()}
        </div>
      )}
    </div>
  );
}

/** Translate a notice by its code; unknown codes fall back to the English text. */
function noticeText(n: Notice, t: (k: string, v?: Record<string, string | number>) => string): string {
  switch (n.code) {
    case "unknownFormat":
      return t("noticeUnknownFormat");
    case "streamFailed":
      return t("noticeStreamFailed", { message: n.arg ?? "" });
    case "aborted":
      return t("noticeAborted");
    case "truncated":
      return t("truncated");
    case "unhandledEvent":
      return t("noticeUnhandledEvent", { type: n.arg ?? "" });
    case "extraChoices":
      return t("noticeExtraChoices");
    default:
      return n.text;
  }
}

function Metric(props: { label: string; value: string; note?: string }) {
  return (
    <div className="metric">
      <div className="metric-label">{props.label}</div>
      <div className="metric-value">{props.value}</div>
      {props.note ? <div className="metric-note">{props.note}</div> : null}
    </div>
  );
}

export function AssembledView({ capture }: { capture: Capture }) {
  const { t } = useLang();
  const { assembled: a, metrics: m } = analyze(capture);
  // Provider error text (e.g. overloaded_error) is shown as sent; our own notices are translated.
  const own = new Set(a.notices.map((n) => n.text));
  const providerErrors = a.errors.filter((e) => !own.has(e));
  const errorLines = [...providerErrors, ...a.notices.filter((n) => n.level === "error").map((n) => noticeText(n, t))];
  const warningLines = a.notices.filter((n) => n.level === "warning").map((n) => noticeText(n, t));
  const ms = (v: number | null) => (v === null ? "-" : `${Math.round(v)} ms`);
  return (
    <div className="assembled">
      <div className="metrics">
        <Metric label={t("metricHeaders")} value={ms(m.headersMs)} />
        <Metric label={t("metricTtft")} value={ms(m.ttftMs)} />
        <Metric
          label={t("metricMaxGap")}
          value={ms(m.maxGapMs)}
          note={m.maxGapAfterChunk >= 0 ? t("metricMaxGapAfter", { n: m.maxGapAfterChunk + 1 }) : undefined}
        />
        <Metric label={t("metricStalls", { ms: 1000 })} value={String(m.stalls)} />
        <Metric label={t("metricTotal")} value={ms(m.totalMs)} />
        <Metric label={t("metricChunks")} value={String(m.chunks)} />
        <Metric label={t("metricEvents")} value={String(m.events)} />
        <Metric label={t("metricBytes")} value={String(m.bytes)} />
      </div>

      {errorLines.length > 0 && (
        <section className="errors" role="alert">
          <h3>{t("sectionErrors")}</h3>
          <ul>
            {errorLines.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
      )}
      {warningLines.length > 0 && (
        <section className="warnings">
          <h3>{t("sectionWarnings")}</h3>
          <ul>
            {warningLines.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>{t("sectionText")}</h3>
        <pre className="text" data-testid="assembled-text">
          {a.text || t("noText")}
        </pre>
      </section>
      {a.reasoning && (
        <section>
          <h3>{t("sectionReasoning")}</h3>
          <pre className="text" data-testid="assembled-reasoning">
            {a.reasoning}
          </pre>
        </section>
      )}
      <section>
        <h3>{t("sectionTools")}</h3>
        {a.tools.length === 0 ? <div className="muted">{t("noTools")}</div> : a.tools.map((tool, i) => <ToolView key={i} tool={tool} />)}
      </section>
      <section>
        <h3>{t("sectionFinish")}</h3>
        {a.finish ? (
          <div>
            {t("finishRaw", { raw: a.finish.raw })} · {t("finishNormalized", { normalized: a.finish.normalized })}
          </div>
        ) : (
          <div className="muted">-</div>
        )}
      </section>
      <section>
        <h3>{t("sectionUsage")}</h3>
        {a.usage ? (
          <div>
            {[
              a.usage.input !== undefined ? t("usageIn", { n: a.usage.input }) : null,
              a.usage.output !== undefined ? t("usageOut", { n: a.usage.output }) : null,
              a.usage.total !== undefined ? t("usageTotal", { n: a.usage.total }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        ) : (
          <div className="muted">-</div>
        )}
      </section>
    </div>
  );
}
