import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer, searchForWorkspaceRoot } from "vite";

import { servableRoots } from "./sample-booklet";

export default async function globalSetup() {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const server = await createServer({
    root: webRoot,
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      // Set by playwright.config.ts, which picks it before Playwright reads
      // baseURL. Strict, so a clash is an error rather than a server the tests
      // then fail to reach.
      port: Number(process.env.LEGO_E2E_PORT ?? 5267),
      strictPort: true,
      // No file watching and no hot reload. A test loads the page once and
      // drives it; it never needs a module swapped underneath. What it does get
      // from watching is a full reload every time any sibling session saves a
      // file anywhere in the workspace, which navigates the page out from under
      // a running spec. That is how camera-panel-fit, highlight-region and
      // exploded-resolution each came to be reported as failing by an agent who
      // had not touched them, and one of those took a 900s timeout.
      hmr: false,
      watch: null,
      // The booklet probes import pdfjs and fetch the sample PDF over `/@fs/`.
      // Run from a worktree, both live outside the workspace vite infers, and
      // the default allow list would refuse to serve them.
      fs: { allow: [searchForWorkspaceRoot(webRoot), ...servableRoots()] },
    },
  });
  await server.listen();
  return async () => {
    await server.close();
  };
}
