import { canonicalDigest } from "@lego-studio/brick-kernel";

import type { RealBuildPrefix50Step44RealDomainObservation } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-contract.ts";
import type { PersistedCaseManifest } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-evidence.ts";
import { REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_THRESHOLDS } from "./real-build-prefix50-subbuild-return-review-camera-real-domain-preregistration.ts";
import {
  readRealBuildPrefix50Step44RealDomainSourceCasePixels,
  type RealBuildPrefix50Step44RealDomainSourceCase,
} from "./real-build-prefix50-subbuild-return-review-camera-real-domain-source.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS,
  type RealBuildPrefix50Step44CameraSearchAttempt,
} from "./real-build-prefix50-subbuild-return-review-camera-search-types.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "./real-build-prefix50-subbuild-return-review-png.ts";

export const REAL_BUILD_PREFIX50_STEP44_PERSISTED_CASE_SOURCE_FILES = [
  "eligible-mask.png",
  "parent-target-mask.png",
  "source-crop.png",
] as const;
const WIDTH = 720;
const HEIGHT = 470;

function withoutCommitment(value: object): Record<string, unknown> {
  const body = { ...value } as Record<string, unknown>;
  Reflect.deleteProperty(body, "commitment");
  return body;
}

function requireSelfCommitted(
  value: { readonly commitment: `sha256:${string}` },
  label: string,
): void {
  if (value.commitment !== canonicalDigest(withoutCommitment(value)))
    throw new TypeError(`${label} did not reproduce its exact self commitment.`);
}

function maskPng(mask: Uint8Array, on: readonly [number, number, number]): Uint8Array {
  const rgba = new Uint8Array(mask.byteLength * 4);
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 0 && mask[index] !== 1)
      throw new TypeError("Persisted real-domain source mask must remain binary.");
    const offset = index * 4;
    const color = mask[index] === 1 ? on : ([0x28, 0x2b, 0x29] as const);
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = 0xff;
  }
  return encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width: WIDTH, height: HEIGHT, rgba });
}

export function deriveRealBuildPrefix50Step44ExactPersistedSourceArtifacts(
  source: RealBuildPrefix50Step44RealDomainSourceCase,
): Readonly<
  Record<(typeof REAL_BUILD_PREFIX50_STEP44_PERSISTED_CASE_SOURCE_FILES)[number], Uint8Array>
> {
  const pixels = readRealBuildPrefix50Step44RealDomainSourceCasePixels(source);
  return Object.freeze({
    "source-crop.png": encodeCanonicalRealBuildPrefix50Step44ReviewPng({
      width: WIDTH,
      height: HEIGHT,
      rgba: pixels.rgba,
    }),
    "eligible-mask.png": maskPng(pixels.eligibleMask, [0xe8, 0xee, 0xe9]),
    "parent-target-mask.png": maskPng(pixels.parentOnlyForegroundMask, [0xff, 0x30, 0xd8]),
  });
}

export function deriveRealBuildPrefix50Step44PersistedRenderArtifactNames(
  attempt: RealBuildPrefix50Step44CameraSearchAttempt,
): string[] {
  return [
    attempt.beautyRestorationControl.artifactFile,
    ...attempt.branchMeasurements.flatMap(({ alignmentPasses, semanticColorArtifact }) => [
      ...alignmentPasses.map(({ artifactFile }) => artifactFile),
      semanticColorArtifact.artifactFile,
    ]),
  ].sort();
}

export function requireRealBuildPrefix50Step44PersistedSearchAttempt(
  attempt: RealBuildPrefix50Step44CameraSearchAttempt,
  eligible: Uint8Array,
  target: Uint8Array,
  digest: (bytes: Uint8Array) => `sha256:${string}`,
): void {
  const renderFiles = deriveRealBuildPrefix50Step44PersistedRenderArtifactNames(attempt);
  const { commitment, ...body } = attempt;
  requireSelfCommitted(attempt.beautyRestorationControl, "Persisted beauty restoration control");
  requireSelfCommitted(attempt.geometrySelection, "Persisted geometry selection");
  requireSelfCommitted(attempt.featureCorroboration, "Persisted feature corroboration");
  for (const [index, row] of attempt.branchMeasurements.entries()) {
    requireSelfCommitted(row, `Persisted branch measurement ${index + 1}`);
    if (row.alignmentPassesCommitment !== canonicalDigest(row.alignmentPasses))
      throw new TypeError(`Persisted branch measurement ${index + 1} pass roster drifted.`);
    for (const pass of row.alignmentPasses)
      requireSelfCommitted(pass, `Persisted branch measurement ${index + 1} pass`);
    requireSelfCommitted(
      row.semanticColorArtifact,
      `Persisted branch measurement ${index + 1} semantic artifact`,
    );
    requireSelfCommitted(
      row.interiorFeatureMeasurement,
      `Persisted branch measurement ${index + 1} feature measurement`,
    );
  }
  if (
    attempt.schemaVersion !== "lego.real-build-prefix50-step44-camera-search-attempt/2" ||
    attempt.expectedPanelFace !== "studs-up" ||
    attempt.sourceEligibleMaskDigest !== digest(eligible) ||
    attempt.parentOnlyTargetMaskDigest !== digest(target) ||
    canonicalDigest(attempt.thresholds) !==
      canonicalDigest(REAL_BUILD_PREFIX50_STEP44_CAMERA_SEARCH_THRESHOLDS) ||
    attempt.renderCount < 16 ||
    attempt.renderCount > 48 ||
    attempt.maximumRenderCount !== 48 ||
    attempt.semanticRenderCount !== 16 ||
    attempt.restorationControlRenderCount !== 1 ||
    attempt.totalCaptureCount !== attempt.renderCount + 17 ||
    attempt.maximumTotalCaptureCount !== 65 ||
    attempt.branchMeasurements.length !== 16 ||
    attempt.branchMeasurementsCommitment !== canonicalDigest(attempt.branchMeasurements) ||
    attempt.geometrySelectionCommitment !== attempt.geometrySelection.commitment ||
    attempt.featureCorroborationCommitment !== attempt.featureCorroboration.commitment ||
    attempt.status !== "resolved" ||
    attempt.refusalReasons.length !== 0 ||
    new Set(renderFiles).size !== renderFiles.length ||
    commitment !== canonicalDigest(body)
  )
    throw new TypeError(
      "Persisted real-domain search attempt did not reproduce its frozen semantics.",
    );
}

