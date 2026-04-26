import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Load env from .env.local first, then fall back to .env. CI passes env
// via GitHub Actions and these are no-ops there.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "out", "build"],
    testTimeout: 15000,
  },
});
