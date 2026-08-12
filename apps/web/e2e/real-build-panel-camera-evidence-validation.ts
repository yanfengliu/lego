import {
  PANEL_CAMERA_DIGEST_PATTERN,
  realBuildPanelCameraLineageId,
  realBuildStableDocumentCandidateId,
} from "./real-build-panel-camera-resolver-boundary";
import type {
  RealBuildPanelCameraCandidateEvidence,
  RealBuildPanelCameraEvidence,
  RealBuildPanelCameraObservationEvidence,
  RealBuildPanelCameraMeasurementEvidence,
} from "./real-build-panel-camera-evidence-types";
import {
  coherentPanelCameraAttempt,
  coherentPanelCameraAttemptOrder,
  coherentPanelCameraFailure,
  expectedPanelCameraObservationId,
  failPanelCameraEvidence as fail,
  panelCameraAngularKey as angularKey,
  requireUniquePanelCameraStrings as requireUnique,
  resolverDerivedPanelCameraStatus,
  samePanelCameraStrings as sameStrings,
} from "./real-build-panel-camera-evidence-attempt-validation";

const LINEAGE_PATTERN = /^panel-camera-lineage:[0-9a-f]{64}$/u;
const PARENT_LINEAGE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/u;

type CandidateRows = {
  readonly rows: RealBuildPanelCameraObservationEvidence[];
  readonly byObservation: Map<string, Map<string, RealBuildPanelCameraObservationEvidence>>;
  readonly observationOrder: string[];
};

function coherentObservation(
  observation: RealBuildPanelCameraObservationEvidence,
  evidence: RealBuildPanelCameraEvidence,
  label: string,
): void {
  const determinant = observation.registration.latticeHand === "as-fitted" ? 1 : -1;
  if (observation.registration.latticeDeterminant !== determinant) {
    fail(`${label} hand requires determinant ${determinant}.`);
  }
  if (
    observation.registration.registrationPanelStepNumber !== evidence.registrationPanelStepNumber
  ) {
    fail(`${label} registration panel does not match the evidence panel.`);
  }
  if (!LINEAGE_PATTERN.test(observation.lineageId)) {
    fail(`${label} lineageId is not a canonical panel-camera lineage.`);
  }
  const seed = observation.observationId === null;
  if (seed !== (evidence.status === "seeded")) {
    fail(`${label} may be an unregistered seed only in seeded aggregate evidence.`);
  }
  if (
    seed !== (observation.parentLineageId === null) ||
    seed !== (observation.silhouetteIou === null) ||
    seed !== (observation.registration.shiftPx === null)
  ) {
    fail(`${label} seed identity, parent, score, and shift nullability disagree.`);
  }
  if (
    observation.parentLineageId !== null &&
    !PARENT_LINEAGE_PATTERN.test(observation.parentLineageId)
  ) {
    fail(`${label} parentLineageId is not a permitted lineage id.`);
  }
  const localIdentity =
    observation.observationId ??
    `${observation.candidateId}:panel-camera-seed:p${String(evidence.registrationPanelStepNumber).padStart(3, "0")}:` +
      `${observation.registration.latticeHand}:d${observation.registration.latticeDeterminant}:q${String(observation.registration.turnDegrees).padStart(3, "0")}`;
  if (
    observation.lineageId !==
    realBuildPanelCameraLineageId({
      parentLineageId: observation.parentLineageId,
      localIdentity,
    })
  ) {
    fail(`${label} lineageId does not bind its parent and local observation identity.`);
  }
}

