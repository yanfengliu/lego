import {
  applyBuildOperations,
  canonicalDigest,
  sha256Hex,
  type Sha256Digest,
} from "@lego-studio/brick-kernel";

import { createPlacePartTransaction } from "../src/manual-commands";
import {
  requireRealBuildCandidateDocumentSnapshotValue,
  type RealBuildCandidateDocumentSnapshot,
} from "./real-build-candidate-document-snapshot";
import { packRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import {
  preflightRealBuildCompiledObservationResources,
  snapshotRealBuildCompiledObservationSource,
  type RealBuildCompiledObservationSourceInput,
} from "./real-build-compiled-observation-source";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { createRealBuildPanelCameraBranchBudgetLedger } from "./real-build-panel-camera-branch-budget";
import {
  PANEL_CAMERA_ANGULAR_HYPOTHESES,
  snapshotPanelCameraBinaryMask,
} from "./real-build-panel-camera-resolver-boundary";
import {
  requireRealBuildPreparedStepInspection,
  type RealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority";
import { mapRealBuildStepOneProperC4MemberCameraToRepresentative } from "./real-build-step-one-proper-c4-camera-equivariance";
import type { RealBuildStepOneProperC4RepresentativeCameraScoreRow } from "./real-build-step-one-proper-c4-global-aggregation";
import {
  requireRealBuildStepOneProperC4QuotientInspection,
  type RealBuildStepOneProperC4QuotientInspection,
  type RealBuildStepOneProperC4RawCandidate,
} from "./real-build-step-one-proper-c4-quotient";
import {
  inspectRealBuildStepOneMaskRendererFactoryConfiguration,
  inspectRealBuildStepOnePreparedMaskRenderer,
  type RealBuildStepOneMaskRendererFactory,
} from "./real-build-step-one-silhouette-renderer";

const FIXED_VERIFICATION_BUDGET = 8_192;
const OMITTED_MEMBER_COUNT = 300;
const VERIFICATION_RENDER_COUNT = 2_400;
const VERIFICATION_CLOSURE_COUNT = 60;
const MEMBERS_PER_VERIFICATION_CLOSURE = 5;
const CAMERAS_PER_VERIFICATION_CLOSURE = 40;
const SAFE_REFLECT_APPLY = Reflect.apply;

export interface RealBuildStepOneProperC4PopulationEquivarianceInspection {
  readonly schemaVersion: "lego.real-build-step-one-proper-c4-population-equivariance/1";
  readonly quotientDigest: Sha256Digest;
  readonly rawRosterDigest: Sha256Digest;
  readonly rendererConfigurationDigest: Sha256Digest;
  readonly representativeRowsDigest: Sha256Digest;
  readonly comparisonDigest: Sha256Digest;
  readonly exactPackedMaskCommitmentParity: true;
  readonly scoreAndTiePreservation: "identical-packed-masks-under-one-bound-source";
  readonly accounting: Readonly<{
    verificationBudget: 8_192;
    verificationReserved: 2_400;
    verificationReservationCount: 60;
    verificationClosureCount: 60;
    membersPerVerificationClosure: 5;
    camerasPerVerificationClosure: 40;
    perClosurePredictedRoleBytes: number;
    perClosurePredictedPixelVisits: number;
    omittedMembers: 300;
    verificationPreparations: 300;
    verificationPhysicalRenderCalls: 2_400;
    verificationDisposals: 300;
    reductionPhysicalRenderCalls: 800;
    reductionAndVerificationPhysicalRenderCalls: 3_200;
    verificationMaskPixels: number;
  }>;
  readonly backendClaim: "exhaustive-current-population-same-factory";
  readonly physicalFrameAuthority: "absent";
  readonly placementAuthority: "absent";
  readonly completionAuthority: Readonly<{ status: "absent"; authorized: false }>;
  readonly authority: "absent";
}

function proofDocument(
  root: RealBuildCandidateDocumentSnapshot,
  preparedStep: RealBuildPreparedStepInspection,
  candidate: RealBuildStepOneProperC4RawCandidate,
): unknown {
  let document = root.document;
  for (let pieceIndex = 0; pieceIndex < candidate.offeredCandidates.length; pieceIndex += 1) {
    const offer = candidate.offeredCandidates[pieceIndex]!;
    const piece = preparedStep.expectedAtomicPieces[pieceIndex];
    if (piece === undefined || piece.catalogPartId !== offer.catalogPartId) {
      throw new TypeError(
        `Proper-C4 population member ${candidate.rawIndex} piece ${pieceIndex} does not bind its prepared catalog identity.`,
      );
    }
    const transaction = createPlacePartTransaction(document, {
      catalogPartId: offer.catalogPartId,
      colorId: piece.colorId,
      transform: offer.transform,
    });
    document = applyBuildOperations(document, transaction.operations);
  }
  return document;
}

function packedMaskDigest(mask: Uint8Array, widthPx: number, heightPx: number): Sha256Digest {
  const packed = packRealBuildCompiledBinaryMaskMsb(mask, widthPx, heightPx);
  return `sha256:${sha256Hex(packed)}` as Sha256Digest;
}

function requireBindings(input: {
  readonly quotient: RealBuildStepOneProperC4QuotientInspection;
  readonly preparedStep: RealBuildPreparedStepInspection;
  readonly rootDocumentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly representativeRows: readonly RealBuildStepOneProperC4RepresentativeCameraScoreRow[];
}): void {
  if (
    input.quotient.rawCandidateCount !== 400 ||
    input.quotient.orbitCount !== 100 ||
    input.quotient.inverseExpandedRawRoster.length !== 400 ||
    input.preparedStep.stepNumber !== 1 ||
    input.preparedStep.preparedRunInputDigest !== input.quotient.preparedRunInputDigest ||
    input.preparedStep.printedStepIdentity !== input.quotient.printedStepIdentity ||
    input.rootDocumentSnapshot.documentHash !== input.quotient.rootDocumentHash ||
    input.rootDocumentSnapshot.canonicalBytesHash !== input.quotient.rootCanonicalBytesHash ||
    input.representativeRows.length !== 800
  ) {
    throw new TypeError(
      "Proper-C4 population verification requires the exact current quotient, root, prepared step, and 800 rendered representative rows.",
    );
  }
}

function sameHypothesis(
  left: (typeof PANEL_CAMERA_ANGULAR_HYPOTHESES)[number],
  right: (typeof PANEL_CAMERA_ANGULAR_HYPOTHESES)[number],
): boolean {
  return (
    left.latticeHand === right.latticeHand &&
    left.latticeDeterminant === right.latticeDeterminant &&
    left.turnDegrees === right.turnDegrees
  );
}

function indexOfHypothesis(hypothesis: (typeof PANEL_CAMERA_ANGULAR_HYPOTHESES)[number]): number {
  return PANEL_CAMERA_ANGULAR_HYPOTHESES.findIndex((candidate) =>
    sameHypothesis(candidate, hypothesis),
  );
}

/**
 * Exhaustively renders the 300 members omitted by the quotient and checks their 2,400
 * mapped packed-mask commitments against the representative masks already scored.
 * These are separately budgeted verification renders, never part of the 800-render claim.
 */
export function verifyRealBuildStepOneProperC4PopulationEquivariance(input: {
  readonly quotient: RealBuildStepOneProperC4QuotientInspection;
  readonly preparedStep: RealBuildPreparedStepInspection;
  readonly rootDocumentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly source: RealBuildCompiledObservationSourceInput;
  readonly prepareModelMaskRenderer: RealBuildStepOneMaskRendererFactory;
  readonly representativeRows: readonly RealBuildStepOneProperC4RepresentativeCameraScoreRow[];
}): RealBuildStepOneProperC4PopulationEquivarianceInspection {
  const quotient = requireRealBuildStepOneProperC4QuotientInspection(input.quotient);
  const preparedStep = requireRealBuildPreparedStepInspection(input.preparedStep);
  const rootDocumentSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
    input.rootDocumentSnapshot,
  );
  const source = snapshotRealBuildCompiledObservationSource(input.source);
  const rendererConfiguration = inspectRealBuildStepOneMaskRendererFactoryConfiguration(
    input.prepareModelMaskRenderer,
    source,
  );
  requireBindings({
    quotient,
    preparedStep,
    rootDocumentSnapshot,
    representativeRows: input.representativeRows,
  });
  const verificationLedger =
    createRealBuildPanelCameraBranchBudgetLedger(FIXED_VERIFICATION_BUDGET);
  const comparisons: unknown[] = [];
  const verificationClosureDigests: Sha256Digest[] = [];
  let preparations = 0;
  let renders = 0;
  let disposals = 0;
  let reservations = 0;
  const omitted = quotient.orbits.flatMap((orbit) =>
    orbit.members.slice(1).map((member, index) => ({
      orbit,
      member,
      memberIndex: index + 1,
    })),
  );
  if (omitted.length !== OMITTED_MEMBER_COUNT) {
    throw new TypeError("Proper-C4 population verification did not enumerate 300 omitted members.");
  }
  let perClosureResources:
    ReturnType<typeof preflightRealBuildCompiledObservationResources> | undefined;
  for (let closureIndex = 0; closureIndex < VERIFICATION_CLOSURE_COUNT; closureIndex += 1) {
    const members = omitted.slice(
      closureIndex * MEMBERS_PER_VERIFICATION_CLOSURE,
      (closureIndex + 1) * MEMBERS_PER_VERIFICATION_CLOSURE,
    );
    if (members.length !== MEMBERS_PER_VERIFICATION_CLOSURE) {
      throw new TypeError(
        `Proper-C4 population verification closure ${closureIndex} did not retain five omitted members.`,
      );
    }
    const resources = preflightRealBuildCompiledObservationResources({
      source,
      rootCount: 8,
      cameraCount: CAMERAS_PER_VERIFICATION_CLOSURE,
      observationCount: CAMERAS_PER_VERIFICATION_CLOSURE,
    });
    perClosureResources ??= resources;
    if (
      resources.predictedRoleBytes !== perClosureResources.predictedRoleBytes ||
      resources.predictedPixelVisits !== perClosureResources.predictedPixelVisits ||
      !verificationLedger.tryReserve(CAMERAS_PER_VERIFICATION_CLOSURE)
    ) {
      throw new RangeError(
        `Proper-C4 population verification closure ${closureIndex} could not reserve 40 cameras inside its separate fixed-8,192 ledger and per-closure pixel cap.`,
      );
    }
    reservations += 1;
    const closureComparisons: unknown[] = [];
    for (const { orbit, member, memberIndex } of members) {
      const raw = quotient.inverseExpandedRawRoster[member.rawIndex];
      if (
        raw === undefined ||
        memberIndex === 0 ||
        member.turnDegrees === 0 ||
        raw.rawIndex !== member.rawIndex
      ) {
        throw new TypeError(
          `Proper-C4 population orbit ${orbit.orbitIndex} does not retain one exact omitted member.`,
        );
      }
      let supplied: unknown;
      try {
        supplied = SAFE_REFLECT_APPLY(input.prepareModelMaskRenderer, undefined, [
          intrinsicRealBuildFreeze({
            candidateId: `proper-c4-population-raw-${member.rawIndex}`,
            document: proofDocument(rootDocumentSnapshot, preparedStep, raw),
          }),
        ]);
      } catch (caught) {
        throw new TypeError(
          `Proper-C4 population verification could not prepare raw member ${member.rawIndex}.`,
          { cause: caught },
        );
      }
      const prepared = inspectRealBuildStepOnePreparedMaskRenderer(supplied);
      preparations += 1;
      let failure: unknown;
      try {
        for (
          let cameraIndex = 0;
          cameraIndex < PANEL_CAMERA_ANGULAR_HYPOTHESES.length;
          cameraIndex += 1
        ) {
          const hypothesis = PANEL_CAMERA_ANGULAR_HYPOTHESES[cameraIndex]!;
          renders += 1;
          const mask = snapshotPanelCameraBinaryMask(
            SAFE_REFLECT_APPLY(prepared.render, prepared.owner, [hypothesis]),
            source.widthPx * source.heightPx,
            `Proper-C4 population raw ${member.rawIndex} camera ${cameraIndex}`,
          );
          const actualDigest = packedMaskDigest(mask, source.widthPx, source.heightPx);
          const representativeHypothesis = mapRealBuildStepOneProperC4MemberCameraToRepresentative(
            hypothesis,
            member.turnDegrees,
          );
          const representativeHypothesisIndex = indexOfHypothesis(representativeHypothesis);
          const representativeEncounterIndex =
            representativeHypothesisIndex * 100 + orbit.orbitIndex;
          const expected = input.representativeRows[representativeEncounterIndex];
          const rawEncounterIndex = cameraIndex * 400 + member.rawIndex;
          if (
            representativeHypothesisIndex < 0 ||
            expected === undefined ||
            expected.orbitIndex !== orbit.orbitIndex ||
            !sameHypothesis(expected.hypothesis, representativeHypothesis) ||
            actualDigest !== expected.maskDigest
          ) {
            throw new TypeError(
              `Proper-C4 population raw member ${member.rawIndex} camera ${cameraIndex} did not match its scored representative mask; no quotient score or tie claim may survive.`,
            );
          }
          const comparison = {
            verificationClosureIndex: closureIndex,
            rawEncounterIndex,
            rawIndex: member.rawIndex,
            orbitIndex: orbit.orbitIndex,
            memberIndex,
            memberTurnDegrees: member.turnDegrees,
            hypothesis,
            representativeHypothesis,
            representativeEncounterIndex,
            packedMaskDigest: actualDigest,
          };
          comparisons.push(comparison);
          closureComparisons.push(comparison);
        }
      } catch (caught) {
        failure = caught;
      }
      try {
        SAFE_REFLECT_APPLY(prepared.dispose, prepared.owner, []);
        disposals += 1;
      } catch (caught) {
        throw new TypeError(
          `Proper-C4 population verification could not dispose raw member ${member.rawIndex}; discard this proof and clean the task-owned renderer.`,
          { cause: caught },
        );
      }
      if (failure !== undefined) throw failure;
    }
    verificationClosureDigests.push(
      canonicalDigest({
        schemaVersion: "lego.real-build-step-one-proper-c4-population-closure/1",
        closureIndex,
        members: members.map(({ orbit, member, memberIndex }) => ({
          orbitIndex: orbit.orbitIndex,
          rawIndex: member.rawIndex,
          memberIndex,
          turnDegrees: member.turnDegrees,
        })),
        comparisons: closureComparisons,
        resources,
      }),
    );
  }
  if (
    verificationLedger.budget !== FIXED_VERIFICATION_BUDGET ||
    verificationLedger.reserved !== VERIFICATION_RENDER_COUNT ||
    verificationLedger.refusedReservation ||
    verificationLedger.failedReservation !== null ||
    reservations !== VERIFICATION_CLOSURE_COUNT ||
    verificationClosureDigests.length !== VERIFICATION_CLOSURE_COUNT ||
    comparisons.length !== VERIFICATION_RENDER_COUNT ||
    preparations !== OMITTED_MEMBER_COUNT ||
    renders !== VERIFICATION_RENDER_COUNT ||
    disposals !== OMITTED_MEMBER_COUNT
  ) {
    throw new TypeError(
      "Proper-C4 population verification did not close exactly 300 omitted members and 2,400 renders inside its separate fixed-8,192 reservation.",
    );
  }
  const comparisonDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-population-comparisons/1",
    quotientDigest: quotient.quotientDigest,
    rendererConfigurationDigest: rendererConfiguration.configurationDigest,
    representativeRowsDigest: canonicalDigest({
      schemaVersion: "lego.real-build-step-one-proper-c4-representative-scores/1",
      rows: input.representativeRows,
    }),
    verificationClosureDigests,
    comparisons,
  });
  const representativeRowsDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-representative-scores/1",
    rows: input.representativeRows,
  });
  return intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-step-one-proper-c4-population-equivariance/1" as const,
    quotientDigest: quotient.quotientDigest,
    rawRosterDigest: quotient.rawRosterDigest,
    rendererConfigurationDigest: rendererConfiguration.configurationDigest,
    representativeRowsDigest,
    comparisonDigest,
    exactPackedMaskCommitmentParity: true as const,
    scoreAndTiePreservation: "identical-packed-masks-under-one-bound-source" as const,
    accounting: intrinsicRealBuildFreeze({
      verificationBudget: 8_192 as const,
      verificationReserved: 2_400 as const,
      verificationReservationCount: 60 as const,
      verificationClosureCount: 60 as const,
      membersPerVerificationClosure: 5 as const,
      camerasPerVerificationClosure: 40 as const,
      perClosurePredictedRoleBytes: perClosureResources!.predictedRoleBytes,
      perClosurePredictedPixelVisits: perClosureResources!.predictedPixelVisits,
      omittedMembers: 300 as const,
      verificationPreparations: 300 as const,
      verificationPhysicalRenderCalls: 2_400 as const,
      verificationDisposals: 300 as const,
      reductionPhysicalRenderCalls: 800 as const,
      reductionAndVerificationPhysicalRenderCalls: 3_200 as const,
      verificationMaskPixels: VERIFICATION_RENDER_COUNT * source.widthPx * source.heightPx,
    }),
    backendClaim: "exhaustive-current-population-same-factory" as const,
    physicalFrameAuthority: "absent" as const,
    placementAuthority: "absent" as const,
    completionAuthority: intrinsicRealBuildFreeze({ status: "absent" as const, authorized: false }),
    authority: "absent" as const,
  });
}
