import { createHash } from "node:crypto";
import { lstatSync } from "node:fs";

import {
  assertAncestorSnapshotsStable,
  preflightContainedPath,
  readContainedBoundedRegularFile,
  type BoundedFileRaceTestHooks,
} from "./bounded-file-read.ts";
import {
  reconcileContainedRegularFileAtomicTemporary,
  writeContainedRegularFileAtomic,
  type ContainedAtomicWritePolicy,
} from "./contained-atomic-write.ts";

export interface RealBuildPrefix50Step44ExactArtifact {
  readonly root: string;
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly label: string;
}

export interface RealBuildPrefix50Step44ExactArtifactHooks {
  readonly read?: BoundedFileRaceTestHooks;
  readonly write?: ContainedAtomicWritePolicy["__testHooks"];
}

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function missing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/**
 * Returns true only after one descriptor proved the existing final path has the expected bytes.
 * Absence is not success; it means the atomic publisher may create this exact path later.
 */
export function preflightRealBuildPrefix50Step44ExactArtifact(
  artifact: RealBuildPrefix50Step44ExactArtifact,
  hooks: RealBuildPrefix50Step44ExactArtifactHooks = {},
): boolean {
  const preflight = preflightContainedPath(artifact.root, artifact.path, artifact.label);
  assertAncestorSnapshotsStable(preflight, artifact.label);
  try {
    const stat = lstatSync(preflight.target);
    if (stat.isSymbolicLink() || !stat.isFile())
      throw new TypeError(`${artifact.label} existing final path must be a regular file.`);
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
  readContainedBoundedRegularFile(artifact.root, artifact.path, {
    label: artifact.label,
    exactBytes: artifact.bytes.byteLength,
    maximumBytes: artifact.bytes.byteLength,
    minimumBytes: artifact.bytes.byteLength,
    expectedSha256: digest(artifact.bytes),
    ...(hooks.read === undefined ? {} : { __testHooks: hooks.read }),
  });
  return true;
}

export function preflightRealBuildPrefix50Step44ExactArtifacts(
  artifacts: readonly RealBuildPrefix50Step44ExactArtifact[],
): void {
  for (const artifact of artifacts) preflightRealBuildPrefix50Step44ExactArtifact(artifact);
}

/** Creates no partial final path: the task-owned same-directory temporary is fsynced first. */
export function writeOrResumeRealBuildPrefix50Step44ExactArtifact(
  artifact: RealBuildPrefix50Step44ExactArtifact,
  policy: Readonly<{
    beforePublish?: () => void;
    afterPublish?: () => void;
    hooks?: RealBuildPrefix50Step44ExactArtifactHooks;
  }> = {},
): void {
  if (preflightRealBuildPrefix50Step44ExactArtifact(artifact, policy.hooks)) {
    reconcileContainedRegularFileAtomicTemporary(
      artifact.root,
      artifact.path,
      artifact.bytes,
      artifact.label,
    );
    return;
  }
  try {
    writeContainedRegularFileAtomic(artifact.root, artifact.path, artifact.bytes, {
      label: artifact.label,
      ...(policy.beforePublish === undefined ? {} : { beforePublish: policy.beforePublish }),
      ...(policy.afterPublish === undefined ? {} : { afterPublish: policy.afterPublish }),
      ...(policy.hooks?.write === undefined ? {} : { __testHooks: policy.hooks.write }),
    });
  } catch (error) {
    // A concurrent exact publisher may have won the no-replace race. Only identical final bytes
    // turn that race into a resumable success; every other result remains the original conflict.
    try {
      if (preflightRealBuildPrefix50Step44ExactArtifact(artifact, policy.hooks)) {
        reconcileContainedRegularFileAtomicTemporary(
          artifact.root,
          artifact.path,
          artifact.bytes,
          artifact.label,
        );
        return;
      }
    } catch {
      // Preserve the atomic publisher's more precise failure and cause chain.
    }
    throw error;
  }
}
