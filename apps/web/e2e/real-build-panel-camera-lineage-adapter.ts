import {
  createRealBuildLineageIdentity,
  deriveRealBuildLineageIdentity,
  snapshotRealBuildCandidateIdentity,
  snapshotRealBuildLineageIdentity,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  projectRealBuildLineageEvidence,
  realBuildLineageAttemptEvidenceId,
  snapshotRealBuildLineageTiePolicy,
  type RealBuildLineageAttemptEvidence,
  type RealBuildLineageEvidence,
  type RealBuildLineageTiePolicy,
} from "./real-build-lineage-evidence";
import type { RealBuildPanelCameraResolution } from "./real-build-panel-camera-resolver-types";
import { realBuildLivePanelCameraEvidenceId } from "./real-build-panel-camera-lineage-evidence-id";
import { requireTrustedRealBuildPanelCameraResolution } from "./real-build-panel-camera-resolver";
import { readLineageAdapterDataProperty } from "./real-build-lineage-adapter-input";

const SCORE_TIE_POLICY: RealBuildLineageTiePolicy = Object.freeze({
  metric: "panel-agreement/1",
  direction: "higher-is-better",
  minimumScore: 0,
  minimumMargin: 0,
  exactTie: "refuse",
});

function requireLivePanelSteps(throughStepNumber: number, registrationPanelStepNumber: number) {
  if (
    !Number.isSafeInteger(throughStepNumber) ||
    throughStepNumber < 0 ||
    throughStepNumber > 359 ||
    !Number.isSafeInteger(registrationPanelStepNumber) ||
    registrationPanelStepNumber < 1 ||
    registrationPanelStepNumber > 359 ||
    registrationPanelStepNumber <= throughStepNumber
  ) {
    throw new RangeError(
      `Panel-camera lineage requires through step 0..359 and a later registration panel 1..359.`,
    );
  }
}

function rootLocalId(
  candidateId: string,
  panel: number,
  seed: RealBuildPanelCameraResolution<unknown>["seeds"][number],
): string {
  return (
    `${candidateId}:panel-camera-seed:p${String(panel).padStart(3, "0")}:` +
    `${seed.latticeHand}:d${seed.latticeDeterminant}:q${String(seed.turnDegrees).padStart(3, "0")}`
  );
}

function rootAttempts(result: RealBuildPanelCameraResolution<unknown>) {
  if (result.seeds.length !== 8) {
    throw new TypeError(`Seeded panel-camera resolution must retain exactly eight live D4 seeds.`);
  }
  return result.seeds.map((seed): RealBuildLineageAttemptEvidence => {
    const identity = createRealBuildLineageIdentity({
      candidateId: result.candidateId,
      documentHash: result.documentHash,
      parent: null,
      throughStepNumber: 0,
      localIdentity: {
        kind: "evidence",
        id: rootLocalId(result.candidateId, result.registrationPanelStepNumber, seed),
      },
    });
    return {
      ...identity,
      sourceEvidenceId: null,
      attemptEvidenceId: null,
      cameraEvidenceId: null,
      registrationPanelStepNumber: result.registrationPanelStepNumber,
      status: "seeded",
      score: null,
    };
  });
}

function scoredAttempts(
  result: RealBuildPanelCameraResolution<unknown>,
  parent: RealBuildLineageIdentity,
): readonly RealBuildLineageAttemptEvidence[] {
  if (result.status !== "observed" && result.status !== "unresolved") {
    throw new TypeError(
      `Panel-camera lineage adapter refuses ${result.status} until a typed exact failure/not-observable witness producer is available.`,
    );
  }
  if (
    result.attempts.length !== 8 ||
    result.attempts.some(({ status }) => status !== "scored") ||
    result.observations.length !== 8
  ) {
    throw new TypeError(
      `Observed/unresolved panel-camera lineage requires eight complete scored attempts and observations.`,
    );
  }
  return result.attempts.map((attempt, attemptIndex): RealBuildLineageAttemptEvidence => {
    if (attempt.status !== "scored") throw new TypeError(`Unreachable non-scored attempt.`);
    const observation = result.observations.find(
      ({ registration }) =>
        registration.latticeHand === attempt.latticeHand &&
        registration.turnDegrees === attempt.turnDegrees,
    );
    if (observation === undefined) {
      throw new TypeError(`A scored panel-camera hypothesis has no exact live observation.`);
    }
    if (observation.silhouetteRegistration.iou !== attempt.iou) {
      throw new TypeError(
        `A live panel-camera observation score does not equal its ranked attempt.`,
      );
    }
    const renderMaskDigest = result.renderMaskDigests[attemptIndex] ?? null;
    if (renderMaskDigest === null) {
      throw new TypeError(`A scored live panel-camera attempt has no exact render-mask digest.`);
    }
    const sourceEvidenceId = realBuildLivePanelCameraEvidenceId({
      candidateId: result.candidateId,
      documentHash: result.documentHash,
      throughStepNumber: result.throughStepNumber,
      registrationPanelStepNumber: result.registrationPanelStepNumber,
      legacyObservationId: observation.observationId,
      registration: observation.registration,
      centrePx: attempt.centrePx,
      silhouetteIou: attempt.iou,
      renderMaskDigest,
      rasterMeasurement: result.rasterMeasurement,
    });
    const attemptEvidenceId = realBuildLineageAttemptEvidenceId({
      candidateId: result.candidateId,
      parentLineageId: parent.lineageId,
      throughStepNumber: result.throughStepNumber,
      registrationPanelStepNumber: result.registrationPanelStepNumber,
      status: "scored",
      sourceEvidenceId,
    });
    const identity = deriveRealBuildLineageIdentity({
      candidateId: result.candidateId,
      documentHash: result.documentHash,
      parent,
      throughStepNumber: result.throughStepNumber,
      localIdentity: { kind: "evidence", id: attemptEvidenceId },
    });
    return {
      ...identity,
      sourceEvidenceId,
      attemptEvidenceId,
      cameraEvidenceId: sourceEvidenceId,
      registrationPanelStepNumber: result.registrationPanelStepNumber,
      status: "scored",
      score: attempt.iou,
    };
  });
}

