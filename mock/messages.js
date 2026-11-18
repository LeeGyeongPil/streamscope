// Mock page texts. Both languages must define exactly the same keys (tests check this).
export const MESSAGES = {
  en: {
    title: "streamscope practice page",
    notice: "Practice mock server: these streams imitate public event formats and are not real provider responses. Open DevTools > \"LLM Streams\" to see them assembled.",
    language: "Language",
    optChunk: "Chunk size (bytes)",
    optStall: "250 ms pause in the middle",
    optBroken: "Broken tool arguments (Anthropic)",
    optError: "Mid-stream error event",
    optAbort: "Cut the connection halfway",
    optCancel: "Cancel from the app after 300 ms",
    runAll: "Run all",
    received: "What this page received (unchanged):",
    status: "status",
    idle: "idle",
    running: "running",
    finished: "finished",
    failed: "failed: {message}",
    cancelled: "cancelled by the app",
    bytes: "{n} bytes",
  },
  ko: {
    title: "streamscope 연습 페이지",
    notice: "연습용 목(mock) 서버: 이 스트림은 공개 문서의 이벤트 형식을 흉내 낸 것이며 실제 공급자 응답이 아닙니다. DevTools > \"LLM Streams\" 에서 조립된 결과를 확인하세요.",
    language: "언어",
    optChunk: "조각 크기(바이트)",
    optStall: "중간에 250 ms 멈춤",
    optBroken: "깨진 도구 인자 (Anthropic)",
    optError: "스트림 중간 오류 이벤트",
    optAbort: "중간에 연결 끊기",
    optCancel: "300 ms 뒤 앱에서 취소",
    runAll: "모두 실행",
    received: "이 페이지가 받은 내용(변경 없음):",
    status: "상태",
    idle: "대기",
    running: "수신 중",
    finished: "완료",
    failed: "실패: {message}",
    cancelled: "앱에서 취소함",
    bytes: "{n} 바이트",
  },
};

export function langFromLocale(locale) {
  return String(locale || "").toLowerCase().startsWith("ko") ? "ko" : "en";
}

export function translate(lang, key, vars = {}) {
  const template = (MESSAGES[lang] && MESSAGES[lang][key]) || MESSAGES.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
