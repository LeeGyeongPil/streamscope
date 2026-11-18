// Builds the panel as a classic script plus a plain HTML page (dist-capture/panel.html)
// that works from file:// for screenshots. Not part of the extension.
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";

execFileSync("npx", ["vite", "build", "--config", "vite.capture.config.ts"], { stdio: "inherit" });
const css = readdirSync("dist-capture").find((f) => f.endsWith(".css"));
writeFileSync(
  "dist-capture/panel.html",
  `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LLM Streams</title>
    ${css ? `<link rel="stylesheet" href="./${css}" />` : ""}
  </head>
  <body>
    <div id="root"></div>
    <script src="./panel.js"></script>
  </body>
</html>
`,
);
console.log("dist-capture/panel.html ready");
