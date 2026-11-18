// Real-Chromium end-to-end check (CI only; needs a display, e.g. xvfb-run, and `npx playwright install chromium`).
// Loads dist/ as an unpacked extension, presses a button on the mock page and checks that the
// panel (opened as a normal tab with ?tab=<id>) shows the assembled answer.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { createMockServer } from "../scripts/mock-server.mjs";

const dist = resolve(import.meta.dirname, "..", "dist");
const server = createMockServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "streamscope-e2e-")), {
  channel: "chromium",
  headless: false,
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});

try {
  let [worker] = context.serviceWorkers();
  worker ??= await context.waitForEvent("serviceworker");
  const extId = new URL(worker.url()).host;

  const page = await context.newPage();
  await page.goto(`${base}/?lang=en`);
  await page.getByRole("button", { name: "Anthropic" }).click();
  await page.waitForFunction(() => document.body.innerText.includes("finished"));
  // The app (mock page) must still show the original stream untouched.
  assert.match(await page.locator(".card pre").first().innerText(), /message_start/);

  // Without the "tabs" permission chrome.tabs.query() hides tab URLs, so identify the mock
  // page tab by trying each candidate id (the active tab first) until the panel shows the text.
  const candidates = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return tabs
      .filter((t) => t.id !== undefined)
      .sort((x, y) => Number(y.active) - Number(x.active))
      .map((t) => t.id);
  });
  assert.ok(candidates.length > 0, "no tabs found");

  let text = null;
  for (const tabId of candidates) {
    const panel = await context.newPage();
    try {
      await panel.goto(`chrome-extension://${extId}/panel/panel.html?tab=${tabId}&lang=en`);
      await panel.getByTestId("assembled-text").waitFor({ timeout: 5000 });
      text = await panel.getByTestId("assembled-text").innerText();
      break;
    } catch {
      // Not the mock page tab (or no capture there); try the next id.
    } finally {
      await panel.close();
    }
  }
  assert.equal(text, "Hi there");
  console.log("e2e OK");
} finally {
  await context.close();
  server.closeAllConnections();
  server.close();
}
