import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@lego-studio/protocol": `${root}packages/protocol/src/index.ts`,
      "@lego-studio/catalog": `${root}packages/catalog/src/index.ts`,
      "@lego-studio/brick-kernel": `${root}packages/brick-kernel/src/index.ts`,
      "@lego-studio/generation": `${root}packages/generation/src/index.ts`,
      "@lego-studio/rendering": `${root}packages/rendering/src/index.ts`,
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "apps/**/*.test.tsx"],
    restoreMocks: true,
  },
});
