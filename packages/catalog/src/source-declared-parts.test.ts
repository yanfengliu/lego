import { describe, expect, it } from "vitest";

import {
  BUNDLED_LDRAW_ARCHIVE,
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import {
  PART_DEFINITIONS,
  resolvePartId,
  type PartDefinition,
  validateMeshPartDefinitionAdmission,
} from "./index.js";
import { makeMeasuredPartDefinition } from "./measured-part-factory.ts";
import type { MeasuredPartBlueprint } from "./measured-part-types.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";
import { SET_6651557_MESH_ASSETS } from "./mesh-assets-6651557.ts";
import {
  ADMITTED_SOURCE_PART_ROWS,
  BUILDER_MISSING_PLATE_LATTICE_PART_IDS,
  bodyBoxes,
  requireAdmittedPart,
} from "./source-declared-parts-test-support.ts";

describe("set 6651557 parts declared from measured source", () => {
  it("admits all thirty through the production mesh gate", () => {
    for (const expected of ADMITTED_SOURCE_PART_ROWS) {
      expect([
        expected.id,
        validateMeshPartDefinitionAdmission(requireAdmittedPart(expected.id)),
      ]).toEqual([expected.id, { accepted: true, issues: [] }]);
    }
  });

  it("carries the measured extents, frame, connectors and collision each part actually has", () => {
    for (const expected of ADMITTED_SOURCE_PART_ROWS) {
      const part = requireAdmittedPart(expected.id);
      const geometry = part.geometry;
      if (geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
        throw new Error(`${expected.id} is not mesh-backed`);
      }
      const asset = SET_6651557_MESH_ASSETS[geometry.assetId]!;

      expect({
        id: part.id,
        family: part.family,
        widthStuds: part.dimensions.widthStuds,
        lengthStuds: part.dimensions.lengthStuds,
        heightLdu: part.dimensions.heightLdu,
        orientationId: geometry.assetToCatalogFrame.orientationId,
        translationLdu: geometry.assetToCatalogFrame.translationLdu,
        connectorGridCenterLdu: part.connectorGridCenterLdu,
        bodyBoundsLdu: part.bodyBoundsLdu,
        boundsLdu: part.boundsLdu,
        studs: part.connectors.filter(({ kind }) => kind === "stud").length,
        clutches: part.connectors.filter(({ kind }) => kind === "undersideClutch").length,
        axles: part.connectors.filter(({ kind }) => kind === "axle").length,
        axleHoles: part.connectors.filter(({ kind }) => kind === "axleHole").length,
        blindAxleHoles: part.connectors.filter(({ kind }) => kind === "blindAxleHole").length,
        bodyBoxes: bodyBoxes(part).length,
        triangles: (asset.indices?.length ?? asset.positionsLdu.length) / 3,
        vertices: asset.positionsLdu.length / 3,
        assetId: `ldraw:official:${expected.ldrawId}`,
      }).toEqual({
        id: expected.id,
        family: expected.family,
        widthStuds: expected.widthStuds,
        lengthStuds: expected.lengthStuds,
        heightLdu: expected.heightLdu,
        orientationId: expected.orientationId,
        translationLdu: expected.translationLdu,
        connectorGridCenterLdu: expected.connectorGridCenterLdu,
        bodyBoundsLdu: expected.bodyBoundsLdu,
        boundsLdu: expected.boundsLdu,
        studs: expected.studs,
        clutches: expected.clutches,
        axles: "axles" in expected ? expected.axles : 0,
        axleHoles: "axleHoles" in expected ? expected.axleHoles : 0,
        blindAxleHoles: "blindAxleHoles" in expected ? expected.blindAxleHoles : 0,
        bodyBoxes: expected.bodyBoxes,
        triangles: expected.triangles,
        vertices: expected.vertices,
        assetId: `ldraw:official:${expected.ldrawId}`,
      });
      // One collision allowance per seat, and one stud cylinder per stud.
      expect(part.collision.allowances).toHaveLength(expected.clutches);
      expect(
        part.collision.primitives.filter(({ kind, tag }) => kind === "cylinder" && tag === "stud"),
      ).toHaveLength(expected.studs);
      expect(resolvePartId(expected.ldrawId)).toBe(expected.id);
      expect(resolvePartId(part.displayName)).toBe(expected.id);
    }
  });

  it("seats 93273's middle clutches on its recessed underside, not on its lowest plane", () => {
    const part = requireAdmittedPart("builtin:curved-slope-1x4-double");
    const seats = part.connectors
      .filter(({ kind }) => kind === "undersideClutch")
      .map(({ positionLdu }) => positionLdu);

    expect(seats).toEqual([
      [0, 0, -10],
      [0, 0, 10],
      [0, 8, -30],
      [0, 8, 30],
    ]);
    // Each seat is a plane the represented solid presents downward, with none
    // of that solid inside the stud footprint below it.
    const boxes = bodyBoxes(part);
    for (const [x, y, z] of seats) {
      expect(boxes.some((box) => box.maxLdu[1] === y)).toBe(true);
      expect(
        boxes.filter(
          (box) =>
            box.maxLdu[1] > y &&
            box.minLdu[0] < x + 6 &&
            box.maxLdu[0] > x - 6 &&
            box.minLdu[2] < z + 6 &&
            box.maxLdu[2] > z - 6,
        ),
      ).toEqual([]);
    }
  });

  it("refuses a seat the part's own solid stands below", () => {
    const part = requireAdmittedPart("builtin:corner-plate-3x3");
    const seat = part.connectors.find(({ kind }) => kind === "undersideClutch")!;
    const raised: PartDefinition = {
      ...part,
      connectors: part.connectors.map((connector) =>
        connector.id === seat.id
          ? { ...connector, positionLdu: [seat.positionLdu[0], 0, seat.positionLdu[2]] }
          : connector,
      ),
      collision: {
        ...part.collision,
        allowances: part.collision.allowances.map((allowance) =>
          allowance.portId === seat.id
            ? { ...allowance, centerLdu: [allowance.centerLdu[0], -2, allowance.centerLdu[2]] }
            : allowance,
        ),
      },
    };

    const result = validateMeshPartDefinitionAdmission(raised);
    expect(result.accepted).toBe(false);
    expect(result.issues.map(({ code }) => code)).toContain(
      "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
    );
    expect(result.issues.map(({ message }) => message).join(" ")).toMatch(
      /cannot pass through the part's own solid to reach that seat/u,
    );
  });

  it("preserves per-file LDraw authorship and licence for every bundled closure", () => {
    expect(BUNDLED_LDRAW_ARCHIVE.sha256).toBe(
      "sha256:6009f2e94204c4d3a63a4c812010b5c90bad8c5acb19b882c859fdac63734eae",
    );
    expect(BUNDLED_LDRAW_SOURCE_FILES).toHaveLength(239);
    for (const file of BUNDLED_LDRAW_SOURCE_FILES) {
      expect(file.author.trim().length).toBeGreaterThan(0);
      expect(file.title.trim().length).toBeGreaterThan(0);
      expect(file.sha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    }
    expect(
      BUNDLED_LDRAW_SOURCE_FILES.filter(({ licenseExpression }) =>
        licenseExpression.includes("CC-BY-2.0"),
      ).map(({ path, licenseExpression }) => [path, licenseExpression]),
    ).toEqual([
      ["parts/2453b.dat", "CC-BY-2.0 OR CC-BY-4.0"],
      ["parts/30503.dat", "CC-BY-2.0 OR CC-BY-4.0"],
      ["parts/32064a.dat", "CC-BY-2.0 OR CC-BY-4.0"],
      ["parts/3245c.dat", "CC-BY-2.0 OR CC-BY-4.0"],
    ]);
    expect(
      BUNDLED_LDRAW_SOURCE_FILES.filter(
        ({ licenseExpression }) => licenseExpression === "CC-BY-4.0",
      ),
    ).toHaveLength(235);
    // 34 named authors across 239 files: attribution is retained per file, never flattened.
    expect(new Set(BUNDLED_LDRAW_SOURCE_FILES.map(({ author }) => author)).size).toBe(34);

    for (const expected of ADMITTED_SOURCE_PART_ROWS) {
      const closure = BUNDLED_LDRAW_CLOSURES[expected.ldrawId.replace(".dat", "")]!;
      expect(closure).toHaveLength(expected.closureFiles);
      expect(
        closure.map((index) => BUNDLED_LDRAW_SOURCE_FILES[index]?.path).filter(Boolean),
      ).toHaveLength(expected.closureFiles);
      expect(
        closure.some(
          (index) => BUNDLED_LDRAW_SOURCE_FILES[index]?.path === `parts/${expected.ldrawId}`,
        ),
      ).toBe(true);
    }
  });

  it("records bundled geometry as reusable and never as training material", () => {
    for (const expected of ADMITTED_SOURCE_PART_ROWS) {
      const { provenance } = requireAdmittedPart(expected.id).geometry;

      expect(provenance.sourceType).toBe("external-bundled-geometry");
      expect(provenance.externalGeometryBundled).toBe(true);
      expect(["CC-BY-4.0", "CC-BY-2.0 OR CC-BY-4.0"]).toContain(provenance.licenseExpression);
      expect(provenance.redistributionAllowed).toBe(true);
      expect(provenance.trainingUseAllowed).toBe(false);
      expect(provenance.attribution).toMatch(/reuse is not permission to train/u);
      expect(provenance.attribution).toContain(expected.ldrawId);
    }
  });

  it("restricts shared connector-capacity claims to admitted mesh definitions", () => {
    const carryingClaims = PART_DEFINITIONS.flatMap((part) =>
      part.connectors
        .filter(({ sharedCapacityGroupIds }) => sharedCapacityGroupIds !== undefined)
        .map((connector) => ({ connector, part })),
    );

    expect(carryingClaims.map(({ connector, part }) => [part.id, connector.id])).toEqual([
      ["builtin:jumper-plate-1x2", "undersideClutch:0:0"],
      ["builtin:jumper-plate-1x2", "undersideClutch:center"],
      ["builtin:jumper-plate-1x2", "undersideClutch:0:1"],
      ["builtin:tile-1x2-chamfered-indented", "undersideClutch:0"],
      ["builtin:tile-1x2-chamfered-indented", "undersideClutch:1"],
      ["builtin:tile-1x2-chamfered-indented", "undersideClutch:2"],
      ["builtin:brick-1x2x2-without-understud", "undersideClutch:0"],
      ["builtin:brick-1x2x2-without-understud", "undersideClutch:1"],
      ["builtin:brick-1x2x2-without-understud", "undersideClutch:2"],
    ]);
    for (const { part } of carryingClaims) {
      expect(part.geometry.generatorId).toBe("builtin:preloaded-mesh-reference/1");
      expect(validateMeshPartDefinitionAdmission(part)).toEqual({ accepted: true, issues: [] });
    }
  });

  it("gives every Builder-missing plate-lattice part a clutch under every top stud", () => {
    // This is the whole point of admitting them. Under LDraw alone each has
    // studs and zero clutch cells, which is a part that can be built on and can
    // never be placed on anything.
    for (const id of BUILDER_MISSING_PLATE_LATTICE_PART_IDS) {
      const part = requireAdmittedPart(id);
      const studs = part.connectors
        .filter(({ kind }) => kind === "stud")
        .map(({ positionLdu }) => `${positionLdu[0]},${positionLdu[2]}`);
      const clutches = part.connectors
        .filter(({ kind }) => kind === "undersideClutch")
        .map(({ positionLdu }) => `${positionLdu[0]},${positionLdu[2]}`);

      expect(studs.length).toBeGreaterThan(0);
      expect([...clutches].sort()).toEqual([...studs].sort());
    }
  });

  it("refuses a declaration that names two connector sources, or none", () => {
    const declared: readonly MeasuredPartBlueprint[] = SET_6651557_MEASURED_BLUEPRINTS;
    const builderBlueprint = declared.find(({ designId }) => designId === "5092")!;
    const shadowBlueprint = declared.find(({ designId }) => designId === "30357")!;

    // The key is dropped rather than set to undefined: under
    // exactOptionalPropertyTypes an absent source and a present undefined one
    // are different declarations, and the factory's rule is about absence.
    const {
      ldcadShadowSource: shadowSource,
      validatedConnectionStudProfile,
      ...sourceless
    } = shadowBlueprint;
    expect(shadowSource).toBeDefined();
    expect(validatedConnectionStudProfile).toBeDefined();
    expect(builderBlueprint.ldcadShadowSource).toBeUndefined();

    expect(() =>
      makeMeasuredPartDefinition({ ...builderBlueprint, ldcadShadowSource: shadowSource! }),
    ).toThrow(
      /declares 2 authored connector sources.*exactly one Builder frame, pinned Builder connectivity fact, or LDCad shadow walk/u,
    );
    expect(() => makeMeasuredPartDefinition({ ...sourceless, studsLdu: [] })).toThrow(
      /declares 0 authored connector sources for its 8 clutch cells.*exactly one Builder frame, pinned Builder connectivity fact, or LDCad shadow walk/u,
    );
  });

  it("compiles only exact axis-aligned LDCad shaft or bore rows through the shared taxonomy", () => {
    const declared: readonly MeasuredPartBlueprint[] = SET_6651557_MEASURED_BLUEPRINTS;
    const shadowBlueprint = declared.find(({ designId }) => designId === "30357")!;
    const builderBlueprint = declared.find(({ designId }) => designId === "77844")!;
    const sourceConnectorsLdu = [
      { kind: "axle", positionLdu: [-20, 0, 0], normal: [-1, 0, 0] },
    ] as const;

    const definition = makeMeasuredPartDefinition({ ...shadowBlueprint, sourceConnectorsLdu });

    expect(definition.connectors.find(({ id }) => id === "axle:0")).toEqual({
      id: "axle:0",
      kind: "axle",
      geometryRole: "axleShaft",
      profileId: "axle-cross/1",
      gender: "male",
      positionLdu: [-20, 0, 0],
      normal: [-1, 0, 0],
      orientationId: "connector-up",
      capacity: 1,
      compatibleKinds: ["axleHole", "blindAxleHole", "pinHole"],
    });
    expect(() => makeMeasuredPartDefinition({ ...builderBlueprint, sourceConnectorsLdu })).toThrow(
      /source connector rows without an LDCad shadow walk/u,
    );
    expect(() =>
      makeMeasuredPartDefinition({
        ...shadowBlueprint,
        sourceConnectorsLdu: [{ kind: "axle", positionLdu: [-20, 0, 0], normal: [1, 1, 0] }],
      }),
    ).toThrow(/exact shaft or bore gate emits one signed unit axis/u);
  });
});