function coherentCandidate(
  candidate: RealBuildPanelCameraCandidateEvidence,
  indexed: CandidateRows,
  registrationPanelStepNumber: number,
  measurement: RealBuildPanelCameraMeasurementEvidence | null,
  label: string,
): void {
  if (!PANEL_CAMERA_DIGEST_PATTERN.test(candidate.documentHash)) {
    fail(`${label} documentHash is not a lowercase sha256 digest.`);
  }
  if (candidate.candidateId !== realBuildStableDocumentCandidateId(candidate.documentHash)) {
    fail(`${label} candidateId does not bind documentHash.`);
  }
  coherentPanelCameraFailure(candidate.status, candidate.failure, label);
  requireUnique(candidate.parentLineageIds, `${label}.parentLineageIds`);
  requireUnique(candidate.observationIds, `${label}.observationIds`);
  requireUnique(
    candidate.selectedLineageIds.map(({ parentLineageId }) => parentLineageId),
    `${label}.selectedLineageIds parents`,
  );
  requireUnique(
    candidate.selectedLineageIds.map(({ lineageId }) => lineageId),
    `${label}.selectedLineageIds`,
  );
  for (const parent of candidate.parentLineageIds) {
    if (!PARENT_LINEAGE_PATTERN.test(parent)) {
      fail(`${label} parentLineageId ${JSON.stringify(parent)} is not a permitted lineage id.`);
    }
  }
  candidate.attempts.forEach((attempt, index) => {
    coherentPanelCameraAttempt(attempt, `${label}.attempts[${index}]`);
  });
  coherentPanelCameraAttemptOrder(candidate, label);
  if (candidate.status !== "seeded" && candidate.attempts.length > 0 && measurement === null) {
    fail(`${label} attempted camera work requires a committed measurement.`);
  }
  if (
    candidate.failure?.code !== "rendering-error" &&
    candidate.attempts.some(
      ({ status, renderMaskDigest }) => status !== "unregistered" && renderMaskDigest === null,
    )
  ) {
    fail(`${label} has a missing render-mask digest without a rendering failure.`);
  }
  if (candidate.status === "seeded") {
    if (
      candidate.parentLineageIds.length !== 0 ||
      candidate.observationIds.length !== 0 ||
      candidate.selectedObservationId !== null ||
      candidate.selectedLineageIds.length !== 0 ||
      indexed.rows.length !== 8 ||
      candidate.attempts.some(({ status }) => status !== "unregistered")
    ) {
      fail(`${label} seeded candidate must retain exactly eight unregistered root lineages.`);
    }
    return;
  }
  if (candidate.parentLineageIds.length === 0) {
    fail(`${label} non-seeded candidate requires at least one parent lineage.`);
  }
  if (candidate.attempts.some(({ status }) => status === "unregistered")) {
    fail(`${label} non-seeded candidate cannot retain unregistered attempts.`);
  }
  if (!sameStrings(candidate.observationIds, indexed.observationOrder)) {
    fail(`${label}.observationIds do not exactly map flattened observations in encounter order.`);
  }
  const parentSet = new Set(candidate.parentLineageIds);
  for (const [observationId, byParent] of indexed.byObservation) {
    if (byParent.size !== parentSet.size) {
      fail(
        `${label} observation ${JSON.stringify(observationId)} does not fan out once per parent.`,
      );
    }
    for (const parent of parentSet) {
      if (!byParent.has(parent)) {
        fail(
          `${label} observation ${JSON.stringify(observationId)} omits parent ${JSON.stringify(parent)}.`,
        );
      }
    }
  }
  const attemptByKey = new Map(candidate.attempts.map((attempt) => [angularKey(attempt), attempt]));
  const scoredObservationIds = candidate.attempts.flatMap((attempt) =>
    attempt.status === "scored"
      ? [
          expectedPanelCameraObservationId(
            candidate.candidateId,
            registrationPanelStepNumber,
            attempt,
            measurement!,
          ),
        ]
      : [],
  );
  if (!sameStrings(candidate.observationIds, scoredObservationIds)) {
    fail(`${label}.observationIds do not exactly correspond to its scored attempts.`);
  }
  for (const [index, row] of indexed.rows.entries()) {
    const attempt = attemptByKey.get(angularKey(row.registration));
    const expectedObservationId =
      attempt?.status === "scored" && measurement !== null
        ? expectedPanelCameraObservationId(
            candidate.candidateId,
            registrationPanelStepNumber,
            attempt,
            measurement,
          )
        : null;
    if (
      attempt?.status !== "scored" ||
      row.observationId !== expectedObservationId ||
      attempt.silhouetteIou !== row.silhouetteIou ||
      attempt.shiftPx![0] !== row.registration.shiftPx![0] ||
      attempt.shiftPx![1] !== row.registration.shiftPx![1]
    ) {
      fail(`${label} flattened observation ${index} does not match its scored attempt.`);
    }
  }
  const derivedStatus = resolverDerivedPanelCameraStatus(candidate);
  if (candidate.status !== derivedStatus) {
    fail(
      `${label} status ${candidate.status} disagrees with resolver-derived status ${derivedStatus}.`,
    );
  }
  const winner =
    derivedStatus === "observed"
      ? expectedPanelCameraObservationId(
          candidate.candidateId,
          registrationPanelStepNumber,
          candidate.attempts[0]!,
          measurement!,
        )
      : null;
  if (candidate.selectedObservationId !== winner) {
    fail(`${label}.selectedObservationId does not equal the resolver-derived winning observation.`);
  }
  const selected = winner === null ? null : indexed.byObservation.get(winner);
  if (winner === null) {
    if (candidate.selectedLineageIds.length !== 0) {
      fail(`${label} has selected lineages without a resolver-derived winner.`);
    }
  } else if (
    selected === undefined ||
    candidate.selectedLineageIds.length !== candidate.parentLineageIds.length
  ) {
    fail(`${label} winning observation must map once to every parent lineage.`);
  } else {
    for (let index = 0; index < candidate.parentLineageIds.length; index += 1) {
      const parent = candidate.parentLineageIds[index]!;
      const expected = selected!.get(parent)!;
      const retained = candidate.selectedLineageIds[index];
      if (retained?.parentLineageId !== parent || retained.lineageId !== expected.lineageId) {
        fail(`${label} selected lineage ${index} does not reproduce its winning parent lineage.`);
      }
    }
  }
}

