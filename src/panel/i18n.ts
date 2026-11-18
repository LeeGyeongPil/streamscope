import { createContext, useContext } from "react";

export type Lang = "en" | "ko";
export const LANGS: Lang[] = ["en", "ko"];
export const LANG_KEY = "lang";

/** All panel text lives here; both languages must define exactly the same keys. */
export const MESSAGES: Record<Lang, Record<string, string>> = {
  en: {
    appTitle: "LLM Streams",
    language: "Language",
    privacyInfo:
      "Reads response headers and bodies of event-stream fetch() calls in this tab, only in memory. Request headers and bodies are never read and nothing is sent anywhere.",
    demoBanner: "Demo data (practice mock streams, not real provider responses)",
    emptyTitle: "No streaming requests yet",
    emptyHint: "Trigger a fetch() that returns text/event-stream in the inspected page. Requests made before DevTools was opened are shown too if the page was loaded after the extension.",
    tabAssembled: "Assembled",
    tabTimeline: "Timeline",
    tabRaw: "Raw events",
    statusStreaming: "streaming",
    statusDone: "done",
    statusAborted: "aborted",
    statusError: "error",
    providerUnknown: "unknown",
    selectRequest: "Select a request on the left.",
    sectionText: "Text",
    sectionReasoning: "Reasoning",
    sectionTools: "Tool calls",
    sectionFinish: "Finish",
    sectionUsage: "Usage",
    sectionErrors: "Errors",
    sectionWarnings: "Warnings",
    noText: "(no text)",
    noTools: "(none)",
    finishRaw: "Reason: {raw}",
    finishNormalized: "Normalized: {normalized}",
    usageIn: "input {n}",
    usageOut: "output {n}",
    usageTotal: "total {n}",
    argsLabel: "Arguments",
    jsonValid: "Valid JSON",
    jsonInvalid: "Invalid JSON at position {position} (line {line}, col {col})",
    jsonDetail: "Parser says: {error}",
    metricHeaders: "Headers",
    metricTtft: "First token",
    metricMaxGap: "Longest gap",
    metricMaxGapAfter: "after chunk #{n}",
    metricStalls: "Stalls (>= {ms} ms)",
    metricTotal: "Total",
    metricChunks: "Chunks",
    metricEvents: "Events",
    metricBytes: "Bytes",
    timelineHint: "Each bar is one network chunk. The blue line is the first output, the orange band is the longest gap.",
    timelineTtft: "first output {ms} ms",
    timelineGap: "longest gap {ms} ms",
    rawIndex: "#",
    rawTime: "Time (ms)",
    rawEvent: "Event",
    rawData: "Data",
    export: "Export",
    copy: "Copy JSON",
    copied: "Copied",
    shareWarning: "The file contains the response body (conversation text). Check it before sharing.",
    truncated: "Truncated: size limit reached, later chunks are not stored",
    noticeUnknownFormat: "Unknown stream format: showing raw events and timing only",
    noticeStreamFailed: "Stream failed: {message}",
    noticeAborted: "Stream was aborted before it finished",
    noticeUnhandledEvent: "Unhandled event type: {type}",
    noticeExtraChoices: "Additional choices are ignored (only the first is shown)",
    copyFailed: "Copy failed. Use Export instead.",
    reconnecting: "Reconnecting to the extension...",
    listUnit: "ms",
    clear: "Clear",
  },
  ko: {
    appTitle: "LLM 스트림",
    language: "언어",
    privacyInfo:
      "이 탭에서 event-stream 으로 오는 fetch() 응답의 헤더와 본문만 메모리에서 읽습니다. 요청 헤더·본문은 읽지 않고 어디로도 전송하지 않습니다.",
    demoBanner: "데모 데이터 (연습용 목(mock) 스트림이며 실제 공급자 응답이 아닙니다)",
    emptyTitle: "아직 스트리밍 요청이 없습니다",
    emptyHint: "검사 중인 페이지에서 text/event-stream 을 돌려주는 fetch() 를 실행해 보세요. 확장을 설치한 뒤 페이지를 새로 열어야 그 이전 요청도 보입니다.",
    tabAssembled: "조립 결과",
    tabTimeline: "타임라인",
    tabRaw: "원시 이벤트",
    statusStreaming: "수신 중",
    statusDone: "완료",
    statusAborted: "중단됨",
    statusError: "오류",
    providerUnknown: "알 수 없음",
    selectRequest: "왼쪽에서 요청을 고르세요.",
    sectionText: "텍스트",
    sectionReasoning: "추론",
    sectionTools: "도구 호출",
    sectionFinish: "종료",
    sectionUsage: "사용량",
    sectionErrors: "오류",
    sectionWarnings: "경고",
    noText: "(텍스트 없음)",
    noTools: "(없음)",
    finishRaw: "사유: {raw}",
    finishNormalized: "정규화: {normalized}",
    usageIn: "입력 {n}",
    usageOut: "출력 {n}",
    usageTotal: "합계 {n}",
    argsLabel: "인자",
    jsonValid: "올바른 JSON",
    jsonInvalid: "{position}번째 위치에서 JSON 오류 ({line}줄 {col}열)",
    jsonDetail: "파서 설명: {error}",
    metricHeaders: "헤더",
    metricTtft: "첫 토큰",
    metricMaxGap: "최대 멈춤",
    metricMaxGapAfter: "{n}번 조각 뒤",
    metricStalls: "멈춤 ({ms} ms 이상)",
    metricTotal: "총 시간",
    metricChunks: "조각",
    metricEvents: "이벤트",
    metricBytes: "바이트",
    timelineHint: "막대 하나가 네트워크 조각 하나입니다. 파란 선은 첫 출력, 주황 띠는 가장 긴 멈춤입니다.",
    timelineTtft: "첫 출력 {ms} ms",
    timelineGap: "최대 멈춤 {ms} ms",
    rawIndex: "#",
    rawTime: "시간 (ms)",
    rawEvent: "이벤트",
    rawData: "데이터",
    export: "내보내기",
    copy: "JSON 복사",
    copied: "복사됨",
    shareWarning: "파일에 응답 본문(대화 내용)이 들어 있습니다. 공유하기 전에 확인하세요.",
    truncated: "잘림: 크기 상한에 도달해 이후 조각은 저장하지 않습니다",
    noticeUnknownFormat: "알 수 없는 스트림 형식: 원시 이벤트와 시간만 표시합니다",
    noticeStreamFailed: "스트림 실패: {message}",
    noticeAborted: "스트림이 끝나기 전에 중단되었습니다",
    noticeUnhandledEvent: "처리하지 않는 이벤트 유형: {type}",
    noticeExtraChoices: "추가 선택지는 무시합니다(첫 번째만 표시)",
    copyFailed: "복사하지 못했습니다. 대신 내보내기를 사용하세요.",
    reconnecting: "확장과 다시 연결하는 중...",
    listUnit: "ms",
    clear: "비우기",
  },
};

