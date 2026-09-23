import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

import type { RealBuildPrefix50Step44BatchCaptureRow } from "./real-build-prefix50-subbuild-return-review-contact-sheet-source.ts";
import type { RealBuildPrefix50Step44ClaimedDirectoryIdentity } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS } from "./real-build-prefix50-subbuild-return-review-views.ts";

const WITHHELD_ROOT_FILES = [
  "real-build-prefix50-step44-blind-dispatch-plan.json",
  "real-build-prefix50-step44-page45-camera-eligible-mask.png",
  "real-build-prefix50-step44-page45-camera-parent-target-mask.png",
  "real-build-prefix50-step44-page45-camera-selected-parent.png",
  "real-build-prefix50-step44-page45-camera-source-crop.png",
  "real-build-prefix50-step44-unblinding-map.json",
  "real-build-prefix50-step44-withheld-batch-capture-manifest.json",
  "vite.log",
] as const;

const CANDIDATE_FILES = [
  "real-build-prefix50-step44-capture-manifest.json",
  "real-build-prefix50-step44-page45-fixed-camera-delta.png",
  "real-build-prefix50-step44-page45-fixed-camera.png",
  ...REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS.map(
    ({ reviewedView }) => `real-build-prefix50-step44-${reviewedView}.png`,
  ),
].sort();

function requireExactNames(actual: readonly string[], expected: readonly string[], label: string) {
  const found = [...actual].sort();
  const wanted = [...expected].sort();
  if (found.length !== wanted.length || found.some((name, index) => name !== wanted[index]))
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
}

export function requireRealBuildPrefix50Step44ExactRealDirectory(
  directory: string,
  label: string,
): string {
  const lexical = resolve(directory);
  const before = lstatSync(lexical, { bigint: true });
  const real = realpathSync(lexical);
  const after = lstatSync(lexical, { bigint: true });
  if (
    lexical !== directory ||
    real !== lexical ||
    !before.isDirectory() ||
    before.isSymbolicLink() ||
    !after.isDirectory() ||
    after.isSymbolicLink() ||
    before.dev !== after.dev ||
    before.ino !== after.ino
  )
    throw new TypeError(`${label} must be one stable absolute real directory, not an alias/link.`);
  return lexical;
}

export function requireRealBuildPrefix50Step44ClaimedDirectoryIdentity(
  identity: RealBuildPrefix50Step44ClaimedDirectoryIdentity,
  directory: string,
  label: string,
): void {
  const lexical = requireRealBuildPrefix50Step44ExactRealDirectory(directory, label);
  const stats = lstatSync(lexical, { bigint: true });
  if (
    identity.lexicalPath !== lexical ||
    identity.realPath !== lexical ||
    identity.device !== stats.dev.toString(10) ||
    identity.inode !== stats.ino.toString(10)
  )
    throw new TypeError(`${label} does not match its exact committed directory identity.`);
}

function requireRegularFile(path: string, label: string): void {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink())
    throw new TypeError(`${label} must be one regular file, not a link or special entry.`);
}

export function requireRealBuildPrefix50Step44ExactWithheldTree(input: {
  readonly withheldRoot: string;
  readonly captures: readonly RealBuildPrefix50Step44BatchCaptureRow[];
  readonly cameraAttemptArtifactFiles: readonly string[];
}): void {
  const root = requireRealBuildPrefix50Step44ExactRealDirectory(
    input.withheldRoot,
    "Step-44 withheld root",
  );
  const candidateDirectories = input.captures.map(({ artifactDirectory }) => artifactDirectory);
  requireExactNames(
    readdirSync(root),
    [
      ...WITHHELD_ROOT_FILES,
      "real-build-prefix50-step44-page45-camera-attempt.json",
      ...input.cameraAttemptArtifactFiles,
      ...candidateDirectories,
    ],
    "Step-44 withheld production tree",
  );
  for (const file of WITHHELD_ROOT_FILES)
    requireRegularFile(resolve(root, file), `Step-44 withheld root file ${file}`);
  requireRegularFile(
    resolve(root, "real-build-prefix50-step44-page45-camera-attempt.json"),
    "Step-44 withheld persisted camera-attempt receipt",
  );
  for (const file of input.cameraAttemptArtifactFiles)
    requireRegularFile(resolve(root, file), `Step-44 withheld camera-attempt artifact ${file}`);
  for (const [index, capture] of input.captures.entries()) {
    const blindId = `B${String(index + 1).padStart(3, "0")}`;
    if (
      capture.blindId !== blindId ||
      capture.artifactDirectory !== blindId ||
      capture.captureManifestFile !== "real-build-prefix50-step44-capture-manifest.json"
    )
      throw new TypeError(`Step-44 withheld candidate root ${blindId} drifted.`);
    const directory = requireRealBuildPrefix50Step44ExactRealDirectory(
      resolve(root, blindId),
      `Step-44 withheld candidate root ${blindId}`,
    );
    requireExactNames(
      readdirSync(directory),
      CANDIDATE_FILES,
      `Step-44 withheld candidate root ${blindId}`,
    );
    for (const file of CANDIDATE_FILES)
      requireRegularFile(resolve(directory, file), `Step-44 ${blindId} artifact ${file}`);
  }
}
