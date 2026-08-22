import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { sha256Hex } from "@lego-studio/brick-kernel";

import {
  realBuildCompiledObservationMaskKey,
  requireRealBuildCompiledObservationPreflight,
  type RealBuildCompiledObservationPreflight,
} from "./real-build-compiled-observation-closure-preflight";
import type {
  RealBuildCompiledObservationClosure,
  RealBuildCompiledObservationClosureInspection,
  RealBuildCompiledObservationMaskReference,
} from "./real-build-compiled-observation-closure-types";
import { MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS } from "./real-build-compiled-observation-closure-types";
import {
  createRealBuildCompiledObservationRegistrationVerifier,
  type RealBuildCompiledRegistrationResult,
} from "./real-build-compiled-observation-registration";
import type { RealBuildCompiledPlacementLineageEvidence } from "./real-build-compiled-placement-lineage-types";
import type { RealBuildPreparedObservationPolicyInspection } from "./real-build-prepared-step-authority";
import { snapshotHostileUint8Array } from "./real-build-hostile-uint8array";

type Source = RealBuildCompiledObservationClosure["sources"][number];
type Camera = RealBuildCompiledObservationClosure["cameras"][number];

function snapshotMasks(
  role: Uint8Array,
  references: readonly RealBuildCompiledObservationMaskReference[],
): ReadonlyMap<string, Uint8Array> {
  const masks = new Map<string, Uint8Array>();
  for (const reference of references) {
    const bytes = role.subarray(reference.offset, reference.offset + reference.bytes);
    if (bytes.length !== reference.bytes || `sha256:${sha256Hex(bytes)}` !== reference.digest) {
      throw new TypeError("Closure mask reference does not match its exact retained slice digest.");
    }
    const remainder = (reference.widthPx * reference.heightPx) & 7;
    if (remainder !== 0 && (bytes[bytes.length - 1]! & ((1 << (8 - remainder)) - 1)) !== 0) {
      throw new TypeError("Closure mask reference has non-zero low MSB padding bits.");
    }
    masks.set(realBuildCompiledObservationMaskKey(reference), bytes);
  }
  return masks;
}

function expectedAccepted(
  input: Parameters<typeof verifyRows>[0],
  candidateId: string,
  lineageIds: readonly string[],
) {
  const transitionById = new Map(
    input.lineage.uniqueTransitions.map(
      (transition) => [transition.transitionId, transition] as const,
    ),
  );
  const transitionIds: string[] = [];
  const transitions = [];
  const seenTransitions = new Set<string>();
  const parentRevisions = new Set<string>();
  for (const lineageId of lineageIds) {
    const edge = input.edgeFor(lineageId);
    if (edge === undefined)
      throw new TypeError("Selected observation lineage is not one compiled edge.");
    const parentRevision = input.parentRevisionFor(edge.parentLineageId);
    const transition = transitionById.get(edge.transitionId);
    if (parentRevision === undefined || transition === undefined) {
      throw new TypeError(
        "Selected observation lineage lacks its direct parent or transition facts.",
      );
    }
    parentRevisions.add(parentRevision);
    if (!seenTransitions.has(edge.transitionId)) {
      transitionIds.push(edge.transitionId);
      transitions.push(transition);
      seenTransitions.add(edge.transitionId);
    }
  }
  if (parentRevisions.size !== 1) {
    throw new TypeError("Selected observation lineages have different direct-parent revisions.");
  }
  const first = transitions[0]!;
  if (
    first === undefined ||
    transitions.some(
      (transition) =>
        transition.childCandidateId !== candidateId ||
        transition.childDocumentHash !== first.childDocumentHash ||
        transition.receipt.finalRevision !== first.receipt.finalRevision ||
        transition.receipt.canonicalStepId !== first.receipt.canonicalStepId ||
        transition.pieces.length !== first.pieces.length ||
        !sameValidation(transition.receipt.validation, first.receipt.validation),
    )
  ) {
    throw new TypeError(
      "Selected compiled transitions do not converge on one candidate, document, revision, canonical step, piece count, and validation report.",
    );
  }
  return {
    candidateId: first.childCandidateId,
    documentHash: first.childDocumentHash,
    lineageIds,
    transitionIds,
    canonicalStepId: first.receipt.canonicalStepId,
    placedPieces: first.pieces.length,
  };
}

