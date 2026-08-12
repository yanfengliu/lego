import { readdirSync, type Dirent } from "node:fs";

import { preflightContainedPath, assertAncestorSnapshotsStable } from "./bounded-file-read";

const RESERVED_ARTIFACT_FILE =
  /^(?:(?:score|document|diagnostic-prefix|served-response-manifest)\.json|served-response-bodies-[0-9]{3}\.bin|step-[0-9]{3}-(?:panel|build)\.png|step-[0-9]{3}-farther-[0-9]{2}-(?:source-panel|candidate-render)-panel-[0-9]{3}\.png)$/u;

/** Refuses evidence-looking top-level files that the immutable manifest did not declare. */
export function assertNoUndeclaredRealBuildArtifacts(
  directory: string,
  declared: ReadonlySet<string>,
): void {
  const preflight = preflightContainedPath(
    directory,
    "artifact-manifest.json",
    "artifact file set",
  );
  let entries: Dirent[];
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    throw new TypeError(
      `Retained artifact directory could not be enumerated to reject undeclared evidence files: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  assertAncestorSnapshotsStable(preflight, "artifact file set");
  const reserved = entries.filter(({ name }) => RESERVED_ARTIFACT_FILE.test(name));
  const undeclared = reserved.filter(({ name }) => !declared.has(name)).map(({ name }) => name);
  if (undeclared.length > 0) {
    throw new TypeError(
      `Retained artifact directory contains undeclared reserved evidence file(s): ${undeclared.sort().join(", ")}. ` +
        `Remove them or bind their exact bytes in artifact-manifest.json.`,
    );
  }
  const nonRegular = reserved.filter((entry) => !entry.isFile()).map(({ name }) => name);
  if (nonRegular.length > 0) {
    throw new TypeError(
      `Declared reserved evidence path(s) are not regular non-link files: ${nonRegular.sort().join(", ")}. ` +
        `Replace each directory, symbolic link, or junction with the exact regular file bound by artifact-manifest.json.`,
    );
  }
}
