import { execFile } from "node:child_process";
import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock(
  "../e2e/real-build-prefix50-step44-later-source-authority.ts",
  () => import("./real-build-prefix50-step44-later-source-authority-test-seam.ts"),
);

import { canonicalDigest, canonicalStringify } from "@lego-studio/brick-kernel";

import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewHarnessEnvelope,
} from "../e2e/real-build-prefix50-subbuild-return";
import type { RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope } from "../e2e/real-build-prefix50-subbuild-return-contract";
import {
  claimRealBuildPrefix50Step44ReviewOutputPublication,
  prepareRealBuildPrefix50Step44ReviewOutputPublication,
  readRealBuildPrefix50Step44ReviewEnvelope,
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
} from "../e2e/real-build-prefix50-subbuild-return-review-harness-input";
import type { RealBuildPrefix50Step44ReviewedReturnFixture } from "../e2e/real-build-prefix50-subbuild-return-review-fixture";
import {
  createStep44ReviewTestArtifacts,
  createStep44ReviewTestResult,
  digest,
  type MutableStep44ReviewFixture,
  recommitStep44ReviewFixture,
} from "./real-build-prefix50-subbuild-return-review-test-support";
import { pinCurrentToolchainPopplerForStep44Test } from "./real-build-prefix50-subbuild-return-review-poppler-test-support.ts";
import { sha256RealBuildPrefix50Step44ReviewBytes } from "../e2e/real-build-prefix50-subbuild-return-review-artifact-io";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS } from "../e2e/real-build-prefix50-subbuild-return-review-views";
import { issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest } from "./real-build-prefix50-step44-later-source-authority-test-seam.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE,
  realBuildPrefix50Step44TransactionTestOnly,
} from "../e2e/real-build-prefix50-subbuild-return-review-transaction";

const runId = `${process.pid}-${Date.now()}`;
const artifactDirectory = resolve(
  `output/playwright/real-build-prefix50-step44-review-gate-test-${runId}`,
);
const envelopePath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `review-envelope-${runId}.json`,
);
const harnessOutputPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `harness-smoke-${runId}`,
);
const invalidEnvelopePath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `invalid-envelope-${runId}.json`,
);
const invalidOutputPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `invalid-output-${runId}`,
);
const publicationOutputPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `publication-output-${runId}`,
);
const junctionOutputPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `junction-output-${runId}`,
);
const junctionTargetPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `junction-target-${runId}`,
);
const claimRaceOutputPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `claim-race-output-${runId}`,
);
const claimSymlinkOutputPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `claim-symlink-output-${runId}`,
);
const claimSymlinkTargetPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `claim-symlink-target-${runId}`,
);
const publicJunctionRaceOutputPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `public-junction-race-output-${runId}`,
);
const publicJunctionForeignTargetPath = resolve(
  REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT,
  `public-junction-foreign-target-${runId}`,
);
const publicJunctionPath = resolve(publicJunctionRaceOutputPath, "public");
const foreignSuccessPath = resolve(
  publicJunctionForeignTargetPath,
  "real-build-prefix50-step44-three-row-smoke-success.json",
);
const execFileAsync = promisify(execFile);

let fixture: RealBuildPrefix50Step44ReviewedReturnFixture;
let manifestBytes: string;
let result: ReturnType<typeof createStep44ReviewTestResult>;
let envelope: RealBuildPrefix50SubBuildReturnReviewHarnessEnvelope;
let envelopeBytesHash: `sha256:${string}`;
let testSourcePdfArtifactPath: string;
let alternatePdfBytes: Buffer;
let restorePopplerEnvironment = (): void => undefined;

function select(reviewFixture: RealBuildPrefix50Step44ReviewedReturnFixture) {
  const hook = __testOnly.selectWithReviewedFixtureForTest;
  if (hook === undefined) throw new Error("Step-44 reviewed fixture test hook is unavailable.");
  return hook(result, reviewFixture, {
    repositoryRoot: resolve("."),
    allowTestArtifactPaths: true,
    testSourcePdfArtifactPath,
    laterSourceReadCapability: issueRealBuildPrefix50Step44LaterSourceReadCapabilityForTest({
      repositoryRoot: resolve("."),
      sourcePdfArtifactPath: testSourcePdfArtifactPath,
      sourcePdfDigest: reviewFixture.source.digest,
      maximumSourceBytes: 80 * 1024 * 1024,
      purpose: "page45-review-artifact-raster",
      physicalPageNumber: 45,
    }),
  });
}