function sameValidation(
  left: RealBuildCompiledPlacementLineageEvidence["uniqueTransitions"][number]["receipt"]["validation"],
  right: RealBuildCompiledPlacementLineageEvidence["uniqueTransitions"][number]["receipt"]["validation"],
): boolean {
  return (
    left.targetDocumentHash === right.targetDocumentHash &&
    left.truthSnapshotHash === right.truthSnapshotHash &&
    left.validatorSetHash === right.validatorSetHash &&
    left.documentGloballyValid === right.documentGloballyValid &&
    left.blockingIssues.length === 0 &&
    right.blockingIssues.length === 0
  );
}

function verifyRows(
  input: {
    readonly lineage: RealBuildCompiledPlacementLineageEvidence;
    readonly closure: RealBuildCompiledObservationClosure;
    readonly role: Uint8Array;
    readonly policy: RealBuildPreparedObservationPolicyInspection;
  } & RealBuildCompiledObservationPreflight,
): RealBuildCompiledObservationClosureInspection {
  const masks = snapshotMasks(input.role, input.maskReferences);
  const register = createRealBuildCompiledObservationRegistrationVerifier(
    MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_PIXEL_VISITS,
  );
  const agreements = new Map<string, RealBuildCompiledRegistrationResult>();
  const emptySources = new Map<string, boolean>();
  const groups = new Map<
    string,
    {
      camera: Camera;
      score: number;
      shift: readonly [number, number];
      lineages: string[];
      order: number;
    }
  >();
  const failedIds: (typeof input.closure.observations)[number]["observationId"][] = [];
  let decisionSource: Source | null = null;
  for (const [index, row] of input.closure.observations.entries()) {
    const observationId = row.observationId;
    const edge = input.edgeFor(row.lineageId)!;
    if (row.status === "failed") {
      failedIds.push(observationId);
      continue;
    }
    const source = input.sourceFor(row.sourceId!);
    if (source === undefined)
      throw new TypeError(`Closure observation ${index} source is not committed.`);
    if (decisionSource === null) decisionSource = source;
    else if (
      decisionSource.sourceId !== source.sourceId ||
      decisionSource.metric !== source.metric ||
      decisionSource.measure !== source.measure ||
      !sameMask(decisionSource.sourceMask, source.sourceMask) ||
      !sameMask(decisionSource.excludedMask, source.excludedMask)
    )
      throw new TypeError(
        "Every decision row must share one exact source, exclusion, metric, measure, and raster.",
      );
    const sourceBytes = masks.get(realBuildCompiledObservationMaskKey(source.sourceMask))!;
    const excludedBytes = masks.get(realBuildCompiledObservationMaskKey(source.excludedMask))!;
    let empty = emptySources.get(source.sourceId);
    if (empty === undefined) {
      empty =
        register.countVisibleSource({
          source: sourceBytes,
          excluded: null,
          width: source.sourceMask.widthPx,
          height: source.sourceMask.heightPx,
          path: "raw source observability",
        }) === 0;
      emptySources.set(source.sourceId, empty);
    }
    if (row.status === "not-observable") {
      if (!empty)
        throw new TypeError("Not-observable closure row retains nonempty raw source pixels.");
      continue;
    }
    if (empty)
      throw new TypeError(
        "Scored closure row retains an empty raw source mask; it must be not-observable.",
      );
    const camera = input.cameraFor(row.cameraId!);
    if (
      camera === undefined ||
      camera.sourceId !== source.sourceId ||
      camera.candidateId !== edge.child.candidateId ||
      camera.documentHash !== edge.child.documentHash
    )
      throw new TypeError(
        "Scored closure row camera does not bind its source and exact compiled child.",
      );
    const comparisonKey = `${source.sourceId}\0${camera.cameraId}`;
    const shift = row.shiftPx!;
    const score = row.score!;
    let agreement = agreements.get(comparisonKey);
    if (agreement === undefined) {
      agreement = register.register({
        source: sourceBytes,
        candidate: masks.get(realBuildCompiledObservationMaskKey(camera.candidateMask))!,
        excluded: excludedBytes,
        width: source.sourceMask.widthPx,
        height: source.sourceMask.heightPx,
        measure: source.measure,
        path: `observation ${index}`,
      });
      agreements.set(comparisonKey, agreement);
    }
    if (
      agreement.shiftPx[0] !== shift[0] ||
      agreement.shiftPx[1] !== shift[1] ||
      agreement.score !== score
    )
      throw new TypeError(
        "Scored closure row does not reproduce deterministic optimal registration.",
      );
    const key = `${camera.candidateId}\0${camera.cameraId}`;
    const prior = groups.get(key);
    if (
      prior !== undefined &&
      (prior.score !== score ||
        prior.shift[0] !== shift[0] ||
        prior.shift[1] !== shift[1] ||
        !sameMask(prior.camera.candidateMask, camera.candidateMask))
    )
      throw new TypeError("Candidate+camera group changes mask, shift, or score.");
    if (prior === undefined)
      groups.set(key, { camera, score, shift, lineages: [row.lineageId], order: index });
    else prior.lineages.push(row.lineageId);
  }
  return finishSelection(input, [...groups.values()], failedIds, decisionSource);
}

