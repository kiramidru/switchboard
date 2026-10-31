import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: "extension-dist",
    emptyOutDir: true,
    copyPublicDir: false,
    minify: true,
    target: "chrome114",
    lib: {
      entry: "src/switchboard/extension-entry.tsx",
      name: "Switchboard",
      formats: ["iife"],
      fileName: () => "switchboard.js",
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