export function projectRealBuildPanelCameraLineageEvidence(input: {
  readonly resolution: RealBuildPanelCameraResolution<unknown>;
  readonly parent: RealBuildLineageIdentity | null;
  readonly tiePolicy?: RealBuildLineageTiePolicy;
}): RealBuildLineageEvidence {
  const resolution = requireTrustedRealBuildPanelCameraResolution(
    readLineageAdapterDataProperty(input, "resolution", "Panel-camera lineage adapter input"),
  );
  const suppliedParent = readLineageAdapterDataProperty(
    input,
    "parent",
    "Panel-camera lineage adapter input",
  ) as RealBuildLineageIdentity | null;
  const tiePolicy = readLineageAdapterDataProperty(
    input,
    "tiePolicy",
    "Panel-camera lineage adapter input",
    true,
  ) as RealBuildLineageTiePolicy | undefined;
  snapshotRealBuildCandidateIdentity({
    candidateId: resolution.candidateId,
    documentHash: resolution.documentHash,
  });
  if (resolution.status === "failed" || resolution.status === "budget-refused") {
    throw new TypeError(
      `Panel-camera lineage adapter refuses ${resolution.status} until a typed exact failure witness producer exists.`,
    );
  }
  requireLivePanelSteps(resolution.throughStepNumber, resolution.registrationPanelStepNumber);
  const validatedTiePolicy =
    tiePolicy === undefined ? SCORE_TIE_POLICY : snapshotRealBuildLineageTiePolicy(tiePolicy);
  if (resolution.status === "seeded") {
    if (suppliedParent !== null || resolution.parentLineageId !== null) {
      throw new TypeError(`Seeded panel-camera lineage must not carry a parent.`);
    }
    return projectRealBuildLineageEvidence({
      throughStepNumber: 0,
      registrationPanelStepNumber: resolution.registrationPanelStepNumber,
      decisionPanelStepNumber: null,
      tiePolicy: validatedTiePolicy,
      parents: [],
      attempts: rootAttempts(resolution),
    });
  }
  if (suppliedParent === null) {
    throw new TypeError(`Non-root panel-camera lineage requires one exact central direct parent.`);
  }
  const parent = snapshotRealBuildLineageIdentity(suppliedParent);
  if (resolution.parentLineageId !== parent.lineageId) {
    throw new TypeError(
      `Panel-camera resolution parentLineageId does not equal the supplied central parent.`,
    );
  }
  if (
    parent.candidateId !== resolution.candidateId ||
    parent.documentHash !== resolution.documentHash ||
    parent.throughStepNumber !== resolution.throughStepNumber
  ) {
    throw new TypeError(
      `Panel-camera observation must retain the supplied parent candidateId, documentHash, and throughStepNumber exactly.`,
    );
  }
  const attempts = scoredAttempts(resolution, parent);
  const selectedObservation =
    resolution.selectedObservationId === null
      ? null
      : (resolution.observations.find(
          ({ observationId }) => observationId === resolution.selectedObservationId,
        ) ?? null);
  if (resolution.selectedObservationId !== null && selectedObservation === null) {
    throw new TypeError(`Panel-camera selectedObservationId does not name a retained observation.`);
  }
  const evidence = projectRealBuildLineageEvidence({
    throughStepNumber: resolution.throughStepNumber,
    registrationPanelStepNumber: resolution.registrationPanelStepNumber,
    decisionPanelStepNumber:
      selectedObservation === null ? null : resolution.registrationPanelStepNumber,
    tiePolicy: validatedTiePolicy,
    parents: [parent],
    attempts,
  });
  if (selectedObservation !== null) {
    const expected = attempts.find((_attempt, index) => {
      const liveAttempt = resolution.attempts[index];
      return (
        liveAttempt?.latticeHand === selectedObservation.registration.latticeHand &&
        liveAttempt.turnDegrees === selectedObservation.registration.turnDegrees
      );
    });
    if (
      expected === undefined ||
      evidence.selection.selectedLineageIds.length !== 1 ||
      evidence.selection.selectedLineageIds[0] !== expected.lineageId
    ) {
      throw new TypeError(
        `Panel-camera selectedObservationId does not equal the score-derived selected central lineage.`,
      );
    }
  } else if (evidence.selection.status === "selected") {
    throw new TypeError(
      `Panel-camera omitted a selectedObservationId for the score-derived winner.`,
    );
  }
  return evidence;
}
