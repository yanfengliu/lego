import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Serves a workspace package's TypeScript source to a probe running in the page.
 *
 * A probe must drive the same module the app ships, not a transcription of it.
 * App sources are already reachable as `/src/...`, but a package under
 * `packages/` sits outside the dev server root, so it is addressed through
 * vite's `/@fs/` prefix. The dev server's `fs.allow` already covers the
 * workspace root, and vite rewrites the module's own bare imports as it serves
 * it, so the package's dependencies resolve too.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function workspaceModuleUrl(pathFromRepoRoot: string): string {
  return `/@fs/${resolve(REPO_ROOT, pathFromRepoRoot).replaceAll("\\", "/")}`;
}

export const RENDERING_MODULE_URL = workspaceModuleUrl("packages/rendering/src/index.ts");
export const BRICK_KERNEL_MODULE_URL = workspaceModuleUrl("packages/brick-kernel/src/index.ts");
export const CATALOG_MODULE_URL = workspaceModuleUrl("packages/catalog/src/index.ts");

/**
 * App sources are served from the dev server root directly. The explicit
 * `string` annotation keeps TypeScript from resolving the literal as a module
 * specifier it would have to typecheck against a path that only exists at
 * runtime.
 */
export const MANUAL_COMMANDS_MODULE_URL: string = "/src/manual-commands.ts";

/** The closed-loop assembly engine, served the same way. */
export const ASSEMBLY_MODULE_URL: string = "/src/assembly/index.ts";
