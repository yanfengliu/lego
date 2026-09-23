import { beforeAll, describe, expect, it } from "vitest";

// @ts-expect-error The opaque verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50ActionPreparation } from "../../../scripts/part-identification-prefix50-action-preparation.mjs";
// @ts-expect-error The opaque verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error The opaque verifier intentionally has no caller-facing TS surface.
import { verifyPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error The ignored-evidence reproducer intentionally has no caller-facing TS surface.
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation-current.mjs";
// @ts-expect-error The ignored-evidence verifier intentionally has no caller-facing TS surface.
import { verifyCurrentPrefix50StructuralEvents } from "../../../scripts/part-identification-prefix50-structural-events-current.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import {
  readRealBuildPrefix50Step41ActionBinding,
  readRealBuildPrefix50VerifiedProjection,
  type RealBuildPrefix50ProjectionOccurrence,
  type RealBuildPrefix50VerifiedProjection,
  type RealBuildPrefix50VerifiedProjectionReader,
} from "../e2e/real-build-prefix50-projection";
import { REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE } from "../e2e/real-build-prefix50-step41-panel-face-fixture";
import type {
  RealBuildPrefix50Step41SeatCandidate,
  RealBuildPrefix50Step41SeatEnumeration,
} from "../e2e/real-build-prefix50-step41-source-repair-enumeration";
import {
  __testOnly,
  requireRealBuildPrefix50Step41SourceRepairProof,
  verifyRealBuildPrefix50Step41SourceRepair,
} from "../e2e/real-build-prefix50-step41-source-repair";
import type {
  RealBuildPrefix50Step41SourceRepairEvidence,
  RealBuildPrefix50Step41SourceRepairInput,
  RealBuildPrefix50Step41SourceRepairProof,
} from "../e2e/real-build-prefix50-step41-source-repair-contract";

let reader: RealBuildPrefix50VerifiedProjectionReader;
let projection: RealBuildPrefix50VerifiedProjection;
let sourceRows: readonly RealBuildPrefix50ProjectionOccurrence[];
let proof: RealBuildPrefix50Step41SourceRepairProof;
let evidence: RealBuildPrefix50Step41SourceRepairEvidence;

function input(
  overrides: Partial<RealBuildPrefix50Step41SourceRepairInput> = {},
): RealBuildPrefix50Step41SourceRepairInput {
  return {
    projectionReader: reader,
    reviewedPanelFaceFixture: REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE,
    sourceRows,
    ...overrides,
  };
}

function changedRow(
  index: number,
  change: Partial<RealBuildPrefix50ProjectionOccurrence>,
): readonly RealBuildPrefix50ProjectionOccurrence[] {
  return sourceRows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...change } : row));
}

function mutateFirstCandidate(
  receipt: RealBuildPrefix50Step41SeatEnumeration,
  mutate: (candidate: RealBuildPrefix50Step41SeatCandidate) => RealBuildPrefix50Step41SeatCandidate,
): RealBuildPrefix50Step41SeatEnumeration {
  return {
    ...receipt,
    candidates: receipt.candidates.map((candidate, index) =>
      index === 0 ? mutate(candidate) : candidate,
    ),
  };
}

function verifyWithMutation(
  mutate: (
    receipt: RealBuildPrefix50Step41SeatEnumeration,
  ) => RealBuildPrefix50Step41SeatEnumeration,
): () => unknown {
  const verify = __testOnly.verifyWithEnumerationMutation;
  if (verify === undefined) throw new Error("Step-41 test verifier is unavailable.");
  return () =>
    verify(input(), (receipt, context) =>
      context.direction === "forward" && context.candidateOrdinal === 270
        ? mutate(receipt)
        : receipt,
    );
}

beforeAll(async () => {
  const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
  const reconciliation = await verifyPrefix50OfficialWorldReconciliation({
    ...reproduced.input,
    artifactBytes: reproduced.bytes,
  });
  const structural = await verifyCurrentPrefix50StructuralEvents();
  reader = createRealBuildPrefix50VerifiedProjectionReader({
    actionPreparation: {
      bytes: bytesFromVerifiedPrefix50ActionPreparation(reproduced.input.actionPreparation),
      verified: reproduced.input.actionPreparation,
    },
    officialWorldReconciliation: {
      bytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(reconciliation),
      verified: reconciliation,
    },
    structuralEvents: { bytes: structural.bytes, verified: structural.verified },
  });
  projection = readRealBuildPrefix50VerifiedProjection(reader);
  sourceRows = projection.occurrences.slice(265, 273);
  proof = verifyRealBuildPrefix50Step41SourceRepair(input());
  evidence = requireRealBuildPrefix50Step41SourceRepairProof(proof);
}, 180_000);

