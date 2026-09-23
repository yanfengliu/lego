import { access, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import { afterAll, describe, expect, it, vi } from "vitest";

import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "../e2e/real-build-prefix50-subbuild-return-review-harness-input.ts";

vi.mock("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-capture.ts", () => ({
  requireRealBuildPrefix50Step44BrowserCaptureCapability: <T>(value: T): T => value,
  requireRealBuildPrefix50Step44RealDomainCapturedCase: <T>(value: T): T => value,
}));
vi.mock("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts", () => ({
  requireRealBuildPrefix50Step44RealDomainSourceCase: <T>(value: T): T => value,
}));
vi.mock("../e2e/real-build-prefix50-subbuild-return-review-camera-search.ts", () => ({
  requireRealBuildPrefix50LiveCameraSearchAttemptEvidence: <T>(value: T): T => value,
}));
vi.mock("../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-replay.ts", () => ({
  independentlyReplayRealBuildPrefix50Step44RealDomainCapture: () => ({
    commitment: `sha256:${"d".repeat(64)}`,
  }),
}));
vi.mock("../e2e/real-build-prefix50-subbuild-return-review-png.ts", () => ({
  encodeCanonicalRealBuildPrefix50Step44ReviewPng: () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
}));
vi.mock("../e2e/real-build-prefix50-step44-calibration-directory-transaction.ts", () => ({
  prospectiveRealBuildPrefix50Step44CalibrationFinalPath: (
    _transaction: unknown,
    physicalPath: string,
  ): string => physicalPath,
}));

import { persistRealBuildPrefix50Step44RealDomainCase } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-evidence.ts";

type PersistenceInput = Parameters<typeof persistRealBuildPrefix50Step44RealDomainCase>[0];

const outputPaths: string[] = [];

function digest(character: string): `sha256:${string}` {
  return `sha256:${character.repeat(64).slice(0, 64)}`;
}

function captureWithObservationCommitment(
  observationCommitment?: `sha256:${string}`,
): PersistenceInput["capture"] {
  const observationBody = Object.freeze({
    panelStep: 41 as const,
    predecessorCaseCommitment: digest("1"),
    sourceCaseCommitment: digest("2"),
    sourceLockCommitment: digest("3"),
    pageRasterCommitment: digest("4"),
    semanticPolicyCommitment: digest("5"),
    liveSearchAttemptCommitment: digest("6"),
    renderArtifactRosterCommitment: digest("7"),
    registrationReceiptsCommitment: digest("8"),
    sourceSharedOrientationAnchorCommitment: digest("9"),
    sourcePerPanelLatticeCounterevidenceCommitment: digest("a"),
    sourcePooledLatticeCounterevidenceFailure: null,
    sourceLatticeFitCommitment: digest("b"),
    sourceLatticeFitQualified: true,
    sourceLatticeFitFailure: null,
    expectedBranchKey: "face:studs-up/hand:as-fitted/turn:0" as const,
    selectedBranchKey: "face:studs-up/hand:as-fitted/turn:0",
    parentOnlyIntersectionOverUnion: 0.75,
    expectedBranchGeometryMargin: 0.125,
    maximumObservedPredictionActualIntersectionOverUnionDrift: 0.01,
    blueCyanF1: 0.8,
    expectedBranchBlueCyanF1Margin: 0.2,
  });
  const sourceCase = Object.freeze({
    panelStep: 41 as const,
    splitRole: "calibration" as const,
    sourceLockCommitment: digest("3"),
    pageRasterCommitment: digest("4"),
    sourceCaseCommitment: digest("2"),
    sharedOrientationAnchor: Object.freeze({ commitment: digest("c") }),
    perPanelLatticeCounterevidence: Object.freeze({ commitment: digest("a") }),
    rgba: new Uint8Array(720 * 470 * 4),
    eligibleMask: new Uint8Array(720 * 470),
    parentOnlyForegroundMask: new Uint8Array(720 * 470),
  });
  const attemptEvidence = Object.freeze({
    attempt: Object.freeze({ commitment: digest("6") }),
    renderArtifacts: Object.freeze({ "live-render.png": new Uint8Array([1, 2, 3, 4]) }),
  });
  return Object.freeze({
    panelStep: 41,
    status: "resolved",
    predecessorCase: Object.freeze({
      commitment: digest("1"),
      activeChildPredecessor: Object.freeze({
        documentHash: digest("e"),
        documentCommitment: digest("f"),
      }),
    }),
    sourceCase,
    semanticPolicy: Object.freeze({ commitment: digest("5") }),
    observation: Object.freeze({
      ...observationBody,
      observationCommitment: observationCommitment ?? canonicalDigest(observationBody),
    }),
    attemptEvidence,
    refusalReasons: Object.freeze([]),
    runtimeCaptureCount: 1,
    scaleSeedCommitment: digest("0"),
    runtimeStateCommitment: digest("d"),
  }) as unknown as PersistenceInput["capture"];
}

async function outputPath(): Promise<string> {
  await mkdir(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, { recursive: true });
  const output = await mkdtemp(
    resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, "unit-real-domain-evidence-"),
  );
  outputPaths.push(output);
  return output;
}

afterAll(async () => {
  for (const output of outputPaths) await rm(output, { recursive: true, force: true });
});

describe("prefix-50 Step-44 real-domain evidence persistence", () => {
  it("accepts an observation whose self commitment replays from its exact body", async () => {
    const output = await outputPath();
    const proof = await persistRealBuildPrefix50Step44RealDomainCase({
      outputPath: output,
      capture: captureWithObservationCommitment(),
      publicationTransaction: Object.freeze({}) as PersistenceInput["publicationTransaction"],
    });

    expect(proof.panelStep).toBe(41);
    expect(proof.observationCommitment).toBe(
      captureWithObservationCommitment().observation.observationCommitment,
    );
  });

  it("rejects a mismatched observation self commitment before creating its case", async () => {
    const output = await outputPath();
    await expect(
      persistRealBuildPrefix50Step44RealDomainCase({
        outputPath: output,
        capture: captureWithObservationCommitment(digest("f")),
        publicationTransaction: Object.freeze({}) as PersistenceInput["publicationTransaction"],
      }),
    ).rejects.toThrow("observation self commitment does not replay from its exact body");
    await expect(access(resolve(output, "step-41"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
