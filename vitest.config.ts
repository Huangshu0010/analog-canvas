import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: false,
    },
    include: [
      "apps/**/*.test.{ts,tsx}",
      "packages/**/*.test.{ts,tsx}",
      "skills/circuit-layout/scripts/**/*.test.{ts,mjs}",
    ],
  },
});
