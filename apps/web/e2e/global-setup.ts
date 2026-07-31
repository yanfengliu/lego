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
      port: 5267,
      strictPort: true,
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
