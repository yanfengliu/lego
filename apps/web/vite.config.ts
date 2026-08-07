import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  /**
   * Keep the workspace packages and their hashing dependency out of the
   * dependency pre-bundle, so a bare import resolves to the source file that
   * was asked for rather than to a shared cache.
   *
   * This is a correctness requirement of the sealed real-build replay, not a
   * build-speed preference. That run materializes a byte-exact source mirror
   * under the run directory, serves it over `/@fs/`, and refuses any request
   * that lands outside it. Left to optimize these, vite rewrites
   * `@lego-studio/catalog` inside the mirrored `brick-kernel/src/index.ts` to
   * `/node_modules/.vite/deps/@lego-studio_catalog.js` — a file in the ordinary
   * checkout that the mirror never vouched for. The route policy blocked four
   * such requests, the module failed to load, and the run reported an opaque
   * `Failed to fetch dynamically imported module`.
   *
   * The refusal was right and the substitution was the defect: a mirror can be
   * byte-exact and still execute code from somewhere else, which is precisely
   * what the replay boundary exists to prevent. All four already sit inside the
   * mirror's declared roots; only the rewrite put them out of reach.
   *
   * This closes four of the six escapes and does not close the last two, which
   * are `ajv`'s CommonJS runtime helpers reached through the protocol package's
   * schema validator. Excluding `ajv` as well makes every request land inside
   * the mirror, and then the module fails a different way: pre-bundling is also
   * what converts that CommonJS into ESM, so served raw it provides no default
   * export. Both halves are recorded rather than one being traded for the
   * other. Closing it properly is a decision about the replay boundary — give
   * the mirror its own dep cache, admit dep-cache URLs with their digests
   * recorded, or take CommonJS off the browser runtime path — and it belongs to
   * whoever owns that boundary.
   */
  optimizeDeps: {
    exclude: [
      "@lego-studio/brick-kernel",
      "@lego-studio/catalog",
      "@lego-studio/protocol",
      "@lego-studio/rendering",
      "@noble/hashes",
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});
