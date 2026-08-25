import { canonicalDigest } from "@lego-studio/brick-kernel";

import type { RealBuildAtomicCompiledBranchCompiler } from "./real-build-atomic-compiled-branch-batch";
import { requireRealBuildCandidateDocumentSnapshotValue } from "./real-build-candidate-document-snapshot";
import {
  preflightRealBuildCompiledObservationResources,
  snapshotRealBuildCompiledObservationSource,
  type RealBuildCompiledObservationSourceInput,
} from "./real-build-compiled-observation-source";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { createRealBuildPanelCameraBranchBudgetLedger } from "./real-build-panel-camera-branch-budget";
import { PANEL_CAMERA_ANGULAR_HYPOTHESES } from "./real-build-panel-camera-resolver-boundary";
import {
  createRealBuildPreparedSearchLedger,
  snapshotRealBuildPreparedSearchLedger,
} from "./real-build-prepared-search-ledger";
import {
  deferRealBuildPreparedObservationPolicyForGlobalAggregation,
  requireRealBuildPreparedObservationPolicyInspection,
  requireRealBuildPreparedStepInspection,
} from "./real-build-prepared-step-authority";
import type { StepCameraLatticeHypothesis } from "./real-build-step-camera";
import {
  aggregateRealBuildStepOneProperC4RepresentativeScores,
  REAL_BUILD_STEP_ONE_PROPER_C4_CLOSURE_COUNT,
  type RealBuildStepOneProperC4RepresentativeCameraScoreRow,
} from "./real-build-step-one-proper-c4-global-aggregation";
import {
  requireRealBuildStepOneProperC4QuotientInspection,
  type RealBuildStepOneProperC4QuotientInspection,
} from "./real-build-step-one-proper-c4-quotient";
import { runRealBuildStepOneProperC4RenderClosure } from "./real-build-step-one-proper-c4-render-closure";
import {
  createRealBuildStepOneProperC4DataArray,
  createRealBuildStepOneProperC4DataObject,
  snapshotRealBuildStepOneProperC4DataObject as snapshotExactDataObject,
} from "./real-build-step-one-proper-c4-data-snapshot";
import { verifyRealBuildStepOneProperC4PopulationEquivariance } from "./real-build-step-one-proper-c4-population-equivariance";
import {
  realBuildStepOneProperC4SourceBindingDigest,
  requireRealBuildStepOneProperC4RendererEquivariance,
} from "./real-build-step-one-proper-c4-render-equivariance";
import type {
  RealBuildStepOneProperC4ClosureInspection,
  RealBuildStepOneProperC4RenderReductionInspection,
} from "./real-build-step-one-proper-c4-render-reduction-types";
import {
  inspectRealBuildStepOneMaskRendererFactoryConfiguration,
  type RealBuildStepOneMaskRendererFactory,
} from "./real-build-step-one-silhouette-renderer";

export type {
  RealBuildStepOneProperC4ClosureInspection,
  RealBuildStepOneProperC4RenderReductionInspection,
} from "./real-build-step-one-proper-c4-render-reduction-types";

const FIXED_BUDGET = 8_192;
const REQUIRED_INPUT_KEYS = [
  "equivariance",
  "policy",
  "prepareModelMaskRenderer",
  "preparedStep",
  "quotient",
  "rootDocumentSnapshot",
  "source",
] as const;
const INPUT_KEYS_WITH_COMPILER = ["compiler", ...REQUIRED_INPUT_KEYS] as const;
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
      "Proper-C4 render reduction requires the current exact 400-row, 100-orbit quotient.",
    );
  }
  return quotient;
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

function aggregationRow(
  row: RealBuildStepOneProperC4RepresentativeCameraScoreRow,
): RealBuildStepOneProperC4RepresentativeCameraScoreRow {
  const hypothesis = intrinsicRealBuildFreeze(
    createRealBuildStepOneProperC4DataObject(
      "latticeHand",
      row.hypothesis.latticeHand,
      "latticeDeterminant",
      row.hypothesis.latticeDeterminant,
      "turnDegrees",
      row.hypothesis.turnDegrees,
    ),
  ) as unknown as StepCameraLatticeHypothesis;
  const shiftPx = intrinsicRealBuildFreeze(
    createRealBuildStepOneProperC4DataArray(row.shiftPx[0], row.shiftPx[1]),
  ) as unknown as readonly [number, number];
  return intrinsicRealBuildFreeze(
    createRealBuildStepOneProperC4DataObject(
      "closureIndex",
      row.closureIndex,
      "orbitIndex",
      row.orbitIndex,
      "hypothesis",
      hypothesis,
      "candidateId",
      row.candidateId,
      "documentHash",
      row.documentHash,
      "cameraId",
      row.cameraId,
      "maskDigest",
      row.maskDigest,
      "shiftPx",
      shiftPx,
      "score",
      row.score,
      "rootLineageId",
      row.rootLineageId,
      "lineageId",
      row.lineageId,
    ),
  ) as unknown as RealBuildStepOneProperC4RepresentativeCameraScoreRow;
}

