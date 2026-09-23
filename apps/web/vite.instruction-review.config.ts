import { defineConfig, mergeConfig } from "vite";

import appConfig from "./vite.config";

// A local, static harness build with read-only inspection/capture hooks. Keep it
// separate from normal dist: the production bundle guard must still forbid hooks.
export default defineConfig(
  mergeConfig(appConfig, {
    define: { "import.meta.env.DEV": "true" },
    build: { outDir: "e2e/static-app/dist" },
  }),
);
