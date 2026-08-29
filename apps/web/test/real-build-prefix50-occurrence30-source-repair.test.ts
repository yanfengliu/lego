import { readFileSync } from "node:fs";

import { PROPER_ORIENTATIONS } from "@lego-studio/catalog";
import {
  composeRigidTransforms,
  createEmptyBrickDocument,
  createPartInstance,
  findCatalogCollisions,
} from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  __testOnly,
  requireRealBuildPrefix50Occurrence30SourceRepairProof,
  verifyRealBuildPrefix50Occurrence30SourceRepair,
} from "../e2e/real-build-prefix50-occurrence30-source-repair";
import { enumeratePlacements } from "../src/assembly/enumerate-placements";

const OFFICIAL_MODEL_PATH = "output/official-model/vx1087034_21066_a.xml";
const BUILDER_GEOMETRY_PATH = "output/real-build/builder-shell-geometry.bin";
const RECONCILIATION_PATH = "output/real-build/prefix50-official-world-reconciliation.json";
const GAUGE = { positionLdu: [-560, 12, 194] as const, orientationId: "upright-yaw-0" };

function proof() {
  return verifyRealBuildPrefix50Occurrence30SourceRepair({
    officialModelBytes: readFileSync(OFFICIAL_MODEL_PATH),
    builderGeometryBundleBytes: readFileSync(BUILDER_GEOMETRY_PATH),
  });
}

