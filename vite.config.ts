import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Build 1/3: devtools page, panel and service worker (ES modules).
// Content scripts cannot be ES modules, so the MAIN-world script and the relay
// are built separately as IIFEs (vite.inject.config.ts, --mode main|relay).
export default defineConfig({
  root: "src",
  publicDir: resolve(import.meta.dirname, "public"),
  plugins: [react()],
  base: "./",
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    target: "chrome120",
    minify: false,
    rollupOptions: {
      input: {
        devtools: resolve(import.meta.dirname, "src/devtools/devtools.html"),
        panel: resolve(import.meta.dirname, "src/panel/panel.html"),
        sw: resolve(import.meta.dirname, "src/background/sw.ts"),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "sw" ? "sw.js" : "assets/[name]-[hash].js"),
      },
    },
  },
});
