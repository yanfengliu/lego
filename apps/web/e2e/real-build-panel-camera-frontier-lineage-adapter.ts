import {
  deriveRealBuildLineageIdentity,
  snapshotRealBuildCandidateIdentity,
  snapshotRealBuildLineageIdentity,
  type RealBuildLineageIdentity,
} from "./real-build-candidate-lineage-identity";
import {
  MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_ATTEMPTS,
  projectRealBuildLineageEvidence,
  realBuildLineageAttemptEvidenceId,
  snapshotRealBuildLineageTiePolicy,
  type RealBuildLineageAttemptEvidence,
  type RealBuildLineageEvidence,
  type RealBuildLineageTiePolicy,
} from "./real-build-lineage-evidence";
import {
  requireTrustedRealBuildPanelCameraFrontierResolution,
  type RealBuildPanelCameraFrontierCandidate,
  type RealBuildPanelCameraFrontierResolution,
} from "./real-build-panel-camera-frontier";
import { realBuildLivePanelCameraEvidenceId } from "./real-build-panel-camera-lineage-evidence-id";
import {
  readLineageAdapterDataProperty,
  snapshotLineageAdapterDenseArray,
} from "./real-build-lineage-adapter-input";

const SCORE_TIE_POLICY: RealBuildLineageTiePolicy = Object.freeze({
  metric: "panel-agreement/1",
  direction: "higher-is-better",
  minimumScore: 0,
  minimumMargin: 0,
  exactTie: "refuse",
});

const MAX_FRONTIER_PARENTS = 100_000;
type FrontierObservation = RealBuildPanelCameraFrontierResolution<unknown>["observations"][number];
export interface RealBuildPanelCameraFrontierObservationIndex {
  readonly visitedObservationCount: number;
  observationsFor(
    candidateId: string,
    latticeHand: string,
    turnDegrees: number,
  ): readonly FrontierObservation[];
  observationsForId(candidateId: string, observationId: string): readonly FrontierObservation[];
}
const NO_FRONTIER_OBSERVATIONS: readonly FrontierObservation[] = Object.freeze([]);

function angularKey(hand: string, turnDegrees: number): string {
  return `${hand}:${turnDegrees}`;
}

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
      `Panel-camera frontier lineage requires through step 0..359 and a later registration panel 1..359.`,
    );
  }
}

export function indexRealBuildPanelCameraFrontierObservations(
  suppliedResult: RealBuildPanelCameraFrontierResolution<unknown>,
): RealBuildPanelCameraFrontierObservationIndex {
  const result = requireTrustedRealBuildPanelCameraFrontierResolution(suppliedResult);
  const mutableIndex = new Map<string, Map<string, FrontierObservation[]>>();
  const mutableIdIndex = new Map<string, Map<string, FrontierObservation[]>>();
  let visitedObservationCount = 0;
  for (const observation of result.observations) {
    visitedObservationCount += 1;
    let byAngular = mutableIndex.get(observation.candidateId);
    if (byAngular === undefined) {
      byAngular = new Map();
      mutableIndex.set(observation.candidateId, byAngular);
    }
    const key = angularKey(
      observation.registration.latticeHand,
      observation.registration.turnDegrees,
    );
    const rows = byAngular.get(key);
    if (rows === undefined) byAngular.set(key, [observation]);
    else rows.push(observation);
    let byId = mutableIdIndex.get(observation.candidateId);
    if (byId === undefined) {
      byId = new Map();
      mutableIdIndex.set(observation.candidateId, byId);
    }
    const idRows = byId.get(observation.observationId);
    if (idRows === undefined) byId.set(observation.observationId, [observation]);
    else idRows.push(observation);
  }
  const index = new Map<string, ReadonlyMap<string, readonly FrontierObservation[]>>();
  for (const [candidateId, mutableByAngular] of mutableIndex) {
    const byAngular = new Map<string, readonly FrontierObservation[]>();
    for (const [key, rows] of mutableByAngular) byAngular.set(key, Object.freeze([...rows]));
    index.set(candidateId, byAngular);
  }
  const idIndex = new Map<string, ReadonlyMap<string, readonly FrontierObservation[]>>();
  for (const [candidateId, mutableById] of mutableIdIndex) {
    const byId = new Map<string, readonly FrontierObservation[]>();
    for (const [observationId, rows] of mutableById) {
      byId.set(observationId, Object.freeze([...rows]));
    }
    idIndex.set(candidateId, byId);
  }
  return Object.freeze({
    visitedObservationCount,
    observationsFor(candidateId: string, latticeHand: string, turnDegrees: number) {
      return (
        index.get(candidateId)?.get(angularKey(latticeHand, turnDegrees)) ??
        NO_FRONTIER_OBSERVATIONS
      );
    },
    observationsForId(candidateId: string, observationId: string) {
      return index.get(candidateId) === undefined
        ? NO_FRONTIER_OBSERVATIONS
        : (idIndex.get(candidateId)?.get(observationId) ?? NO_FRONTIER_OBSERVATIONS);
    },
  });
}

