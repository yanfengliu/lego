import { canonicalDigest, type Sha256Digest } from "@lego-studio/brick-kernel";

import type {
  RealBuildDocumentCandidateId,
  RealBuildLineageId,
} from "./real-build-candidate-lineage-identity";
import type { RealBuildCompiledObservationCameraId } from "./real-build-compiled-observation-closure";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  PANEL_CAMERA_ANGULAR_HYPOTHESES,
  PANEL_CAMERA_DIGEST_PATTERN,
} from "./real-build-panel-camera-resolver-boundary";
import { requireRealBuildPreparedObservationPolicyInspection } from "./real-build-prepared-step-authority";
import type { StepCameraLatticeHypothesis, StepCameraTurnDegrees } from "./real-build-step-camera";
import { mapRealBuildStepOneProperC4MemberCameraToRepresentative } from "./real-build-step-one-proper-c4-camera-equivariance";
import {
  snapshotRealBuildStepOneProperC4DataArray as snapshotDenseDataArray,
  snapshotRealBuildStepOneProperC4DataObject as snapshotExactDataObject,
} from "./real-build-step-one-proper-c4-data-snapshot";
import {
  requireRealBuildStepOneProperC4QuotientInspection,
  type RealBuildStepOneProperC4InverseMapEntry,
  type RealBuildStepOneProperC4QuotientInspection,
} from "./real-build-step-one-proper-c4-quotient";

export const REAL_BUILD_STEP_ONE_PROPER_C4_CLOSURE_COUNT = 20;
export const REAL_BUILD_STEP_ONE_PROPER_C4_ORBITS_PER_CLOSURE = 5;
export const REAL_BUILD_STEP_ONE_PROPER_C4_CAMERAS_PER_ORBIT = 8;
export const REAL_BUILD_STEP_ONE_PROPER_C4_REPRESENTATIVE_SCORE_COUNT = 800;
export const REAL_BUILD_STEP_ONE_PROPER_C4_RAW_SCORE_COUNT = 3_200;

const INPUT_KEYS = ["policy", "quotient", "representativeRows"] as const;
const ROW_KEYS = [
  "closureIndex",
  "orbitIndex",
  "hypothesis",
  "candidateId",
  "documentHash",
  "cameraId",
  "maskDigest",
  "shiftPx",
  "score",
  "rootLineageId",
  "lineageId",
] as const;
const HYPOTHESIS_KEYS = ["latticeHand", "latticeDeterminant", "turnDegrees"] as const;
const CAMERA_ID_PATTERN = /^compiled-observation-camera:sha256:[0-9a-f]{64}$/u;
const LINEAGE_ID_PATTERN = /^lineage:sha256:[0-9a-f]{64}$/u;

export interface RealBuildStepOneProperC4RepresentativeCameraScoreRow {
  readonly closureIndex: number;
  readonly orbitIndex: number;
  readonly hypothesis: StepCameraLatticeHypothesis;
  readonly candidateId: RealBuildDocumentCandidateId;
  readonly documentHash: Sha256Digest;
  readonly cameraId: RealBuildCompiledObservationCameraId;
  readonly maskDigest: Sha256Digest;
  readonly shiftPx: readonly [number, number];
  readonly score: number;
  readonly rootLineageId: RealBuildLineageId;
  readonly lineageId: RealBuildLineageId;
}

export interface RealBuildStepOneProperC4RawMemberCameraScoreRow {
  readonly rawEncounterIndex: number;
  readonly rawIndex: number;
  readonly orbitIndex: number;
  readonly memberIndex: number;
  readonly memberTurnDegrees: StepCameraTurnDegrees;
  readonly hypothesis: StepCameraLatticeHypothesis;
  readonly representativeHypothesis: StepCameraLatticeHypothesis;
  readonly representativeEncounterIndex: number;
  readonly closureIndex: number;
  readonly representativeCandidateId: RealBuildDocumentCandidateId;
  readonly representativeDocumentHash: Sha256Digest;
  readonly representativeCameraId: RealBuildCompiledObservationCameraId;
  readonly representativeMaskDigest: Sha256Digest;
  readonly representativeShiftPx: readonly [number, number];
  readonly score: number;
  readonly representativeRootLineageId: RealBuildLineageId;
  readonly representativeLineageId: RealBuildLineageId;
}

