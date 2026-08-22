import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { createRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import {
  deriveRealBuildCompiledObservationCameraId,
  deriveRealBuildCompiledObservationId,
  deriveRealBuildCompiledObservationSourceId,
} from "./real-build-compiled-observation-closure-digest";
import type {
  RealBuildCompiledObservationClosure,
  RealBuildCompiledObservationMaskReference,
} from "./real-build-compiled-observation-closure-types";
import { MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS } from "./real-build-compiled-observation-closure-types";
import { parseRealBuildCompiledObservationClosure } from "./real-build-compiled-observation-closure-parser";
import { requireRealBuildCompiledObservationClosurePreReplayRows } from "./real-build-compiled-observation-closure-pre-replay";
import { realBuildCompiledObservationRegistrationVisits } from "./real-build-compiled-observation-registration";
import {
  inspectRealBuildCompiledPlacementLineageReplayWork,
  inspectRealBuildCompiledPlacementLineageWork,
  requireReplayAdmittedRealBuildCompiledPlacementLineageWorkInspection,
  validateRealBuildCompiledPlacementLineageReplayWorkInspection,
} from "./real-build-compiled-placement-lineage-parser";
import type {
  RealBuildCompiledLineageEdge,
  RealBuildCompiledPlacementLineageEvidence,
} from "./real-build-compiled-placement-lineage-types";
import { MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES } from "./real-build-compiled-placement-lineage-types";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";
import {
  requireRealBuildPreparedObservationPolicyInspection,
  type RealBuildPreparedObservationPolicyInspection,
} from "./real-build-prepared-step-authority";

type Source = RealBuildCompiledObservationClosure["sources"][number];
type Camera = RealBuildCompiledObservationClosure["cameras"][number];

export interface RealBuildCompiledObservationPreflight {
  readonly lineage: RealBuildCompiledPlacementLineageEvidence;
  readonly closure: RealBuildCompiledObservationClosure;
  readonly policy: RealBuildPreparedObservationPolicyInspection;
  readonly edgeFor: (lineageId: string) => RealBuildCompiledLineageEdge | undefined;
  readonly sourceFor: (sourceId: string) => Source | undefined;
  readonly cameraFor: (cameraId: string) => Camera | undefined;
  readonly parentRevisionFor: (lineageId: string) => string | undefined;
  readonly maskReferences: readonly RealBuildCompiledObservationMaskReference[];
}

const preflights = new WeakSet<object>();

export function realBuildCompiledObservationMaskKey(
  reference: RealBuildCompiledObservationMaskReference,
): string {
  return JSON.stringify(reference);
}

function exactMaskRanges(
  closure: RealBuildCompiledObservationClosure,
): readonly RealBuildCompiledObservationMaskReference[] {
  const byRange = new Map<string, RealBuildCompiledObservationMaskReference>();
  for (const reference of [
    ...closure.sources.flatMap(({ sourceMask, excludedMask }) => [sourceMask, excludedMask]),
    ...closure.cameras.map(({ candidateMask }) => candidateMask),
  ]) {
    const key = `${reference.offset}:${reference.bytes}`;
    const prior = byRange.get(key);
    if (
      prior !== undefined &&
      realBuildCompiledObservationMaskKey(prior) !== realBuildCompiledObservationMaskKey(reference)
    ) {
      throw new TypeError("Closure mask aliases must retain identical exact descriptors.");
    }
    if (prior === undefined) byRange.set(key, reference);
  }
  const ranges = [...byRange.values()].sort((left, right) => left.offset - right.offset);
  let next = 0;
  for (const range of ranges) {
    if (range.offset !== next) {
      throw new TypeError(
        `Closure role has an unused or overlapping byte range at offset ${next}.`,
      );
    }
    next += range.bytes;
  }
  if (next !== closure.roleBytes) {
    throw new TypeError(
      `Closure mask ranges cover ${next} bytes, not declared ${closure.roleBytes}.`,
    );
  }
  return intrinsicRealBuildFreeze(ranges);
}

function parentRevisions(
  lineage: RealBuildCompiledPlacementLineageEvidence,
): ReadonlyMap<string, string> {
  const revisions = new Map<string, string>();
  for (const group of lineage.rootCandidates) {
    const snapshot = createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: group.canonicalBytes,
      expectedDocumentHash: group.documentHash,
    });
    for (const identity of group.identities)
      revisions.set(identity.lineageId, snapshot.document.revision);
  }
  return revisions;
}

