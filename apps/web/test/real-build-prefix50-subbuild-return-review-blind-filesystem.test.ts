import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { requireRealBuildPrefix50Step44ExactWithheldTree } from "../e2e/real-build-prefix50-subbuild-return-review-blind-filesystem.ts";
import type { RealBuildPrefix50Step44BatchCaptureRow } from "../e2e/real-build-prefix50-subbuild-return-review-contact-sheet-source.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS } from "../e2e/real-build-prefix50-subbuild-return-review-views.ts";

const roots: string[] = [];

const ROOT_FILES = [
  "real-build-prefix50-step44-blind-dispatch-plan.json",
  "real-build-prefix50-step44-page45-camera-attempt.json",
  "real-build-prefix50-step44-page45-camera-eligible-mask.png",
  "real-build-prefix50-step44-page45-camera-parent-target-mask.png",
  "real-build-prefix50-step44-page45-camera-selected-parent.png",
  "real-build-prefix50-step44-page45-camera-source-crop.png",
  "real-build-prefix50-step44-unblinding-map.json",
  "real-build-prefix50-step44-withheld-batch-capture-manifest.json",
  "vite.log",
] as const;

const CAMERA_FILES = [
  "real-build-prefix50-step44-page45-camera-branch-00-seed.png",
  "real-build-prefix50-step44-page45-camera-branch-00-semantic-blue-cyan.png",
  "real-build-prefix50-step44-page45-camera-beauty-restoration-control.png",
] as const;

const CANDIDATE_FILES = [
  "real-build-prefix50-step44-capture-manifest.json",
  "real-build-prefix50-step44-page45-fixed-camera-delta.png",
  "real-build-prefix50-step44-page45-fixed-camera.png",
  ...REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS.map(
    ({ reviewedView }) => `real-build-prefix50-step44-${reviewedView}.png`,
  ),
] as const;

function regular(path: string): void {
  writeFileSync(path, "fixture", { flag: "wx" });
}

function fixture(): {
  readonly root: string;
  readonly captures: readonly RealBuildPrefix50Step44BatchCaptureRow[];
} {
  const root = resolve(mkdtempSync(join(tmpdir(), "lego-step44-withheld-tree-")));
  roots.push(root);
  for (const file of [...ROOT_FILES, ...CAMERA_FILES]) regular(resolve(root, file));
  const captures = [0, 1].map((index) => {
    const blindId = `B${String(index + 1).padStart(3, "0")}` as `B${string}`;
    mkdirSync(resolve(root, blindId));
    for (const file of CANDIDATE_FILES) regular(resolve(root, blindId, file));
    return {
      blindId,
      artifactDirectory: blindId,
      captureManifestFile: "real-build-prefix50-step44-capture-manifest.json",
    } as unknown as RealBuildPrefix50Step44BatchCaptureRow;
  });
  return { root, captures };
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Step-44 exact withheld production tree", () => {
  it("accepts the verified dynamic camera-attempt roster alongside exact candidate roots", () => {
    const { root, captures } = fixture();

    expect(() =>
      requireRealBuildPrefix50Step44ExactWithheldTree({
        withheldRoot: root,
        captures,
        cameraAttemptArtifactFiles: CAMERA_FILES,
      }),
    ).not.toThrow();
  });

  it("rejects an omitted attempt render, an extra root entry, and candidate-roster drift", () => {
    const missing = fixture();
    unlinkSync(resolve(missing.root, CAMERA_FILES[0]));
    expect(() =>
      requireRealBuildPrefix50Step44ExactWithheldTree({
        withheldRoot: missing.root,
        captures: missing.captures,
        cameraAttemptArtifactFiles: CAMERA_FILES,
      }),
    ).toThrow(/withheld production tree/iu);

    const extra = fixture();
    regular(resolve(extra.root, "unexpected-root-file.png"));
    expect(() =>
      requireRealBuildPrefix50Step44ExactWithheldTree({
        withheldRoot: extra.root,
        captures: extra.captures,
        cameraAttemptArtifactFiles: CAMERA_FILES,
      }),
    ).toThrow(/withheld production tree/iu);

    const candidate = fixture();
    mkdirSync(resolve(candidate.root, "B003"));
    expect(() =>
      requireRealBuildPrefix50Step44ExactWithheldTree({
        withheldRoot: candidate.root,
        captures: candidate.captures,
        cameraAttemptArtifactFiles: CAMERA_FILES,
      }),
    ).toThrow(/withheld production tree/iu);
  });
});
