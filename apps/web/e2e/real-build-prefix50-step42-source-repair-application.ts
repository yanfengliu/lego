import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";

import {
  realBuildPrefix50ProjectionCommitment,
  requireRealBuildPrefix50VerifiedProjectionValue,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import type { RealBuildPrefix50Step41RepairedProjectionView } from "./real-build-prefix50-step41-source-repair-application";
import { requireRealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair";
import type { RealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair-contract";
import { requireRealBuildPrefix50Step42SourceRepairProof } from "./real-build-prefix50-step42-source-repair";
import {
  type RealBuildPrefix50Step42SourceRepairEvidence,
  type RealBuildPrefix50Step42SourceRepairProof,
} from "./real-build-prefix50-step42-source-repair-contract";

export interface RealBuildPrefix50Step42SourceRepairProposal {
  readonly schemaVersion: "lego.real-build-prefix50-step42-source-repair-proposal/1";
  readonly authority: "none";
  readonly occurrenceOrdinal: 274;
  readonly sourceEvidence: RealBuildPrefix50Step42SourceRepairEvidence;
  readonly repairCommitment: `sha256:${string}`;
  readonly basis: "opaque-page44-action-plus-physical-layer-and-reciprocal-seat-proof";
}

export interface RealBuildPrefix50Step42RepairedProjectionView {
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly proposal: RealBuildPrefix50Step42SourceRepairProposal;
}

const proposals = new WeakSet<object>();
const SAFE_ADD = WeakSet.prototype.add;
const SAFE_HAS = WeakSet.prototype.has;
const SAFE_APPLY = Reflect.apply;

const EXACT_PRIOR_TRANSFORMS = new Map<number, RigidTransform>([
  [270, { positionLdu: [440, -80, -108], orientationId: "proper-m-00n0n0n00" }],
  [271, { positionLdu: [240, -80, -108], orientationId: "proper-m-00n0n0n00" }],
  [272, { positionLdu: [300, -80, -108], orientationId: "proper-m-00n0n0n00" }],
  [273, { positionLdu: [380, -80, -108], orientationId: "proper-m-00n0n0n00" }],
  [281, { positionLdu: [410, -118, -96], orientationId: "proper-m-00pp000p0" }],
  [282, { positionLdu: [270, -118, -96], orientationId: "proper-m-00pp000p0" }],
  [283, { positionLdu: [340, -118, -96], orientationId: "proper-m-00pp000p0" }],
]);

function exactDataObject(value: unknown, expected: readonly string[], label: string): void {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  ) {
    throw new TypeError(`${label} must be a plain inert data object.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  const wanted = [...expected].sort();
  const actual = keys.filter((key): key is string => typeof key === "string").sort();
  if (
    keys.some((key) => typeof key !== "string") ||
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index]) ||
    actual.some((key) => !descriptors[key]!.enumerable || !("value" in descriptors[key]!))
  ) {
    throw new TypeError(`${label} must contain exactly inert data fields ${wanted.join(", ")}.`);
  }
}

function exactDataArray(value: unknown, expectedLength: number, label: string): void {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new TypeError(`${label} must be an exact ${expectedLength}-entry data array.`);
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  const wanted = [
    ...Array.from({ length: expectedLength }, (_, index) => String(index)),
    "length",
  ].sort();
  const actual = keys.filter((key): key is string => typeof key === "string").sort();
  if (
    keys.some((key) => typeof key !== "string") ||
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index]) ||
    actual.some((key) => !("value" in descriptors[key]!))
  ) {
    throw new TypeError(`${label} must not contain accessors, symbols, holes, or extra fields.`);
  }
}

function sameTransform(left: RigidTransform, right: RigidTransform): boolean {
  return (
    left.orientationId === right.orientationId &&
    left.positionLdu.every((coordinate, index) => coordinate === right.positionLdu[index])
  );
}

function sameOccurrenceExceptTransform(
  left: RealBuildPrefix50VerifiedProjection["occurrences"][number],
  right: RealBuildPrefix50VerifiedProjection["occurrences"][number],
): boolean {
  return (
    canonicalDigest({ ...left, sourceWorldTransform: right.sourceWorldTransform }) ===
    canonicalDigest(right)
  );
}

function requireExactStep41AndIntegralView(
  source: RealBuildPrefix50VerifiedProjection,
  view: RealBuildPrefix50Step41RepairedProjectionView,
  step41Evidence: ReturnType<typeof requireRealBuildPrefix50Step41SourceRepairProof>,
): RealBuildPrefix50VerifiedProjection {
  exactDataObject(view, ["projection", "proposal"], "Step-42 predecessor view");
  exactDataObject(
    view.proposal,
    [
      "authority",
      "occurrenceOrdinals",
      "provisionalBasis",
      "repairCommitment",
      "schemaVersion",
      "sourceEvidence",
    ],
    "Step-42 predecessor proposal",
  );
  exactDataObject(
    view.projection,
    [
      "childSubBuildWindow",
      "occurrences",
      "schemaVersion",
      "sourceArtifactDigest",
      "sourceSetId",
      "steps",
    ],
    "Step-42 predecessor projection",
  );
  exactDataArray(
    view.projection.occurrences,
    source.occurrences.length,
    "Step-42 predecessor occurrences",
  );
  const projection = view.projection;
  if (
    view.proposal.schemaVersion !== "lego.real-build-prefix50-step41-source-repair-proposal/1" ||
    view.proposal.authority !== "none" ||
    view.proposal.sourceEvidence !== step41Evidence ||
    view.proposal.repairCommitment !== step41Evidence.repairCommitment ||
    projection.schemaVersion !== source.schemaVersion ||
    projection.sourceSetId !== source.sourceSetId ||
    projection.sourceArtifactDigest !== source.sourceArtifactDigest ||
    projection.steps !== source.steps ||
    projection.childSubBuildWindow !== source.childSubBuildWindow ||
    projection.occurrences.length !== source.occurrences.length
  ) {
    throw new TypeError(
      "Step-42 application requires the exact Step-41/integral computation view and its branded predecessor proof.",
    );
  }
  for (const [index, computed] of projection.occurrences.entries()) {
    const raw = source.occurrences[index]!;
    const expected = EXACT_PRIOR_TRANSFORMS.get(raw.ordinal);
    if (
      expected === undefined
        ? computed !== raw
        : !sameOccurrenceExceptTransform(computed, raw) ||
          computed.partIdentity !== raw.partIdentity ||
          computed.subBuildPath !== raw.subBuildPath ||
          !sameTransform(computed.sourceWorldTransform, expected)
    ) {
      throw new TypeError(
        `Step-42 application found an unproved predecessor change at occurrence ${raw.ordinal}.`,
      );
    }
  }
  return projection;
}

/** Applies only occurrence 274 after exact Step-41 and half-LDU repairs. */
export function applyRealBuildPrefix50Step42SourceRepair(
  sourceProjection: RealBuildPrefix50VerifiedProjection,
  predecessorView: RealBuildPrefix50Step41RepairedProjectionView,
  step41Proof: RealBuildPrefix50Step41SourceRepairProof,
  step42Proof: RealBuildPrefix50Step42SourceRepairProof,
): RealBuildPrefix50Step42RepairedProjectionView {
  const source = requireRealBuildPrefix50VerifiedProjectionValue(sourceProjection);
  const step41Evidence = requireRealBuildPrefix50Step41SourceRepairProof(step41Proof);
  const evidence = requireRealBuildPrefix50Step42SourceRepairProof(step42Proof);
  const projectionCommitment = realBuildPrefix50ProjectionCommitment(source);
  if (
    step41Evidence.projectionCommitment !== projectionCommitment ||
    evidence.projectionCommitment !== projectionCommitment ||
    evidence.step41RepairCommitment !== step41Evidence.repairCommitment ||
    evidence.occurrenceOrdinal !== 274 ||
    evidence.placementAuthority !== false ||
    evidence.catalogTruthClaimed !== false
  ) {
    throw new TypeError(
      "Step-42 application requires exact branded Step-41/42 proofs for one opaque projection.",
    );
  }
  const predecessor = requireExactStep41AndIntegralView(source, predecessorView, step41Evidence);
  const raw = predecessor.occurrences[273]!;
  const sourceRaw = source.occurrences[273]!;
  if (
    raw !== sourceRaw ||
    raw.ordinal !== 274 ||
    !sameTransform(raw.sourceWorldTransform, evidence.rawSourceTransform)
  ) {
    throw new TypeError(
      "Step-42 application requires occurrence 274 to retain its exact raw source identity and transform.",
    );
  }
  const occurrences = predecessor.occurrences.map((occurrence) =>
    occurrence.ordinal === 274
      ? deepFreeze({
          ...occurrence,
          sourceWorldTransform: deepFreeze(evidence.repairedSourceTransform),
        })
      : occurrence,
  );
  const projection = deepFreeze({
    schemaVersion: predecessor.schemaVersion,
    sourceSetId: predecessor.sourceSetId,
    sourceArtifactDigest: predecessor.sourceArtifactDigest,
    childSubBuildWindow: predecessor.childSubBuildWindow,
    steps: predecessor.steps,
    occurrences,
  });
  const proposal = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step42-source-repair-proposal/1" as const,
    authority: "none" as const,
    occurrenceOrdinal: 274 as const,
    sourceEvidence: evidence,
    repairCommitment: evidence.repairCommitment,
    basis: "opaque-page44-action-plus-physical-layer-and-reciprocal-seat-proof" as const,
  });
  SAFE_APPLY(SAFE_ADD, proposals, [proposal]);
  return deepFreeze({ projection, proposal });
}

export function requireRealBuildPrefix50Step42SourceRepairProposal(
  value: unknown,
): RealBuildPrefix50Step42SourceRepairProposal {
  if (value === null || typeof value !== "object" || !SAFE_APPLY(SAFE_HAS, proposals, [value])) {
    throw new TypeError(
      "Step-42 binding requires the exact runtime proposal produced from its opaque repair proof; clones and caller proposals are forbidden.",
    );
  }
  return value as RealBuildPrefix50Step42SourceRepairProposal;
}
