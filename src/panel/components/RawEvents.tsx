import { useMemo } from "react";
import { parseSSE, type Capture } from "../../core";
import { useLang } from "../i18n";

const SHOWN = 500;

export function RawEvents({ capture }: { capture: Capture }) {
  const { t } = useLang();
  const events = useMemo(() => parseSSE(capture.chunks), [capture, capture.chunks.length]);
  return (
    <table className="raw" data-testid="raw-table">
      <thead>
        <tr>
          <th>{t("rawIndex")}</th>
          <th>{t("rawTime")}</th>
          <th>{t("rawEvent")}</th>
          <th>{t("rawData")}</th>
        </tr>
      </thead>
      <tbody>
        {events.slice(0, SHOWN).map((e, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td>{Math.round(e.t)}</td>
            <td>{e.event ?? ""}</td>
            <td className="data" title={e.data}>
              {e.data.length > 300 ? e.data.slice(0, 300) + "…" : e.data}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
