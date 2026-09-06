import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Aliases are declared here rather than read from tsconfig so the test runner
 * needs no extra plugin. There are only two, and they must match the `paths`
 * block in tsconfig.json.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@payload-config": fileURLToPath(new URL("./src/payload.config.mts", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // The Payload admin bundle and Next build output are not ours to test.
    exclude: ["node_modules/**", ".next/**", "legacy/**"],
  },
});
