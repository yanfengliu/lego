import { readdirSync } from "node:fs";

import { preflightContainedPath, assertAncestorSnapshotsStable } from "./bounded-file-read";

const RESERVED_ARTIFACT_FILE =
  /^(?:score|document|diagnostic-prefix)\.json$|^step-[0-9]{3}-(?:panel|build)\.png$|^step-[0-9]{3}-farther-[0-9]{2}-(?:source-panel|candidate-render)-panel-[0-9]{3}\.png$/u;

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
  let names: string[];
  try {
    names = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && RESERVED_ARTIFACT_FILE.test(entry.name))
      .map(({ name }) => name);
  } catch (error) {
    throw new TypeError(
      `Retained artifact directory could not be enumerated to reject undeclared evidence files: ${error instanceof Error ? error.message : String(error)}.`,
      { cause: error },
    );
  }
  assertAncestorSnapshotsStable(preflight, "artifact file set");
  const undeclared = names.filter((name) => !declared.has(name));
  if (undeclared.length > 0) {
    throw new TypeError(
      `Retained artifact directory contains undeclared reserved evidence file(s): ${undeclared.sort().join(", ")}. ` +
        `Remove them or bind their exact bytes in artifact-manifest.json.`,
    );
  }
}