export type RealBuildStepOneProperC4GlobalAggregationInspection = Readonly<{
  schemaVersion: "lego.real-build-step-one-proper-c4-global-aggregation/1";
  quotientDigest: Sha256Digest;
  policyDigest: Sha256Digest;
  preparedRunInputDigest: Sha256Digest;
  representativeRows: readonly RealBuildStepOneProperC4RepresentativeCameraScoreRow[];
  representativeRowsDigest: Sha256Digest;
  quotientInverseMap: readonly RealBuildStepOneProperC4InverseMapEntry[];
  inverseMapDigest: Sha256Digest;
  inverseExpandedRows: readonly RealBuildStepOneProperC4RawMemberCameraScoreRow[];
  inverseExpandedRowsDigest: Sha256Digest;
  rankedRawEncounterIndices: readonly number[];
  rankingDigest: Sha256Digest;
  accounting: Readonly<{
    closureCount: 20;
    representativesPerClosure: 5;
    representativeCameraRows: 800;
    rawMemberCameraRows: 3_200;
    quotientLogicalCameraAssociations: 6_400;
    rawLogicalCameraAssociations: 25_600;
  }>;
  selection: Readonly<{
    status: "selected" | "unresolved";
    selectedRawEncounterIndex: number | null;
    selectedRepresentativeEncounterIndex: number | null;
    bestScore: number;
    runnerUpScore: number;
    margin: number;
  }>;
  aggregationDigest: Sha256Digest;
  acceptedDocument: null;
  acceptedTransition: null;
  physicalFrameAuthority: "absent";
  placementAuthority: "absent";
  completionAuthority: Readonly<{ status: "absent"; authorized: false }>;
  authority: "absent";
}>;

const inspections = new WeakSet<object>();
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_WEAK_SET_ADD = WeakSet.prototype.add;
const SAFE_WEAK_SET_HAS = WeakSet.prototype.has;

function exactCurrentQuotient(value: unknown): RealBuildStepOneProperC4QuotientInspection {
  const quotient = requireRealBuildStepOneProperC4QuotientInspection(value);
  if (
    quotient.rawCandidateCount !== 400 ||
    quotient.orbitCount !== 100 ||
    quotient.orbits.length !== 100 ||
    quotient.inverseMap.length !== 400 ||
    quotient.branchAccounting.rawRootEdges !== 3_200 ||
    quotient.branchAccounting.quotientRootEdges !== 800 ||
    quotient.branchAccounting.rawLogicalCameraBranches !== 25_600 ||
    quotient.branchAccounting.quotientLogicalCameraBranches !== 6_400
  ) {
    throw new TypeError(
      "Proper-C4 global aggregation requires the current exact 400-row, 100-orbit quotient with 25,600-to-6,400 logical branch accounting.",
    );
  }
  return quotient;
}

function exactHypothesis(value: unknown, label: string): StepCameraLatticeHypothesis {
  const row = snapshotExactDataObject(value, label, HYPOTHESIS_KEYS);
  if (
    (row.latticeHand !== "as-fitted" && row.latticeHand !== "x-reflected") ||
    (row.latticeDeterminant !== 1 && row.latticeDeterminant !== -1) ||
    (row.latticeHand === "as-fitted") !== (row.latticeDeterminant === 1) ||
    ![0, 90, 180, 270].includes(row.turnDegrees as number)
  ) {
    throw new TypeError(`${label} must be one exact ordered D4 lattice hypothesis.`);
  }
  return intrinsicRealBuildFreeze({
    latticeHand: row.latticeHand,
    latticeDeterminant: row.latticeDeterminant,
    turnDegrees: row.turnDegrees,
  }) as StepCameraLatticeHypothesis;
}

function sameHypothesis(
  left: StepCameraLatticeHypothesis,
  right: StepCameraLatticeHypothesis,
): boolean {
  return (
    left.latticeHand === right.latticeHand &&
    left.latticeDeterminant === right.latticeDeterminant &&
    left.turnDegrees === right.turnDegrees
  );
}

function exactId(value: unknown, pattern: RegExp, label: string): string {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new TypeError(`${label} is not one canonical generated identifier.`);
  }
  return value;
}

