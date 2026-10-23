import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // GitHub Pages serves this project from a repository subpath; Vercel and local dev use the domain root.
  base: process.env.GITHUB_ACTIONS === "true" ? "/alhikmah-english-platform/" : "/",
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${fileURLToPath(new URL("./src/", import.meta.url))}/`,
      },
    ],
  },
  server: {
    port: 5173,
  },
});