function attemptsForCandidate(
  result: RealBuildPanelCameraFrontierResolution<unknown>,
  candidate: RealBuildPanelCameraFrontierCandidate<unknown>,
  parents: ReadonlyMap<string, RealBuildLineageIdentity>,
  observationIndex: RealBuildPanelCameraFrontierObservationIndex,
): readonly RealBuildLineageAttemptEvidence[] {
  if (candidate.status !== "observed" && candidate.status !== "unresolved") {
    throw new TypeError(
      `Panel-camera frontier lineage refuses ${candidate.status} until an exact typed failure witness producer exists.`,
    );
  }
  if (
    candidate.attempts.length !== 8 ||
    candidate.attempts.some(({ status }) => status !== "scored") ||
    candidate.renderMaskDigests.length !== 8
  ) {
    throw new TypeError(
      `Panel-camera frontier candidate requires eight complete scored attempts and render digests.`,
    );
  }
  return candidate.attempts.flatMap((attempt, attemptIndex) => {
    if (attempt.status !== "scored") throw new TypeError(`Unreachable non-scored attempt.`);
    const observations = observationIndex.observationsFor(
      candidate.candidateId,
      attempt.latticeHand,
      attempt.turnDegrees,
    );
    if (
      observations.length !== candidate.parentLineageIds.length ||
      observations.some(
        ({ documentHash, throughStepNumber, silhouetteRegistration }) =>
          documentHash !== candidate.documentHash ||
          throughStepNumber !== candidate.throughStepNumber ||
          silhouetteRegistration.iou !== attempt.iou,
      )
    ) {
      throw new TypeError(
        `Panel-camera frontier observations do not exactly reproduce one scored attempt per parent.`,
      );
    }
    const first = observations[0]!;
    if (observations.some(({ observationId }) => observationId !== first.observationId)) {
      throw new TypeError(`Converged parents do not share one exact live camera observation.`);
    }
    const renderMaskDigest = candidate.renderMaskDigests[attemptIndex];
    if (renderMaskDigest === null || renderMaskDigest === undefined) {
      throw new TypeError(`A scored frontier attempt has no exact render-mask digest.`);
    }
    const sourceEvidenceId = realBuildLivePanelCameraEvidenceId({
      candidateId: candidate.candidateId,
      documentHash: candidate.documentHash,
      throughStepNumber: candidate.throughStepNumber,
      registrationPanelStepNumber: result.registrationPanelStepNumber,
      legacyObservationId: first.observationId,
      registration: first.registration,
      centrePx: attempt.centrePx,
      silhouetteIou: attempt.iou,
      renderMaskDigest,
      rasterMeasurement: result.rasterMeasurement,
    });
    return candidate.parentLineageIds.map((parentLineageId): RealBuildLineageAttemptEvidence => {
      const parent = parents.get(parentLineageId);
      if (parent === undefined) {
        throw new TypeError(`Panel-camera frontier candidate names an unsupplied central parent.`);
      }
      const attemptEvidenceId = realBuildLineageAttemptEvidenceId({
        candidateId: candidate.candidateId,
        parentLineageId,
        throughStepNumber: candidate.throughStepNumber,
        registrationPanelStepNumber: result.registrationPanelStepNumber,
        status: "scored",
        sourceEvidenceId,
      });
      const identity = deriveRealBuildLineageIdentity({
        candidateId: candidate.candidateId,
        documentHash: candidate.documentHash,
        parent,
        throughStepNumber: candidate.throughStepNumber,
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
  });
}

function selectedAttemptLineages(
  candidate: RealBuildPanelCameraFrontierCandidate<unknown>,
  attempts: readonly RealBuildLineageAttemptEvidence[],
  observationIndex: RealBuildPanelCameraFrontierObservationIndex,
): readonly string[] {
  if (candidate.selectedObservationId === null) return [];
  if (!candidate.observationIds.includes(candidate.selectedObservationId)) {
    throw new TypeError(`Frontier selectedObservationId is not retained by its candidate.`);
  }
  const selectedObservations = observationIndex.observationsForId(
    candidate.candidateId,
    candidate.selectedObservationId,
  );
  if (selectedObservations.length !== candidate.parentLineageIds.length) {
    throw new TypeError(`Frontier selectedObservationId has no exact retained observation.`);
  }
  const selectedObservation = selectedObservations[0]!;
  const angular = candidate.attempts.findIndex(
    (attempt) =>
      attempt.status === "scored" &&
      attempt.latticeHand === selectedObservation.registration.latticeHand &&
      attempt.turnDegrees === selectedObservation.registration.turnDegrees,
  );
  if (angular < 0) throw new TypeError(`Frontier selected observation has no scored attempt.`);
  const offset = angular * candidate.parentLineageIds.length;
  return attempts
    .slice(offset, offset + candidate.parentLineageIds.length)
    .map(({ lineageId }) => lineageId);
}

/** One current central lineage-evidence result per stable document candidate. */
export function projectRealBuildPanelCameraFrontierLineageEvidence(input: {
  readonly resolution: RealBuildPanelCameraFrontierResolution<unknown>;
  readonly parents: readonly RealBuildLineageIdentity[];
  readonly tiePolicy?: RealBuildLineageTiePolicy;
}): readonly RealBuildLineageEvidence[] {
  const result = requireTrustedRealBuildPanelCameraFrontierResolution(
    readLineageAdapterDataProperty(
      input,
      "resolution",
      "Panel-camera frontier lineage adapter input",
    ),
  );
  const suppliedParentsValue = readLineageAdapterDataProperty(
    input,
    "parents",
    "Panel-camera frontier lineage adapter input",
  );
  const tiePolicy = readLineageAdapterDataProperty(
    input,
    "tiePolicy",
    "Panel-camera frontier lineage adapter input",
    true,
  ) as RealBuildLineageTiePolicy | undefined;
  if (result.status === "failed" || result.status === "budget-refused") {
    throw new TypeError(
      `Panel-camera frontier lineage refuses ${result.status} until an exact typed failure witness producer exists.`,
    );
  }
  requireLivePanelSteps(result.throughStepNumber, result.registrationPanelStepNumber);
  const validatedTiePolicy =
    tiePolicy === undefined ? SCORE_TIE_POLICY : snapshotRealBuildLineageTiePolicy(tiePolicy);
  const suppliedParents = snapshotLineageAdapterDenseArray(
    suppliedParentsValue,
    "Panel-camera frontier lineage adapter input.parents",
    MAX_FRONTIER_PARENTS,
  );
  const parents: Map<string, RealBuildLineageIdentity> = new Map(
    suppliedParents.map((value) => {
      const parent = snapshotRealBuildLineageIdentity(value);
      return [parent.lineageId, parent] as const;
    }),
  );
  const expectedParents = new Set(
    result.candidates.flatMap(({ parentLineageIds }) => parentLineageIds),
  );
  if (
    parents.size !== suppliedParents.length ||
    parents.size !== expectedParents.size ||
    [...parents.keys()].some((lineageId) => !expectedParents.has(lineageId))
  ) {
    throw new TypeError(
      `Panel-camera frontier requires exactly its distinct central direct parents.`,
    );
  }
  for (const candidate of result.candidates) {
    for (const parentLineageId of candidate.parentLineageIds) {
      const parent = parents.get(parentLineageId);
      if (
        parent === undefined ||
        parent.candidateId !== candidate.candidateId ||
        parent.documentHash !== candidate.documentHash ||
        parent.throughStepNumber !== candidate.throughStepNumber
      ) {
        throw new TypeError(
          `Panel-camera frontier observation must retain every direct parent candidateId, documentHash, and throughStepNumber exactly.`,
        );
      }
    }
  }
  const expectedObservationCount = result.candidates.reduce(
    (total, candidate) => total + candidate.parentLineageIds.length * 8,
    0,
  );
  if (result.observations.length !== expectedObservationCount) {
    throw new TypeError(
      `Panel-camera frontier observations must contain exactly eight rows per candidate parent.`,
    );
  }
  const indexedObservations = indexRealBuildPanelCameraFrontierObservations(result);
  if (indexedObservations.visitedObservationCount !== result.observations.length) {
    throw new TypeError(`Panel-camera frontier observation index did not visit every row once.`);
  }
  return Object.freeze(
    result.candidates.map((candidate) => {
      snapshotRealBuildCandidateIdentity({
        candidateId: candidate.candidateId,
        documentHash: candidate.documentHash,
      });
      const attempts = attemptsForCandidate(result, candidate, parents, indexedObservations);
      const expectedSelected = selectedAttemptLineages(candidate, attempts, indexedObservations);
      const evidence = projectRealBuildLineageEvidence(
        {
          throughStepNumber: result.throughStepNumber,
          registrationPanelStepNumber: result.registrationPanelStepNumber,
          decisionPanelStepNumber:
            expectedSelected.length === 0 ? null : result.registrationPanelStepNumber,
          tiePolicy: validatedTiePolicy,
          parents: candidate.parentLineageIds.map((lineageId) => parents.get(lineageId)!),
          attempts,
        },
        MAXIMUM_REAL_BUILD_LINEAGE_EVIDENCE_ATTEMPTS,
      );
      if (
        evidence.selection.selectedLineageIds.length !== expectedSelected.length ||
        evidence.selection.selectedLineageIds.some(
          (lineageId, index) => lineageId !== expectedSelected[index],
        )
      ) {
        throw new TypeError(
          `Frontier selectedObservationId does not equal the score-derived central lineage group.`,
        );
      }
      return evidence;
    }),
  );
}