export function runRealBuildStepOneProperC4RenderReduction(
  input: unknown,
): RealBuildStepOneProperC4RenderReductionInspection {
  let exact: Readonly<Record<string, unknown>>;
  try {
    exact = snapshotExactDataObject(
      input,
      "Proper-C4 render reduction input",
      INPUT_KEYS_WITH_COMPILER,
    );
  } catch {
    exact = snapshotExactDataObject(input, "Proper-C4 render reduction input", REQUIRED_INPUT_KEYS);
  }
  const quotient = exactCurrentQuotient(exact.quotient);
  const preparedStep = requireRealBuildPreparedStepInspection(exact.preparedStep);
  const policy = requireRealBuildPreparedObservationPolicyInspection(exact.policy);
  const rootDocumentSnapshot = requireRealBuildCandidateDocumentSnapshotValue(
    exact.rootDocumentSnapshot,
  );
  const source = snapshotRealBuildCompiledObservationSource(
    exact.source as RealBuildCompiledObservationSourceInput,
  );
  const prepareModelMaskRenderer =
    exact.prepareModelMaskRenderer as RealBuildStepOneMaskRendererFactory;
  const compiler = exact.compiler as RealBuildAtomicCompiledBranchCompiler | undefined;
  if (compiler !== undefined && typeof compiler !== "function") {
    throw new TypeError("Proper-C4 render reduction compiler must be a function or undefined.");
  }
  if (
    preparedStep.stepNumber !== 1 ||
    preparedStep.preparedRunInputDigest !== quotient.preparedRunInputDigest ||
    preparedStep.printedStepIdentity !== quotient.printedStepIdentity ||
    policy.preparedRunInputDigest !== quotient.preparedRunInputDigest ||
    rootDocumentSnapshot.documentHash !== quotient.rootDocumentHash ||
    rootDocumentSnapshot.canonicalBytesHash !== quotient.rootCanonicalBytesHash ||
    source.observationMode !== "lookahead" ||
    source.registrationPanelStepNumber !== 2
  ) {
    throw new TypeError("Proper-C4 render reduction inputs do not bind the exact step-1 quotient.");
  }
  preflightRealBuildCompiledObservationResources({
    source,
    rootCount: 8,
    cameraCount: 40,
    observationCount: 40,
  });
  const rendererConfiguration = inspectRealBuildStepOneMaskRendererFactoryConfiguration(
    prepareModelMaskRenderer,
    source,
  );
  const rendererEquivariance = requireRealBuildStepOneProperC4RendererEquivariance(
    exact.equivariance,
    prepareModelMaskRenderer,
    source,
  );
  const boundSourceDigest = realBuildStepOneProperC4SourceBindingDigest(source);
  const deferredPolicy = deferRealBuildPreparedObservationPolicyForGlobalAggregation(policy);
  const searchLedger = createRealBuildPreparedSearchLedger(FIXED_BUDGET);
  const cameraLedger = createRealBuildPanelCameraBranchBudgetLedger(FIXED_BUDGET);
  const closures: RealBuildStepOneProperC4ClosureInspection[] = [];
  for (
    let closureIndex = 0;
    closureIndex < REAL_BUILD_STEP_ONE_PROPER_C4_CLOSURE_COUNT;
    closureIndex += 1
  ) {
    closures.push(
      runRealBuildStepOneProperC4RenderClosure({
        closureIndex,
        quotient,
        preparedStep,
        deferredPolicy,
        rootDocumentSnapshot,
        source,
        sourceBindingDigest: boundSourceDigest,
        rendererConfigurationDigest: rendererConfiguration.configurationDigest,
        prepareModelMaskRenderer,
        compiler,
        searchLedger,
        cameraLedger,
      }),
    );
  }
  const searchSnapshot = snapshotRealBuildPreparedSearchLedger(searchLedger);
  if (
    searchSnapshot.budget !== FIXED_BUDGET ||
    searchSnapshot.reserved !== 800 ||
    searchSnapshot.refused ||
    searchSnapshot.reservationCount !== 20 ||
    searchSnapshot.failedReservation !== null ||
    cameraLedger.budget !== FIXED_BUDGET ||
    cameraLedger.reserved !== 6_400 ||
    cameraLedger.refusedReservation ||
    cameraLedger.failedReservation !== null
  ) {
    throw new TypeError("Proper-C4 shared fixed-8192 ledgers did not close at 800/6,400.");
  }
  const rows = intrinsicRealBuildFreeze(
    createRealBuildStepOneProperC4DataArray(
      ...PANEL_CAMERA_ANGULAR_HYPOTHESES.flatMap((hypothesis) =>
        closures.flatMap((closure) =>
          closure.representativeRows
            .filter((row) => sameHypothesis(row.hypothesis, hypothesis))
            .map(aggregationRow),
        ),
      ),
    ),
  ) as unknown as readonly RealBuildStepOneProperC4RepresentativeCameraScoreRow[];
  if (rows.length !== 800)
    throw new TypeError("Proper-C4 reduction did not retain 800 score rows.");
  const rendererPopulationEquivariance = verifyRealBuildStepOneProperC4PopulationEquivariance({
    quotient,
    preparedStep,
    rootDocumentSnapshot,
    source,
    prepareModelMaskRenderer,
    representativeRows: rows,
  });
  const globalAggregation = aggregateRealBuildStepOneProperC4RepresentativeScores(
    createRealBuildStepOneProperC4DataObject(
      "policy",
      policy,
      "quotient",
      quotient,
      "representativeRows",
      rows,
    ),
  );
  if (
    rendererPopulationEquivariance.representativeRowsDigest !==
      globalAggregation.representativeRowsDigest ||
    globalAggregation.selection.status !== "unresolved" ||
    globalAggregation.selection.selectedRawEncounterIndex !== null ||
    globalAggregation.selection.selectedRepresentativeEncounterIndex !== null ||
    globalAggregation.selection.margin !== 0 ||
    globalAggregation.acceptedTransition !== null ||
    globalAggregation.acceptedDocument !== null
  ) {
    throw new TypeError(
      "Proper-C4 inverse expansion did not preserve the exact global symmetry tie.",
    );
  }
  const frozenClosures = intrinsicRealBuildFreeze(closures);
  const closureDigestsDigest = canonicalDigest({
    schemaVersion: "lego.real-build-step-one-proper-c4-render-closure-digests/1",
    digests: closures.map(({ closureDigest }) => closureDigest),
  });
  const cameraSnapshot = intrinsicRealBuildFreeze({
    budget: 8_192 as const,
    reserved: 6_400 as const,
    refusedReservation: false as const,
    failedReservation: null,
  });
  const accounting = intrinsicRealBuildFreeze({
    closureCount: 20 as const,
    representatives: 100 as const,
    rawCandidates: 400 as const,
    compiledLineageEdges: 800 as const,
    uniquePhysicalTransitions: 100 as const,
    physicalRenderBaseline: 3_200 as const,
    physicalRenderCalls: 800 as const,
    representativeCameraScores: 800 as const,
    inverseExpandedRawCameraScores: 3_200 as const,
    rawLogicalCameraBranches: 25_600 as const,
    quotientLogicalCameraBranches: 6_400 as const,
    reductionNumerator: 3 as const,
    reductionDenominator: 4 as const,
  });
  const body = {
    schemaVersion: "lego.real-build-step-one-proper-c4-render-reduction/1" as const,
    quotientDigest: quotient.quotientDigest,
    rendererConfigurationDigest: rendererConfiguration.configurationDigest,
    rendererEquivariance,
    rendererPopulationEquivariance,
    sourceBindingDigest: boundSourceDigest,
    closures: frozenClosures,
    closureDigestsDigest,
    searchLedger: searchSnapshot,
    cameraLedger: cameraSnapshot,
    globalAggregation,
    accounting,
    acceptedTransition: null,
    acceptedDocument: null,
    physicalFrameAuthority: "absent" as const,
    placementAuthority: "absent" as const,
    completionAuthority: intrinsicRealBuildFreeze({ status: "absent" as const, authorized: false }),
    authority: "absent" as const,
  };
  const result = intrinsicRealBuildFreeze({
    ...body,
    integrationDigest: canonicalDigest(body),
  }) as RealBuildStepOneProperC4RenderReductionInspection;
  SAFE_REFLECT_APPLY(SAFE_WEAK_SET_ADD, inspections, [result]);
  return result;
}

export function requireRealBuildStepOneProperC4RenderReductionInspection(
  value: unknown,
): RealBuildStepOneProperC4RenderReductionInspection {
  if (
    value === null ||
    typeof value !== "object" ||
    !(SAFE_REFLECT_APPLY(SAFE_WEAK_SET_HAS, inspections, [value]) as boolean)
  ) {
    throw new TypeError(
      "Proper-C4 render reduction requires the exact frozen inspection from this module.",
    );
  }
  return value as RealBuildStepOneProperC4RenderReductionInspection;
}