function sameMask(
  left: RealBuildCompiledObservationMaskReference,
  right: RealBuildCompiledObservationMaskReference,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function finishSelection(
  input: Parameters<typeof verifyRows>[0],
  groups: { camera: Camera; score: number; lineages: string[]; order: number }[],
  failedIds: RealBuildCompiledObservationClosureInspection["failedObservationIds"],
  decisionSource: Source | null,
): RealBuildCompiledObservationClosureInspection {
  groups.sort((left, right) => right.score - left.score || left.order - right.order);
  const best = groups[0] ?? null;
  const runner = groups[1] ?? null;
  const margin = best === null || runner === null ? null : best.score - runner.score;
  const complete =
    input.closure.observations.length === input.lineage.lineageEdges.length &&
    failedIds.length === 0 &&
    input.closure.observations.every(({ status }) => status === "scored");
  const selected =
    complete &&
    best !== null &&
    best.score >= input.policy.minimumScore &&
    (runner === null || margin! > input.policy.minimumMargin);
  const expected =
    failedIds.length > 0
      ? {
          status: "unverified-failure",
          decisionSourceId: null,
          selectedCameraId: null,
          selectedCandidateId: null,
          selectedLineageIds: [],
          bestScore: best?.score ?? null,
          runnerUpScore: runner?.score ?? null,
          margin,
        }
      : {
          status: selected ? "selected" : "unresolved",
          decisionSourceId: decisionSource?.sourceId ?? null,
          selectedCameraId: selected ? best!.camera.cameraId : null,
          selectedCandidateId: selected ? best!.camera.candidateId : null,
          selectedLineageIds: selected ? best!.lineages : [],
          bestScore: best?.score ?? null,
          runnerUpScore: runner?.score ?? null,
          margin,
        };
  if (JSON.stringify(input.closure.selection) !== JSON.stringify(expected))
    throw new TypeError(
      "Closure selection does not reproduce exact camera groups and prepared thresholds.",
    );
  const accepted = selected
    ? expectedAccepted(input, best!.camera.candidateId, best!.lineages)
    : null;
  if (JSON.stringify(input.closure.acceptedTransition) !== JSON.stringify(accepted))
    throw new TypeError(
      "Closure acceptedTransition does not reproduce its selected compiled edges and receipts.",
    );
  return intrinsicRealBuildFreeze({
    closure: input.closure,
    reproducible:
      failedIds.length === 0 &&
      input.closure.observations.every(({ status }) => status === "scored"),
    failedObservationIds: intrinsicRealBuildFreeze([...failedIds]),
    provenanceAuthority: "absent",
    authority: "absent",
  });
}

/** Accepts only the module-branded bytes preflight; raw structural evidence is never public input. */
export function verifyRealBuildCompiledObservationRows(
  preflightInspection: unknown,
  roleBytes: unknown | null,
): RealBuildCompiledObservationClosureInspection {
  const preflight = requireRealBuildCompiledObservationPreflight(preflightInspection);
  const { closure } = preflight;
  const role =
    closure.roleBytes === 0
      ? roleBytes === null
        ? new Uint8Array()
        : (() => {
            throw new TypeError("Closure without role bytes requires null role input.");
          })()
      : snapshotHostileUint8Array(roleBytes, {
          maximumBytes: closure.roleBytes,
          typeError: "Compiled observation role bytes must be a genuine Uint8Array.",
          oversizeError: (length) =>
            `Compiled observation role bytes contain ${length} bytes, exceeding the closure's exact ${closure.roleBytes}; no bytes were copied.`,
          sharedError: "Compiled observation role bytes cannot use SharedArrayBuffer storage.",
          copyError:
            "Compiled observation role bytes changed or detached during bounded byte copying.",
        });
  if (
    role.length !== closure.roleBytes ||
    (role.length > 0 && `sha256:${sha256Hex(role)}` !== closure.roleDigest)
  ) {
    throw new TypeError(
      "Compiled observation role length or digest does not reproduce closure metadata.",
    );
  }
  return verifyRows({ ...preflight, role });
}