function requireRowShape(
  row: RealBuildCompiledObservationClosure["observations"][number],
  index: number,
): void {
  if (row.status === "failed") {
    if (
      row.sourceId !== null ||
      row.cameraId !== null ||
      row.shiftPx !== null ||
      row.score !== null ||
      row.outcome === null ||
      row.outcome === "source-mask-empty"
    ) {
      throw new TypeError(
        `Closure observation ${index} failed rows require null source/camera/shift/score and one typed failure.`,
      );
    }
  } else if (row.status === "not-observable") {
    if (
      row.sourceId === null ||
      row.cameraId !== null ||
      row.shiftPx !== null ||
      row.score !== null ||
      row.outcome !== "source-mask-empty"
    ) {
      throw new TypeError(
        `Closure observation ${index} not-observable row has invalid raw-source-empty fields.`,
      );
    }
  } else if (
    row.sourceId === null ||
    row.cameraId === null ||
    row.shiftPx === null ||
    row.score === null ||
    row.outcome !== null
  ) {
    throw new TypeError(
      `Closure observation ${index} scored row requires source, camera, shift, score, and null outcome.`,
    );
  }
}

function requireSelectionShape(closure: RealBuildCompiledObservationClosure): void {
  const selection = closure.selection;
  const selected = selection.status === "selected";
  if (
    (selected && selection.decisionSourceId === null) ||
    selected !== (selection.selectedCameraId !== null) ||
    selected !== (selection.selectedCandidateId !== null) ||
    selected !== selection.selectedLineageIds.length > 0 ||
    (selection.status === "unverified-failure" && selection.decisionSourceId !== null)
  ) {
    throw new TypeError(
      "Closure selection status must exactly govern its decision source, selected camera, candidate, and lineages.",
    );
  }
  if ((closure.acceptedTransition !== null) !== selected) {
    throw new TypeError(
      "Closure acceptedTransition must be present exactly when selection is selected.",
    );
  }
}

