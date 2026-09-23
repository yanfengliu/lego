import { deepFreeze } from "@lego-studio/brick-kernel";
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
  readRealBuildPrefix50Step43ActionBinding,
  readRealBuildPrefix50VerifiedProjection,
  type RealBuildPrefix50ProjectionOccurrence,
  type RealBuildPrefix50VerifiedProjection,
  type RealBuildPrefix50VerifiedProjectionReader,
} from "../e2e/real-build-prefix50-projection";
import { REAL_BUILD_PREFIX50_STEP41_PANEL_FACE_FIXTURE } from "../e2e/real-build-prefix50-step41-panel-face-fixture";
import { verifyRealBuildPrefix50Step41SourceRepair } from "../e2e/real-build-prefix50-step41-source-repair";
import type { RealBuildPrefix50Step41SourceRepairProof } from "../e2e/real-build-prefix50-step41-source-repair-contract";
import { REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE } from "../e2e/real-build-prefix50-step42-43-panel-fixture";
import { REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE } from "../e2e/real-build-prefix50-step42-panel-face-fixture";
import {
  applyRealBuildPrefix50Step42_43SourceRepair,
  requireRealBuildPrefix50Step42_43SourceRepairProposal,
  type RealBuildPrefix50Step42_43PredecessorProofs,
} from "../e2e/real-build-prefix50-step42-43-source-repair-application";
import type {
  RealBuildPrefix50Step42_43SourceRepairEvidence,
  RealBuildPrefix50Step42_43SourceRepairInput,
  RealBuildPrefix50Step42_43SourceRepairProof,
} from "../e2e/real-build-prefix50-step42-43-source-repair-contract";
import {
  __testOnly,
  requireRealBuildPrefix50Step42_43SourceRepairProof,
  verifyRealBuildPrefix50Step42_43SourceRepair,
} from "../e2e/real-build-prefix50-step42-43-source-repair";
import { verifyRealBuildPrefix50Step42SourceRepair } from "../e2e/real-build-prefix50-step42-source-repair";
import type { RealBuildPrefix50Step42SourceRepairProof } from "../e2e/real-build-prefix50-step42-source-repair-contract";

let reader: RealBuildPrefix50VerifiedProjectionReader;
let projection: RealBuildPrefix50VerifiedProjection;
let sourceRows: readonly RealBuildPrefix50ProjectionOccurrence[];
let step41Proof: RealBuildPrefix50Step41SourceRepairProof;
let step42Proof: RealBuildPrefix50Step42SourceRepairProof;
let proof: RealBuildPrefix50Step42_43SourceRepairProof;
let evidence: RealBuildPrefix50Step42_43SourceRepairEvidence;

function input(
  overrides: Partial<RealBuildPrefix50Step42_43SourceRepairInput> = {},
): RealBuildPrefix50Step42_43SourceRepairInput {
  return {
    projectionReader: reader,
    reviewedPanelFixture: REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE,
    sourceRows,
    step41SourceRepairProof: step41Proof,
    step42SourceRepairProof: step42Proof,
    ...overrides,
  };
}

function predecessorProofs(): RealBuildPrefix50Step42_43PredecessorProofs {
  return {
    step41SourceRepairProof: step41Proof,
    step42SourceRepairProof: step42Proof,
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
  step42Proof = verifyRealBuildPrefix50Step42SourceRepair({
    projectionReader: reader,
    reviewedPanelFaceFixture: REAL_BUILD_PREFIX50_STEP42_PANEL_FACE_FIXTURE,
    sourceRows: projection.occurrences.slice(257, 274),
    step41SourceRepairProof: step41Proof,
  });
  sourceRows = projection.occurrences.slice(257, 280);
  proof = verifyRealBuildPrefix50Step42_43SourceRepair(input());
  evidence = requireRealBuildPrefix50Step42_43SourceRepairProof(proof);
}, 180_000);