export function requireRealBuildPrefix50Step44PersistedObservationMatchesCase(input: {
  readonly manifest: PersistedCaseManifest;
  readonly observation: RealBuildPrefix50Step44RealDomainObservation;
  readonly renderBindings: readonly PersistedCaseManifest["artifactBindings"][number][];
}): void {
  const { manifest, observation, renderBindings } = input;
  const attempt = manifest.searchAttempt;
  const selected = attempt.branchMeasurements.find(
    ({ branchKey }) => branchKey === attempt.geometrySelection.selectedBranchKey,
  );
  const maximumDrift = Math.max(
    0,
    ...attempt.branchMeasurements.flatMap(({ alignmentPasses }) =>
      alignmentPasses.map(
        ({ incomingPredictionActualIntersectionOverUnionDrift }) =>
          incomingPredictionActualIntersectionOverUnionDrift ?? 0,
      ),
    ),
  );
  const registrationReceiptsCommitment = canonicalDigest(
    attempt.branchMeasurements.map(({ branchKey, alignmentPasses }) => ({
      branchKey,
      passes: alignmentPasses.map(({ commitment, registrationProposal }) => ({
        passCommitment: commitment,
        registrationProposalCommitment: registrationProposal?.commitment ?? null,
      })),
    })),
  );
  const { observationCommitment, ...observationBody } = observation;
  const thresholds = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_THRESHOLDS;
  if (
    observationCommitment !== canonicalDigest(observationBody) ||
    observation.panelStep !== manifest.panelStep ||
    observation.predecessorCaseCommitment !== manifest.predecessorCaseCommitment ||
    observation.sourceCaseCommitment !== manifest.sourceCaseCommitment ||
    observation.sourceLockCommitment !== manifest.sourceLockCommitment ||
    observation.pageRasterCommitment !== manifest.pageRasterCommitment ||
    observation.semanticPolicyCommitment !== manifest.semanticPolicyCommitment ||
    observation.liveSearchAttemptCommitment !== manifest.searchAttemptCommitment ||
    observation.renderArtifactRosterCommitment !== canonicalDigest(renderBindings) ||
    observation.registrationReceiptsCommitment !== registrationReceiptsCommitment ||
    observation.sourceSharedOrientationAnchorCommitment !==
      manifest.sharedOrientationAnchor.commitment ||
    observation.sourcePerPanelLatticeCounterevidenceCommitment !==
      manifest.perPanelLatticeCounterevidence.commitment ||
    observation.sourcePooledLatticeCounterevidenceFailure !==
      manifest.sharedOrientationAnchor.pooledCounterevidenceFailure ||
    observation.sourceLatticeFitCommitment !==
      canonicalDigest(manifest.sharedOrientationAnchor.latticeFit) ||
    observation.sourceLatticeFitQualified !== true ||
    observation.sourceLatticeFitFailure !== null ||
    observation.expectedBranchKey !== "face:studs-up/hand:as-fitted/turn:0" ||
    observation.selectedBranchKey !== attempt.geometrySelection.selectedBranchKey ||
    observation.parentOnlyIntersectionOverUnion !==
      (attempt.geometrySelection.selectedIntersectionOverUnion ?? 0) ||
    observation.expectedBranchGeometryMargin !==
      (attempt.geometrySelection.expectedFaceGeometryMargin ?? 0) ||
    observation.maximumObservedPredictionActualIntersectionOverUnionDrift !== maximumDrift ||
    observation.blueCyanF1 !== (selected?.interiorFeatureMeasurement.f1 ?? 0) ||
    observation.expectedBranchBlueCyanF1Margin !==
      (attempt.featureCorroboration.expectedFaceBlueCyanF1Margin ?? 0) ||
    observation.selectedBranchKey !== observation.expectedBranchKey ||
    observation.parentOnlyIntersectionOverUnion <
      thresholds.minimumParentOnlyIntersectionOverUnion ||
    observation.expectedBranchGeometryMargin < thresholds.minimumExpectedBranchGeometryMargin ||
    maximumDrift > thresholds.maximumPredictionActualIntersectionOverUnionDrift ||
    observation.blueCyanF1 < thresholds.minimumBlueCyanF1 ||
    observation.expectedBranchBlueCyanF1Margin < thresholds.minimumExpectedBranchBlueCyanF1Margin
  )
    throw new TypeError(
      "Persisted real-domain observation drifted from its exact case/search evidence.",
    );
}
