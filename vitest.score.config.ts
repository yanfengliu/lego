import { configDefaults, defineConfig } from "vitest/config";

import base, { SCORE_TESTS } from "./vitest.config";

/** `npm run test:score`: only the scoring runs that `vitest.config.ts` keeps out of `npm test`. */
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: SCORE_TESTS,
    exclude: [...configDefaults.exclude],
  },
});
