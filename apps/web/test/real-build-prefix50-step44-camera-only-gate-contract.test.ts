import { createHash } from "node:crypto";
import { link, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA } from "../e2e/real-build-bootstrap-source";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_BYTES_HASH,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
  assertRealBuildPrefix50Step44CameraOnlyOutputEntries,
  assertRealBuildPrefix50Step44CameraOnlyVerifiedAttemptBinding,
  requireRealBuildPrefix50Step44CameraOnlyOutputName,
} from "../e2e/real-build-prefix50-step44-camera-only-gate-contract";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_ELIGIBLE_MASK_FILE,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SELECTED_PARENT_FILE,
  assertRealBuildPrefix50Step44CameraOnlyOutputTree,
  assertRealBuildPrefix50Step44CameraOnlyPersistedArtifactPixels,
  writeRealBuildPrefix50Step44CameraOnlyManifest,
} from "../e2e/real-build-prefix50-step44-camera-only-gate-artifacts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
  assertRealBuildPrefix50Step44CameraOnlyManifestSourceLock,
  assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock,
  assertRealBuildPrefix50Step44CameraOnlySourceLock,
  type RealBuildPrefix50Step44CameraOnlyLiveSourceLock,
} from "../e2e/real-build-prefix50-step44-camera-only-source-lock";
import { REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT } from "../e2e/real-build-prefix50-subbuild-return-review-camera-calibration";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
} from "../e2e/real-build-prefix50-step44-panel-face-prefix";

const fixedFiles = [
  "camera-only-static-app.log",
  "real-build-prefix50-step44-page45-camera-attempt.json",
  "real-build-prefix50-step44-page45-camera-source-crop.png",
  "real-build-prefix50-step44-page45-camera-eligible-mask.png",
  "real-build-prefix50-step44-page45-camera-parent-target-mask.png",
  "real-build-prefix50-step44-page45-camera-selected-parent.png",
  "real-build-prefix50-step44-page45-camera-beauty-restoration-control.png",
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
] as const;

