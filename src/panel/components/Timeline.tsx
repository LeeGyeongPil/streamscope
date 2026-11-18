import type { Capture } from "../../core";
import { analyze } from "../analysis";
import { useLang } from "../i18n";

const WIDTH = 800;
const HEIGHT = 120;

export function Timeline({ capture }: { capture: Capture }) {
  const { t } = useLang();
  const { metrics: m } = analyze(capture);
  const total = Math.max(1, m.totalMs, ...capture.chunks.map((c) => c.t));
  const x = (ms: number) => (ms / total) * WIDTH;
  const maxLen = Math.max(1, ...capture.chunks.map((c) => c.text.length));

  // Highlight the longest gap (always) and any gap that counts as a stall.
  const gaps: { from: number; to: number; stall: boolean }[] = [];
  for (let i = 1; i < capture.chunks.length; i++) {
    const from = capture.chunks[i - 1]!.t;
    const to = capture.chunks[i]!.t;
    const isMax = i - 1 === m.maxGapAfterChunk && to - from > 0;
    if (isMax || to - from >= 1000) gaps.push({ from, to, stall: to - from >= 1000 });
  }

  return (
    <div className="timeline">
      <p className="hint">{t("timelineHint")}</p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={t("tabTimeline")} className="timeline-svg">
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} className="tl-bg" />
        {gaps.map((g, i) => (
          <rect key={i} x={x(g.from)} y={0} width={Math.max(2, x(g.to) - x(g.from))} height={HEIGHT} className={g.stall ? "tl-stall" : "tl-gap"} data-testid="tl-gap" />
        ))}
        {capture.chunks.map((c, i) => {
          const h = 10 + (c.text.length / maxLen) * (HEIGHT - 30);
          return <rect key={i} x={x(c.t)} y={HEIGHT - 10 - h} width={Math.max(1, WIDTH / 400)} height={h} className="tl-bar" />;
        })}
        <rect x={0} y={HEIGHT - 10} width={x(m.headersMs)} height={4} className="tl-headers" />
        {m.ttftMs !== null && <line x1={x(m.ttftMs)} x2={x(m.ttftMs)} y1={0} y2={HEIGHT} className="tl-ttft" data-testid="tl-ttft" />}
      </svg>
      <div className="timeline-legend">
        <span>0 ms</span>
        {m.ttftMs !== null && <span className="ttft">{t("timelineTtft", { ms: Math.round(m.ttftMs) })}</span>}
        {m.maxGapMs > 0 && <span className="gap">{t("timelineGap", { ms: Math.round(m.maxGapMs) })}</span>}
        <span>{Math.round(total)} ms</span>
      </div>
    </div>
  );
}
