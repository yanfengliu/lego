import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";

import {
  requireRealBuildPrefix50VerifiedProjectionValue,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import {
  REAL_BUILD_PREFIX50_STEP42_43_REPAIRS,
  type RealBuildPrefix50Step42_43SourceRepairEvidence,
  type RealBuildPrefix50Step42_43SourceRepairProof,
} from "./real-build-prefix50-step42-43-source-repair-contract";
import { requireRealBuildPrefix50Step42_43SourceRepairProof } from "./real-build-prefix50-step42-43-source-repair";
import { requireRealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair";
import type { RealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair-contract";
import { requireRealBuildPrefix50Step42SourceRepairProof } from "./real-build-prefix50-step42-source-repair";
import type { RealBuildPrefix50Step42SourceRepairProof } from "./real-build-prefix50-step42-source-repair-contract";

export interface RealBuildPrefix50Step42_43SourceRepairProposal {
  readonly schemaVersion: "lego.real-build-prefix50-step42-43-source-repair-proposal/1";
  readonly authority: "none";
  readonly occurrenceOrdinals: readonly [275, 276, 277, 278, 279, 280];
  readonly sourceEvidence: RealBuildPrefix50Step42_43SourceRepairEvidence;
  readonly repairCommitment: `sha256:${string}`;
  readonly basis: "opaque-page44-actions-plus-page45-lookahead-plus-exhaustive-terminal-window";
}

export interface RealBuildPrefix50Step42_43RepairedProjectionView {
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly proposal: RealBuildPrefix50Step42_43SourceRepairProposal;
}

export interface RealBuildPrefix50Step42_43PredecessorProofs {
  readonly step41SourceRepairProof: RealBuildPrefix50Step41SourceRepairProof;
  readonly step42SourceRepairProof: RealBuildPrefix50Step42SourceRepairProof;
}

const proposals = new WeakSet<object>();
const SAFE_ADD = WeakSet.prototype.add;
const SAFE_HAS = WeakSet.prototype.has;
const SAFE_APPLY = Reflect.apply;

const ALLOWED_PRIOR_REPAIRS = new Map<number, RigidTransform>([
  [270, { positionLdu: [440, -80, -108], orientationId: "proper-m-00n0n0n00" }],
  [271, { positionLdu: [240, -80, -108], orientationId: "proper-m-00n0n0n00" }],
  [272, { positionLdu: [300, -80, -108], orientationId: "proper-m-00n0n0n00" }],
  [273, { positionLdu: [380, -80, -108], orientationId: "proper-m-00n0n0n00" }],
  [274, { positionLdu: [400, -72, -108], orientationId: "proper-m-00n0n0n00" }],
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

function requireComputationOverlay(
  source: RealBuildPrefix50VerifiedProjection,
  computation: RealBuildPrefix50VerifiedProjection,
): void {
  exactDataObject(
    computation,
    [
      "childSubBuildWindow",
      "occurrences",
      "schemaVersion",
      "sourceArtifactDigest",
      "sourceSetId",
      "steps",
    ],
    "Late Step-42/43 computation projection",
  );
  exactDataArray(
    computation.occurrences,
    source.occurrences.length,
    "Late Step-42/43 computation occurrences",
  );
  if (
    computation.schemaVersion !== source.schemaVersion ||
    computation.sourceSetId !== source.sourceSetId ||
    computation.sourceArtifactDigest !== source.sourceArtifactDigest ||
    computation.steps !== source.steps ||
    computation.childSubBuildWindow !== source.childSubBuildWindow ||
    computation.occurrences.length !== source.occurrences.length
  ) {
    throw new TypeError("Late Step-42/43 application requires one exact computation overlay.");
  }
  for (const [index, computed] of computation.occurrences.entries()) {
    const sourceRow = source.occurrences[index]!;
    const ordinal = index + 1;
    const allowedPrior = ALLOWED_PRIOR_REPAIRS.get(ordinal);
    const isOurRawRow = ordinal >= 275 && ordinal <= 280;
    exactDataObject(
      computed,
      Object.keys(sourceRow),
      `Late Step-42/43 computation occurrence ${ordinal}`,
    );
    exactDataObject(
      computed.sourceWorldTransform,
      ["orientationId", "positionLdu"],
      `Late Step-42/43 computation occurrence ${ordinal} transform`,
    );
    exactDataArray(
      computed.sourceWorldTransform.positionLdu,
      3,
      `Late Step-42/43 computation occurrence ${ordinal} position`,
    );
    if (
      !sameOccurrenceExceptTransform(computed, sourceRow) ||
      computed.partIdentity !== sourceRow.partIdentity ||
      computed.subBuildPath !== sourceRow.subBuildPath ||
      (isOurRawRow &&
        !sameTransform(computed.sourceWorldTransform, sourceRow.sourceWorldTransform)) ||
      (!isOurRawRow &&
        (allowedPrior === undefined
          ? computed !== sourceRow
          : !sameTransform(computed.sourceWorldTransform, allowedPrior)))
    ) {
      throw new TypeError(
        `Late Step-42/43 application refuses overlapping or unproved occurrence ${ordinal}.`,
      );
    }
  }
}

export function applyRealBuildPrefix50Step42_43SourceRepair(
  sourceProjection: RealBuildPrefix50VerifiedProjection,
  computationProjection: RealBuildPrefix50VerifiedProjection,
  predecessorProofs: RealBuildPrefix50Step42_43PredecessorProofs,
  proof: RealBuildPrefix50Step42_43SourceRepairProof,
): RealBuildPrefix50Step42_43RepairedProjectionView {
  const source = requireRealBuildPrefix50VerifiedProjectionValue(sourceProjection);
  const evidence = requireRealBuildPrefix50Step42_43SourceRepairProof(proof);
  exactDataObject(
    predecessorProofs,
    ["step41SourceRepairProof", "step42SourceRepairProof"],
    "Late Step-42/43 predecessor proofs",
  );
  const step41Evidence = requireRealBuildPrefix50Step41SourceRepairProof(
    predecessorProofs.step41SourceRepairProof,
  );
  const step42Evidence = requireRealBuildPrefix50Step42SourceRepairProof(
    predecessorProofs.step42SourceRepairProof,
  );
  if (
    evidence.projectionCommitment !== canonicalDigest(source) ||
    evidence.sourceRowsCommitment !== canonicalDigest(source.occurrences.slice(257, 280)) ||
    evidence.step41RepairCommitment !== step41Evidence.repairCommitment ||
    evidence.step42RepairCommitment !== step42Evidence.repairCommitment ||
    step42Evidence.step41RepairCommitment !== step41Evidence.repairCommitment ||
    step41Evidence.projectionCommitment !== evidence.projectionCommitment ||
    step42Evidence.projectionCommitment !== evidence.projectionCommitment
  ) {
    throw new TypeError(
      "Late Step-42/43 proof or branded Step-41/42 predecessors belong to a different opaque projection.",
    );
  }
  requireComputationOverlay(source, computationProjection);
  const repairs = new Map<number, RigidTransform>(
    REAL_BUILD_PREFIX50_STEP42_43_REPAIRS.map(({ ordinal, repaired }) => [ordinal, repaired]),
  );
  const occurrences = computationProjection.occurrences.map((row) => {
    const repaired = repairs.get(row.ordinal);
    return repaired === undefined
      ? row
      : deepFreeze({ ...row, sourceWorldTransform: deepFreeze(repaired) });
  });
  const projection = deepFreeze({
    schemaVersion: computationProjection.schemaVersion,
    sourceSetId: computationProjection.sourceSetId,
    sourceArtifactDigest: computationProjection.sourceArtifactDigest,
    childSubBuildWindow: computationProjection.childSubBuildWindow,
    steps: computationProjection.steps,
    occurrences,
  });
  const proposal = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step42-43-source-repair-proposal/1" as const,
    authority: "none" as const,
    occurrenceOrdinals: [275, 276, 277, 278, 279, 280] as const,
    sourceEvidence: evidence,
    repairCommitment: evidence.repairCommitment,
    basis: "opaque-page44-actions-plus-page45-lookahead-plus-exhaustive-terminal-window" as const,
  });
  SAFE_APPLY(SAFE_ADD, proposals, [proposal]);
  return deepFreeze({ projection, proposal });
}

export function requireRealBuildPrefix50Step42_43SourceRepairProposal(
  value: unknown,
): RealBuildPrefix50Step42_43SourceRepairProposal {
  if (value === null || typeof value !== "object" || !SAFE_APPLY(SAFE_HAS, proposals, [value])) {
    throw new TypeError(
      "Late Step-42/43 binding requires the exact runtime proposal produced from its opaque repair proof; clones and caller proposals are forbidden.",
    );
  }
  return value as RealBuildPrefix50Step42_43SourceRepairProposal;
}
