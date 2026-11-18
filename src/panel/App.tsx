import { useCallback, useEffect, useMemo, useState } from "react";
import { AssembledView } from "./components/AssembledView";
import { ExportButton } from "./components/ExportButton";
import { RawEvents } from "./components/RawEvents";
import { RequestList } from "./components/RequestList";
import { Timeline } from "./components/Timeline";
import { LANGS, LangContext, langFromLocale, loadLang, saveLang, translate, browserLocale, type Lang } from "./i18n";
import { useCaptures } from "./useCaptures";

type Tab = "assembled" | "timeline" | "raw";

export function App({ search }: { search?: string }) {
  // Synchronous first guess; the saved choice (async) replaces it right after mount.
  const [lang, setLangState] = useState<Lang>(() => langFromLocale(browserLocale()));
  const [tab, setTab] = useState<Tab>("assembled");
  const [selected, setSelected] = useState<string | null>(null);
  const source = useCaptures(search);

  useEffect(() => {
    let alive = true;
    void loadLang(search).then((l) => {
      if (alive) setLangState(l);
    });
    return () => {
      alive = false;
    };
  }, [search]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    void saveLang(l);
  }, []);

  const ctx = useMemo(() => ({ lang, setLang, t: (k: string, v?: Record<string, string | number>) => translate(lang, k, v) }), [lang, setLang]);
  const { t } = ctx;

  const current = source.captures.find((c) => c.id === selected) ?? source.captures[source.captures.length - 1] ?? null;

  return (
    <LangContext.Provider value={ctx}>
      <div className="app">
        <header>
          <h1>{t("appTitle")}</h1>
          <details className="info">
            <summary aria-label="info">i</summary>
            <p>{t("privacyInfo")}</p>
          </details>
          {source.mode === "live" && (
            <button type="button" onClick={source.clear}>
              {t("clear")}
            </button>
          )}
          <label className="lang">
            {t("language")}{" "}
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t("language")}>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {l === "en" ? "English" : "한국어"}
                </option>
              ))}
            </select>
          </label>
        </header>
        {source.reconnecting && <div className="demo-banner">{t("reconnecting")}</div>}
        {source.mode === "demo" && <div className="demo-banner">{t("demoBanner")}</div>}
        <main>
          <aside>
            {source.captures.length === 0 ? (
              <div className="empty">
                <strong>{t("emptyTitle")}</strong>
                <p>{t("emptyHint")}</p>
              </div>
            ) : (
              <RequestList captures={source.captures} selectedId={current?.id ?? null} onSelect={setSelected} />
            )}
          </aside>
          <section className="detail">
            {current ? (
              <>
                <div className="detail-head">
                  <div role="tablist" className="tabs">
                    {(["assembled", "timeline", "raw"] as Tab[]).map((id) => (
                      <button key={id} role="tab" type="button" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                        {t(id === "assembled" ? "tabAssembled" : id === "timeline" ? "tabTimeline" : "tabRaw")}
                      </button>
                    ))}
                  </div>
                  <ExportButton capture={current} />
                </div>
                {tab === "assembled" && <AssembledView capture={current} />}
                {tab === "timeline" && <Timeline capture={current} />}
                {tab === "raw" && <RawEvents capture={current} />}
              </>
            ) : (
              <div className="empty">{t("selectRequest")}</div>
            )}
          </section>
        </main>
      </div>
    </LangContext.Provider>
  );
}
