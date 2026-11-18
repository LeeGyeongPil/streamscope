// Verifies that dist/ is a loadable MV3 extension. Prints "dist OK" as the last line on success.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const problems = [];
const fail = (msg) => problems.push(msg);

function readJson(rel) {
  const p = join(dist, rel);
  if (!existsSync(p)) {
    fail(`missing ${rel} (run \`npm run build\` first)`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    fail(`${rel} is not valid JSON: ${e.message}`);
    return null;
  }
}

const m = readJson("manifest.json");
if (m) {
  if (m.manifest_version !== 3) fail(`manifest_version must be 3, got ${m.manifest_version}`);
  if (!m.devtools_page) fail("devtools_page is missing");
  if (m.minimum_chrome_version !== "120") fail(`minimum_chrome_version must be "120", got ${JSON.stringify(m.minimum_chrome_version)}`);
  if (m.default_locale !== "en") fail('default_locale must be "en"');
  if (JSON.stringify(m.permissions) !== JSON.stringify(["storage"])) fail(`permissions must be exactly ["storage"], got ${JSON.stringify(m.permissions)}`);
  if (m.host_permissions && m.host_permissions.length) fail("host_permissions must be empty");

  const main = (m.content_scripts ?? []).find((c) => c.world === "MAIN");
  if (!main) fail("no content script with world MAIN");
  else if (main.run_at !== "document_start") fail('MAIN-world content script must use run_at "document_start"');

  // Every file the manifest points at must exist.
  const refs = new Set();
  if (m.devtools_page) refs.add(m.devtools_page);
  if (m.background?.service_worker) refs.add(m.background.service_worker);
  for (const c of m.content_scripts ?? []) for (const f of [...(c.js ?? []), ...(c.css ?? [])]) refs.add(f);
  for (const f of Object.values(m.icons ?? {})) refs.add(f);
  for (const f of refs) if (!existsSync(join(dist, f))) fail(`manifest references missing file: ${f}`);

  // The panel page is opened from devtools.js by path, so check it too.
  if (!existsSync(join(dist, "panel", "panel.html"))) fail("panel/panel.html is missing");
}

// Content scripts cannot be ES modules.
for (const f of ["main.js", "relay.js"]) {
  const p = join(dist, f);
  if (!existsSync(p)) continue;
  const src = readFileSync(p, "utf8");
  if (/^\s*(import|export)\s/m.test(src)) fail(`${f} contains import/export statements (must be a classic script)`);
}

// Locales: same keys in en and ko.
const en = readJson("_locales/en/messages.json");
const ko = readJson("_locales/ko/messages.json");
if (en && ko) {
  const a = Object.keys(en).sort().join(",");
  const b = Object.keys(ko).sort().join(",");
  if (a !== b) fail(`_locales key mismatch: en=[${a}] ko=[${b}]`);
}

if (problems.length) {
  for (const p of problems) console.error(`dist check failed: ${p}`);
  process.exit(1);
}
console.log("dist OK");