function snapshotRepresentativeRows(
  value: unknown,
): readonly RealBuildStepOneProperC4RepresentativeCameraScoreRow[] {
  const rows = snapshotDenseDataArray(
    value,
    "Proper-C4 representative camera score rows",
    REAL_BUILD_STEP_ONE_PROPER_C4_REPRESENTATIVE_SCORE_COUNT,
  );
  if (rows.length !== REAL_BUILD_STEP_ONE_PROPER_C4_REPRESENTATIVE_SCORE_COUNT) {
    throw new RangeError(
      `Proper-C4 global aggregation requires exactly ${REAL_BUILD_STEP_ONE_PROPER_C4_REPRESENTATIVE_SCORE_COUNT} representative camera score rows; received ${rows.length}.`,
    );
  }
  const retained: RealBuildStepOneProperC4RepresentativeCameraScoreRow[] = [];
  const rootByHypothesis = new Map<number, string>();
  const candidateByOrbit = new Map<number, readonly [string, string]>();
  const orbitByCandidate = new Map<string, number>();
  const cameraIds = new Set<string>();
  const lineageIds = new Set<string>();
  for (let encounterIndex = 0; encounterIndex < rows.length; encounterIndex += 1) {
    const source = snapshotExactDataObject(
      rows[encounterIndex],
      `Proper-C4 representative row ${encounterIndex}`,
      ROW_KEYS,
    );
    const hypothesisIndex = Math.floor(encounterIndex / 100);
    const orbitIndex = encounterIndex % 100;
    const closureIndex = Math.floor(orbitIndex / 5);
    const hypothesis = exactHypothesis(
      source.hypothesis,
      `Proper-C4 representative row ${encounterIndex}.hypothesis`,
    );
    if (
      source.orbitIndex !== orbitIndex ||
      source.closureIndex !== closureIndex ||
      !sameHypothesis(hypothesis, PANEL_CAMERA_ANGULAR_HYPOTHESES[hypothesisIndex]!)
    ) {
      throw new TypeError(
        `Proper-C4 representative row ${encounterIndex} is not in canonical closure/orbit/D4 encounter order.`,
      );
    }
    const documentHash = exactId(
      source.documentHash,
      PANEL_CAMERA_DIGEST_PATTERN,
      `Proper-C4 representative row ${encounterIndex}.documentHash`,
    ) as Sha256Digest;
    const candidateId = exactId(
      source.candidateId,
      /^document:sha256:[0-9a-f]{64}$/u,
      `Proper-C4 representative row ${encounterIndex}.candidateId`,
    ) as RealBuildDocumentCandidateId;
    if (candidateId !== `document:${documentHash}`) {
      throw new TypeError(
        `Proper-C4 representative row ${encounterIndex} candidateId does not bind documentHash.`,
      );
    }
    const retainedCandidate = candidateByOrbit.get(orbitIndex);
    if (
      retainedCandidate !== undefined &&
      (candidateId !== retainedCandidate[0] || documentHash !== retainedCandidate[1])
    ) {
      throw new TypeError(
        `Proper-C4 orbit ${orbitIndex} camera rows do not bind one representative candidate document.`,
      );
    }
    candidateByOrbit.set(orbitIndex, [candidateId, documentHash]);
    const priorOrbit = orbitByCandidate.get(candidateId);
    if (priorOrbit !== undefined && priorOrbit !== orbitIndex) {
      throw new TypeError("Proper-C4 representative candidates repeat across distinct orbits.");
    }
    orbitByCandidate.set(candidateId, orbitIndex);
    const rootLineageId = exactId(
      source.rootLineageId,
      LINEAGE_ID_PATTERN,
      `Proper-C4 representative row ${encounterIndex}.rootLineageId`,
    ) as RealBuildLineageId;
    const expectedRoot = rootByHypothesis.get(hypothesisIndex);
    if (expectedRoot !== undefined && expectedRoot !== rootLineageId) {
      throw new TypeError(
        `Proper-C4 D4 hypothesis ${hypothesisIndex} changed root lineage across closures.`,
      );
    }
    rootByHypothesis.set(hypothesisIndex, rootLineageId);
    const lineageId = exactId(
      source.lineageId,
      LINEAGE_ID_PATTERN,
      `Proper-C4 representative row ${encounterIndex}.lineageId`,
    ) as RealBuildLineageId;
    if (lineageIds.has(lineageId)) {
      throw new TypeError("Proper-C4 representative rows repeat one compiled lineage ID.");
    }
    lineageIds.add(lineageId);
    const shift = snapshotDenseDataArray(
      source.shiftPx,
      `Proper-C4 representative row ${encounterIndex}.shiftPx`,
      2,
    );
    if (
      shift.length !== 2 ||
      !shift.every(
        (coordinate) => Number.isSafeInteger(coordinate) && !Object.is(coordinate, -0),
      ) ||
      !Number.isFinite(source.score) ||
      Object.is(source.score, -0) ||
      (source.score as number) < 0 ||
      (source.score as number) > 1
    ) {
      throw new RangeError(
        `Proper-C4 representative row ${encounterIndex} requires two safe-integer shifts and a finite unit-interval score.`,
      );
    }
    const cameraId = exactId(
      source.cameraId,
      CAMERA_ID_PATTERN,
      `Proper-C4 representative row ${encounterIndex}.cameraId`,
    ) as RealBuildCompiledObservationCameraId;
    if (cameraIds.has(cameraId)) {
      throw new TypeError("Proper-C4 representative rows repeat one compiled camera ID.");
    }
    cameraIds.add(cameraId);
    retained.push(
      intrinsicRealBuildFreeze({
        closureIndex,
        orbitIndex,
        hypothesis,
        candidateId,
        documentHash,
        cameraId,
        maskDigest: exactId(
          source.maskDigest,
          PANEL_CAMERA_DIGEST_PATTERN,
          `Proper-C4 representative row ${encounterIndex}.maskDigest`,
        ) as Sha256Digest,
        shiftPx: intrinsicRealBuildFreeze([...shift]) as unknown as readonly [number, number],
        score: source.score as number,
        rootLineageId,
        lineageId,
      }),
    );
  }
  return intrinsicRealBuildFreeze(retained);
}