function buildPreflight(input: {
  readonly lineage: RealBuildCompiledPlacementLineageEvidence;
  readonly closure: RealBuildCompiledObservationClosure;
  readonly policy: RealBuildPreparedObservationPolicyInspection;
}): RealBuildCompiledObservationPreflight {
  const { lineage, closure, policy } = input;
  if (lineage.status !== "unresolved" || lineage.lineageEdges.length === 0) {
    throw new TypeError(
      "Compiled observation closure requires an unresolved /1 lineage with a nonempty compiled frontier.",
    );
  }
  const childByLineage = new Map(
    lineage.lineageEdges.map((edge) => [edge.child.lineageId as string, edge] as const),
  );
  const childByCandidate = new Map(
    lineage.childCandidates.map((child) => [child.candidateId, child] as const),
  );
  const sources = new Map<string, Source>();
  for (const source of closure.sources) {
    const { sourceId, ...committed } = source;
    if (
      sources.has(sourceId) ||
      sourceId !== deriveRealBuildCompiledObservationSourceId(committed)
    ) {
      throw new TypeError(
        "Closure source IDs must uniquely commit their exact source descriptors.",
      );
    }
    if (
      source.preparedRunInputDigest !== policy.preparedRunInputDigest ||
      source.preparedStepIdentity !== lineage.preparedStep.printedStepIdentity ||
      source.compiledThroughStepNumber !== lineage.throughStepNumber
    ) {
      throw new TypeError("Closure source does not bind the compiled prepared step and run input.");
    }
    sources.set(sourceId, source);
  }
  const cameras = new Map<string, Camera>();
  for (const camera of closure.cameras) {
    const { cameraId, ...committed } = camera;
    const source = sources.get(camera.sourceId);
    const child = childByCandidate.get(camera.candidateId);
    if (
      cameras.has(cameraId) ||
      cameraId !== deriveRealBuildCompiledObservationCameraId(committed)
    ) {
      throw new TypeError("Closure camera IDs must uniquely commit exact camera descriptors.");
    }
    if (
      source === undefined ||
      child === undefined ||
      child.documentHash !== camera.documentHash ||
      camera.candidateMask.widthPx !== source.sourceMask.widthPx ||
      camera.candidateMask.heightPx !== source.sourceMask.heightPx
    ) {
      throw new TypeError(
        "Closure camera must bind one exact source raster and retained compiled child document.",
      );
    }
    cameras.set(cameraId, camera);
  }
  if (
    closure.observations.length !== lineage.lineageEdges.length ||
    closure.observations.some(
      (row, index) => row.lineageId !== lineage.lineageEdges[index]!.child.lineageId,
    )
  ) {
    throw new TypeError(
      "Closure observations must contain exactly one row per compiled child edge in canonical lineageEdges order.",
    );
  }
  const usedSources = new Set<string>();
  const usedCameras = new Set<string>();
  const compared = new Set<string>();
  const groupRows = new Map<
    string,
    { readonly score: number; readonly shift: readonly [number, number] }
  >();
  let decisionSourceId: string | null = null;
  let visits = 0;
  for (const [index, row] of closure.observations.entries()) {
    const { observationId, ...committed } = row;
    if (observationId !== deriveRealBuildCompiledObservationId(committed)) {
      throw new TypeError(`Closure observation ${index} ID does not commit its exact row.`);
    }
    requireRowShape(row, index);
    if (row.status === "failed") continue;
    const source = sources.get(row.sourceId!);
    if (source === undefined)
      throw new TypeError(`Closure observation ${index} source is not committed.`);
    usedSources.add(source.sourceId);
    if (decisionSourceId === null) decisionSourceId = source.sourceId;
    else if (decisionSourceId !== source.sourceId) {
      throw new TypeError("Every decision row must share one exact source descriptor and raster.");
    }
    if (row.status === "not-observable") continue;
    const camera = cameras.get(row.cameraId!);
    const edge = childByLineage.get(row.lineageId)!;
    if (
      camera === undefined ||
      camera.sourceId !== source.sourceId ||
      camera.candidateId !== edge.child.candidateId ||
      camera.documentHash !== edge.child.documentHash
    ) {
      throw new TypeError(
        "Scored closure row camera does not bind its source and exact compiled child.",
      );
    }
    usedCameras.add(camera.cameraId);
    compared.add(`${source.sourceId}\0${camera.cameraId}`);
    const groupKey = `${camera.candidateId}\0${camera.cameraId}`;
    const prior = groupRows.get(groupKey);
    if (
      prior !== undefined &&
      (prior.score !== row.score ||
        prior.shift[0] !== row.shiftPx![0] ||
        prior.shift[1] !== row.shiftPx![1])
    ) {
      throw new TypeError("Candidate+camera group changes its retained shift or score.");
    }
    if (prior === undefined) groupRows.set(groupKey, { score: row.score!, shift: row.shiftPx! });
  }
  if (usedSources.size !== sources.size || usedCameras.size !== cameras.size) {
    throw new TypeError("Closure source and camera tables cannot retain orphan entries.");
  }
  for (const sourceId of usedSources) {
    const source = sources.get(sourceId)!;
    visits += source.sourceMask.widthPx * source.sourceMask.heightPx;
  }
  for (const key of compared) {
    const source = sources.get(key.slice(0, key.indexOf("\0")))!;
    visits += realBuildCompiledObservationRegistrationVisits(
      source.sourceMask.widthPx,
      source.sourceMask.heightPx,
    );
  }
  if (visits > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS) {
    throw new RangeError(
      `Compiled observation closure predicts ${visits} pixel visits, exceeding ${MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS}; role bytes were not accessed.`,
    );
  }
  requireSelectionShape(closure);
  if (
    (closure.selection.decisionSourceId !== null &&
      !sources.has(closure.selection.decisionSourceId)) ||
    (closure.selection.selectedCameraId !== null &&
      !cameras.has(closure.selection.selectedCameraId)) ||
    (closure.selection.selectedCandidateId !== null &&
      !childByCandidate.has(closure.selection.selectedCandidateId))
  ) {
    throw new TypeError(
      "Closure selection names an uncommitted source, camera, or compiled candidate.",
    );
  }
  const parentRevisionByLineage = parentRevisions(lineage);
  const preflight = intrinsicRealBuildFreeze({
    lineage,
    closure,
    policy,
    edgeFor: (lineageId: string) => childByLineage.get(lineageId),
    sourceFor: (sourceId: string) => sources.get(sourceId),
    cameraFor: (cameraId: string) => cameras.get(cameraId),
    parentRevisionFor: (lineageId: string) => parentRevisionByLineage.get(lineageId),
    maskReferences: exactMaskRanges(closure),
  });
  preflights.add(preflight);
  return preflight;
}

