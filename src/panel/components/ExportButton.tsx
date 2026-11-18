import { useState } from "react";
import { toExport, type Capture } from "../../core";
import { analyze } from "../analysis";
import { useLang } from "../i18n";

/** Pretty-printed streamscope/v1 JSON for a capture. */
export function exportJson(capture: Capture, now?: () => Date): string {
  return JSON.stringify(toExport(capture, now), null, 2);
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function ExportButton({ capture, now = () => new Date() }: { capture: Capture; now?: () => Date }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const download = () => {
    const when = now();
    const blob = new Blob([exportJson(capture, () => when)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `streamscope-${analyze(capture).assembled.provider}-${stamp(when)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportJson(capture, now));
      setFailed(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked in DevTools panels; tell the user the download still works.
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
    }
  };

  return (
    <div className="export">
      <button type="button" onClick={download}>
        {t("export")}
      </button>
      <button type="button" onClick={copy}>
        {copied ? t("copied") : t("copy")}
      </button>
      <span className="share-warning">{t("shareWarning")}</span>
      {failed && (
        <span className="share-warning" role="status">
          {t("copyFailed")}
        </span>
      )}
    </div>
  );
}
