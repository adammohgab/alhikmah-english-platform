import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Project GitHub Pages site: https://<user>.github.io/alhikmah-english-platform/
  base: "/alhikmah-english-platform/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
  },
});
