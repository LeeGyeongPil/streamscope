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

  const tabId = await worker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((t) => t.url?.startsWith(url))?.id;
  }, base);
  assert.ok(tabId !== undefined, "could not find the mock page tab");

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/panel/panel.html?tab=${tabId}&lang=en`);
  await panel.getByTestId("assembled-text").waitFor();
  assert.equal(await panel.getByTestId("assembled-text").innerText(), "Hi there");
  console.log("e2e OK");
} finally {
  await context.close();
  server.closeAllConnections();
  server.close();
}