function coherentReservation(evidence: RealBuildPanelCameraEvidence): void {
  const { reservation } = evidence;
  if (
    reservation.reservedBefore > reservation.budget ||
    reservation.reservedAfter > reservation.budget
  ) {
    fail("reservation exceeds its budget.");
  }
  if (evidence.status === "budget-refused") {
    if (
      reservation.requested < 8 ||
      reservation.requested % 8 !== 0 ||
      reservation.failure === null ||
      reservation.reservedAfter !== reservation.reservedBefore ||
      reservation.failure.budget !== reservation.budget ||
      reservation.failure.reservedBefore !== reservation.reservedBefore ||
      reservation.failure.requested !== reservation.requested ||
      reservation.requested <= reservation.budget - reservation.reservedBefore
    ) {
      fail("budget-refused reservation is not an atomic over-budget refusal.");
    }
  } else if (
    reservation.failure !== null ||
    reservation.reservedAfter !== reservation.reservedBefore + reservation.requested ||
    reservation.requested > reservation.budget - reservation.reservedBefore
  ) {
    fail("admitted reservation is not an atomic successful reservation.");
  }
}

export function validateRealBuildPanelCameraEvidence(
  evidence: RealBuildPanelCameraEvidence,
  maximumEntries: number,
): void {
  if (evidence.candidates.length + evidence.observations.length > maximumEntries) {
    fail(
      `top-level candidates plus observations exceed explicit maximumEntries ${maximumEntries}.`,
    );
  }
  coherentPanelCameraFailure(evidence.status, evidence.failure, "aggregate");
  coherentReservation(evidence);
  if (
    evidence.failure !== null &&
    evidence.failure.stepNumber !== evidence.registrationPanelStepNumber
  ) {
    fail("aggregate failure is not bound to the registration panel step.");
  }
  if (evidence.registrationPanelStepNumber <= evidence.throughStepNumber) {
    fail("throughStepNumber must be retained and strictly precede the registration panel.");
  }
  if ((evidence.throughStepNumber === 0) !== (evidence.status === "seeded")) {
    fail("throughStepNumber 0 is reserved exactly for the eight-way seeded root.");
  }
  if (
    evidence.measurement !== null &&
    (!Number.isSafeInteger(evidence.measurement.widthPx * evidence.measurement.heightPx) ||
      evidence.measurement.widthPx * evidence.measurement.heightPx > 16_777_216)
  ) {
    fail("measurement raster exceeds the bounded 16,777,216-pixel camera surface.");
  }
  if (evidence.status === "budget-refused") {
    if (
      evidence.measurement !== null ||
      evidence.candidates.length !== 0 ||
      evidence.observations.length !== 0
    ) {
      fail("budget-refused evidence must admit no candidates or observations.");
    }
    return;
  }
  if (evidence.candidates.length === 0) fail("an admitted result requires at least one candidate.");
  const candidateById = new Map<string, RealBuildPanelCameraCandidateEvidence>();
  const rowsByCandidate = new Map<string, CandidateRows>();
  for (const [index, candidate] of evidence.candidates.entries()) {
    if (candidateById.has(candidate.candidateId)) {
      fail(`candidates duplicates ${JSON.stringify(candidate.candidateId)}.`);
    }
    candidateById.set(candidate.candidateId, candidate);
    rowsByCandidate.set(candidate.candidateId, {
      rows: [],
      byObservation: new Map(),
      observationOrder: [],
    });
    if (
      candidate.failure !== null &&
      candidate.failure.stepNumber !== evidence.registrationPanelStepNumber
    ) {
      fail(`candidates[${index}] failure is not bound to the registration panel step.`);
    }
  }
  const lineageIds = new Set<string>();
  for (const [index, observation] of evidence.observations.entries()) {
    const indexed = rowsByCandidate.get(observation.candidateId);
    if (indexed === undefined) {
      fail(
        `observations[${index}] names unknown candidate ${JSON.stringify(observation.candidateId)}.`,
      );
    }
    coherentObservation(observation, evidence, `observations[${index}]`);
    if (lineageIds.has(observation.lineageId)) {
      fail(`observations.lineageIds duplicates ${JSON.stringify(observation.lineageId)}.`);
    }
    lineageIds.add(observation.lineageId);
    indexed.rows.push(observation);
    if (observation.observationId !== null) {
      let parents = indexed.byObservation.get(observation.observationId);
      if (parents === undefined) {
        parents = new Map();
        indexed.byObservation.set(observation.observationId, parents);
        indexed.observationOrder.push(observation.observationId);
      }
      if (parents.has(observation.parentLineageId!)) {
        fail(`observations[${index}] duplicates its observation and parent lineage pair.`);
      }
      parents.set(observation.parentLineageId!, observation);
    }
  }
  evidence.candidates.forEach((candidate, index) =>
    coherentCandidate(
      candidate,
      rowsByCandidate.get(candidate.candidateId)!,
      evidence.registrationPanelStepNumber,
      evidence.measurement,
      `candidates[${index}]`,
    ),
  );
  if (evidence.status === "seeded") {
    if (
      evidence.measurement !== null ||
      evidence.candidates.length !== 1 ||
      evidence.observations.length !== 8
    ) {
      fail("seeded evidence must retain one step-0 candidate and exactly eight seed lineages.");
    }
  } else if (evidence.candidates.some(({ status }) => status === "seeded")) {
    fail("non-seeded aggregate cannot contain a seeded candidate.");
  }
  const aggregate = evidence.candidates.some(({ status }) => status === "failed")
    ? "failed"
    : evidence.candidates.some(({ status }) => status === "unresolved")
      ? "unresolved"
      : evidence.candidates.every(({ status }) => status === "observed")
        ? "observed"
        : evidence.candidates.every(({ status }) => status === "seeded")
          ? "seeded"
          : null;
  if (aggregate !== evidence.status) {
    fail(
      `aggregate status ${evidence.status} does not equal candidate-derived status ${aggregate}.`,
    );
  }
  const statusFailure =
    aggregate === "failed" || aggregate === "unresolved"
      ? (evidence.candidates.find(({ status }) => status === aggregate)?.failure ?? null)
      : null;
  if (JSON.stringify(evidence.failure) !== JSON.stringify(statusFailure)) {
    fail("aggregate failure does not equal the first candidate at aggregate status severity.");
  }
  let requested = evidence.status === "seeded" ? 8 : 0;
  if (evidence.status !== "seeded") {
    for (const candidate of evidence.candidates) {
      const addition = candidate.parentLineageIds.length * 8;
      if (!Number.isSafeInteger(addition) || requested > Number.MAX_SAFE_INTEGER - addition) {
        fail("retained parent hypotheses require an unsafe reservation count.");
      }
      requested += addition;
    }
  }
  if (evidence.reservation.requested !== requested) {
    fail(
      `reservation requested ${evidence.reservation.requested}, but retained parent hypotheses require ${requested}.`,
    );
  }
}