function sha256(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

const bootstrapDigest = `sha256:${"a".repeat(64)}` as const;
const repositoryRoot = "C:\\exact-camera-gate-repository";
const bootstrapFiles = [
  { path: "playwright.config.ts", digest: `sha256:${"c".repeat(64)}`, bytes: 1 },
  {
    path: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    digest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    bytes: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
  },
] as const;

function exactLockManifestDigest(
  files: readonly { readonly path: string; readonly digest: string; readonly bytes: number }[],
): `sha256:${string}` {
  return sha256(
    Buffer.from(
      `${JSON.stringify({ schemaVersion: REAL_BUILD_BOOTSTRAP_LOCK_SCHEMA, files })}\n`,
      "utf8",
    ),
  );
}

const lockManifestDigest = exactLockManifestDigest(bootstrapFiles);
const commonSourceRows = [bootstrapFiles[1]!] as const;
const commonBootstrapDigest = sha256(
  Buffer.from(
    JSON.stringify({
      schemaVersion: "lego.real-build-prefix50-step44-common-source-roster/1",
      files: commonSourceRows,
    }),
    "utf8",
  ),
);
const commonLockManifestDigest = exactLockManifestDigest(commonSourceRows);
function sourceLockInput(
  files: readonly {
    readonly path: string;
    readonly digest: string;
    readonly bytes: number;
  }[] = bootstrapFiles,
  identity: Readonly<{
    directory?: string;
    helperPid?: number;
    lockManifestDigest?: `sha256:${string}`;
  }> = {},
) {
  return {
    repositoryRoot,
    manifest: { manifestDigest: bootstrapDigest, files },
    lock: {
      repoRoot: repositoryRoot,
      directory: identity.directory ?? "C:\\exact-camera-gate-lock",
      helperPid: identity.helperPid ?? 1234,
      lockManifestDigest: identity.lockManifestDigest ?? exactLockManifestDigest(files),
      lockedFiles: files.length,
      lockedBytes: files.reduce((total, file) => total + file.bytes, 0),
    },
  };
}

describe("prefix-50 Step-44 camera-only gate boundary", () => {
  it("derives one mode-neutral page44 source identity from each exact live lock", () => {
    const evidence = assertRealBuildPrefix50Step44CameraOnlySourceLock(sourceLockInput());
    expect(evidence).toEqual({
      schemaVersion: "lego.real-build-prefix50-step44-camera-only-source-lock/1",
      bootstrapSourceManifestDigest: commonBootstrapDigest,
      lockManifestDigest: commonLockManifestDigest,
      lockedFileCount: 1,
      lockedByteCount: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
      sourcePdf: {
        artifactPath: "recipes/6651557.pdf",
        byteDigest: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
        bytes: 70_238_655,
      },
      commitment: canonicalDigest({
        schemaVersion: "lego.real-build-prefix50-step44-camera-only-source-lock/1",
        bootstrapSourceManifestDigest: commonBootstrapDigest,
        lockManifestDigest: commonLockManifestDigest,
        lockedFileCount: 1,
        lockedByteCount: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SOURCE_PDF_BYTES,
        sourcePdf: {
          artifactPath: "recipes/6651557.pdf",
          byteDigest: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
          bytes: 70_238_655,
        },
      }),
    });
    expect(
      assertRealBuildPrefix50Step44CameraOnlySourceLock(
        sourceLockInput([
          bootstrapFiles[0],
          {
            path: "apps/web/e2e/operation-specific-safe.ts",
            digest: sha256(Buffer.from("safe")),
            bytes: 4,
          },
          bootstrapFiles[1],
        ]),
      ),
    ).toEqual(evidence);
  });

  it("rejects missing, duplicate, wrong-size, and wrong-digest PDF lock rows", () => {
    const other = bootstrapFiles[0];
    const pdf = bootstrapFiles[1];
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlySourceLock(sourceLockInput([other])),
    ).toThrow("exactly one recipes/6651557.pdf entry; observed 0");
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlySourceLock(sourceLockInput([other, pdf, pdf])),
    ).toThrow("exactly one recipes/6651557.pdf entry; observed 2");
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlySourceLock(
        sourceLockInput([{ ...pdf, bytes: pdf.bytes - 1 }]),
      ),
    ).toThrow("must bind recipes/6651557.pdf as exactly 70238655 bytes");
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlySourceLock(
        sourceLockInput([{ ...pdf, digest: `sha256:${"d".repeat(64)}` }]),
      ),
    ).toThrow("must bind recipes/6651557.pdf as exactly 70238655 bytes");
  });

  it("rejects a same-count roster rebound and a changed helper PID or directory", () => {
    const changedRoster = [
      { ...bootstrapFiles[0], path: "apps/web/e2e/rebound-with-same-byte-count.ts" },
      bootstrapFiles[1],
    ];
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlySourceLock(
        sourceLockInput(changedRoster, { lockManifestDigest }),
      ),
    ).toThrow("exact lock roster, helper identity, and repository root");

    const evidence = assertRealBuildPrefix50Step44CameraOnlySourceLock(sourceLockInput());
    const before = {
      evidence,
      runtimeIdentity: {
        directory: "C:\\exact-camera-gate-lock",
        helperPid: 1234,
        repoRoot: repositoryRoot,
        lockManifestDigest,
      },
    } as RealBuildPrefix50Step44CameraOnlyLiveSourceLock;
    const changedPid = {
      ...before,
      runtimeIdentity: { ...before.runtimeIdentity, helperPid: 5678 },
    };
    const changedDirectory = {
      ...before,
      runtimeIdentity: {
        ...before.runtimeIdentity,
        directory: "C:\\rebound-camera-gate-lock",
      },
    };
    for (const after of [changedPid, changedDirectory])
      expect(() =>
        assertRealBuildPrefix50Step44CameraOnlySameLiveSourceLock({ before, after }),
      ).toThrow("opaque capability minted from this process's running bootstrap helper");
  });

  it("binds the same exact PDF source lock into complete and refused manifests", () => {
    const sourceLock = assertRealBuildPrefix50Step44CameraOnlySourceLock(sourceLockInput());
    for (const status of ["complete", "refused"] as const)
      expect(() =>
        assertRealBuildPrefix50Step44CameraOnlyManifestSourceLock({
          manifest: {
            schemaVersion: "lego.real-build-prefix50-step44-camera-only-gate-manifest/2",
            status,
            sourceLock,
          },
          expectedSourceLock: sourceLock,
        }),
      ).not.toThrow();
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyManifestSourceLock({
        manifest: {
          schemaVersion: "lego.real-build-prefix50-step44-camera-only-gate-manifest/2",
          status: "complete",
          sourceLock: { ...sourceLock, lockedFileCount: sourceLock.lockedFileCount + 1 },
        },
        expectedSourceLock: sourceLock,
      }),
    ).toThrow("did not retain its exact live PDF source-lock binding");
  });

  it("pins the current verified compact review batch and one direct fresh output name", () => {
    expect(REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_RELATIVE_PATH).toBe(
      "output/playwright/real-build-prefix50-step44-return-review/return-review-batch-v2-6bb4f29d7f7133bc7edcc2179c4657732ad6de65a55295aaccc6b2ea542b351d.json",
    );
    expect(REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_BATCH_BYTES_HASH).toBe(
      "sha256:5b8aab325eca84433ed49922772002f3981cb883bb70889436509c9aa3974894",
    );
    expect(requireRealBuildPrefix50Step44CameraOnlyOutputName("camera-only-page45-gate-v2")).toBe(
      "camera-only-page45-gate-v2",
    );
    for (const escaped of [
      "../camera-only-page45-gate-v2",
      "camera-only-page46-gate-v2",
      "camera-only-page45-gate-v2/candidate-0",
    ])
      expect(() => requireRealBuildPrefix50Step44CameraOnlyOutputName(escaped)).toThrow(
        "one direct camera-only-page45-gate-* directory name",
      );
  });

  it("admits only the flat page-45 camera evidence set with one overlay per render", () => {
    const renders = Array.from(
      { length: 16 },
      (_, index) =>
        `real-build-prefix50-step44-page45-camera-branch-${index.toString().padStart(2, "0")}-seed.png`,
    );
    const overlays = renders.map((file) => `${file.slice(0, -4)}-overlay.png`);
    const semanticRenders = Array.from(
      { length: 16 },
      (_, index) =>
        `real-build-prefix50-step44-page45-camera-branch-${index
          .toString()
          .padStart(2, "0")}-semantic-blue-cyan.png`,
    );
    const completeFiles = [...fixedFiles, ...renders, ...overlays, ...semanticRenders];
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
        files: completeFiles,
        directories: [],
        complete: true,
        expectedCompleteFiles: completeFiles,
      }),
    ).not.toThrow();
    const extraRender = "real-build-prefix50-step44-page45-camera-branch-99-confirmation.png";
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
        files: [...completeFiles, extraRender, `${extraRender.slice(0, -4)}-overlay.png`],
        directories: [],
        complete: true,
        expectedCompleteFiles: completeFiles,
      }),
    ).toThrow("exactly its verified attempt renders");
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
        files: [...fixedFiles, ...renders, ...overlays, ...semanticRenders],
        directories: ["candidate-000"],
        complete: true,
      }),
    ).toThrow("may not contain artifact directories");
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
        files: [...fixedFiles, ...renders, ...overlays, ...semanticRenders, "page46.png"],
        directories: [],
        complete: true,
      }),
    ).toThrow("Page-46 artifact escaped");
    const mismatchedOverlays = [
      ...overlays.slice(1),
      overlays[0]!.replace("branch-00", "branch-16"),
    ];
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyOutputEntries({
        files: [...fixedFiles, ...renders, ...mismatchedOverlays, ...semanticRenders],
        directories: [],
        complete: true,
      }),
    ).toThrow("exact stem-matched overlay set");
  });

  it.todo(
    "round-trips and mutation-tests complete/refused manifests with a genuine persisted qualification",
  );

  it("rejects complete and refused manifest writes without a branded qualification", async () => {
    const root = await mkdtemp(join(tmpdir(), "lego-step44-unqualified-manifest-"));
    try {
      const sourceLock = assertRealBuildPrefix50Step44CameraOnlySourceLock(sourceLockInput());
      for (const status of ["complete", "refused"] as const) {
        const body = {
          schemaVersion: "lego.real-build-prefix50-step44-camera-only-gate-manifest/2" as const,
          authority: "none" as const,
          status,
          sourceLock,
        };
        await expect(
          writeRealBuildPrefix50Step44CameraOnlyManifest({
            outputPath: root,
            manifest: { ...body, commitment: canonicalDigest(body) },
          }),
        ).rejects.toThrow("runtime-branded persisted Steps-41/42-qualified");
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a hard-linked expected entry and a partial camera-only authority tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "lego-step44-linked-tree-"));
    const outside = await mkdtemp(join(tmpdir(), "lego-step44-linked-source-"));
    try {
      const outsideFile = join(outside, "vite.log");
      await writeFile(outsideFile, "shared-link\n", "utf8");
      await link(outsideFile, join(root, "camera-only-static-app.log"));
      await writeFile(
        join(root, "real-build-prefix50-step44-page45-camera-attempt.json"),
        "{}\n",
        "utf8",
      );
      await writeFile(
        join(root, REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE),
        "{}\n",
        "utf8",
      );
      await expect(
        assertRealBuildPrefix50Step44CameraOnlyOutputTree(root, "refused"),
      ).rejects.toThrow("may not contain artifact directories");

      await rm(join(root, "camera-only-static-app.log"));
      await expect(
        assertRealBuildPrefix50Step44CameraOnlyOutputTree(root, "refused"),
      ).rejects.toThrow("artifact is absent");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("cross-binds independently verified decisions to the live receipt", () => {
    const branches = [{ branchKey: "face:studs-up/hand:as-fitted/turn:0" }];
    const geometry = { selectedBranchKey: "face:studs-up/hand:as-fitted/turn:0", passed: true };
    const feature = { selectedBranchKey: geometry.selectedBranchKey, passed: true };
    const receipt = {
      branchMeasurements: branches,
      branchMeasurementsCommitment: canonicalDigest(branches),
      geometrySelection: geometry,
      geometrySelectionCommitment: canonicalDigest(geometry),
      featureCorroboration: feature,
      featureCorroborationCommitment: canonicalDigest(feature),
      selectedBranchKey: geometry.selectedBranchKey,
      metricCalibrationCommitment:
        REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
    };
    const attempt = {
      ...receipt,
      status: "resolved",
      renderCount: 1,
      semanticRenderCount: 16,
      restorationControlRenderCount: 1,
      totalCaptureCount: 18,
      metricCalibrationCommitment:
        REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
    };
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyVerifiedAttemptBinding({
        receipt,
        attempt,
        expectedRenderCount: 1,
        expectedTotalCaptureCount: 18,
      }),
    ).not.toThrow();
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyVerifiedAttemptBinding({
        receipt,
        attempt: { ...attempt, branchMeasurements: [{ branchKey: "forged" }] },
        expectedRenderCount: 1,
        expectedTotalCaptureCount: 18,
      }),
    ).toThrow("branches do not exactly equal");
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyVerifiedAttemptBinding({
        receipt,
        attempt: { ...attempt, status: "refused" },
        expectedRenderCount: 1,
        expectedTotalCaptureCount: 18,
      }),
    ).toThrow("selected branch, status, or capture accounting drifted");
  });

  it("rejects swapped, corrupted, or receipt-renamed persisted camera pixels", () => {
    const width = 720;
    const height = 470;
    const rgba = new Uint8Array(width * height * 4);
    for (let index = 0; index < width * height; index += 1)
      rgba.set([0x28, 0x2b, 0x29, 0xff], index * 4);
    rgba.set([0xe8, 0xee, 0xe9, 0xff], 0);
    const swapped = new Uint8Array(rgba);
    swapped.set([0xff, 0x30, 0xd8, 0xff], 0);
    const pngBytes = encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width, height, rgba });
    const rowBody = {
      artifactFile: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_ELIGIBLE_MASK_FILE,
      width,
      height,
      pngDigest: sha256(pngBytes),
      pixelDigest: sha256(rgba),
    };
    const artifact = { ...rowBody, commitment: canonicalDigest(rowBody) };
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyPersistedArtifactPixels({
        literalArtifactFile: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_ELIGIBLE_MASK_FILE,
        artifact,
        pngBytes,
        decodedRgba: rgba,
        expectedRgba: rgba,
      }),
    ).not.toThrow();
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyPersistedArtifactPixels({
        literalArtifactFile: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_ELIGIBLE_MASK_FILE,
        artifact,
        pngBytes,
        decodedRgba: rgba,
        expectedRgba: swapped,
      }),
    ).toThrow("exact expected pixels");
    const corrupted = new Uint8Array(rgba);
    corrupted[0] = corrupted[0]! ^ 0xff;
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyPersistedArtifactPixels({
        literalArtifactFile: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_ELIGIBLE_MASK_FILE,
        artifact,
        pngBytes,
        decodedRgba: corrupted,
        expectedRgba: corrupted,
      }),
    ).toThrow("row, digest");
    expect(() =>
      assertRealBuildPrefix50Step44CameraOnlyPersistedArtifactPixels({
        literalArtifactFile: REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_SELECTED_PARENT_FILE,
        artifact,
        pngBytes,
        decodedRgba: rgba,
        expectedRgba: rgba,
      }),
    ).toThrow("literal file");
  });
});