function tampered(
  change: (draft: MutableStep44ReviewFixture) => void,
): RealBuildPrefix50Step44ReviewedReturnFixture {
  const draft = structuredClone(fixture) as MutableStep44ReviewFixture;
  change(draft);
  return recommitStep44ReviewFixture(draft);
}

beforeAll(async () => {
  restorePopplerEnvironment = pinCurrentToolchainPopplerForStep44Test();
  result = createStep44ReviewTestResult();
  const brand = __testOnly.brandReturnResultForReviewTests;
  const createEnvelope = __testOnly.createCandidateReviewEnvelopeForTest;
  if (brand === undefined || createEnvelope === undefined)
    throw new Error("Step-44 result-brand or candidate-envelope test hook is unavailable.");
  brand(result);
  envelope = createEnvelope(result, result.candidateRoster[0]!.candidateKey);
  const created = await createStep44ReviewTestArtifacts(artifactDirectory, envelope);
  fixture = created.fixture;
  manifestBytes = created.manifestBytes;
  testSourcePdfArtifactPath = created.testSourcePdfArtifactPath;
  alternatePdfBytes = created.alternatePdfBytes;
  await mkdir(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, { recursive: true });
  const envelopeBytes = Buffer.from(canonicalStringify(envelope));
  envelopeBytesHash = sha256RealBuildPrefix50Step44ReviewBytes(envelopeBytes);
  await writeFile(envelopePath, envelopeBytes, { flag: "wx" });
});

afterAll(async () => {
  restorePopplerEnvironment();
  await unlink(envelopePath).catch(() => undefined);
  await unlink(invalidEnvelopePath).catch(() => undefined);
  await rm(harnessOutputPath, { recursive: true, force: true });
  await rm(invalidOutputPath, { recursive: true, force: true });
  await rm(publicationOutputPath, { recursive: true, force: true });
  await rm(junctionOutputPath, { recursive: true, force: true });
  await rm(junctionTargetPath, { recursive: true, force: true });
  await rm(claimRaceOutputPath, { recursive: true, force: true });
  await rm(claimSymlinkOutputPath, { recursive: true, force: true });
  await rm(claimSymlinkTargetPath, { recursive: true, force: true });
  await unlink(publicJunctionPath).catch(() => undefined);
  await rm(publicJunctionRaceOutputPath, { recursive: true, force: true });
  await rm(publicJunctionForeignTargetPath, { recursive: true, force: true });
  await rm(artifactDirectory, { recursive: true, force: true });
});

