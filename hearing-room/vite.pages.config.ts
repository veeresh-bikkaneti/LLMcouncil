import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function pagesIndexAtRoot(): Plugin {
  return {
    name: "pages-index-at-root",
    apply: "build",
    closeBundle() {
      const outDir = resolve("dist-pages");
      const nested = resolve(outDir, "pages/index.html");
      if (existsSync(nested)) copyFileSync(nested, resolve(outDir, "index.html"));
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, ".nojekyll"), "");
    },
  };
}

export default defineConfig({
  base: process.env.PAGES_BASE || "/LLMcouncil/",
  publicDir: "public",
  resolve: { tsconfigPaths: true },
  plugins: [tailwindcss(), viteReact(), pagesIndexAtRoot()],
  build: {
    outDir: "dist-pages",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve("pages/index.html"),
    },
  },
});
