import { beforeAll, describe, expect, it } from "vitest";

// @ts-expect-error Opaque verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50ActionPreparation } from "../../../scripts/part-identification-prefix50-action-preparation.mjs";
// @ts-expect-error Opaque verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error Opaque verifier intentionally has no caller-facing TS surface.
import { verifyPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error Current ignored-evidence producer intentionally has no caller-facing TS surface.
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation-current.mjs";
// @ts-expect-error Current ignored-evidence verifier intentionally has no caller-facing TS surface.
import { verifyCurrentPrefix50StructuralEvents } from "../../../scripts/part-identification-prefix50-structural-events-current.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import {
  readRealBuildPrefix50VerifiedProjection,
  type RealBuildPrefix50ProjectionOccurrence,
  type RealBuildPrefix50VerifiedProjection,
  type RealBuildPrefix50VerifiedProjectionReader,
} from "../e2e/real-build-prefix50-projection";
import { REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE } from "../e2e/real-build-prefix50-step41-panel-face-fixture";
import { verifyRealBuildPrefix50Step41SourceRepair } from "../e2e/real-build-prefix50-step41-source-repair";
import type { RealBuildPrefix50Step41SourceRepairProof } from "../e2e/real-build-prefix50-step41-source-repair-contract";
import { REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE } from "../e2e/real-build-prefix50-step42-panel-face-fixture";
import {
  REAL_BUILD_PREFIX50_STEP42_PREFLIGHT_ROWS,
  preflightRealBuildPrefix50Step42SourceRepair,
} from "../e2e/real-build-prefix50-step42-source-repair-preflight";
import {
  requireRealBuildPrefix50Step42SourceRepairProof,
  verifyRealBuildPrefix50Step42SourceRepair,
} from "../e2e/real-build-prefix50-step42-source-repair";
import type {
  RealBuildPrefix50Step42SourceRepairEvidence,
  RealBuildPrefix50Step42SourceRepairInput,
  RealBuildPrefix50Step42SourceRepairProof,
} from "../e2e/real-build-prefix50-step42-source-repair-contract";

let reader: RealBuildPrefix50VerifiedProjectionReader;
let projection: RealBuildPrefix50VerifiedProjection;
let sourceRows: readonly RealBuildPrefix50ProjectionOccurrence[];
let step41Proof: RealBuildPrefix50Step41SourceRepairProof;
let proof: RealBuildPrefix50Step42SourceRepairProof;
let opaqueEvidence: RealBuildPrefix50Step42SourceRepairEvidence;

function opaqueInput(
  overrides: Partial<RealBuildPrefix50Step42SourceRepairInput> = {},
): RealBuildPrefix50Step42SourceRepairInput {
  return {
    projectionReader: reader,
    reviewedPanelFaceFixture: REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE,
    sourceRows,
    step41SourceRepairProof: step41Proof,
    ...overrides,
  };
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
  step41Proof = verifyRealBuildPrefix50Step41SourceRepair({
    projectionReader: reader,
    reviewedPanelFaceFixture: REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE,
    sourceRows: projection.occurrences.slice(265, 273),
  });
  sourceRows = projection.occurrences.slice(257, 274);
  proof = verifyRealBuildPrefix50Step42SourceRepair(opaqueInput());
  opaqueEvidence = requireRealBuildPrefix50Step42SourceRepairProof(proof);
}, 180_000);

