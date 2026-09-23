import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";
import type { RigidTransform } from "@lego-studio/protocol";

import {
  readRealBuildPrefix50Step42ActionBinding,
  readRealBuildPrefix50VerifiedProjection,
  realBuildPrefix50ProjectionCommitment,
  type RealBuildPrefix50ProjectionOccurrence,
  type RealBuildPrefix50Step42ActionBinding,
} from "./real-build-prefix50-projection";
import { requireRealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair";
import { REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE } from "./real-build-prefix50-step42-panel-face-fixture";
import {
  REAL_BUILD_PREFIX50_STEP42_RAW_TRANSFORM,
  type RealBuildPrefix50Step42SourceRepairEvidence,
  type RealBuildPrefix50Step42SourceRepairInput,
  type RealBuildPrefix50Step42SourceRepairProof,
  type RealBuildPrefix50Step42WindowRow,
} from "./real-build-prefix50-step42-source-repair-contract";
import { preflightRealBuildPrefix50Step42SourceRepair } from "./real-build-prefix50-step42-source-repair-preflight";

const proofs = new WeakMap<object, RealBuildPrefix50Step42SourceRepairEvidence>();
const CHILD_PATH = [
  "7004cf0d-d97f-4b0d-8572-970e23815c05",
  "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
] as const;

function ownData(value: unknown, key: string, label: string): unknown {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an enumerable own data property.`);
  }
  return descriptor.value;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a data object.`);
  }
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (keys.length !== wanted.length || keys.some((key, index) => key !== wanted[index])) {
    throw new TypeError(`${label} must contain exactly ${wanted.join(", ")}.`);
  }
}

function sameTransform(left: RigidTransform, right: RigidTransform): boolean {
  return (
    left.orientationId === right.orientationId &&
    left.positionLdu.every((coordinate, axis) => coordinate === right.positionLdu[axis])
  );
}

function samePath(path: readonly string[]): boolean {
  return (
    path.length === CHILD_PATH.length && path.every((entry, index) => entry === CHILD_PATH[index])
  );
}

function requireFixture(value: unknown): typeof REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE {
  const fixture = value as typeof REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE;
  if (
    fixture !== REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE ||
    fixture.schemaVersion !== "lego.real-build-prefix50-step42-panel-face-fixture/1" ||
    fixture.sourceSetId !== "6651557" ||
    fixture.sourcePdfDigest !==
      "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27" ||
    fixture.pageNumber !== 44 ||
    fixture.cropDigest !==
      "sha256:66fda118c6cbad71c6058ac3cf7b4f5e69161fd0ad026a19389edf96687bc888" ||
    fixture.calloutIdentity !== "p44|q1|x101.684|y227.599" ||
    fixture.candidateOrdinal !== 274 ||
    fixture.receiverOrdinals.join(",") !== "270,273" ||
    fixture.reviewedPanelFace !== "studs-up" ||
    fixture.canonicalOrientationId !== "proper-m-00n0n0n00" ||
    fixture.equivalentOrientationId !== "proper-m-00p0n0p00" ||
    fixture.lookaheadPageNumber !== 45 ||
    fixture.reviewDisposition !== "reviewed-occurrence-scoped-source-frame-repair-not-authority"
  ) {
    throw new TypeError(
      "Step-42 source repair requires the exact closed page-44 panel and page-45 lookahead fixture; caller clones carry no authority.",
    );
  }
  return fixture;
}

function requireActionBinding(
  binding: RealBuildPrefix50Step42ActionBinding,
  projectionStepDigest: string,
): void {
  const member = binding.members[0];
  if (
    binding.schemaVersion !== "lego.real-build-prefix50-step42-action-binding/1" ||
    binding.sourceSetId !== "6651557" ||
    binding.actionPreparationDigest !==
      "sha256:cc1163b91bcc3892137e73dd99ae51b9626589572ca683f55e74302bd4a2b267" ||
    binding.officialModelPhaseDigest !==
      "sha256:8988e328aa5793b07fc6c398eb518f4d972d90c8de85c41006db02b2792d896e" ||
    binding.stepActionDigest !== projectionStepDigest ||
    binding.stepActionDigest !==
      "sha256:21a075a8a05ced0e42ad7acb10e0cad752fe812826fa8b6a4e38ca874a49eb0d" ||
    binding.phaseSourceDigest !==
      "sha256:aed22188ce55f7bf14d36903b11da202c5c0afec8e1f844474380c6fad5a9c99" ||
    binding.printedStepNumber !== 42 ||
    binding.phaseSequence !== 68 ||
    binding.phaseKind !== "direct" ||
    !samePath(binding.subBuildPath) ||
    binding.callout.identity !== REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE.calloutIdentity ||
    binding.callout.cropDigest !== REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE.cropDigest ||
    binding.members.length !== 3 ||
    member?.occurrenceOrdinal !== 274 ||
    member.phaseMemberOrdinal !== 1 ||
    member.builderBrickRef !== "27fedc66-8b4f-4c03-87d7-27a53abd009e" ||
    member.officialDesignId !== "6636" ||
    member.designRevision !== "6636;N"
  ) {
    throw new TypeError(
      "Step-42 source repair requires the exact opaque page-44 action, phase-68 source digest, child path, and 6636;N member.",
    );
  }
}