describe("prefix-50 step-41 source repair authority", () => {
  it("binds the exact opaque action phase, PDF crop, path, ordinals, and Builder refs", () => {
    const binding = readRealBuildPrefix50Step41ActionBinding(reader);
    expect(binding).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step41-action-binding/1",
      sourceSetId: "6651557",
      sourcePdfDigest: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
      stepActionDigest: "sha256:60dabfb1bd11de1b0f78e4e4b3e8fa75403221679ce9951d109ce7ad7dff06f5",
      printedStepNumber: 41,
      phaseSequence: 67,
      phaseKind: "direct",
      phaseSourceDigest: "sha256:a4685cc8695811bdc25251f519ece53696901699e758ecfb371c59df0eb62d0a",
      subBuildPath: [
        "7004cf0d-d97f-4b0d-8572-970e23815c05",
        "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
      ],
      callout: {
        identity: "p44|q4|x80.989|y495.535",
        pageNumber: 44,
        quantity: 4,
        cropDigest: "sha256:e9dbd7576685871145b9e6278d217fce619bd55d0def81f8438f401e65761072",
      },
    });
    expect(
      binding.members.map(({ occurrenceOrdinal, builderBrickRef }) => [
        occurrenceOrdinal,
        builderBrickRef,
      ]),
    ).toEqual([
      [270, "1260a44e-b125-411e-8552-596f22aa32e4"],
      [271, "a9aee720-9a6d-4d05-b1cb-2821d8101d03"],
      [272, "4287ddd1-1cc4-4cc5-ae50-acf1d543cb06"],
      [273, "8a6a770f-a0b9-430a-8802-8f057fbd748a"],
    ]);
    expect(Object.isFrozen(binding)).toBe(true);
    expect(Object.isFrozen(binding.members)).toBe(true);
  });

  it("derives four canonical reciprocal seats while retaining raw counterevidence", () => {
    expect(evidence).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step41-source-repair-evidence/1",
      authority: "none",
      sourceSetId: "6651557",
      printedStepNumber: 41,
      phaseSequence: 67,
      rawSourceTransformsPreserved: true,
      catalogTruthClaimed: false,
      placementAuthority: false,
      orientationEnumerationCountPerDirection: 24,
      totalReciprocalConnectionCount: 8,
      collisionAndCapacityScope: "isolated-source-rows-266..273-eight-body",
      isolatedConnectedCollisionFindingCount: 0,
    });
    expect(
      evidence.pairs.map(({ receiverOrdinal, candidateOrdinal }) => [
        receiverOrdinal,
        candidateOrdinal,
      ]),
    ).toEqual([
      [267, 270],
      [266, 271],
      [269, 272],
      [268, 273],
    ]);
    expect(
      evidence.pairs.map(({ repairedSourceWorldTransform }) => repairedSourceWorldTransform),
    ).toEqual([
      { positionLdu: [440, -80, -108], orientationId: "proper-m-00n0n0n00" },
      { positionLdu: [240, -80, -108], orientationId: "proper-m-00n0n0n00" },
      { positionLdu: [300, -80, -108], orientationId: "proper-m-00n0n0n00" },
      { positionLdu: [380, -80, -108], orientationId: "proper-m-00n0n0n00" },
    ]);
    for (const pair of evidence.pairs) {
      expect(pair.rawConnectionCount).toBe(0);
      expect(pair.rawCollisionFindingCodes).toEqual([
        "PART_BODY_COLLISION",
        "PART_STUD_BODY_COLLISION",
      ]);
      expect(pair.equivalentOrientationIds).toEqual(["proper-m-00n0n0n00", "proper-m-00p0n0p00"]);
      expect(pair.physicalOccupancyClassCount).toBe(1);
      expect(pair.canonicalOrientationBasis).toBe("raw-long-axis-direction-preserved");
      expect(pair.canonicalConnections).toHaveLength(2);
      expect(pair.alternativeConnections).toHaveLength(2);
      expect(pair.canonicalConnections).toEqual([
        {
          receiverPortId: "stud:0",
          candidatePortId: "undersideClutch:1",
          connectionKind: "stud-tube",
        },
        {
          receiverPortId: "stud:1",
          candidatePortId: "undersideClutch:0",
          connectionKind: "stud-tube",
        },
      ]);
      expect(pair.alternativeConnections).toEqual([
        {
          receiverPortId: "stud:0",
          candidatePortId: "undersideClutch:0",
          connectionKind: "stud-tube",
        },
        {
          receiverPortId: "stud:1",
          candidatePortId: "undersideClutch:1",
          connectionKind: "stud-tube",
        },
      ]);
      expect(pair.forwardCounts).toEqual({
        rawSeeds: 48,
        distinctTransforms: 38,
        rejectedNoConnections: 0,
        rejectedColliding: 4,
        accepted: 34,
      });
      expect(pair.reverseCounts).toEqual(pair.forwardCounts);
      expect(pair.reciprocalExactCandidateCount).toBe(1);
      expect(pair.connectedCollisionFindingCount).toBe(0);
    }
    expect(evidence.isolatedConnectorCapacityEndpointClaimCount).toBe(16);
    expect(evidence.repairCommitment).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.pairs[0]!.canonicalConnections)).toBe(true);
  });

  it("keeps the two symmetry labels distinct while proving one physical class", () => {
    for (const pair of evidence.pairs) {
      expect(pair.canonicalConnections).not.toEqual(pair.alternativeConnections);
      expect(pair.canonicalConnections.map(({ receiverPortId }) => receiverPortId).sort()).toEqual(
        pair.alternativeConnections.map(({ receiverPortId }) => receiverPortId).sort(),
      );
      expect(
        pair.canonicalConnections.map(({ candidatePortId }) => candidatePortId).sort(),
      ).toEqual(pair.alternativeConnections.map(({ candidatePortId }) => candidatePortId).sort());
    }
  });

  it.each([
    [
      "identity",
      () =>
        changedRow(4, {
          partIdentity: {
            ...sourceRows[4]!.partIdentity,
            officialDesignRevision: "forged;A",
          },
        }),
    ],
    ["path", () => changedRow(4, { subBuildPath: ["forged-child"] })],
    [
      "raw transform",
      () =>
        changedRow(4, {
          sourceWorldTransform: {
            ...sourceRows[4]!.sourceWorldTransform,
            positionLdu: [441, -98, -102],
          },
        }),
    ],
  ])("rejects caller-tampered %s source evidence", (_label, mutate) => {
    expect(() =>
      verifyRealBuildPrefix50Step41SourceRepair(input({ sourceRows: mutate() })),
    ).toThrow(/exact projection identity, path, phase, and raw transform/u);
  });

  it("rejects incomplete, reordered, and third-body source rosters", () => {
    for (const rows of [
      sourceRows.slice(0, 7),
      [sourceRows[1]!, sourceRows[0]!, ...sourceRows.slice(2)],
      [...sourceRows, sourceRows[0]!],
    ]) {
      expect(() => verifyRealBuildPrefix50Step41SourceRepair(input({ sourceRows: rows }))).toThrow(
        /exact source rows 266\.\.273|exact projection identity/u,
      );
    }
  });

  it("rejects a one-LDU enumerated transform and a forged port", () => {
    expect(
      verifyWithMutation((receipt) =>
        mutateFirstCandidate(receipt, (candidate) => ({
          ...candidate,
          transform: {
            ...candidate.transform,
            positionLdu: [
              candidate.transform.positionLdu[0] + 1,
              candidate.transform.positionLdu[1],
              candidate.transform.positionLdu[2],
            ],
          },
        })),
      ),
    ).toThrow(/forged transform/u);

    expect(
      verifyWithMutation((receipt) =>
        mutateFirstCandidate(receipt, (candidate) => ({
          ...candidate,
          connections: candidate.connections.map((connection, index) =>
            index === 0 ? { ...connection, candidatePortId: "forged-port" } : connection,
          ),
        })),
      ),
    ).toThrow(/port|connector/u);
  });

  it("rejects third-body and truncated reciprocal enumerations", () => {
    expect(
      verifyWithMutation((receipt) =>
        mutateFirstCandidate(receipt, (candidate) => ({
          ...candidate,
          connections: candidate.connections.map((connection, index) =>
            index === 0 ? { ...connection, targetPartId: "forged-third-body" } : connection,
          ),
        })),
      ),
    ).toThrow(/third bod/u);

    expect(
      verifyWithMutation((receipt) => ({
        ...receipt,
        candidates: receipt.candidates.slice(1),
      })),
    ).toThrow(/incomplete or internally inconsistent/u);

    expect(
      verifyWithMutation((receipt) => ({
        ...receipt,
        orientationIds: receipt.orientationIds.slice(1),
      })),
    ).toThrow(/incomplete or internally inconsistent/u);
  });

  it("rejects fixture, reader, and proof clones", () => {
    expect(() =>
      verifyRealBuildPrefix50Step41SourceRepair(
        input({ reviewedPanelFaceFixture: { ...REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE } }),
      ),
    ).toThrow(/exact closed page-44 fixture fields/u);
    expect(() =>
      verifyRealBuildPrefix50Step41SourceRepair(input({ projectionReader: { ...reader } })),
    ).toThrow(/opaque current prefix-50 projection reader|reader minted from/u);
    expect(() => requireRealBuildPrefix50Step41SourceRepairProof({ ...proof })).toThrow(
      /caller clones carry no authority/u,
    );
  });
});
