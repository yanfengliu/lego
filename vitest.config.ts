import { fileURLToPath } from "node:url";

import { configDefaults, defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Scoring runs, not unit tests: each measures the real booklet or a grown
 * assembly and records the number under `output/`. They run through
 * `npm run test:score` (`vitest.score.config.ts`) and stay out of `npm test`,
 * where the placement-branching curve alone took 100-134 s and overran its
 * own 120 s budget on a loaded machine.
 */
export const SCORE_TESTS = ["apps/**/*.score.test.ts"];

export default defineConfig({
  resolve: {
    alias: {
      "@lego-studio/protocol": `${root}packages/protocol/src/index.ts`,
      "@lego-studio/catalog": `${root}packages/catalog/src/index.ts`,
      "@lego-studio/brick-kernel": `${root}packages/brick-kernel/src/index.ts`,
      "@lego-studio/rendering": `${root}packages/rendering/src/index.ts`,
    },
  },
  test: {
    environment: "node",
    // Eight was the fastest isolated full-corpus pass; sixteen caused migrating timeouts.
    maxWorkers: 8,
    include: [
      "packages/**/*.test.ts",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
      "scripts/**/*.test.mjs",
    ],
    exclude: [...configDefaults.exclude, ...SCORE_TESTS],
    restoreMocks: true,
  },
});
