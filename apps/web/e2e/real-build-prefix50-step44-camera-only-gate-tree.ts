import { lstatSync, realpathSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
  assertRealBuildPrefix50Step44CameraOnlyOutputEntries,
} from "./real-build-prefix50-step44-camera-only-gate-contract.ts";

const SOURCE_CROP_FILE = "real-build-prefix50-step44-page45-camera-source-crop.png";
const ELIGIBLE_MASK_FILE = "real-build-prefix50-step44-page45-camera-eligible-mask.png";
const PARENT_TARGET_MASK_FILE = "real-build-prefix50-step44-page45-camera-parent-target-mask.png";
const SELECTED_PARENT_FILE = "real-build-prefix50-step44-page45-camera-selected-parent.png";

function outputRootIdentity(outputPath: string): Readonly<{
  realPath: string;
  device: bigint;
  inode: bigint;
}> {
  const realPath = realpathSync(outputPath);
  const stat = lstatSync(realPath, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new TypeError("Camera-only Step-44 output root must remain a real directory.");
  return Object.freeze({ realPath, device: stat.dev, inode: stat.ino });
}

function requireSameOutputRoot(
  before: ReturnType<typeof outputRootIdentity>,
  outputPath: string,
): void {
  const after = outputRootIdentity(outputPath);
  if (
    after.realPath !== before.realPath ||
    after.device !== before.device ||
    after.inode !== before.inode
  )
    throw new TypeError("Camera-only Step-44 output root identity changed during verification.");
}

export async function assertRealBuildPrefix50Step44CameraOnlyOutputTree(
  outputPath: string,
  status: "complete" | "refused" = "complete",
  expectedRenderArtifactFiles?: readonly string[],
  expectedOverlayFiles?: readonly string[],
): Promise<void> {
  const root = outputRootIdentity(outputPath);
  const entries = await readdir(root.realPath, { withFileTypes: true });
  const files: string[] = [];
  const rejected: string[] = [];
  for (const entry of entries) {
    const stat = lstatSync(resolve(root.realPath, entry.name), { bigint: true });
    if (!entry.isFile() || !stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n)
      rejected.push(entry.name);
    else files.push(entry.name);
  }
  requireSameOutputRoot(root, outputPath);
  const expectedCompleteFiles =
    status === "complete"
      ? [
          "camera-only-static-app.log",
          "real-build-prefix50-step44-page45-camera-attempt.json",
          SOURCE_CROP_FILE,
          ELIGIBLE_MASK_FILE,
          PARENT_TARGET_MASK_FILE,
          SELECTED_PARENT_FILE,
          REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
          ...(expectedRenderArtifactFiles ?? []),
          ...(expectedOverlayFiles ?? []),
        ]
      : undefined;
  const expectedRefusalFiles =
    status === "refused"
      ? [
          "camera-only-static-app.log",
          "real-build-prefix50-step44-page45-camera-attempt.json",
          REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
          ...(expectedRenderArtifactFiles ?? []),
        ]
      : undefined;
  assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
    files,
    directories: rejected,
    complete: status === "complete",
    status,
    ...(expectedCompleteFiles === undefined ? {} : { expectedCompleteFiles }),
    ...(expectedRefusalFiles === undefined ? {} : { expectedRefusalFiles }),
  });
}