describe("prefix-50 occurrence-30 opaque source repair", () => {
  it("derives the exact single-Bone Builder world from committed source pins", () => {
    const verified = proof();
    const evidence = requireRealBuildPrefix50Occurrence30SourceRepairProof(verified);

    expect(evidence).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair-evidence/1",
      officialModelDigest: __testOnly.expectedEvidence.officialModelDigest,
      occurrenceOrdinal: 30,
      printedStepNumber: 14,
      brickRef: __testOnly.expectedEvidence.brickRef,
      partRef: __testOnly.expectedEvidence.partRef,
      boneRef: __testOnly.expectedEvidence.boneRef,
      boneCount: 1,
      designRevision: "77844;B",
      catalogPartId: "builtin:corner-plate-3x3",
      rawBoneTransformDigest: __testOnly.expectedEvidence.rawBoneTransformDigest,
      sourcePinTrustedDigest: __testOnly.expectedEvidence.sourcePinTrustedDigest,
      sourcePinCommitments: __testOnly.expectedEvidence.sourcePinCommitments,
      frameCandidateCount: 1,
      frameEquivalenceClassCount: 1,
      catalogToBuilderLocalTransform: {
        positionLdu: [40, -4, 0],
        orientationId: "upright-yaw-180",
      },
      builderWorldTransform: {
        positionLdu: [50, 0, -344],
        orientationId: "upright-yaw-180",
      },
      repairedSourceWorldTransform: {
        positionLdu: [10, -4, -344],
        orientationId: "upright-yaw-0",
      },
    });
    expect(Object.isFrozen(verified)).toBe(true);
    expect(Object.isFrozen(evidence)).toBe(true);
  });

  it("rejects cloned, serialized, caller-shaped, and wrong-byte proof inputs", () => {
    const verified = proof();
    expect(() => requireRealBuildPrefix50Occurrence30SourceRepairProof({ ...verified })).toThrow(
      /opaque proof/u,
    );
    expect(() =>
      requireRealBuildPrefix50Occurrence30SourceRepairProof(JSON.parse(JSON.stringify(verified))),
    ).toThrow(/opaque proof/u);
    expect(() =>
      requireRealBuildPrefix50Occurrence30SourceRepairProof({
        schemaVersion: "lego.real-build-prefix50-occurrence30-source-repair-proof/1",
      }),
    ).toThrow(/caller-shaped/u);

    const changedXml = readFileSync(OFFICIAL_MODEL_PATH);
    changedXml[changedXml.length - 1] = changedXml[changedXml.length - 1]! ^ 1;
    expect(() =>
      verifyRealBuildPrefix50Occurrence30SourceRepair({
        officialModelBytes: changedXml,
        builderGeometryBundleBytes: readFileSync(BUILDER_GEOMETRY_PATH),
      }),
    ).toThrow(/exact official XML/u);

    const changedGeometry = readFileSync(BUILDER_GEOMETRY_PATH);
    changedGeometry[0] = changedGeometry[0]! ^ 1;
    expect(() =>
      verifyRealBuildPrefix50Occurrence30SourceRepair({
        officialModelBytes: readFileSync(OFFICIAL_MODEL_PATH),
        builderGeometryBundleBytes: changedGeometry,
      }),
    ).toThrow(/exact Builder geometry bundle/u);
  });

  it("refuses wrong identity, retained pose, every other orientation, and one-LDU frame drift", () => {
    const evidence = requireRealBuildPrefix50Occurrence30SourceRepairProof(proof());
    const changed = (patch: object) => ({ ...evidence, ...patch });
    for (const [name, value] of [
      ["brickRef", "wrong-brick"],
      ["partRef", "wrong-part"],
      ["boneRef", "wrong-bone"],
      ["designRevision", "77844;wrong"],
      ["rawBoneTransformDigest", `sha256:${"0".repeat(64)}`],
    ] as const) {
      expect(() => __testOnly.requireExactEvidence(changed({ [name]: value }))).toThrow(
        /exact official XML identity/u,
      );
    }
    expect(() =>
      __testOnly.requireExactEvidence(
        changed({
          repairedSourceWorldTransform: {
            positionLdu: [30, -4, -364],
            orientationId: "upright-yaw-0",
          },
        }),
      ),
    ).toThrow(/unique fresh frame/u);

    for (const orientation of PROPER_ORIENTATIONS) {
      if (orientation.id === "upright-yaw-180") continue;
      expect(() =>
        __testOnly.requireExactEvidence(
          changed({
            catalogToBuilderLocalTransform: {
              positionLdu: [40, -4, 0],
              orientationId: orientation.id,
            },
          }),
        ),
      ).toThrow(/unique fresh frame/u);
    }
    for (const axis of [0, 1, 2] as const) {
      for (const delta of [-1, 1] as const) {
        const position = [40, -4, 0] as [number, number, number];
        position[axis] += delta;
        expect(() =>
          __testOnly.requireExactEvidence(
            changed({
              catalogToBuilderLocalTransform: {
                positionLdu: position,
                orientationId: "upright-yaw-180",
              },
            }),
          ),
        ).toThrow(/unique fresh frame/u);
      }
    }
  });

  it("finds the repaired pose with five exact seats and keeps third bodies collision-free", () => {
    const reconciliation = JSON.parse(readFileSync(RECONCILIATION_PATH, "utf8")) as {
      rows: Array<{
        sourceBuilderIdentityOrdinal: number;
        catalogPartId: string;
        catalogColorId: string;
        catalogWorldTransform: {
          positionLdu: [number, number, number];
          orientationId: string;
        };
      }>;
    };
    const rowByOrdinal = new Map(
      reconciliation.rows.map((row) => [row.sourceBuilderIdentityOrdinal, row]),
    );
    const part = (
      ordinal: number,
      transform = composeRigidTransforms(GAUGE, rowByOrdinal.get(ordinal)!.catalogWorldTransform),
    ) => {
      const row = rowByOrdinal.get(ordinal)!;
      return createPartInstance({
        id: `occurrence-${ordinal}`,
        catalogPartId: row.catalogPartId,
        colorId: row.catalogColorId,
        transform,
      });
    };
    const baseParts = [...Array.from({ length: 29 }, (_, index) => index + 1), 31].map((ordinal) =>
      part(ordinal),
    );
    const base = {
      ...createEmptyBrickDocument({ id: "occurrence30-enumeration", name: "Occurrence 30" }),
      parts: baseParts,
    };
    const repairedTarget = {
      positionLdu: [-550, 8, -150] as [number, number, number],
      orientationId: "upright-yaw-0",
    };
    const enumeration = enumeratePlacements(base, "builtin:corner-plate-3x3", {
      maxDistinctTransforms: 200_000,
    });
    const candidate = enumeration.candidates.find(
      ({ transform }) => JSON.stringify(transform) === JSON.stringify(repairedTarget),
    );
    expect(candidate).toBeDefined();
    const receiverConnections = candidate!.connections.filter(
      ({ targetPartId }) => targetPartId === "occurrence-31",
    );
    expect(
      receiverConnections
        .map(({ candidatePortId, targetPortId }) => [candidatePortId, targetPortId] as const)
        .sort(([left], [right]) => left.localeCompare(right)),
    ).toEqual([
      ["stud:0", "undersideClutch:0:5"],
      ["stud:1", "undersideClutch:1:5"],
      ["stud:2", "undersideClutch:2:5"],
      ["stud:3", "undersideClutch:0:4"],
      ["stud:4", "undersideClutch:0:3"],
    ]);
    expect(new Set(receiverConnections.map(({ candidatePortId }) => candidatePortId)).size).toBe(5);
    expect(new Set(receiverConnections.map(({ targetPortId }) => targetPortId)).size).toBe(5);

    const repaired = part(30, repairedTarget);
    const future147 = part(147);
    expect(findCatalogCollisions([repaired, future147], [])).toEqual([]);
    const retained = part(30);
    expect(findCatalogCollisions([retained, future147], []).length).toBeGreaterThan(0);
  });
});
