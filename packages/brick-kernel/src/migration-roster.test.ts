import type { BrickDocumentV1, ConnectionEdge } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { canonicalDigest } from "./canonical.ts";
import { createPartInstance } from "./factory.ts";
import {
  REVIEWED_TRUTHS_V4,
  REVIEWED_TRUTH_V1,
  documentAtReviewedTruth,
} from "./migration-historical-fixtures.test-support.ts";
import { migrateDocumentTruth } from "./migration.ts";
import { validateBrickDocument } from "./validation.ts";

function withPartsAndConnection(
  base: BrickDocumentV1,
  parts: BrickDocumentV1["parts"],
  connection: ConnectionEdge,
  narrowConstraints = false,
): BrickDocumentV1 {
  const partIds = parts.map(({ id }) => id);
  return {
    ...base,
    parts,
    connections: [connection],
    submodels: [{ ...base.submodels[0]!, partIds }],
    steps: [{ ...base.steps[0]!, partIds }],
    ...(narrowConstraints
      ? {
          constraints: {
            ...base.constraints,
            allowedCatalogPartIds: parts.map(({ catalogPartId }) => catalogPartId),
            allowedColorIds: ["builtin:red"],
          },
        }
      : {}),
  };
}

describe("historical catalog roster migration", () => {
  it("refuses a current-valid color on an actual part when /1 truth did not define it", () => {
    const part = createPartInstance({
      id: "future-color-part",
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:dark-turquoise",
    });
    const forged = documentAtReviewedTruth({
      id: "v1-future-part-color",
      name: "Forged /1 part color",
      truth: REVIEWED_TRUTH_V1,
      part,
    });

    expect(canonicalDigest(forged.truth)).toBe(
      "sha256:0f6b9dcb03a9dd570b4ccc68f41a015bb33422e5cf6c1fe032f1a15bfbd76a8a",
    );
    const { document, report } = migrateDocumentTruth(forged);

    expect(document).toBe(forged);
    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toEqual([
      `Part future-color-part uses color builtin:dark-turquoise, which reviewed source truth ${report.fromTruthHash} (builtin.basic-parts/1) did not define; the color cannot be legitimized by migration`,
    ]);
  });

  it("refuses a current-valid color pre-seeded only in /1 caller constraints", () => {
    const historical = documentAtReviewedTruth({
      id: "v1-future-constraint-color",
      name: "Forged /1 constraint color",
      truth: REVIEWED_TRUTH_V1,
    });
    const forged: BrickDocumentV1 = {
      ...historical,
      constraints: {
        ...historical.constraints,
        allowedColorIds: [...historical.constraints.allowedColorIds, "builtin:dark-turquoise"],
      },
    };

    const { document, report } = migrateDocumentTruth(forged);

    expect(document).toBe(forged);
    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toEqual([
      `Document constraints allow color builtin:dark-turquoise, which reviewed source truth ${report.fromTruthHash} (builtin.basic-parts/1) did not define; remove the future ID or load the document under the truth that introduced it`,
    ]);
  });

  it.each([
    { rosterIndex: 0, partId: "builtin:wedge-plate-2x4-left", admitted: false },
    { rosterIndex: 1, partId: "builtin:wedge-plate-2x4-left", admitted: true },
    { rosterIndex: 1, partId: "builtin:technic-brick-1x2", admitted: false },
    { rosterIndex: 2, partId: "builtin:technic-brick-1x2", admitted: true },
  ] as const)(
    "selects reviewed /4 roster $rosterIndex by full truth hash for $partId",
    ({ rosterIndex, partId, admitted }) => {
      const reviewed = REVIEWED_TRUTHS_V4[rosterIndex]!;
      const part = createPartInstance({ id: "part", catalogPartId: partId });
      const historical = documentAtReviewedTruth({
        id: `v4-${rosterIndex}-${partId}`,
        name: "Shared-version roster",
        truth: reviewed.truth,
        part,
      });

      expect(canonicalDigest(historical.truth)).toBe(reviewed.truthHash);
      const { document, report } = migrateDocumentTruth(historical);

      expect(report.fromCatalogVersion).toBe("builtin.basic-parts/4");
      expect(report.fromTruthHash).toBe(reviewed.truthHash);
      expect(report.migrated).toBe(admitted);
      if (admitted) {
        expect(report.blockingReasons).toEqual([]);
        expect(validateBrickDocument(document).documentGloballyValid).toBe(true);
      } else {
        expect(document).toBe(historical);
        expect(report.blockingReasons).toContain(
          `Part part uses catalog part ${partId}, which reviewed source truth ${reviewed.truthHash} (builtin.basic-parts/4) did not define; the part cannot be legitimized by migration`,
        );
      }
    },
  );

  it("refuses a source-valid /4 connection whose endpoint semantics disappeared", () => {
    const reviewed = REVIEWED_TRUTHS_V4[1]!;
    const wedge = createPartInstance({
      id: "wedge",
      catalogPartId: "builtin:wedge-plate-2x4-left",
    });
    const plate = createPartInstance({
      id: "plate",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [10, 8, 10], orientationId: "upright-yaw-0" },
    });
    const connection: ConnectionEdge = {
      id: "historical-edge",
      kind: "stud-tube",
      a: { partId: wedge.id, portId: "undersideClutch:1:2" },
      b: { partId: plate.id, portId: "stud:0:0" },
      provenance: { source: "manual" },
    };
    const historicalBase = documentAtReviewedTruth({
      id: "v4-59-removed-port",
      name: "Source-valid removed endpoint",
      truth: reviewed.truth,
    });
    const historical = withPartsAndConnection(historicalBase, [wedge, plate], connection);

    expect(canonicalDigest(historical.truth)).toBe(reviewed.truthHash);
    const { document, report } = migrateDocumentTruth(historical);

    expect(document).toBe(historical);
    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Connection historical-edge endpoint wedge/undersideClutch:1:2 existed in reviewed source truth ${reviewed.truthHash} but current truth removes it; migration cannot preserve the edge`,
    );
  });

  it("migrates a stable endpoint on the same historical wedge without broad part rejection", () => {
    const reviewed = REVIEWED_TRUTHS_V4[1]!;
    const wedge = createPartInstance({
      id: "wedge",
      catalogPartId: "builtin:wedge-plate-2x4-left",
      colorId: "builtin:red",
    });
    const plate = createPartInstance({
      id: "plate",
      catalogPartId: "builtin:plate-1x1",
      colorId: "builtin:red",
      transform: { positionLdu: [10, 8, 30], orientationId: "upright-yaw-0" },
    });
    const base = documentAtReviewedTruth({
      id: "v4-59-stable-port",
      name: "Stable endpoint on changed part",
      truth: reviewed.truth,
    });
    const historical = withPartsAndConnection(
      base,
      [wedge, plate],
      {
        id: "stable-edge",
        kind: "stud-tube",
        a: { partId: wedge.id, portId: "undersideClutch:1:3" },
        b: { partId: plate.id, portId: "stud:0:0" },
        provenance: { source: "manual" },
      },
      true,
    );

    const { document, report } = migrateDocumentTruth(historical);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.addedCatalogPartIds).toHaveLength(89);
    expect(report.addedColorIds).toHaveLength(44);
    expect(validateBrickDocument(document).documentGloballyValid).toBe(true);
  });

  it("refuses a same-ID jumper stud whose source frame and collision stud moved", () => {
    const reviewed = REVIEWED_TRUTHS_V4[0]!;
    const jumper = createPartInstance({
      id: "jumper",
      catalogPartId: "builtin:jumper-plate-1x3",
    });
    const plate = createPartInstance({
      id: "plate",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [0, -8, -20], orientationId: "upright-yaw-0" },
    });
    const base = documentAtReviewedTruth({
      id: "v4-55-moved-jumper-stud",
      name: "Source-valid moved jumper stud",
      truth: reviewed.truth,
    });
    const historical = withPartsAndConnection(base, [jumper, plate], {
      id: "jumper-edge",
      kind: "stud-tube",
      a: { partId: jumper.id, portId: "stud:0" },
      b: { partId: plate.id, portId: "undersideClutch:0:0" },
      provenance: { source: "manual" },
    });

    const { document, report } = migrateDocumentTruth(historical);

    expect(document).toBe(historical);
    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Connection jumper-edge endpoint jumper/stud:0 changed after reviewed source truth ${reviewed.truthHash}; migration cannot preserve its connector semantics`,
    );
  });

  it("refuses a connector introduced later on a part that already existed", () => {
    const reviewed = REVIEWED_TRUTHS_V4[2]!;
    const technicBrick = createPartInstance({
      id: "technic",
      catalogPartId: "builtin:technic-brick-1x2",
    });
    const axle = createPartInstance({
      id: "axle",
      catalogPartId: "builtin:axle-1x2",
      transform: { positionLdu: [-10, -2, 0], orientationId: "upright-yaw-0" },
    });
    const base = documentAtReviewedTruth({
      id: "v4-61-future-axle-port",
      name: "Later axle port injection",
      truth: reviewed.truth,
    });
    const historical = withPartsAndConnection(base, [technicBrick, axle], {
      id: "future-axle-edge",
      kind: "stud-tube",
      a: { partId: technicBrick.id, portId: "pinHole:0" },
      b: { partId: axle.id, portId: "axle:2" },
      provenance: { source: "manual" },
    });

    const { document, report } = migrateDocumentTruth(historical);

    expect(document).toBe(historical);
    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Connection future-axle-edge endpoint axle/axle:2 did not exist in reviewed source truth ${reviewed.truthHash}; migration cannot legitimize a later connector`,
    );
  });

  it("refuses a dangling endpoint whose historical catalog identity cannot be authenticated", () => {
    const reviewed = REVIEWED_TRUTHS_V4[2]!;
    const technicBrick = createPartInstance({
      id: "technic",
      catalogPartId: "builtin:technic-brick-1x2",
    });
    const base = documentAtReviewedTruth({
      id: "v4-61-dangling-future-port",
      name: "Dangling later-port injection",
      truth: reviewed.truth,
    });
    const historical = withPartsAndConnection(base, [technicBrick], {
      id: "dangling-future-edge",
      kind: "stud-tube",
      a: { partId: technicBrick.id, portId: "pinHole:0" },
      b: { partId: "missing-axle", portId: "axle:2" },
      provenance: { source: "manual" },
    });

    const { document, report } = migrateDocumentTruth(historical);

    expect(document).toBe(historical);
    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Connection dangling-future-edge endpoint missing-axle/axle:2 references missing part missing-axle under reviewed source truth ${reviewed.truthHash}; add that source-truth-valid part instance or remove the dangling connection before migration`,
    );
  });

  it("refuses a duplicate part ID before an alias can authenticate removed endpoint semantics", () => {
    const reviewed = REVIEWED_TRUTHS_V4[1]!;
    const wedge = createPartInstance({
      id: "dup",
      catalogPartId: "builtin:wedge-plate-2x4-left",
    });
    const alias = createPartInstance({
      id: "dup",
      catalogPartId: "builtin:plate-2x4",
    });
    const plate = createPartInstance({
      id: "plate",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [10, 8, 10], orientationId: "upright-yaw-0" },
    });
    const base = documentAtReviewedTruth({
      id: "v4-59-duplicate-part-alias",
      name: "Duplicate part endpoint alias",
      truth: reviewed.truth,
    });
    const historical = withPartsAndConnection(base, [wedge, alias, plate], {
      id: "duplicate-alias-edge",
      kind: "stud-tube",
      a: { partId: "dup", portId: "undersideClutch:1:2" },
      b: { partId: plate.id, portId: "stud:0:0" },
      provenance: { source: "manual" },
    });

    const { document, report } = migrateDocumentTruth(historical);

    expect(document).toBe(historical);
    expect(report.migrated).toBe(false);
    expect(report.blockingReasons).toContain(
      `Connection duplicate-alias-edge endpoint dup/undersideClutch:1:2 resolves to multiple source part instances with duplicate ID dup under reviewed source truth ${reviewed.truthHash}; make part IDs unique before migration so connector semantics can be authenticated`,
    );
  });

  it("preserves draft-invalid transforms when connector semantics themselves are stable", () => {
    const reviewed = REVIEWED_TRUTHS_V4[1]!;
    const wedge = createPartInstance({
      id: "wedge",
      catalogPartId: "builtin:wedge-plate-2x4-left",
    });
    const plate = createPartInstance({
      id: "plate",
      catalogPartId: "builtin:plate-1x1",
      transform: { positionLdu: [10, 8, 31], orientationId: "upright-yaw-0" },
    });
    const base = documentAtReviewedTruth({
      id: "v4-59-stable-draft",
      name: "Stable endpoint with draft transform",
      truth: reviewed.truth,
    });
    const historical = withPartsAndConnection(base, [wedge, plate], {
      id: "draft-edge",
      kind: "stud-tube",
      a: { partId: wedge.id, portId: "undersideClutch:1:3" },
      b: { partId: plate.id, portId: "stud:0:0" },
      provenance: { source: "manual" },
    });

    const { document, report } = migrateDocumentTruth(historical);
    const validation = validateBrickDocument(document);

    expect(report.migrated).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(validation.documentGloballyValid).toBe(false);
    expect(validation.issues.map(({ code }) => code)).toContain("CONNECTION_TRANSFORM_MISMATCH");
  });
});
