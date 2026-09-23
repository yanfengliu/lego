import { canonicalDigest, deepFreeze } from "@lego-studio/brick-kernel";

import {
  readRealBuildPrefix50Step42ActionBinding,
  readRealBuildPrefix50Step43ActionBinding,
  readRealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import { REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE } from "./real-build-prefix50-step42-43-panel-fixture";
import { requireRealBuildPrefix50Step42_43PanelFixture } from "./real-build-prefix50-step42-43-fixture-verification";
import {
  REAL_BUILD_PREFIX50_STEP42_43_CHILD_PATH,
  REAL_BUILD_PREFIX50_STEP42_43_REPAIRS,
  type RealBuildPrefix50Step42_43SourceRepairEvidence,
  type RealBuildPrefix50Step42_43SourceRepairInput,
  type RealBuildPrefix50Step42_43SourceRepairProof,
} from "./real-build-prefix50-step42-43-source-repair-contract";
import { enumerateRealBuildPrefix50Step42_43SourceRepair } from "./real-build-prefix50-step42-43-source-repair-enumeration";
import { requireRealBuildPrefix50Step41SourceRepairProof } from "./real-build-prefix50-step41-source-repair";
import { requireRealBuildPrefix50Step42SourceRepairProof } from "./real-build-prefix50-step42-source-repair";

const TEST_MODE = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const proofs = new WeakMap<object, RealBuildPrefix50Step42_43SourceRepairEvidence>();

type Enumeration = ReturnType<typeof enumerateRealBuildPrefix50Step42_43SourceRepair>;
type EnumerationMutation = (value: Enumeration) => Enumeration;

const EXPECTED_SOURCE_ROWS = [
  [275, 42, 68, 2, "builtin:black", "builtin:tile-1x2", "3069", "3069;Q", "3069b"],
  [276, 42, 68, 3, "builtin:black", "builtin:plate-1x4", "3710", "3710;L", "3710"],
  [277, 43, 69, 1, "builtin:white", "builtin:plate-1x4", "3710", "3710;L", "3710"],
  [278, 43, 70, 1, "builtin:white", "builtin:slope-1x2-45", "3040", "3040;F", "3040b"],
  [279, 43, 70, 2, "builtin:white", "builtin:slope-1x2-45", "3040", "3040;F", "3040b"],
  [280, 43, 71, 1, "builtin:white", "builtin:tile-1x2", "3069", "3069;Q", "3069b"],
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

function sameVector(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requireSourceRows(
  unsafeRows: unknown,
  projectionRows: ReturnType<typeof readRealBuildPrefix50VerifiedProjection>["occurrences"],
) {
  if (!Array.isArray(unsafeRows) || unsafeRows.length !== 23) {
    throw new TypeError("Late Step-42/43 repair requires exact projection rows 258..280.");
  }
  for (const [index, row] of unsafeRows.entries()) {
    if (row !== projectionRows[index + 257] || row.ordinal !== index + 258) {
      throw new TypeError("Late Step-42/43 source roster must retain exact opaque rows 258..280.");
    }
  }
  for (const [index, expected] of EXPECTED_SOURCE_ROWS.entries()) {
    const row = unsafeRows[expected[0] - 258]!;
    const repair = REAL_BUILD_PREFIX50_STEP42_43_REPAIRS[index]!;
    if (
      row.printedStepNumber !== expected[1] ||
      row.phaseSequence !== expected[2] ||
      row.phaseMemberOrdinal !== expected[3] ||
      row.colorId !== expected[4] ||
      row.partIdentity.reconciledCatalogPartId !== expected[5] ||
      row.partIdentity.publishedCatalogPartId !== expected[5] ||
      row.partIdentity.officialDesignId !== expected[6] ||
      row.partIdentity.officialDesignRevision !== expected[7] ||
      row.partIdentity.sourceLDrawPartId !== expected[8] ||
      row.partIdentity.identityProofId !== null ||
      row.partIdentity.basis !== "published-exact" ||
      !sameVector(row.sourceWorldTransform.positionLdu, repair.raw.positionLdu) ||
      row.sourceWorldTransform.orientationId !== repair.raw.orientationId ||
      !sameVector(row.subBuildPath, REAL_BUILD_PREFIX50_STEP42_43_CHILD_PATH)
    ) {
      throw new TypeError(`Occurrence ${expected[0]} lost its exact member identity or raw pose.`);
    }
  }
  return unsafeRows;
}

function requireBindings(
  projection: ReturnType<typeof readRealBuildPrefix50VerifiedProjection>,
  step42: ReturnType<typeof readRealBuildPrefix50Step42ActionBinding>,
  step43: ReturnType<typeof readRealBuildPrefix50Step43ActionBinding>,
): void {
  if (
    step42.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE.sourcePdfDigest ||
    step43.sourcePdfDigest !== REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE.sourcePdfDigest ||
    step42.stepActionDigest !== projection.steps[41]!.sourceActionDigest ||
    step43.stepActionDigest !== projection.steps[42]!.sourceActionDigest ||
    step43.lateStep42.stepActionDigest !== projection.steps[41]!.sourceActionDigest ||
    step43.lateStep42.callouts.map(({ identity }) => identity).join(",") !==
      REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE.step42.callouts
        .map(({ identity }) => identity)
        .join(",") ||
    step43.lateStep42.callouts.map(({ cropDigest }) => cropDigest).join(",") !==
      REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE.step42.callouts
        .map(({ cropDigest }) => cropDigest)
        .join(",") ||
    step42.members[1]?.occurrenceOrdinal !== 275 ||
    step42.members[2]?.occurrenceOrdinal !== 276 ||
    step43.phases
      .flatMap(({ members }) => members)
      .map(({ occurrenceOrdinal }) => occurrenceOrdinal)
      .join(",") !== "277,278,279,280"
  ) {
    throw new TypeError("Late Step-42/43 repair requires the exact opaque page-44 actions.");
  }
}

function requirePredecessorEvidence(
  projection: ReturnType<typeof readRealBuildPrefix50VerifiedProjection>,
  step41ProofValue: unknown,
  step42ProofValue: unknown,
) {
  const step41 = requireRealBuildPrefix50Step41SourceRepairProof(step41ProofValue);
  const step42 = requireRealBuildPrefix50Step42SourceRepairProof(step42ProofValue);
  const projectionCommitment = canonicalDigest(projection);
  const exactStep41Transforms = [
    [270, 440, -80, -108, "proper-m-00n0n0n00"],
    [271, 240, -80, -108, "proper-m-00n0n0n00"],
    [272, 300, -80, -108, "proper-m-00n0n0n00"],
    [273, 380, -80, -108, "proper-m-00n0n0n00"],
  ] as const;
  if (
    step41.projectionCommitment !== projectionCommitment ||
    step42.projectionCommitment !== projectionCommitment ||
    step42.step41RepairCommitment !== step41.repairCommitment ||
    step41.pairs.length !== exactStep41Transforms.length ||
    step41.pairs.some((pair, index) => {
      const expected = exactStep41Transforms[index]!;
      return (
        pair.candidateOrdinal !== expected[0] ||
        !sameVector(pair.repairedSourceWorldTransform.positionLdu, expected.slice(1, 4)) ||
        pair.repairedSourceWorldTransform.orientationId !== expected[4]
      );
    }) ||
    step42.occurrenceOrdinal !== 274 ||
    !sameVector(step42.repairedSourceTransform.positionLdu, [400, -72, -108]) ||
    step42.repairedSourceTransform.orientationId !== "proper-m-00n0n0n00" ||
    step42.catalogVersion !== "builtin.basic-parts/30" ||
    step42.catalogSnapshotHash !==
      "sha256:a030be3e20eeb1592594c43e321be64ac2f84875c40ad2445c48ca9e104ef290" ||
    step42.truthSnapshotHash !==
      "sha256:c304c3eb673e86d48580c6b28309f1fdf8bf4d71f7259ecc75f6f5691a336d51"
  ) {
    throw new TypeError(
      "Late Step-42/43 repair requires exact branded Step-41 and Step-42 predecessor evidence for repaired occurrences 270..274 under current /30 truth.",
    );
  }
  return { step41, step42 };
}

function requireEnumeration(value: Enumeration): Enumeration {
  const expectedRawConnectionCounts = [0, 2, 0, 0, 0, 0] as const;
  const expectedRawSeedCounts = [64, 448, 512, 160, 152, 48] as const;
  const expectedDistinctTransformCounts = [58, 330, 374, 152, 148, 44] as const;
  const expectedEnumerationCounts = [
    [0, 24, 34],
    [0, 116, 214],
    [0, 116, 258],
    [0, 44, 108],
    [0, 46, 102],
    [0, 20, 24],
  ] as const;
  const expectedRawCollisions = [
    "PART_BODY_COLLISION",
    "PART_BODY_COLLISION|PART_STUD_BODY_COLLISION",
    "PART_BODY_COLLISION",
    "",
    "",
    "",
  ] as const;
  const expectedRawCollisionCounterparts = [
    "PART_BODY_COLLISION@[266]",
    "PART_BODY_COLLISION@[269]|PART_STUD_BODY_COLLISION@[269]",
    "PART_BODY_COLLISION@[269]",
    "",
    "",
    "",
  ] as const;
  const expectedReciprocity = [
    [1, 2],
    [1, 2],
    [1, 4],
    [1, 2],
    [1, 2],
    [2, 2],
  ] as const;
  const expectedTargets = [
    "271,271",
    "272,272",
    "276,276,276,276",
    "277,277",
    "277,277",
    "278,279",
  ];
  const expectedConnections = [
    "271:stud:0>undersideClutch:0:0|271:stud:1>undersideClutch:0:1",
    "272:stud:0>undersideClutch:0:1|272:stud:1>undersideClutch:0:2",
    "276:stud:0:0>undersideClutch:0:0|276:stud:0:1>undersideClutch:0:1|276:stud:0:2>undersideClutch:0:2|276:stud:0:3>undersideClutch:0:3",
    "277:stud:0:0>undersideClutch:0|277:stud:0:1>undersideClutch:1",
    "277:stud:0:2>undersideClutch:1|277:stud:0:3>undersideClutch:0",
    "278:stud:0>undersideClutch:0:0|279:stud:0>undersideClutch:0:1",
  ] as const;
  if (
    value.terminalPartCount !== 23 ||
    value.terminalConnectionCount !== 46 ||
    value.terminalCollisionFindingCount !== 0 ||
    value.terminalBlockingIssueCount !== 0 ||
    value.terminalReciprocalConnectionCount !== 14 ||
    value.catalogVersion !== "builtin.basic-parts/30" ||
    value.catalogSnapshotHash !==
      "sha256:a030be3e20eeb1592594c43e321be64ac2f84875c40ad2445c48ca9e104ef290" ||
    value.truthSnapshotHash !==
      "sha256:c304c3eb673e86d48580c6b28309f1fdf8bf4d71f7259ecc75f6f5691a336d51" ||
    value.predecessorDocumentHash !==
      "sha256:337a8e5fd7c80810b1ff86b236b59b7801fc490eff8018ca2fa42c03dee4d238" ||
    value.terminalDocumentHash !==
      "sha256:df9d06b7eb8a9eb6011bef529e3a60f2f45def19507e8781b86d3bba21ec7f54" ||
    value.terminalConnectorCapacityClaimCount !== 92 ||
    value.rows.length !== REAL_BUILD_PREFIX50_STEP42_43_REPAIRS.length
  ) {
    throw new TypeError("Late Step-42/43 terminal enumeration is incomplete or forged.");
  }
  for (const [index, row] of value.rows.entries()) {
    const repair = REAL_BUILD_PREFIX50_STEP42_43_REPAIRS[index]!;
    const canonical = row.sourceXAcceptedCandidates.find(
      ({ transform }) =>
        transform.orientationId === repair.repaired.orientationId &&
        sameVector(transform.positionLdu, repair.repaired.positionLdu),
    );
    const alternative = row.sourceXAcceptedCandidates.find(
      ({ transform }) =>
        transform.orientationId === repair.equivalentOrientationId &&
        sameVector(transform.positionLdu, repair.repaired.positionLdu),
    );
    const slope = repair.catalogPartId === "builtin:slope-1x2-45";
    if (
      row.ordinal !== repair.ordinal ||
      !sameVector(row.rawSourceWorldTransform.positionLdu, repair.raw.positionLdu) ||
      row.rawSourceWorldTransform.orientationId !== repair.raw.orientationId ||
      !sameVector(row.repairedSourceWorldTransform.positionLdu, repair.repaired.positionLdu) ||
      row.repairedSourceWorldTransform.orientationId !== repair.repaired.orientationId ||
      row.completeOrientationCount !== 24 ||
      row.rawSeedCount !== expectedRawSeedCounts[index] ||
      row.distinctTransformCount !== expectedDistinctTransformCounts[index] ||
      [
        row.enumerationCounts.rejectedNoConnections,
        row.enumerationCounts.rejectedColliding,
        row.enumerationCounts.accepted,
      ].join(",") !== expectedEnumerationCounts[index]!.join(",") ||
      row.rawConnectionCount !== expectedRawConnectionCounts[index] ||
      row.rawCollisionFindingCodes.join("|") !== expectedRawCollisions[index] ||
      row.rawCollisionFindings.map(({ code }) => code).join("|") !== expectedRawCollisions[index] ||
      row.rawCollisionFindings
        .map(({ code, counterpartOrdinals }) => `${code}@[${counterpartOrdinals.join(",")}]`)
        .join("|") !== expectedRawCollisionCounterparts[index] ||
      canonical === undefined ||
      alternative === undefined ||
      canonical.currentCatalogLegal !== true ||
      (slope && alternative.currentCatalogLegal !== true) ||
      (canonical.occupancyKey === alternative.occupancyKey) !== !slope ||
      row.symmetryOccupancyRelation !==
        (slope ? "distinct-facing-occupancy" : "same-physical-occupancy") ||
      row.selectedConnections.map(({ targetOrdinal }) => targetOrdinal).join(",") !==
        expectedTargets[index] ||
      row.selectedConnections
        .map(
          ({ targetOrdinal, targetPortId, candidatePortId }) =>
            `${targetOrdinal}:${targetPortId}>${candidatePortId}`,
        )
        .join("|") !== expectedConnections[index] ||
      row.selectedCollisionFindingCount !== 0 ||
      [row.reciprocalExactTargetCount, row.reciprocalExactConnectionCount].join(",") !==
        expectedReciprocity[index]!.join(",")
    ) {
      throw new TypeError(
        `Occurrence ${repair.ordinal} exhaustive pose evidence is incomplete or forged.`,
      );
    }
  }
  return value;
}

function verifyWithMutation(
  unsafeInput: RealBuildPrefix50Step42_43SourceRepairInput,
  mutate?: EnumerationMutation,
): RealBuildPrefix50Step42_43SourceRepairProof {
  exactKeys(
    unsafeInput,
    [
      "projectionReader",
      "reviewedPanelFixture",
      "sourceRows",
      "step41SourceRepairProof",
      "step42SourceRepairProof",
    ],
    "Late Step-42/43 source-repair input",
  );
  const reader = ownData(unsafeInput, "projectionReader", "Late Step-42/43 source-repair input");
  const projection = readRealBuildPrefix50VerifiedProjection(reader);
  const step42 = readRealBuildPrefix50Step42ActionBinding(reader);
  const step43 = readRealBuildPrefix50Step43ActionBinding(reader);
  const fixture = ownData(
    unsafeInput,
    "reviewedPanelFixture",
    "Late Step-42/43 source-repair input",
  ) as typeof REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE;
  requireRealBuildPrefix50Step42_43PanelFixture(fixture, step42, step43);
  requireBindings(projection, step42, step43);
  const predecessors = requirePredecessorEvidence(
    projection,
    ownData(unsafeInput, "step41SourceRepairProof", "Late Step-42/43 source-repair input"),
    ownData(unsafeInput, "step42SourceRepairProof", "Late Step-42/43 source-repair input"),
  );
  const rows = requireSourceRows(
    ownData(unsafeInput, "sourceRows", "Late Step-42/43 source-repair input"),
    projection.occurrences,
  );
  const enumerated = requireEnumeration(
    mutate?.(enumerateRealBuildPrefix50Step42_43SourceRepair(rows)) ??
      enumerateRealBuildPrefix50Step42_43SourceRepair(rows),
  );
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-step42-43-source-repair-evidence/1" as const,
    authority: "none" as const,
    sourceSetId: "6651557" as const,
    projectionCommitment: canonicalDigest(projection),
    step41RepairCommitment: predecessors.step41.repairCommitment,
    step42RepairCommitment: predecessors.step42.repairCommitment,
    step42ActionBindingCommitment: canonicalDigest(step42),
    step43ActionBindingCommitment: canonicalDigest(step43),
    panelFixtureCommitment: canonicalDigest(fixture),
    sourceRowsCommitment: canonicalDigest(rows),
    sourcePdfDigest: fixture.sourcePdfDigest,
    physicalPageNumber: 44 as const,
    lookaheadPhysicalPageNumber: 45 as const,
    rawSourceTransformsPreserved: true as const,
    exhaustiveOrientationEnumeration: true as const,
    catalogTruthClaimed: false as const,
    placementAuthority: false as const,
    collisionOrEnumerationWaiver: false as const,
    reviewedNonUprightOrientationLabelsByPartId: {
      "builtin:tile-1x2": ["proper-m-00n0n0n00"],
      "builtin:plate-1x4": ["proper-m-00n0n0n00"],
      "builtin:slope-1x2-45": ["proper-m-00n0n0n00", "proper-m-00p0n0p00"],
    },
    ...enumerated,
  });
  const evidence = deepFreeze({ ...body, repairCommitment: canonicalDigest(body) });
  const proof = Object.freeze({
    schemaVersion: "lego.real-build-prefix50-step42-43-source-repair-proof/1" as const,
  });
  proofs.set(proof, evidence);
  return proof;
}

export function verifyRealBuildPrefix50Step42_43SourceRepair(
  input: RealBuildPrefix50Step42_43SourceRepairInput,
): RealBuildPrefix50Step42_43SourceRepairProof {
  return verifyWithMutation(input);
}

export function requireRealBuildPrefix50Step42_43SourceRepairProof(
  value: unknown,
): RealBuildPrefix50Step42_43SourceRepairEvidence {
  const evidence = value !== null && typeof value === "object" ? proofs.get(value) : undefined;
  if (evidence === undefined) {
    throw new TypeError(
      "Late Step-42/43 repair requires its opaque proof; caller clones carry no authority.",
    );
  }
  return evidence;
}

export const __testOnly: Readonly<{
  verifyWithEnumerationMutation?: typeof verifyWithMutation;
}> = deepFreeze(TEST_MODE ? { verifyWithEnumerationMutation: verifyWithMutation } : {});
