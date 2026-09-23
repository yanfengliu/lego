import { beforeAll, describe, expect, it } from "vitest";

import { canonicalDigest } from "@lego-studio/brick-kernel";

import { searchRealBuildPrefix50Step44ParentCamera } from "../e2e/real-build-prefix50-subbuild-return-review-camera-search.ts";
import {
  deriveRealBuildPrefix50Step44CameraRefusalReasons,
  deriveRealBuildPrefix50Step44FeatureCorroboration,
  deriveRealBuildPrefix50Step44GeometrySelection,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-search-decisions.ts";
import { REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT } from "../e2e/real-build-prefix50-subbuild-return-review-camera-calibration.ts";
import {
  verifyRealBuildPrefix50Step44CameraMeasurementSemantics,
  type RealBuildPrefix50Step44DecodedCameraAttemptArtifact,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-attempt-verifier.ts";
import type { RealBuildPrefix50Step44CameraMeasurementSemanticContract } from "../e2e/real-build-prefix50-subbuild-return-review-camera-attempt-verifier-setup.ts";
import { stableBranchKeys } from "../e2e/real-build-prefix50-subbuild-return-review-camera-search-primitives.ts";
import type {
  RealBuildPrefix50Step44CameraSearchAttempt,
  RealBuildPrefix50Step44CameraSearchAttemptEvidence,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import { decodeRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png.ts";
import {
  requireRealBuildPrefix50Step44SemanticColorPolicy,
  type RealBuildPrefix50Step44SemanticColorPolicy,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-semantic.ts";
import {
  recommitCameraAttempt,
  type Mutable,
} from "./real-build-prefix50-subbuild-return-review-camera-verifier-test-support.ts";
import semanticColorPolicyFixture from "./fixtures/real-build-prefix50-step44-semantic-color-policy.json";
import {
  BACKGROUND_HEX,
  HEIGHT,
  inputFor,
  sha256,
  WIDTH,
} from "./real-build-prefix50-subbuild-return-review-camera-production-search-support.ts";

let verifierFixture:
  | {
      readonly attempt: RealBuildPrefix50Step44CameraSearchAttempt;
      readonly artifacts: Readonly<
        Record<string, RealBuildPrefix50Step44DecodedCameraAttemptArtifact>
      >;
      readonly contract: RealBuildPrefix50Step44CameraMeasurementSemanticContract;
    }
  | undefined;
let positiveResult: Awaited<ReturnType<typeof searchRealBuildPrefix50Step44ParentCamera>>;
let semanticPolicy: RealBuildPrefix50Step44SemanticColorPolicy;
let positiveBeautyRenderCalls = 0;
let positiveSemanticRenderCalls = 0;

function fixtureFor(
  input: ReturnType<typeof inputFor>["input"],
  evidence: RealBuildPrefix50Step44CameraSearchAttemptEvidence,
) {
  const digest = sha256(Uint8Array.of(44));
  const artifacts = Object.fromEntries(
    Object.entries(evidence.renderArtifacts).map(([file, pngBytes]) => [
      file,
      {
        pngBytes,
        rgba: decodeRealBuildPrefix50Step44ReviewPng(pngBytes, WIDTH * HEIGHT, file).rgba,
      },
    ]),
  );
  const context = {
    sourcePdfDigest: digest,
    sourcePageRasterCommitment: digest,
    panelCropCommitment: digest,
    panelFacePrefixEvidenceCommitment: digest,
    expectedPanelFace: input.expectedPanelFace,
    parentOnlyRegionCommitment: digest,
    reviewBatchEnvelopeCommitment: digest,
    returnResultCommitment: digest,
    candidateRosterCommitment: digest,
    sourceDocumentHash: digest,
    sharedParentDocumentHash: digest,
    sharedParentDocumentCommitment: digest,
    semanticColorPolicyCommitment: input.semanticPolicy.commitment,
    metricCalibrationCommitment: REAL_BUILD_PREFIX50_STEP44_INTERIOR_FEATURE_CALIBRATION_COMMITMENT,
  };
  return {
    attempt: evidence.attempt,
    artifacts,
    contract: {
      context,
      expectedPanelFace: input.expectedPanelFace,
      frame: input.frame,
      branches: input.branches.map((branch, branchIndex) => ({ branchIndex, ...branch })),
      sourceRgba: input.sourceRgba,
      eligibleMask: input.eligibleMask,
      parentOnlyTargetMask: input.parentOnlyTargetMask,
      semanticColorPolicy: input.semanticPolicy,
    },
  } satisfies NonNullable<typeof verifierFixture>;
}

beforeAll(async () => {
  semanticPolicy = requireRealBuildPrefix50Step44SemanticColorPolicy(
    semanticColorPolicyFixture as unknown as RealBuildPrefix50Step44SemanticColorPolicy,
  );
  const controlled = inputFor("positive", semanticPolicy, true);
  let captured: RealBuildPrefix50Step44CameraSearchAttemptEvidence | undefined;
  positiveResult = await searchRealBuildPrefix50Step44ParentCamera({
    ...controlled.input,
    attemptSink: (evidence) => {
      captured = evidence;
    },
  });
  if (captured === undefined) throw new TypeError("Positive verifier fixture was not captured.");
  verifierFixture = fixtureFor(controlled.input, captured);
  positiveBeautyRenderCalls = controlled.beautyCalls();
  positiveSemanticRenderCalls = controlled.semanticCalls();
}, 180_000);

describe("Step-44 production camera decision isolation", () => {
  it("clones a renderer-reused RGBA buffer while retaining ordered counterevidence", async () => {
    const result = positiveResult;
    expect(result.selectedBranchKey).toBe("face:studs-up/hand:as-fitted/turn:0");
    expect(result.branchMeasurements).toHaveLength(16);
    expect(result.branchMeasurements.map((row) => row.branchKey)).toEqual(stableBranchKeys());
    expect(result.branchMeasurements.filter((row) => row.geometryEligible)).toHaveLength(8);
    expect(result.branchMeasurements[0]!.interiorFeatureMeasurement.f1).toBeGreaterThan(
      result.branchMeasurements[1]!.interiorFeatureMeasurement.f1,
    );
    expect(result.geometrySelection.selectedBranchKey).toBe(result.selectedBranchKey);
    expect(result.featureCorroboration.selectedBranchKey).toBe(result.selectedBranchKey);
    expect(result.geometrySelection.counterevidenceGeometryCommitments).toHaveLength(8);
    expect(result.geometrySelection.strongestUnexpectedFaceIntersectionOverUnion).toBeGreaterThan(
      0.9,
    );
    expect(result.geometrySelection.strongestOtherExpectedFaceIntersectionOverUnion).toBeLessThan(
      result.geometrySelection.selectedIntersectionOverUnion!,
    );
    expect(result.geometrySelection.expectedFaceGeometryMargin).toBeGreaterThanOrEqual(0.015);
    expect(result.featureCorroboration.strongestUnexpectedFaceBlueCyanF1).toBeGreaterThanOrEqual(
      result.featureCorroboration.selectedBlueCyanF1!,
    );
    expect(result.featureCorroboration.geometryRunnerUpBlueCyanF1).toBeLessThan(
      result.featureCorroboration.selectedBlueCyanF1!,
    );
    expect(result.featureCorroboration.expectedFaceBlueCyanF1Margin).toBeGreaterThanOrEqual(
      result.thresholds.minimumExpectedFaceBlueCyanF1Margin,
    );
    expect(result.featureCorroboration).toMatchObject({
      selectionAuthority: false,
      tieBreakAuthority: false,
      retryAuthority: false,
      hogAuthority: "diagnostic-only",
      passed: true,
    });
    expect(result.thresholds).toEqual({
      minimumParentOnlyIntersectionOverUnion: 0.9,
      minimumBranchWinnerMargin: 0.015,
      maximumPredictionActualIntersectionOverUnionDrift: 0.02,
      minimumBlueCyanF1: 0.7508763144717076,
      minimumExpectedFaceBlueCyanF1Margin: 0.24912368552829245,
      maximumAlignmentPasses: 3,
    });
    expect(positiveBeautyRenderCalls).toBe(
      result.attempt.renderCount + result.attempt.restorationControlRenderCount,
    );
    expect(positiveSemanticRenderCalls).toBe(result.attempt.semanticRenderCount);
    expect(result.attempt.semanticRenderCount).toBe(16);
    expect(result.attempt.restorationControlRenderCount).toBe(1);
    expect(result.attempt.totalCaptureCount).toBe(result.attempt.renderCount + 17);
    expect(result.attempt.renderCount).toBeLessThanOrEqual(48);
    expect(
      result.branchMeasurements.every(
        (row) =>
          row.alignmentPasses.length <= 3 &&
          row.alignmentPasses.filter((pass) => pass.passKind === "rebase").length <= 1 &&
          row.alignmentPasses.every(
            (pass) =>
              pass.projectionMatrix.length === 16 &&
              pass.matrixWorldInverse.length === 16 &&
              (pass.registrationProposal === null ||
                pass.registrationProposal.status === "locally-contained" ||
                pass.registrationProposal.status === "refused"),
          ) &&
          row.interiorFeatureMeasurement.beautyRenderPixelDigest === row.selectedPixelDigest &&
          row.interiorFeatureMeasurement.semanticPolicyCommitment === semanticPolicy.commitment,
      ),
    ).toBe(true);
    const selected = result.branchMeasurements[0]!;
    const artifactFile = selected.alignmentPasses[selected.publishedPassIndex]!.artifactFile;
    expect(verifierFixture!.artifacts[artifactFile]!.pngBytes).toEqual(
      result.selectedControlRender.pngBytes,
    );
    expect(sha256(result.selectedControlRender.rgba)).toBe(result.selectedParentPixelDigest);
    expect(
      new Set(Object.values(verifierFixture!.artifacts).map(({ pngBytes }) => sha256(pngBytes)))
        .size,
    ).toBeGreaterThan(1);
  }, 120_000);

  it("refuses an exact expected-face geometry tie after sinking every render", async () => {
    const controlled = inputFor("geometry-tie", semanticPolicy);
    let captured: RealBuildPrefix50Step44CameraSearchAttemptEvidence | undefined;
    await expect(
      searchRealBuildPrefix50Step44ParentCamera({
        ...controlled.input,
        attemptSink: (evidence) => {
          captured = evidence;
        },
      }),
    ).rejects.toThrow(/required attempt sink completed/u);
    expect(captured).toBeDefined();
    expect(captured!.attempt.geometrySelection).toMatchObject({
      selectedBranchKey: "face:studs-up/hand:as-fitted/turn:0",
      expectedFaceGeometryMargin: 0,
      passed: false,
    });
    expect(captured!.attempt.refusalReasons).toContain("expected-face-geometry-margin-not-met");
    expect(controlled.beautyCalls()).toBe(captured!.attempt.renderCount + 1);
    expect(controlled.semanticCalls()).toBe(16);
  }, 120_000);

  it("refuses a nonseparating geometry runner without retrying or shopping by color", async () => {
    const controlled = inputFor("feature-competitor", semanticPolicy);
    let captured: RealBuildPrefix50Step44CameraSearchAttemptEvidence | undefined;
    await expect(
      searchRealBuildPrefix50Step44ParentCamera({
        ...controlled.input,
        attemptSink: (evidence) => {
          captured = evidence;
        },
      }),
    ).rejects.toThrow(/required attempt sink completed/u);
    expect(captured).toBeDefined();
    expect(captured!.attempt.geometrySelection.passed).toBe(true);
    expect(captured!.attempt.geometrySelection.selectedBranchKey).toBe(
      "face:studs-up/hand:as-fitted/turn:0",
    );
    expect(captured!.attempt.featureCorroboration).toMatchObject({
      selectedBranchKey: "face:studs-up/hand:as-fitted/turn:0",
      passed: false,
    });
    expect(captured!.attempt.featureCorroboration.geometryRunnerUpBlueCyanF1).toBe(
      captured!.attempt.featureCorroboration.selectedBlueCyanF1!,
    );
    expect(captured!.attempt.refusalReasons).toContain("expected-face-blue-cyan-margin-not-met");
    expect(controlled.beautyCalls()).toBe(captured!.attempt.renderCount + 1);
    expect(controlled.semanticCalls()).toBe(16);
  }, 120_000);

  it("ignores a third expected-face color winner that geometry did not select as runner-up", async () => {
    const controlled = inputFor("color-shopping-adversary", semanticPolicy);
    let captured: RealBuildPrefix50Step44CameraSearchAttemptEvidence | undefined;
    const result = await searchRealBuildPrefix50Step44ParentCamera({
      ...controlled.input,
      attemptSink: (evidence) => {
        captured = evidence;
      },
    });
    expect(captured).toBeDefined();
    expect(result.selectedBranchKey).toBe("face:studs-up/hand:as-fitted/turn:0");
    expect(result.geometrySelection.strongestOtherExpectedFaceBranchKey).toBe(
      "face:studs-up/hand:as-fitted/turn:1",
    );
    expect(result.featureCorroboration.geometryRunnerUpBranchKey).toBe(
      "face:studs-up/hand:as-fitted/turn:1",
    );
    expect(result.branchMeasurements[2]!.interiorFeatureMeasurement.f1).toBeGreaterThan(
      result.branchMeasurements[0]!.interiorFeatureMeasurement.f1,
    );
    expect(result.featureCorroboration.passed).toBe(true);
    expect(controlled.beautyCalls()).toBe(result.attempt.renderCount + 1);
    expect(controlled.semanticCalls()).toBe(16);
    expect(result.attempt.totalCaptureCount).toBe(result.attempt.renderCount + 17);
  }, 120_000);

  it("sinks an identity-ambiguity refusal before throwing", async () => {
    const controlled = inputFor("identity-ambiguity", semanticPolicy);
    let captured: RealBuildPrefix50Step44CameraSearchAttemptEvidence | undefined;
    await expect(
      searchRealBuildPrefix50Step44ParentCamera({
        ...controlled.input,
        attemptSink: (evidence) => {
          captured = evidence;
        },
      }),
    ).rejects.toThrow(/required attempt sink completed/u);
    expect(captured?.attempt.status).toBe("refused");
    expect(captured?.attempt.branchMeasurements).toHaveLength(16);
    expect(captured?.attempt.branchMeasurements.map((row) => row.branchKey)).toEqual(
      stableBranchKeys(),
    );
    expect(controlled.beautyCalls()).toBe(captured!.attempt.renderCount + 1);
    expect(controlled.semanticCalls()).toBe(16);
  }, 120_000);

  it("withholds geometry selection when even one expected-face branch is not comparably registered", () => {
    const rows = structuredClone(positiveResult.branchMeasurements) as unknown as Mutable<
      typeof positiveResult.branchMeasurements
    >;
    const incomplete = rows[3]!;
    incomplete.converged = false;
    incomplete.alignmentPasses[incomplete.publishedPassIndex]!.settled = false;
    const typedRows = rows as unknown as typeof positiveResult.branchMeasurements;
    const geometry = deriveRealBuildPrefix50Step44GeometrySelection(typedRows, "studs-up");
    const feature = deriveRealBuildPrefix50Step44FeatureCorroboration({
      rows: typedRows,
      geometry,
      sourceCommitment: positiveResult.featureCorroboration.sourceCommitment,
    });
    expect(geometry).toMatchObject({
      selectedBranchKey: null,
      selectedIntersectionOverUnion: null,
      passed: false,
    });
    expect(
      deriveRealBuildPrefix50Step44CameraRefusalReasons({
        rows: typedRows,
        geometry,
        feature,
      }),
    ).toEqual(["incomplete-branch-registration", "no-converged-expected-face-branch"]);
  });

  it("independently rejects coordinated persisted-camera semantic tampering", () => {
    expect(verifierFixture).toBeDefined();
    const fixture = verifierFixture!;
    expect(() => verifyRealBuildPrefix50Step44CameraMeasurementSemantics(fixture)).not.toThrow();
    const mutations: readonly [
      string,
      (value: Mutable<RealBuildPrefix50Step44CameraSearchAttempt>) => void,
    ][] = [
      ["one branch", (value) => value.branchMeasurements.splice(1)],
      ["wrong face", (value) => (value.branchMeasurements[0]!.branchFace = "underside")],
      [
        "hidden incomplete branch registration",
        (value) => {
          const branch = value.branchMeasurements[3]!;
          branch.converged = false;
          branch.alignmentPasses[branch.publishedPassIndex]!.settled = false;
        },
      ],
      [
        "fabricated IoU and F1",
        (value) => {
          value.branchMeasurements[0]!.alignmentPasses[0]!.intersectionOverUnion = 1;
          value.branchMeasurements[0]!.interiorFeatureMeasurement.f1 = 1;
        },
      ],
      [
        "altered camera equation",
        (value) => {
          value.branchMeasurements[0]!.alignmentPasses[0]!.solvedCenterDeltaPx += 1;
        },
      ],
      [
        "noncanonical pass name",
        (value) => {
          value.branchMeasurements[0]!.alignmentPasses[0]!.passKind = "confirmation";
        },
      ],
      [
        "altered matrices",
        (value) => {
          const branch = value.branchMeasurements[0]!;
          const pass = branch.alignmentPasses[0]!;
          pass.projectionMatrix[0] = pass.projectionMatrix[0]! + 1;
          pass.rendererCameraCommitment = canonicalDigest({
            request: {
              scene: "model-only",
              backgroundHex: BACKGROUND_HEX,
              parameters: pass.parameters,
              frame: branch.frame,
            },
            projectionMatrix: pass.projectionMatrix,
            matrixWorldInverse: pass.matrixWorldInverse,
          });
        },
      ],
      [
        "feature digest mismatch",
        (value) => {
          value.branchMeasurements[0]!.interiorFeatureMeasurement.beautyRenderPixelDigest = sha256(
            Uint8Array.of(45),
          );
        },
      ],
    ];
    for (const [label, mutate] of mutations) {
      const attempt = structuredClone(
        fixture.attempt,
      ) as unknown as Mutable<RealBuildPrefix50Step44CameraSearchAttempt>;
      mutate(attempt);
      recommitCameraAttempt(attempt);
      expect(
        () =>
          verifyRealBuildPrefix50Step44CameraMeasurementSemantics({
            ...fixture,
            attempt: attempt as unknown as RealBuildPrefix50Step44CameraSearchAttempt,
          }),
        label,
      ).toThrow();
    }
  }, 180_000);
});