function requireSourceRows(
  value: unknown,
  projectionRows: readonly RealBuildPrefix50ProjectionOccurrence[],
): readonly RealBuildPrefix50ProjectionOccurrence[] {
  if (!Array.isArray(value) || value.length !== 17) {
    throw new TypeError("Step-42 source repair requires exact source rows 258..274.");
  }
  for (const [index, row] of value.entries()) {
    const ordinal = index + 258;
    const source = projectionRows[ordinal - 1];
    if (
      row !== source ||
      row.ordinal !== ordinal ||
      !samePath(row.subBuildPath) ||
      (ordinal === 274 &&
        (row.printedStepNumber !== 42 ||
          row.phaseSequence !== 68 ||
          row.phaseMemberOrdinal !== 1 ||
          row.colorId !== "builtin:black" ||
          row.partIdentity.reconciledCatalogPartId !== "builtin:tile-1x6" ||
          row.partIdentity.officialDesignRevision !== "6636;N" ||
          !sameTransform(row.sourceWorldTransform, REAL_BUILD_PREFIX50_STEP42_RAW_TRANSFORM)))
    ) {
      throw new TypeError(
        `Step-42 source row ${ordinal} must retain exact projection identity, path, phase, and raw transform.`,
      );
    }
  }
  return value;
}

function repairedWindowRows(
  rows: readonly RealBuildPrefix50ProjectionOccurrence[],
  step41Evidence: ReturnType<typeof requireRealBuildPrefix50Step41SourceRepairProof>,
): readonly RealBuildPrefix50Step42WindowRow[] {
  const step41ByOrdinal = new Map(
    step41Evidence.pairs.map((pair) => [pair.candidateOrdinal, pair.repairedSourceWorldTransform]),
  );
  return rows.map((row) => ({
    ordinal: row.ordinal,
    printedStepNumber: row.printedStepNumber,
    catalogPartId: row.partIdentity.reconciledCatalogPartId,
    colorId: row.colorId,
    sourceWorldTransform: step41ByOrdinal.get(row.ordinal) ?? row.sourceWorldTransform,
  }));
}

export function verifyRealBuildPrefix50Step42SourceRepair(
  input: RealBuildPrefix50Step42SourceRepairInput,
): RealBuildPrefix50Step42SourceRepairProof {
  exactKeys(
    input,
    ["projectionReader", "reviewedPanelFaceFixture", "sourceRows", "step41SourceRepairProof"],
    "Step-42 source-repair input",
  );
  const fixture = requireFixture(
    ownData(input, "reviewedPanelFaceFixture", "Step-42 source-repair input"),
  );
  const reader = ownData(
    input,
    "projectionReader",
    "Step-42 source-repair input",
  ) as RealBuildPrefix50SourceRepairInputReader;
  const projection = readRealBuildPrefix50VerifiedProjection(reader);
  const binding = readRealBuildPrefix50Step42ActionBinding(reader);
  requireActionBinding(binding, projection.steps[41]!.sourceActionDigest);
  const rows = requireSourceRows(
    ownData(input, "sourceRows", "Step-42 source-repair input"),
    projection.occurrences,
  );
  const step41Evidence = requireRealBuildPrefix50Step41SourceRepairProof(
    ownData(input, "step41SourceRepairProof", "Step-42 source-repair input"),
  );
  if (
    step41Evidence.projectionCommitment !== realBuildPrefix50ProjectionCommitment(projection) ||
    step41Evidence.pairs.length !== 4 ||
    step41Evidence.pairs.some(
      (pair) =>
        pair.repairedSourceWorldTransform.orientationId !== "proper-m-00n0n0n00" ||
        pair.repairedSourceWorldTransform.positionLdu[1] !== -80 ||
        pair.repairedSourceWorldTransform.positionLdu[2] !== -108,
    )
  ) {
    throw new TypeError("Step-42 source repair requires the exact prior Step-41 four-panel proof.");
  }
  const preflight = preflightRealBuildPrefix50Step42SourceRepair(
    repairedWindowRows(rows, step41Evidence),
  );
  const { schemaVersion: _preflightSchema, ...measurements } = preflight;
  void _preflightSchema;
  const evidence = deepFreeze({
    ...measurements,
    schemaVersion: "lego.real-build-prefix50-step42-source-repair-evidence/1" as const,
    projectionCommitment: realBuildPrefix50ProjectionCommitment(projection),
    rawProjectionRowsCommitment: canonicalDigest(rows),
    actionBindingCommitment: canonicalDigest(binding),
    panelFaceFixtureCommitment: canonicalDigest(fixture),
    step41RepairCommitment: step41Evidence.repairCommitment,
    sourcePdfDigest: binding.sourcePdfDigest,
    panelPageNumber: 44 as const,
    panelCropDigest: binding.callout.cropDigest,
    lookaheadPageNumber: 45 as const,
    stepActionDigest: binding.stepActionDigest,
    phaseSourceDigest: binding.phaseSourceDigest,
    printedStepNumber: 42 as const,
    phaseSequence: 68 as const,
    occurrenceOrdinal: 274 as const,
    rawSourceTransformsPreserved: true as const,
    catalogTruthClaimed: false as const,
    placementAuthority: false as const,
  });
  const proof = Object.freeze({
    schemaVersion: "lego.real-build-prefix50-step42-source-repair-proof/1" as const,
  });
  proofs.set(proof, evidence);
  return proof;
}

type RealBuildPrefix50SourceRepairInputReader =
  RealBuildPrefix50Step42SourceRepairInput["projectionReader"];

export function requireRealBuildPrefix50Step42SourceRepairProof(
  value: unknown,
): RealBuildPrefix50Step42SourceRepairEvidence {
  const evidence = value !== null && typeof value === "object" ? proofs.get(value) : undefined;
  if (evidence === undefined) {
    throw new TypeError(
      "Step-42 source repair requires the opaque proof minted from exact action, projection, Step-41, panel, and complete preflight evidence; caller clones carry no authority.",
    );
  }
  return evidence;
}
