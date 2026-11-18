import type { Capture } from "../../core";
import { analyze } from "../analysis";
import { redactUrl } from "../../core";
import { useLang } from "../i18n";

const STATUS_KEY: Record<string, string> = {
  streaming: "statusStreaming",
  done: "statusDone",
  aborted: "statusAborted",
  error: "statusError",
};

export function pathOf(url: string): string {
  const safe = redactUrl(url);
  try {
    const u = new URL(safe);
    return u.pathname + u.search;
  } catch {
    return safe;
  }
}

export function RequestList(props: { captures: Capture[]; selectedId: string | null; onSelect(id: string): void }) {
  const { t } = useLang();
  return (
    <ul className="request-list" aria-label={t("appTitle")}>
      {props.captures.map((c) => {
        const { assembled, metrics, status } = analyze(c);
        const provider = assembled.provider === "unknown" ? t("providerUnknown") : assembled.provider;
        return (
          <li key={c.id}>
            <button
              type="button"
              className={"request-row" + (c.id === props.selectedId ? " selected" : "")}
              onClick={() => props.onSelect(c.id)}
              data-testid="request-row"
            >
              <span className="badge provider">{provider}</span>
              <span className={`badge status ${status}`} data-status={status}>
                {t(STATUS_KEY[status] ?? "statusDone")}
              </span>
              <span className="url" title={redactUrl(c.url)}>
                {pathOf(c.url)}
              </span>
              <span className="nums">
                {metrics.ttftMs === null ? "-" : Math.round(metrics.ttftMs)} / {Math.round(metrics.totalMs)} {t("listUnit")}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
