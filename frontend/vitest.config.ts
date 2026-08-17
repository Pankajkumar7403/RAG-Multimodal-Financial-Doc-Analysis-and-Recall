import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      "server-only": path.resolve(import.meta.dirname, "tests/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
});