describe("prefix-50 Step-42 occurrence-274 focused preflight", () => {
  it("reproduces the raw 0/13 blocker before proving one canonical reciprocal repair", () => {
    const evidence = preflightRealBuildPrefix50Step42SourceRepair(
      REAL_BUILD_PREFIX50_STEP42_PREFLIGHT_ROWS,
    );
    expect(evidence).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step42-preflight-evidence/1",
      authority: "none",
      catalogVersion: "builtin.basic-parts/30",
      catalogSnapshotHash:
        "sha256:a030be3e20eeb1592594c43e321be64ac2f84875c40ad2445c48ca9e104ef290",
      truthSnapshotHash: "sha256:c304c3eb673e86d48580c6b28309f1fdf8bf4d71f7259ecc75f6f5691a336d51",
      preRepairDocumentHash:
        "sha256:6af1f3fa9af4d272e3ad634bb533cdb81ab6937ab7f68f5254cdd23f82ffb1e1",
      postRepairDocumentHash:
        "sha256:337a8e5fd7c80810b1ff86b236b59b7801fc490eff8018ca2fa42c03dee4d238",
      exactChildPartCount: 16,
      exactChildConnectionCount: 28,
      exactChildBlockingIssueCount: 0,
      rawSourceTransform: {
        positionLdu: [400, -98, -110],
        orientationId: "proper-m-00nn000p0",
      },
      rawSeededConnectionCount: 2,
      rawConnectedCollisionPartOrdinals: [267, 268],
      rawConnectedCollisionFindingCodes: ["PART_BODY_COLLISION", "PART_BODY_COLLISION"],
      rawUnconnectedStudCollisionPartOrdinals: [264, 265],
      rawRosterCounts: {
        rawSeeds: 24,
        distinctTransforms: 13,
        rejectedColliding: 13,
        accepted: 0,
      },
      completeOrientationCount: 24,
      completeRawSeeds: 288,
      completeAcceptedLabelCount: 98,
      completeAcceptedOccupancyCount: 49,
      panelFacePhysicalOccupancyClassCount: 1,
      equivalentOrientationIds: ["proper-m-00n0n0n00", "proper-m-00p0n0p00"],
      repairedSourceTransform: {
        positionLdu: [400, -72, -108],
        orientationId: "proper-m-00n0n0n00",
      },
      repairedOccupancyKey: "340,-76,-118|460,-68,-98",
      reciprocalExactReceiverCount: 2,
      repairedConnectedCollisionFindingCount: 0,
      repairedChildPartCount: 17,
      repairedChildConnectionCount: 32,
      repairedChildBlockingIssueCount: 0,
    });
    expect(evidence.canonicalConnections).toEqual([
      {
        receiverOrdinal: 270,
        receiverPortId: "stud:0",
        candidatePortId: "undersideClutch:0:0",
        connectionKind: "stud-tube",
      },
      {
        receiverOrdinal: 270,
        receiverPortId: "stud:1",
        candidatePortId: "undersideClutch:0:1",
        connectionKind: "stud-tube",
      },
      {
        receiverOrdinal: 273,
        receiverPortId: "stud:0",
        candidatePortId: "undersideClutch:0:3",
        connectionKind: "stud-tube",
      },
      {
        receiverOrdinal: 273,
        receiverPortId: "stud:1",
        candidatePortId: "undersideClutch:0:4",
        connectionKind: "stud-tube",
      },
    ]);
    expect(evidence.equivalentConnections).toEqual([
      {
        receiverOrdinal: 270,
        receiverPortId: "stud:0",
        candidatePortId: "undersideClutch:0:5",
        connectionKind: "stud-tube",
      },
      {
        receiverOrdinal: 270,
        receiverPortId: "stud:1",
        candidatePortId: "undersideClutch:0:4",
        connectionKind: "stud-tube",
      },
      {
        receiverOrdinal: 273,
        receiverPortId: "stud:0",
        candidatePortId: "undersideClutch:0:2",
        connectionKind: "stud-tube",
      },
      {
        receiverOrdinal: 273,
        receiverPortId: "stud:1",
        candidatePortId: "undersideClutch:0:1",
        connectionKind: "stud-tube",
      },
    ]);
    expect(evidence.rawAndOlderRefusedOccupancyKey).toBe("340,-108,-114|460,-88,-106");
    expect(evidence.exactPhysicalLayerCommitments.raw).toEqual(
      evidence.exactPhysicalLayerCommitments.olderRefused,
    );
    expect(evidence.exactPhysicalLayerCommitments.canonical).toEqual(
      evidence.exactPhysicalLayerCommitments.equivalent,
    );
    expect(evidence.exactPhysicalLayerCommitments.canonical).toEqual({
      connectors: "sha256:057d43d55d28c54d8b5e7697d500ac6b88584bd1b718b4fc9dae90d9a7457c61",
      collision: "sha256:63b3f7a87d0fa8e40c39ab1120a9a3642a1a2e213960b44864ff37102038e7f2",
      allowances: "sha256:39ebdb00c763dba78c3b74260c04bd92189744c0ae3888555f445f3b2e84159c",
      geometry: "sha256:ed29d79a064b35b59c3a5fde9749e6e1e2ee08b88aa8e216848abbe66e6ad088",
    });
    expect(evidence.repairCommitment).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Object.isFrozen(evidence)).toBe(true);
  });

  it("refuses a one-LDU change instead of moving the expected assertion", () => {
    const changed = REAL_BUILD_PREFIX50_STEP42_PREFLIGHT_ROWS.map((row, index) =>
      index === 16
        ? {
            ...row,
            sourceWorldTransform: {
              ...row.sourceWorldTransform,
              positionLdu: [401, -98, -110] as [number, number, number],
            },
          }
        : row,
    );

    expect(() => preflightRealBuildPrefix50Step42SourceRepair(changed)).toThrow(
      /exact repaired-child rows 258\.\.273 plus raw row 274/u,
    );
  });
});