describe("prefix-50 Step 44 review envelope and repository artifact gate", () => {
  it("accepts only a branded result constructor and round-trips the closed bounded envelope", async () => {
    const parsed = await readRealBuildPrefix50Step44ReviewEnvelope(envelopePath);
    expect(parsed.envelope).toEqual(envelope);
    expect(parsed.envelope).toMatchObject({
      authority: "none",
      returnResultCommitment: result.commitment,
      candidateRosterCommitment: result.candidateRosterCommitment,
      projectionCommitment: result.projectionCommitment,
      childSubBuildWindowCommitment: result.childSubBuildWindowCommitment,
      sourceMemberRowsCommitment: result.sourceMemberRowsCommitment,
      detachedStateCommitment: result.detachedStateCommitment,
      sourceDocumentHash: result.sourceDocumentHash,
      selectedDocumentHash: envelope.selectedDocumentHash,
      selectedDocumentCommitment: envelope.selectedDocumentCommitment,
    });
    expect(() => createRealBuildPrefix50SubBuildReturnReviewHarnessEnvelope({ ...result })).toThrow(
      /runtime-branded enumeration receipt/u,
    );
    await writeFile(invalidEnvelopePath, `${canonicalStringify(envelope)}\n`, { flag: "wx" });
    await expect(readRealBuildPrefix50Step44ReviewEnvelope(invalidEnvelopePath)).rejects.toThrow(
      /exact canonical JSON bytes/u,
    );
    await unlink(invalidEnvelopePath);
  });

  it("refuses to mint selection from the legacy fixture even when its old artifacts are valid", async () => {
    await expect(select(fixture)).rejects.toThrow(/legacy fixture selection is disabled/u);
  });

  it("rejects a reviewStatus flip when raw ignored artifacts are absent", async () => {
    const selectPromoted = __testOnly.selectWithPromotedFixtureForTest;
    if (selectPromoted === undefined)
      throw new Error("Step-44 promoted-fixture runtime test hook is unavailable.");
    const absent = structuredClone(fixture) as MutableStep44ReviewFixture;
    const absentRoot = `output/playwright/real-build-prefix50-step44-return-review/absent-${runId}`;
    absent.sourcePageRaster.artifactPath = `${absentRoot}/page.png`;
    absent.panelCrop.artifactPath = `${absentRoot}/crop.png`;
    absent.captureManifest.artifactPath = `${absentRoot}/manifest.json`;
    for (const { fixtureKey, reviewedView } of REAL_BUILD_PREFIX50_STEP44_REVIEW_VIEW_ROWS)
      absent.renderReviews[fixtureKey].artifactPath = `${absentRoot}/${reviewedView}.png`;
    const promotedFixture = recommitStep44ReviewFixture(absent);

    expect(() => selectPromoted(result, promotedFixture)).toThrow(
      /reviewStatus cannot mint selection/u,
    );
    await expect(select(promotedFixture)).rejects.toThrow(/does not exist|ENOENT|artifact/u);
  });

  it("rerenders physical PDF page 45 and rejects a self-consistent digest update with stale raster pixels", async () => {
    const sourcePdfPath = resolve(testSourcePdfArtifactPath);
    const originalPdfBytes = await readFile(sourcePdfPath);
    await writeFile(sourcePdfPath, alternatePdfBytes);
    try {
      const changed = structuredClone(fixture) as MutableStep44ReviewFixture;
      const changedDigest = sha256RealBuildPrefix50Step44ReviewBytes(alternatePdfBytes);
      changed.source.digest = changedDigest;
      changed.sourcePageRaster.sourcePdfDigest = changedDigest;
      await expect(select(recommitStep44ReviewFixture(changed))).rejects.toThrow(
        /fresh Poppler rerender/u,
      );
    } finally {
      await writeFile(sourcePdfPath, originalPdfBytes);
    }
  });

  it("rejects the legacy single-envelope CLI before launching the promotion-safe batch harness", async () => {
    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          "apps/web/e2e/real-build-prefix50-subbuild-return-review-harness.ts",
          "--input",
          envelopePath,
          "--expected-input-sha256",
          envelopeBytesHash,
          "--output",
          harnessOutputPath,
        ],
        { cwd: resolve("."), windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 },
      ),
    ).rejects.toThrow(/compact 211-candidate batch input/u);
    await expect(access(harnessOutputPath)).rejects.toThrow();
  });

  it("rejects invalid input before creating its output directory", async () => {
    const invalidBytes = Buffer.from(JSON.stringify({ authority: "none" }));
    const invalidBytesHash = sha256RealBuildPrefix50Step44ReviewBytes(invalidBytes);
    await writeFile(invalidEnvelopePath, invalidBytes, { flag: "wx" });
    await expect(
      execFileAsync(
        process.execPath,
        [
          "--experimental-strip-types",
          "apps/web/e2e/real-build-prefix50-subbuild-return-review-harness.ts",
          "--input",
          invalidEnvelopePath,
          "--expected-input-sha256",
          invalidBytesHash,
          "--output",
          invalidOutputPath,
        ],
        { cwd: resolve("."), windowsHide: true, timeout: 30_000, maxBuffer: 1024 * 1024 },
      ),
    ).rejects.toThrow();
    await expect(access(invalidOutputPath)).rejects.toThrow();
  });

  it("preflights an absent direct output and claims it exclusively", async () => {
    const prepared =
      await prepareRealBuildPrefix50Step44ReviewOutputPublication(publicationOutputPath);
    expect(prepared).toEqual({ outputPath: publicationOutputPath });
    await expect(access(publicationOutputPath)).rejects.toThrow();
    await claimRealBuildPrefix50Step44ReviewOutputPublication(prepared);
    await expect(access(publicationOutputPath)).resolves.toBeUndefined();
    await expect(
      prepareRealBuildPrefix50Step44ReviewOutputPublication(publicationOutputPath),
    ).rejects.toThrow(/output already exists/u);
  });

  it("never replaces a raced empty directory while claiming an absent output", async () => {
    const prepared =
      await prepareRealBuildPrefix50Step44ReviewOutputPublication(claimRaceOutputPath);
    await mkdir(claimRaceOutputPath);
    const before = await lstat(claimRaceOutputPath);
    await expect(claimRealBuildPrefix50Step44ReviewOutputPublication(prepared)).rejects.toThrow(
      /will not replace/u,
    );
    const after = await lstat(claimRaceOutputPath);
    expect(after.ino).toBe(before.ino);
    expect(after.birthtimeMs).toBe(before.birthtimeMs);
    expect(await readdir(claimRaceOutputPath)).toEqual([]);
  });

  it.runIf(process.platform !== "win32")(
    "never replaces a raced POSIX symlink while claiming an absent output",
    async () => {
      const prepared =
        await prepareRealBuildPrefix50Step44ReviewOutputPublication(claimSymlinkOutputPath);
      await mkdir(claimSymlinkTargetPath);
      await symlink(claimSymlinkTargetPath, claimSymlinkOutputPath, "dir");
      await expect(claimRealBuildPrefix50Step44ReviewOutputPublication(prepared)).rejects.toThrow(
        /will not replace/u,
      );
      expect((await lstat(claimSymlinkOutputPath)).isSymbolicLink()).toBe(true);
      expect(await readdir(claimSymlinkTargetPath)).toEqual([]);
    },
  );

  it("rejects nested and junction output targets before claiming publication", async () => {
    await expect(
      prepareRealBuildPrefix50Step44ReviewOutputPublication(
        resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, "nested", `run-${runId}`),
      ),
    ).rejects.toThrow(/absent direct child/u);
    await mkdir(junctionTargetPath);
    await symlink(
      junctionTargetPath,
      junctionOutputPath,
      process.platform === "win32" ? "junction" : "dir",
    );
    await expect(
      prepareRealBuildPrefix50Step44ReviewOutputPublication(junctionOutputPath),
    ).rejects.toThrow(/output already exists/u);
  });

  it("refuses a raced public junction without touching its foreign target or committing", async () => {
    const publication = await prepareRealBuildPrefix50Step44ReviewOutputPublication(
      publicJunctionRaceOutputPath,
    );
    const runDirectoryIdentity =
      await claimRealBuildPrefix50Step44ReviewOutputPublication(publication);
    await mkdir(publicJunctionForeignTargetPath);
    const foreignBytes = Buffer.from("foreign-success-must-survive");
    await writeFile(foreignSuccessPath, foreignBytes, { flag: "wx" });
    await symlink(
      publicJunctionForeignTargetPath,
      publicJunctionPath,
      process.platform === "win32" ? "junction" : "dir",
    );

    await expect(
      realBuildPrefix50Step44TransactionTestOnly.createClaimedOutputDirectories(
        publication,
        runDirectoryIdentity,
      ),
    ).rejects.toThrow();
    await realBuildPrefix50Step44TransactionTestOnly.recoverClaimedThreeRowOutput(publication);

    expect(await readFile(foreignSuccessPath)).toEqual(foreignBytes);
    expect(await readdir(publicJunctionForeignTargetPath)).toEqual([
      "real-build-prefix50-step44-three-row-smoke-success.json",
    ]);
    await expect(
      access(
        resolve(publicJunctionRaceOutputPath, REAL_BUILD_PREFIX50_STEP44_PUBLICATION_COMPLETE_FILE),
      ),
    ).rejects.toThrow();
    await expect(
      access(
        resolve(
          publicJunctionRaceOutputPath,
          "real-build-prefix50-step44-three-row-smoke-incomplete.json",
        ),
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    [
      "receipt",
      (draft: MutableStep44ReviewFixture) => (draft.returnResultCommitment = digest("b")),
    ],
    [
      "roster",
      (draft: MutableStep44ReviewFixture) => (draft.candidateRosterCommitment = digest("c")),
    ],
    [
      "document",
      (draft: MutableStep44ReviewFixture) => (draft.selectedDocumentCommitment = digest("d")),
    ],
    ["crop", (draft: MutableStep44ReviewFixture) => (draft.panelCrop.pngDigest = digest("e"))],
    [
      "render",
      (draft: MutableStep44ReviewFixture) =>
        (draft.renderReviews.frontOrthographic.pngDigest = digest("f")),
    ],
    [
      "pixel",
      (draft: MutableStep44ReviewFixture) =>
        (draft.renderReviews.backOrthographic.pixelDigest = digest("1")),
    ],
    [
      "camera",
      (draft: MutableStep44ReviewFixture) =>
        (draft.renderReviews.leftOrthographic.cameraCommitment = digest("2")),
    ],
    [
      "manifest",
      (draft: MutableStep44ReviewFixture) => (draft.captureManifest.byteDigest = digest("3")),
    ],
    [
      "promotion receipt",
      (draft: MutableStep44ReviewFixture) => (draft.artifactVerificationCommitment = digest("4")),
    ],
  ] as const)("rejects %s binding tamper", async (_label, change) => {
    await expect(select(tampered(change))).rejects.toThrow();
  });

  it("rejects capture-manifest byte tampering even when its JSON values still parse", async () => {
    const manifestPath = resolve(
      artifactDirectory,
      "real-build-prefix50-step44-capture-manifest.json",
    );
    await writeFile(manifestPath, `${manifestBytes} `);
    await expect(select(fixture)).rejects.toThrow(/manifest bytes|capture manifest/u);
    await writeFile(manifestPath, manifestBytes);
  });

  it("rejects a self-recommitted render packet whose retained renderer snapshot was changed", async () => {
    const manifestPath = resolve(
      artifactDirectory,
      "real-build-prefix50-step44-capture-manifest.json",
    );
    const changed = JSON.parse(manifestBytes) as {
      renderPacket: {
        rendererSnapshot: Record<string, unknown>;
        rendererSnapshotCommitment: string;
        commitment: string;
      } & Record<string, unknown>;
      renderPacketCommitment: string;
      commitment: string;
    } & Record<string, unknown>;
    changed.renderPacket.rendererSnapshot.contextLost = true;
    changed.renderPacket.rendererSnapshotCommitment = canonicalDigest(
      changed.renderPacket.rendererSnapshot,
    );
    const renderBody = { ...changed.renderPacket };
    Reflect.deleteProperty(renderBody, "commitment");
    changed.renderPacket.commitment = canonicalDigest(renderBody);
    changed.renderPacketCommitment = changed.renderPacket.commitment;
    const manifestBody = { ...changed };
    Reflect.deleteProperty(manifestBody, "commitment");
    changed.commitment = canonicalDigest(manifestBody);
    const changedBytes = canonicalStringify(changed);
    await writeFile(manifestPath, changedBytes);
    const changedFixture = structuredClone(fixture) as MutableStep44ReviewFixture;
    changedFixture.captureManifest.byteDigest = sha256RealBuildPrefix50Step44ReviewBytes(
      Buffer.from(changedBytes),
    );
    changedFixture.captureManifest.commitment = changed.commitment as `sha256:${string}`;
    changedFixture.captureManifest.renderPacketCommitment =
      changed.renderPacketCommitment as `sha256:${string}`;
    await expect(select(recommitStep44ReviewFixture(changedFixture))).rejects.toThrow(
      /render packet/u,
    );
    await writeFile(manifestPath, manifestBytes);
  });

  it("preflights hostile depth before any document structural hash", async () => {
    let hostile: unknown = "leaf";
    for (let depth = 0; depth < 60; depth += 1) hostile = { nested: hostile };
    await writeFile(envelopePath, JSON.stringify(hostile));
    await expect(readRealBuildPrefix50Step44ReviewEnvelope(envelopePath)).rejects.toThrow(
      /depth limit/u,
    );
    await writeFile(envelopePath, JSON.stringify(envelope));
  });
});
