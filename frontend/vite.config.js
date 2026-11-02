import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Same-origin /api in dev, matching the single-service deploy planned for Saturday.
    // /auth too, so the OAuth redirect and its cookie stay on localhost:5173.
    proxy: { "/api": "http://localhost:8000", "/auth": "http://localhost:8000" },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
  },
});