/** `ko`, `ko-KR`, `ko_KR.UTF-8` -> Korean; everything else -> English. */
export function langFromLocale(locale: string | undefined | null): Lang {
  return (locale ?? "").toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function translate(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const template = MESSAGES[lang][key] ?? MESSAGES.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

type KeyValueStore = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
};

/** chrome.storage.local inside the extension, localStorage in a plain browser tab. */
function store(): KeyValueStore | null {
  const c = (globalThis as { chrome?: typeof chrome }).chrome;
  if (c?.storage?.local) {
    return {
      get: async (key) => {
        const r = await c.storage.local.get(key);
        const v = r?.[key];
        return typeof v === "string" ? v : undefined;
      },
      set: async (key, value) => {
        await c.storage.local.set({ [key]: value });
      },
    };
  }
  try {
    const ls = globalThis.localStorage;
    if (ls) {
      return {
        get: async (key) => ls.getItem(key) ?? undefined,
        set: async (key, value) => ls.setItem(key, value),
      };
    }
  } catch {
    // localStorage can throw in sandboxed frames; fall through.
  }
  return null;
}

export function browserLocale(): string | undefined {
  const c = (globalThis as { chrome?: typeof chrome }).chrome;
  return c?.i18n?.getUILanguage?.() ?? globalThis.navigator?.language;
}

/** Language precedence: `?lang=` query > saved choice > browser/UI language (first run only). */
export async function loadLang(search: string = globalThis.location?.search ?? ""): Promise<Lang> {
  const q = new URLSearchParams(search).get("lang");
  if (q === "en" || q === "ko") return q;
  try {
    const saved = await store()?.get(LANG_KEY);
    if (saved === "en" || saved === "ko") return saved;
  } catch {
    // Storage unavailable: use detection.
  }
  return langFromLocale(browserLocale());
}

export async function saveLang(lang: Lang): Promise<void> {
  try {
    await store()?.set(LANG_KEY, lang);
  } catch {
    // Not fatal: the choice just will not persist.
  }
}

export type LangContextValue = {
  lang: Lang;
  setLang(lang: Lang): void;
  t(key: string, vars?: Record<string, string | number>): string;
};

export const LangContext = createContext<LangContextValue>({
  lang: "en",
  setLang: () => {},
  t: (key, vars) => translate("en", key, vars),
});

export const useLang = () => useContext(LangContext);
