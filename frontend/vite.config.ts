import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Project GitHub Pages site: https://<user>.github.io/alhikmah-english-platform/
  base: "/alhikmah-english-platform/",
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