describe("prefix-50 Step-42 occurrence-274 opaque source proof", () => {
  it("binds the exact action, panel fixture, predecessor proof, truth, and structural hashes", () => {
    expect(opaqueEvidence).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step42-source-repair-evidence/1",
      authority: "none",
      printedStepNumber: 42,
      phaseSequence: 68,
      occurrenceOrdinal: 274,
      panelPageNumber: 44,
      lookaheadPageNumber: 45,
      rawSourceTransformsPreserved: true,
      catalogTruthClaimed: false,
      placementAuthority: false,
      catalogVersion: "builtin.basic-parts/30",
      catalogSnapshotHash:
        "sha256:a030be3e20eeb1592594c43e321be64ac2f84875c40ad2445c48ca9e104ef290",
      truthSnapshotHash: "sha256:c304c3eb673e86d48580c6b28309f1fdf8bf4d71f7259ecc75f6f5691a336d51",
      preRepairDocumentHash:
        "sha256:6af1f3fa9af4d272e3ad634bb533cdb81ab6937ab7f68f5254cdd23f82ffb1e1",
      postRepairDocumentHash:
        "sha256:337a8e5fd7c80810b1ff86b236b59b7801fc490eff8018ca2fa42c03dee4d238",
    });
    expect(opaqueEvidence.step41RepairCommitment).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(opaqueEvidence.repairCommitment).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Object.isFrozen(opaqueEvidence)).toBe(true);
  });

  it("refuses mutated inputs, predecessor/proof clones, accessors, and extras", () => {
    expect(() =>
      verifyRealBuildPrefix50Step42SourceRepair(
        opaqueInput({
          sourceRows: sourceRows.map((row, index) => (index === 16 ? { ...row } : row)),
        }),
      ),
    ).toThrow(/exact projection identity/u);
    expect(() =>
      verifyRealBuildPrefix50Step42SourceRepair(
        opaqueInput({
          reviewedPanelFaceFixture: { ...REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE },
        }),
      ),
    ).toThrow(/caller clones carry no authority/u);
    expect(() =>
      verifyRealBuildPrefix50Step42SourceRepair(
        opaqueInput({ step41SourceRepairProof: { ...step41Proof } }),
      ),
    ).toThrow(/opaque proof/u);
    expect(() => requireRealBuildPrefix50Step42SourceRepairProof({ ...proof })).toThrow(
      /caller clones carry no authority/u,
    );
    expect(() =>
      verifyRealBuildPrefix50Step42SourceRepair({ ...opaqueInput(), extra: true } as never),
    ).toThrow(/must contain exactly/u);
    const accessorInput = { ...opaqueInput() } as Record<string, unknown>;
    Object.defineProperty(accessorInput, "sourceRows", {
      enumerable: true,
      get: () => sourceRows,
    });
    expect(() => verifyRealBuildPrefix50Step42SourceRepair(accessorInput as never)).toThrow(
      /own data property/u,
    );
  });
});