describe("prefix-50 late Step-42/43 opaque source repair", () => {
  it("binds all three Step-43 phases and reviewed page-44 callouts", () => {
    const binding = readRealBuildPrefix50Step43ActionBinding(reader);
    expect(binding).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step43-action-binding/1",
      sourceSetId: "6651557",
      sourcePdfDigest: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
      stepActionDigest: "sha256:1183e81bf3933f7f49f6ec12d6684b48230606ffbbdbb2fd652223eded4bc46c",
      printedStepNumber: 43,
      subBuildPath: [
        "7004cf0d-d97f-4b0d-8572-970e23815c05",
        "2956f76b-0e29-497c-84ae-d8bd9099aa3f",
      ],
    });
    expect(binding.phases.map(({ sequence }) => sequence)).toEqual([69, 70, 71]);
    expect(binding.lateStep42.callouts.map(({ identity }) => identity)).toEqual([
      "p44|q1|x23.093|y227.599",
      "p44|q1|x53.989|y227.599",
    ]);
    expect(
      binding.phases.flatMap(({ members }) =>
        members.map(({ occurrenceOrdinal }) => occurrenceOrdinal),
      ),
    ).toEqual([277, 278, 279, 280]);
    expect(binding.callouts.map(({ identity }) => identity)).toEqual([
      "p44|q1|x404.189|y491.335",
      "p44|q1|x443.424|y491.335",
      "p44|q2|x499.460|y491.335",
    ]);
    expect(Object.isFrozen(binding)).toBe(true);
  });

  it("proves exact poses, reciprocal ports, exhaustive labels, and the terminal child", () => {
    expect(evidence).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step42-43-source-repair-evidence/1",
      authority: "none",
      physicalPageNumber: 44,
      lookaheadPhysicalPageNumber: 45,
      rawSourceTransformsPreserved: true,
      exhaustiveOrientationEnumeration: true,
      catalogTruthClaimed: false,
      placementAuthority: false,
      collisionOrEnumerationWaiver: false,
      terminalPartCount: 23,
      terminalConnectionCount: 46,
      terminalCollisionFindingCount: 0,
      terminalBlockingIssueCount: 0,
      terminalReciprocalConnectionCount: 14,
      catalogVersion: "builtin.basic-parts/30",
      catalogSnapshotHash:
        "sha256:a030be3e20eeb1592594c43e321be64ac2f84875c40ad2445c48ca9e104ef290",
      truthSnapshotHash: "sha256:c304c3eb673e86d48580c6b28309f1fdf8bf4d71f7259ecc75f6f5691a336d51",
      predecessorDocumentHash:
        "sha256:337a8e5fd7c80810b1ff86b236b59b7801fc490eff8018ca2fa42c03dee4d238",
      terminalDocumentHash:
        "sha256:df9d06b7eb8a9eb6011bef529e3a60f2f45def19507e8781b86d3bba21ec7f54",
    });
    expect(evidence.rows.map(({ ordinal }) => ordinal)).toEqual([275, 276, 277, 278, 279, 280]);
    expect(
      evidence.rows.map(({ repairedSourceWorldTransform }) => repairedSourceWorldTransform),
    ).toEqual([
      { positionLdu: [240, -72, -108], orientationId: "proper-m-00n0n0n00" },
      { positionLdu: [300, -72, -108], orientationId: "proper-m-00n0n0n00" },
      { positionLdu: [300, -64, -108], orientationId: "proper-m-00n0n0n00" },
      { positionLdu: [320, -48, -108], orientationId: "proper-m-00n0n0n00" },
      { positionLdu: [280, -48, -108], orientationId: "proper-m-00p0n0p00" },
      { positionLdu: [300, -32, -108], orientationId: "proper-m-00n0n0n00" },
    ]);
    expect(evidence.rows.map(({ selectedConnections }) => selectedConnections.length)).toEqual([
      2, 2, 4, 2, 2, 2,
    ]);
    expect(evidence.rows.map(({ symmetryOccupancyRelation }) => symmetryOccupancyRelation)).toEqual(
      [
        "same-physical-occupancy",
        "same-physical-occupancy",
        "same-physical-occupancy",
        "distinct-facing-occupancy",
        "distinct-facing-occupancy",
        "same-physical-occupancy",
      ],
    );
    expect(evidence.reviewedNonUprightOrientationLabelsByPartId).toEqual({
      "builtin:tile-1x2": ["proper-m-00n0n0n00"],
      "builtin:plate-1x4": ["proper-m-00n0n0n00"],
      "builtin:slope-1x2-45": ["proper-m-00n0n0n00", "proper-m-00p0n0p00"],
    });
    expect(evidence.repairCommitment).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(Object.isFrozen(evidence.rows[0]!.sourceXAcceptedCandidates)).toBe(true);
    console.log(
      "STEP42_43_ENUMERATION_COUNTS",
      JSON.stringify({
        rows: evidence.rows.map(({ ordinal, rawSeedCount, distinctTransformCount }) => ({
          ordinal,
          rawSeedCount,
          distinctTransformCount,
        })),
        terminalConnectorCapacityClaimCount: evidence.terminalConnectorCapacityClaimCount,
      }),
    );
  });

  it("applies only six transforms while preserving reviewed prior overlays", () => {
    const priorTransforms = new Map<
      number,
      RealBuildPrefix50ProjectionOccurrence["sourceWorldTransform"]
    >([
      [270, { positionLdu: [440, -80, -108], orientationId: "proper-m-00n0n0n00" }],
      [271, { positionLdu: [240, -80, -108], orientationId: "proper-m-00n0n0n00" }],
      [272, { positionLdu: [300, -80, -108], orientationId: "proper-m-00n0n0n00" }],
      [273, { positionLdu: [380, -80, -108], orientationId: "proper-m-00n0n0n00" }],
      [274, { positionLdu: [400, -72, -108], orientationId: "proper-m-00n0n0n00" }],
      [281, { positionLdu: [410, -118, -96], orientationId: "proper-m-00pp000p0" }],
      [282, { positionLdu: [270, -118, -96], orientationId: "proper-m-00pp000p0" }],
      [283, { positionLdu: [340, -118, -96], orientationId: "proper-m-00pp000p0" }],
    ]);
    const computation = deepFreeze({
      ...projection,
      occurrences: projection.occurrences.map((row) =>
        priorTransforms.has(row.ordinal)
          ? { ...row, sourceWorldTransform: priorTransforms.get(row.ordinal)! }
          : row,
      ),
    });
    const applied = applyRealBuildPrefix50Step42_43SourceRepair(
      projection,
      computation,
      predecessorProofs(),
      proof,
    );
    expect(applied.proposal).toMatchObject({
      authority: "none",
      occurrenceOrdinals: [275, 276, 277, 278, 279, 280],
    });
    expect(requireRealBuildPrefix50Step42_43SourceRepairProposal(applied.proposal)).toBe(
      applied.proposal,
    );
    expect(() =>
      requireRealBuildPrefix50Step42_43SourceRepairProposal({ ...applied.proposal }),
    ).toThrow(/clones and caller proposals are forbidden/u);
    for (const ordinal of [270, 271, 272, 273, 274, 281, 282, 283]) {
      expect(applied.projection.occurrences[ordinal - 1]!.sourceWorldTransform).toEqual(
        priorTransforms.get(ordinal),
      );
    }
    expect(applied.projection.occurrences[280]!.sourceWorldTransform).toBe(
      computation.occurrences[280]!.sourceWorldTransform,
    );
  });

  it("rejects source, fixture, proof, enumeration, and overlapping-overlay clones", () => {
    expect(() =>
      verifyRealBuildPrefix50Step42_43SourceRepair(
        input({ sourceRows: sourceRows.map((row, index) => (index === 0 ? { ...row } : row)) }),
      ),
    ).toThrow(/exact opaque rows/u);
    expect(() =>
      verifyRealBuildPrefix50Step42_43SourceRepair(
        input({ reviewedPanelFixture: { ...REAL_BUILD_PREFIX50_STEP42_43_PANEL_FIXTURE } }),
      ),
    ).toThrow(/exact causally bound page-44\/45 fixture/u);
    expect(() =>
      verifyRealBuildPrefix50Step42_43SourceRepair(
        input({ step41SourceRepairProof: { ...step41Proof } }),
      ),
    ).toThrow(/opaque proof/u);
    expect(() =>
      verifyRealBuildPrefix50Step42_43SourceRepair(
        input({ step42SourceRepairProof: { ...step42Proof } }),
      ),
    ).toThrow(/opaque proof/u);
    expect(() => requireRealBuildPrefix50Step42_43SourceRepairProof({ ...proof })).toThrow(
      /caller clones carry no authority/u,
    );
    const verifyMutation = __testOnly.verifyWithEnumerationMutation!;
    expect(() =>
      verifyMutation(
        input(),
        (value) =>
          ({
            ...value,
            rows: value.rows.map((row, index) =>
              index === 0
                ? {
                    ...row,
                    selectedConnections: row.selectedConnections.map((connection, portIndex) =>
                      portIndex === 0
                        ? { ...connection, candidatePortId: "forged-port" }
                        : connection,
                    ),
                  }
                : row,
            ),
          }) as typeof value,
      ),
    ).toThrow(/exhaustive pose evidence/u);
    expect(() =>
      verifyMutation(
        input(),
        (value) =>
          ({
            ...value,
            rows: value.rows.map((row, index) =>
              index === 0
                ? {
                    ...row,
                    rawCollisionFindings: row.rawCollisionFindings.map((finding) => ({
                      ...finding,
                      counterpartOrdinals: [269],
                    })),
                  }
                : row,
            ),
          }) as typeof value,
      ),
    ).toThrow(/exhaustive pose evidence/u);
    expect(() =>
      applyRealBuildPrefix50Step42_43SourceRepair(
        projection,
        projection,
        predecessorProofs(),
        proof,
      ),
    ).toThrow(/unproved occurrence 270/u);
    const exactPriorTransforms = new Map<
      number,
      RealBuildPrefix50ProjectionOccurrence["sourceWorldTransform"]
    >([
      [270, { positionLdu: [440, -80, -108], orientationId: "proper-m-00n0n0n00" }],
      [271, { positionLdu: [240, -80, -108], orientationId: "proper-m-00n0n0n00" }],
      [272, { positionLdu: [300, -80, -108], orientationId: "proper-m-00n0n0n00" }],
      [273, { positionLdu: [380, -80, -108], orientationId: "proper-m-00n0n0n00" }],
      [274, { positionLdu: [400, -72, -108], orientationId: "proper-m-00n0n0n00" }],
      [281, { positionLdu: [410, -118, -96], orientationId: "proper-m-00pp000p0" }],
      [282, { positionLdu: [270, -118, -96], orientationId: "proper-m-00pp000p0" }],
      [283, { positionLdu: [340, -118, -96], orientationId: "proper-m-00pp000p0" }],
    ] as const);
    const exactComputation = deepFreeze({
      ...projection,
      occurrences: projection.occurrences.map((row) =>
        exactPriorTransforms.has(row.ordinal)
          ? { ...row, sourceWorldTransform: exactPriorTransforms.get(row.ordinal)! }
          : row,
      ),
    });
    expect(() =>
      applyRealBuildPrefix50Step42_43SourceRepair(
        projection,
        { ...exactComputation, extra: true } as never,
        predecessorProofs(),
        proof,
      ),
    ).toThrow(/must contain exactly inert data fields/u);
    expect(() =>
      applyRealBuildPrefix50Step42_43SourceRepair(
        projection,
        exactComputation,
        { ...predecessorProofs(), extra: true } as never,
        proof,
      ),
    ).toThrow(/must contain exactly inert data fields/u);
    expect(() =>
      applyRealBuildPrefix50Step42_43SourceRepair(
        projection,
        exactComputation,
        {
          ...predecessorProofs(),
          step42SourceRepairProof: { ...step42Proof },
        },
        proof,
      ),
    ).toThrow(/opaque proof/u);
    const overlap = deepFreeze({
      ...exactComputation,
      occurrences: exactComputation.occurrences.map((row) =>
        row.ordinal === 275
          ? {
              ...row,
              sourceWorldTransform: {
                ...row.sourceWorldTransform,
                positionLdu: [241, -98, -110] as const,
              },
            }
          : row,
      ),
    });
    expect(() =>
      applyRealBuildPrefix50Step42_43SourceRepair(projection, overlap, predecessorProofs(), proof),
    ).toThrow(/overlapping or unproved occurrence 275/u);
  }, 40_000);
});
