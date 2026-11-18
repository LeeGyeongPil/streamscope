# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.2] - 2026-11-18

### Fixed
- Cancelling the app's response body (`reader.cancel()`) now closes the original connection; the capture ends as `aborted` instead of the observer reading the stream to the end.

### Changed
- Observation now happens as the app reads: a body the app never reads is not captured, and chunk timestamps are taken when the app reads them.

## [0.1.1] - 2026-11-18

### Fixed
- End-to-end test locates the practice page tab without the `tabs` permission, so the CI e2e job passes.

## [0.1.0] - 2026-11-18

### Added
- Chrome MV3 DevTools panel "LLM Streams" (React) that reassembles streaming responses.
- MAIN-world `fetch` wrapper that mirrors `text/event-stream` responses through a clone; the app's own `Response` is untouched.
- ISOLATED relay with a capped per-tab buffer (50 requests, 5 MB or 20,000 chunks each) and a stateless service-worker router with backlog replay.
- Assembly for OpenAI Chat Completions (and compatible servers), OpenAI Responses, Anthropic Messages, Gemini `alt=sse` and Vercel AI SDK UI message streams: text, reasoning, tool-call arguments (JSON checked with position, line and column), finish reason, usage, mid-stream errors.
- Latency metrics: headers time, time to first output, longest gap, stalls, total time, chunk/event/byte counts.
- `streamscope/v1` export with a dependency-free `replay.ts` helper.
- English and Korean UI with a language menu (panel, extension name, practice page, mock server terminal output).
- Practice mock server and page (`npm start`) that stream the five formats over real HTTP.
- The panel reopens its connection when the extension's service worker is stopped while idle, shows "Reconnecting..." meanwhile, and recovers captures from the page-side buffer.
- `Assembled.notices`: coded diagnostics (`unknownFormat`, `streamFailed`, `aborted`, `truncated`, `unhandledEvent`, `extraChoices`) so the panel can translate them.
- Short hint when "Copy JSON" is blocked by the browser.
- Export and request list mask secret-looking URL query values (`key`, `api_key`, `access_token`, `token`, `sig`, ...) as `***`, so exported `url` values differ from the captured URL.
- Export drops response headers that identify an account or carry secrets (cookie, authorization, organization, project, account, token, api-key headers).
- Korean panel shows no English warning sentences; provider error text is still shown as sent.
