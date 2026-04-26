import { defineConfig } from "vitest/config";

export default defineConfig({
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "out", "build"],
  },
});