function expandRawRows(
  rows: readonly RealBuildStepOneProperC4RepresentativeCameraScoreRow[],
  inverseMap: readonly RealBuildStepOneProperC4InverseMapEntry[],
): readonly RealBuildStepOneProperC4RawMemberCameraScoreRow[] {
  const expanded: RealBuildStepOneProperC4RawMemberCameraScoreRow[] = [];
  for (const hypothesis of PANEL_CAMERA_ANGULAR_HYPOTHESES) {
    for (let rawIndex = 0; rawIndex < inverseMap.length; rawIndex += 1) {
      const inverse = inverseMap[rawIndex]!;
      if (inverse.rawIndex !== rawIndex) {
        throw new TypeError(
          "Proper-C4 quotient inverse map is not in canonical raw encounter order.",
        );
      }
      const representativeHypothesis = mapRealBuildStepOneProperC4MemberCameraToRepresentative(
        hypothesis,
        inverse.turnDegrees,
      );
      const representativeTurn = representativeHypothesis.turnDegrees;
      const representativeHypothesisIndex =
        (representativeHypothesis.latticeDeterminant === 1 ? 0 : 4) + representativeTurn / 90;
      const representativeEncounterIndex = representativeHypothesisIndex * 100 + inverse.orbitIndex;
      const representative = rows[representativeEncounterIndex]!;
      const rawEncounterIndex = expanded.length;
      expanded.push(
        intrinsicRealBuildFreeze({
          rawEncounterIndex,
          rawIndex,
          orbitIndex: inverse.orbitIndex,
          memberIndex: inverse.memberIndex,
          memberTurnDegrees: inverse.turnDegrees,
          hypothesis,
          representativeHypothesis,
          representativeEncounterIndex,
          closureIndex: representative.closureIndex,
          representativeCandidateId: representative.candidateId,
          representativeDocumentHash: representative.documentHash,
          representativeCameraId: representative.cameraId,
          representativeMaskDigest: representative.maskDigest,
          representativeShiftPx: representative.shiftPx,
          score: representative.score,
          representativeRootLineageId: representative.rootLineageId,
          representativeLineageId: representative.lineageId,
        }),
      );
    }
  }
  return intrinsicRealBuildFreeze(expanded);
}

