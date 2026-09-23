import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Lets Node 24's type stripping run this repository's TypeScript directly.
 *
 * Two resolutions Node cannot make on its own:
 * - `@lego-studio/*` goes to this checkout's `packages/<name>/src/index.ts`,
 *   the same mapping tsconfig `paths` and the vitest aliases use. Resolving it
 *   through node_modules instead would load whichever checkout the workspace
 *   symlinks point at — from a worktree, the main checkout's packages.
 * - Relative imports written without an extension (the style of
 *   apps/web/src) retry with `.ts`.
 */
export const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const WORKSPACE_PACKAGES = new Map(
  ["protocol", "catalog", "brick-kernel", "rendering"].map((name) => [
    `@lego-studio/${name}`,
    pathToFileURL(resolve(REPOSITORY_ROOT, "packages", name, "src", "index.ts")).href,
  ]),
);

let registered = false;

export function registerBookletHooks() {
  if (registered) return;
  for (const url of WORKSPACE_PACKAGES.values()) {
    if (!existsSync(fileURLToPath(url))) {
      throw new Error(
        `Workspace entry ${fileURLToPath(url)} is missing; run the booklet harness from a complete checkout of this repository.`,
      );
    }
  }
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const workspace = WORKSPACE_PACKAGES.get(specifier);
      if (workspace !== undefined) return nextResolve(workspace, context);
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        if (
          error?.code === "ERR_MODULE_NOT_FOUND" &&
          (specifier.startsWith("./") || specifier.startsWith("../")) &&
          !/\.[cm]?[jt]sx?$/u.test(specifier)
        ) {
          return nextResolve(`${specifier}.ts`, context);
        }
        throw error;
      }
    },
  });
  registered = true;
}
