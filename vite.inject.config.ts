import { defineConfig } from "vite";
import { resolve } from "node:path";

// Builds 2 and 3: content scripts as import-free IIFE files.
//   vite build --config vite.inject.config.ts --mode main   -> dist/main.js (MAIN world)
//   vite build --config vite.inject.config.ts --mode relay  -> dist/relay.js (ISOLATED world)
export default defineConfig(({ mode }) => {
  const entry = mode === "relay" ? "src/content/relay.ts" : "src/inject/main.ts";
  const file = mode === "relay" ? "relay.js" : "main.js";
  return {
    publicDir: false,
    build: {
      outDir: "dist",
      emptyOutDir: false,
      target: "chrome120",
      minify: false,
      lib: {
        entry: resolve(import.meta.dirname, entry),
        formats: ["iife"],
        name: mode === "relay" ? "streamscopeRelay" : "streamscopeInject",
        fileName: () => file,
      },
    },
  };
});
