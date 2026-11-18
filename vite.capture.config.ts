import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Optional build for README screenshots: the panel as one classic (non-module)
// script so panel.html?demo=1 also opens from file:// (module scripts are
// blocked there). Run via `node scripts/build-capture.mjs`; output: dist-capture/.
export default defineConfig({
  publicDir: false,
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "dist-capture",
    emptyOutDir: true,
    target: "chrome120",
    minify: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(import.meta.dirname, "src/panel/main.tsx"),
      formats: ["iife"],
      name: "streamscopePanel",
      fileName: () => "panel.js",
    },
  },
});