function requireEmptyLegacyObservationGeneration(
  lineage: RealBuildCompiledPlacementLineageEvidence,
): void {
  if (
    lineage.status !== "unresolved" ||
    lineage.lineageEdges.length === 0 ||
    lineage.observationBytes !== null ||
    lineage.observationRefs.length !== 0 ||
    lineage.selection.status !== "unresolved" ||
    lineage.selection.decisionPanelStepNumber !== null ||
    lineage.selection.selectedCandidateId !== null ||
    lineage.selection.selectedLineageIds.length !== 0 ||
    lineage.selection.bestScore !== null ||
    lineage.selection.runnerUpScore !== null ||
    lineage.selection.margin !== null ||
    lineage.acceptedTransition !== null
  ) {
    throw new TypeError(
      "Closure verification requires linked compiled-placement-lineage /1 to retain an unresolved nonempty compiled frontier, empty observation generation, and no accepted transition.",
    );
  }
}

/** Bytes-only, branded semantic preflight; structural evidence is never accepted here. */
export function inspectRealBuildCompiledObservationPreflight(
  compiledLineageBytes: unknown,
  closureBytes: unknown,
  policyInspection: unknown,
): RealBuildCompiledObservationPreflight {
  const policy = requireRealBuildPreparedObservationPolicyInspection(policyInspection);
  const closure = parseRealBuildCompiledObservationClosure(closureBytes);
  requireRealBuildCompiledObservationClosurePreReplayRows(closure);
  const lineageBytes = snapshotHostileUint8Array(compiledLineageBytes, {
    maximumBytes: MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES,
    typeError: "Compiled lineage bytes must be a genuine Uint8Array.",
    oversizeError: (length) =>
      `Compiled lineage bytes contain ${length} bytes, exceeding ${MAXIMUM_REAL_BUILD_COMPILED_LINEAGE_BYTES}; no bytes were copied.`,
    sharedError: "Compiled lineage bytes cannot use SharedArrayBuffer storage.",
    copyError: "Compiled lineage bytes changed or detached during bounded byte copying.",
  });
  const lineageInspection = inspectRealBuildCompiledPlacementLineageWork(lineageBytes);
  validateRealBuildCompiledPlacementLineageReplayWorkInspection(
    inspectRealBuildCompiledPlacementLineageReplayWork(lineageInspection),
  );
  return inspectObservationPreflightFromReplayAdmittedLineageWork(
    lineageInspection,
    closureBytes,
    policy,
  );
}

function inspectObservationPreflightFromReplayAdmittedLineageWork(
  lineageWorkInspection: unknown,
  closureBytes: unknown,
  policy: RealBuildPreparedObservationPolicyInspection,
): RealBuildCompiledObservationPreflight {
  const inspection =
    requireReplayAdmittedRealBuildCompiledPlacementLineageWorkInspection(lineageWorkInspection);
  const { evidence: lineage } = inspection;
  requireEmptyLegacyObservationGeneration(lineage);
  const closure = parseRealBuildCompiledObservationClosure(closureBytes);
  if (inspection.compiledLineageBytesDigest !== closure.compiledLineageBytesDigest) {
    throw new TypeError(
      "Closure compiledLineageBytesDigest does not bind the exact supplied /1 bytes.",
    );
  }
  if (policy.preparedRunInputDigest !== lineage.preparedStep.preparedRunInputDigest) {
    throw new TypeError(
      "Prepared observation policy digest does not match compiledLineage.preparedStep.preparedRunInputDigest.",
    );
  }
  return buildPreflight({ lineage, closure, policy });
}

/** Reuses an exact branded lineage after replay-work admission and semantic validation. */
export function inspectRealBuildCompiledObservationPreflightFromReplayAdmittedLineageWork(
  lineageWorkInspection: unknown,
  closureBytes: unknown,
  policyInspection: unknown,
): RealBuildCompiledObservationPreflight {
  return inspectObservationPreflightFromReplayAdmittedLineageWork(
    lineageWorkInspection,
    closureBytes,
    requireRealBuildPreparedObservationPolicyInspection(policyInspection),
  );
}

export function requireRealBuildCompiledObservationPreflight(
  value: unknown,
): RealBuildCompiledObservationPreflight {
  if (value === null || typeof value !== "object" || !preflights.has(value)) {
    throw new TypeError(
      "Compiled observation verification requires its exact bytes-only preflight inspection.",
    );
  }
  return value as RealBuildCompiledObservationPreflight;
}