export function aggregateRealBuildStepOneProperC4RepresentativeScores(
  input: unknown,
): RealBuildStepOneProperC4GlobalAggregationInspection {
  const exactInput = snapshotExactDataObject(
    input,
    "Proper-C4 global aggregation input",
    INPUT_KEYS,
  );
  const quotient = exactCurrentQuotient(exactInput.quotient);
  const policy = requireRealBuildPreparedObservationPolicyInspection(exactInput.policy);
  if (policy.preparedRunInputDigest !== quotient.preparedRunInputDigest) {
    throw new TypeError("Proper-C4 global policy does not bind the quotient prepared run.");
  }
  const representativeRows = snapshotRepresentativeRows(exactInput.representativeRows);
  const policyDigest = canonicalDigest({
    schemaVersion: "lego.real-build-prepared-observation-policy-binding/1",
    preparedRunInputDigest: policy.preparedRunInputDigest,
    minimumScore: policy.minimumScore,
    minimumMargin: policy.minimumMargin,
  });
  const representativeRowsDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-representative-scores/1",
    rows: representativeRows,
  });
  const inverseMapDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-inverse-map/1",
    inverseMap: quotient.inverseMap,
  });
  const inverseExpandedRows = expandRawRows(representativeRows, quotient.inverseMap);
  if (inverseExpandedRows.length !== REAL_BUILD_STEP_ONE_PROPER_C4_RAW_SCORE_COUNT) {
    throw new TypeError("Proper-C4 inverse expansion did not produce exactly 3,200 raw scores.");
  }
  const inverseExpandedRowsDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-raw-member-scores/1",
    rows: inverseExpandedRows,
  });
  const rankedRawEncounterIndices = intrinsicRealBuildFreeze(
    inverseExpandedRows
      .map(({ rawEncounterIndex }) => rawEncounterIndex)
      .sort(
        (left, right) =>
          inverseExpandedRows[right]!.score - inverseExpandedRows[left]!.score || left - right,
      ),
  );
  const best = inverseExpandedRows[rankedRawEncounterIndices[0]!]!;
  const runnerUp = inverseExpandedRows[rankedRawEncounterIndices[1]!]!;
  const margin = best.score - runnerUp.score;
  const selected = best.score >= policy.minimumScore && margin > policy.minimumMargin;
  const selection = intrinsicRealBuildFreeze({
    status: selected ? ("selected" as const) : ("unresolved" as const),
    selectedRawEncounterIndex: selected ? best.rawEncounterIndex : null,
    selectedRepresentativeEncounterIndex: selected ? best.representativeEncounterIndex : null,
    bestScore: best.score,
    runnerUpScore: runnerUp.score,
    margin,
  });
  const rankingDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-global-ranking/1",
    rankedRawEncounterIndices,
    selection,
  });
  const accounting = intrinsicRealBuildFreeze({
    closureCount: 20 as const,
    representativesPerClosure: 5 as const,
    representativeCameraRows: 800 as const,
    rawMemberCameraRows: 3_200 as const,
    quotientLogicalCameraAssociations: 6_400 as const,
    rawLogicalCameraAssociations: 25_600 as const,
  });
  const aggregationDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-global-aggregation/1",
    quotientDigest: quotient.quotientDigest,
    policyDigest,
    representativeRowsDigest,
    inverseMapDigest,
    inverseExpandedRowsDigest,
    rankingDigest,
    accounting,
  });
  const result = intrinsicRealBuildFreeze({
    schemaVersion: "lego.real-build-step-one-proper-c4-global-aggregation/1" as const,
    quotientDigest: quotient.quotientDigest,
    policyDigest,
    preparedRunInputDigest: policy.preparedRunInputDigest,
    representativeRows,
    representativeRowsDigest,
    quotientInverseMap: quotient.inverseMap,
    inverseMapDigest,
    inverseExpandedRows,
    inverseExpandedRowsDigest,
    rankedRawEncounterIndices,
    rankingDigest,
    accounting,
    selection,
    aggregationDigest,
    acceptedDocument: null,
    acceptedTransition: null,
    physicalFrameAuthority: "absent" as const,
    placementAuthority: "absent" as const,
    completionAuthority: intrinsicRealBuildFreeze({ status: "absent" as const, authorized: false }),
    authority: "absent" as const,
  }) as unknown as RealBuildStepOneProperC4GlobalAggregationInspection;
  SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, inspections, [result]);
  return result;
}

export function requireRealBuildStepOneProperC4GlobalAggregationInspection(
  value: unknown,
): RealBuildStepOneProperC4GlobalAggregationInspection {
  if (
    value === null ||
    typeof value !== "object" ||
    !(SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, inspections, [value]) as boolean)
  ) {
    throw new TypeError(
      "Proper-C4 global aggregation requires the exact frozen inspection from this module.",
    );
  }
  return value as RealBuildStepOneProperC4GlobalAggregationInspection;
}
