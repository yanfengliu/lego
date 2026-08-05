import { readFileSync } from "node:fs";

const policy = JSON.parse(
  new TextDecoder("utf8", { fatal: true }).decode(
    readFileSync(new URL("./real-build-source-roots.json", import.meta.url)),
  ),
) as { readonly schemaVersion?: unknown; readonly roots?: unknown };

if (
  policy.schemaVersion !== "lego.real-build-source-roots/1" ||
  !Array.isArray(policy.roots) ||
  policy.roots.some((root) => typeof root !== "string")
) {
  throw new TypeError("Real-build source-root policy has an unsupported or malformed schema.");
}

/** Every first-party source and pinned runtime package that can affect browser execution or Node finalization. */
export const REAL_BUILD_SOURCE_ROOTS = policy.roots as readonly string[];
