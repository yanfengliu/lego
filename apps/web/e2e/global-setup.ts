import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

export default async function globalSetup() {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const server = await createServer({
    root: webRoot,
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port: 5267,
      strictPort: true,
    },
  });
  await server.listen();
  return async () => {
    await server.close();
  };
}
