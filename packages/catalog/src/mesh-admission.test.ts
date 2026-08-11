import { describe, expect, it } from "vitest";

import {
  assertBuiltinCatalogMeshAdmissions,
  createPreloadedMeshAssetResolver,
  getPartDefinition,
  meshAssetContentHash,
  STUD_PITCH_LDU,
  validateMeshPartDefinitionAdmission,
  type CollisionPrimitive,
  type LduVector3,
  type MeshPartAdmissionIssueCode,
  type PartDefinition,
  type PreloadedMeshAsset,
  type SourceProvenance,
} from "./index.js";

const ASSET_ID = "test:off-centre-box/1";
const ASSET: PreloadedMeshAsset = {
  assetId: ASSET_ID,
  positionsLdu: [0, 0, 0, 40, 0, 0, 40, 0, 20, 0, 0, 20, 0, 8, 0, 40, 8, 0, 40, 8, 20, 0, 8, 20],
  indices: [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0,
    4, 3, 4, 7,
  ],
  groups: [{ role: "body", triangleStart: 0, triangleCount: 12 }],
};
const CATALOG_OFFSET_LDU = [10, 0, -20] as const;
const MESH_PROVENANCE: SourceProvenance = {
  sourceId: "lego-studio:test-off-centre-render-mesh",
  sourceType: "project-authored",
  sourceVersion: "1",
  licenseExpression: "MIT",
  attribution: "Synthetic test fixture authored for LEGO Studio.",
  runtimeRole: "render-mesh-asset",
  redistributionAllowed: true,
  trainingUseAllowed: false,
  externalGeometryBundled: false,
};

function shifted([x, y, z]: LduVector3): LduVector3 {
  return [x + CATALOG_OFFSET_LDU[0], y, z + CATALOG_OFFSET_LDU[2]];
}

function shiftedPrimitive(primitive: CollisionPrimitive): CollisionPrimitive {
  switch (primitive.kind) {
    case "box":
      return { ...primitive, minLdu: shifted(primitive.minLdu), maxLdu: shifted(primitive.maxLdu) };
    case "wedge":
      return {
        ...primitive,
        minLdu: shifted(primitive.minLdu),
        maxLdu: shifted(primitive.maxLdu),
        cutOffsetLdu:
          primitive.cutOffsetLdu +
          primitive.cutNormalXZ[0] * CATALOG_OFFSET_LDU[0] +
          primitive.cutNormalXZ[1] * CATALOG_OFFSET_LDU[2],
      };
    case "cylinder":
      return { ...primitive, centerLdu: shifted(primitive.centerLdu) };
    case "convex-prism":
      return {
        ...primitive,
        verticesXZLdu: primitive.verticesXZLdu.map(([x, z]) => [
          x + CATALOG_OFFSET_LDU[0],
          z + CATALOG_OFFSET_LDU[2],
        ]),
      };
  }
}

function definition(
  options: {
    readonly frame?: boolean;
    readonly grid?: boolean;
    readonly asset?: PreloadedMeshAsset;
  } = {},
): PartDefinition {
  const base = getPartDefinition("builtin:tile-1x2")!;
  const asset = options.asset ?? ASSET;
  const baseWithoutAdmissionOverrides = (({ ldrawFrame, connectorGridCenterLdu, ...rest }) => {
    void ldrawFrame;
    void connectorGridCenterLdu;
    return rest;
  })(base);
  return {
    ...baseWithoutAdmissionOverrides,
    id: "test:off-centre-mesh-part",
    geometry: {
      generatorId: "builtin:preloaded-mesh-reference/1",
      assetId: asset.assetId,
      contentHash: meshAssetContentHash(asset),
      ...(options.frame === false
        ? {}
        : {
            assetToCatalogFrame: {
              schemaVersion: "mesh-asset-to-catalog-frame/1" as const,
              orientationId: "upright-yaw-90",
              translationLdu: [0, -4, 0] as const,
            },
          }),
      provenance: MESH_PROVENANCE,
    } as PartDefinition["geometry"],
    ...(options.grid === false
      ? {}
      : { connectorGridCenterLdu: [CATALOG_OFFSET_LDU[0], CATALOG_OFFSET_LDU[2]] as const }),
    bodyBoundsLdu: { min: [0, -4, -40], max: [20, 4, 0] },
    boundsLdu: { min: [0, -4, -40], max: [20, 4, 0] },
    connectors: base.connectors.map((connector) => ({
      ...connector,
      positionLdu: shifted(connector.positionLdu),
    })),
    collision: {
      ...base.collision,
      // One box, stated here rather than borrowed. The tile this fixture is
      // built from is a shell now — a ceiling, four walls and no single "body" —
      // and the cases below mutate one body primitive and expect the union to
      // stop matching the mesh. Against five boxes, moving one of them leaves
      // the union unchanged and the fixture stops testing what it says it does.
      primitives: [
        { id: "body", kind: "box", tag: "body", minLdu: [0, -4, -40], maxLdu: [20, 4, 0] },
        ...base.collision.primitives
          .filter(({ tag }) => tag !== "body")
          .map((primitive) => shiftedPrimitive(primitive)),
      ],
      allowances: base.collision.allowances.map((allowance) => ({
        ...allowance,
        centerLdu: shifted(allowance.centerLdu),
      })),
    },
  };
}

function issueCodes(
  part: PartDefinition,
  includeAsset = true,
  asset: PreloadedMeshAsset = ASSET,
): readonly MeshPartAdmissionIssueCode[] {
  const resolver = createPreloadedMeshAssetResolver(includeAsset ? { [asset.assetId]: asset } : {});
  return validateMeshPartDefinitionAdmission(part, resolver).issues.map(({ code }) => code);
}

describe("mesh part catalog admission", () => {
  it("admits only a closed, integrity-bound, framed mesh whose visual extents match bounds", () => {
    const result = validateMeshPartDefinitionAdmission(
      definition(),
      createPreloadedMeshAssetResolver({ [ASSET_ID]: ASSET }),
    );

    expect(result).toEqual({ accepted: true, issues: [] });
  });

  it("rejects a definition whose closed asset is absent before it can render a placeholder", () => {
    expect(issueCodes(definition(), false)).toEqual(["MESH_ADMISSION_RESOLUTION_FAILED"]);
  });

  it("fails built-in catalog construction against the exact empty production registry", () => {
    expect(() => assertBuiltinCatalogMeshAdmissions([definition()])).toThrow(
      /Built-in catalog rejected.*MESH_ADMISSION_RESOLUTION_FAILED.*MESH_ASSET_MISSING/,
    );
  });

  it("rejects malformed identity, provenance, frame, and snapping truth", () => {
    const valid = definition();
    const validGeometry = valid.geometry;
    if (validGeometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
      throw new Error("Test fixture must use a preloaded mesh recipe");
    }
    const invalidId: PartDefinition = {
      ...valid,
      geometry: {
        ...validGeometry,
        assetId: "test:bad\0asset",
      },
    };
    const uppercaseHash: PartDefinition = {
      ...valid,
      geometry: {
        ...validGeometry,
        contentHash: validGeometry.contentHash.toUpperCase() as `sha256:${string}`,
      },
    };
    const wrongProvenance: PartDefinition = {
      ...valid,
      geometry: {
        ...validGeometry,
        provenance: { ...MESH_PROVENANCE, runtimeRole: "parametric-runtime-geometry" },
      },
    };
    const fractionalGrid: PartDefinition = {
      ...valid,
      connectorGridCenterLdu: [10.5, -20],
    };

    expect(issueCodes(invalidId)).toContain("MESH_ADMISSION_ASSET_ID_INVALID");
    expect(issueCodes(uppercaseHash)).toContain("MESH_ADMISSION_HASH_INVALID");
    expect(issueCodes(wrongProvenance)).toContain("MESH_ADMISSION_PROVENANCE_INVALID");
    expect(issueCodes(definition({ frame: false }))).toContain("MESH_ADMISSION_FRAME_INVALID");
    expect(issueCodes(definition({ grid: false }))).toContain("MESH_ADMISSION_GRID_CENTER_INVALID");
    expect(issueCodes(fractionalGrid)).toContain("MESH_ADMISSION_GRID_CENTER_INVALID");
  });

  it("accepts coherent external bundled provenance and rejects incoherent licensing flags", () => {
    const valid = definition();
    if (valid.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
      throw new Error("Test fixture must use a preloaded mesh recipe");
    }
    const externalProvenance: SourceProvenance = {
      sourceId: "ldraw:test-contract-fixture.dat",
      sourceType: "external-bundled-geometry",
      sourceVersion: "fixture-1",
      licenseExpression: "CC-BY-2.0",
      attribution: "Synthetic contract fixture standing in for externally authored geometry.",
      runtimeRole: "render-mesh-asset",
      redistributionAllowed: true,
      trainingUseAllowed: false,
      externalGeometryBundled: true,
    };
    const external: PartDefinition = {
      ...valid,
      geometry: { ...valid.geometry, provenance: externalProvenance },
    };
    const incoherent: PartDefinition = {
      ...external,
      geometry: {
        ...external.geometry,
        provenance: {
          ...externalProvenance,
          licenseExpression: "NOASSERTION",
          redistributionAllowed: false,
          externalGeometryBundled: false,
        },
      },
    };

    expect(issueCodes(external)).not.toContain("MESH_ADMISSION_PROVENANCE_INVALID");
    expect(issueCodes(incoherent)).toContain("MESH_ADMISSION_PROVENANCE_INVALID");
  });

  it("requires finite measured declarations and toleranced equality with resolved visual bounds", () => {
    const valid = definition();
    const bodyOutside: PartDefinition = {
      ...valid,
      bodyBoundsLdu: { min: [0, -4, -40], max: [21, 4, 0] },
    };
    // Measured geometry is not whole LDU, so a fraction is admitted while a
    // non-finite or unrepresentable magnitude still is not.
    const nonFiniteBounds: PartDefinition = {
      ...valid,
      boundsLdu: { min: [0, -4, -40], max: [Number.POSITIVE_INFINITY, 4, 0] },
    };
    const unrepresentableBounds: PartDefinition = {
      ...valid,
      boundsLdu: { min: [0, -4, -40], max: [1e12, 4, 0] },
    };
    const meshWithMaximumRawZ = (maximumRawZ: number): PreloadedMeshAsset => ({
      ...ASSET,
      positionsLdu: ASSET.positionsLdu.map((coordinate, index) =>
        index % 3 === 2 && coordinate === 20 ? maximumRawZ : coordinate,
      ),
    });
    const outsideToleranceAsset = meshWithMaximumRawZ(20.001);
    const withinToleranceAsset = meshWithMaximumRawZ(20.000_000_5);
    const misclassifiedBodyAsset: PreloadedMeshAsset = {
      ...ASSET,
      groups: [
        { role: "body", triangleStart: 0, triangleCount: 2 },
        { role: "stud", triangleStart: 2, triangleCount: 10 },
      ],
    };
    const outsideTolerance = definition({ asset: outsideToleranceAsset });
    const withinTolerance = definition({ asset: withinToleranceAsset });
    const misclassifiedBody = definition({ asset: misclassifiedBodyAsset });

    expect(issueCodes(bodyOutside)).toContain("MESH_ADMISSION_BOUNDS_INVALID");
    expect(issueCodes(nonFiniteBounds)).toContain("MESH_ADMISSION_BOUNDS_INVALID");
    expect(issueCodes(unrepresentableBounds)).toContain("MESH_ADMISSION_BOUNDS_INVALID");
    expect(issueCodes(outsideTolerance, true, outsideToleranceAsset)).toContain(
      "MESH_ADMISSION_VISUAL_BOUNDS_MISMATCH",
    );
    expect(issueCodes(misclassifiedBody, true, misclassifiedBodyAsset)).toContain(
      "MESH_ADMISSION_BODY_BOUNDS_MISMATCH",
    );
    expect(
      validateMeshPartDefinitionAdmission(
        withinTolerance,
        createPreloadedMeshAssetResolver({ [withinToleranceAsset.assetId]: withinToleranceAsset }),
      ),
    ).toEqual({ accepted: true, issues: [] });
  });

  it("fails closed on malformed dimensions, connectors, snapping, collision, and vertical truth", () => {
    const valid = definition();
    const invalidDimensions: PartDefinition = {
      ...valid,
      dimensions: { ...valid.dimensions, widthLdu: valid.dimensions.widthLdu + 1 },
    };
    const invalidConnector: PartDefinition = {
      ...valid,
      connectors: valid.connectors.map((connector, index) =>
        index === 0
          ? {
              ...connector,
              positionLdu: [
                connector.positionLdu[0] + 0.5,
                connector.positionLdu[1],
                connector.positionLdu[2],
              ],
            }
          : connector,
      ),
    };
    const incompatibleGrid: PartDefinition = {
      ...valid,
      connectors: valid.connectors.map((connector, index) =>
        index === 0
          ? {
              ...connector,
              positionLdu: [
                connector.positionLdu[0] + 1,
                connector.positionLdu[1],
                connector.positionLdu[2],
              ],
            }
          : connector,
      ),
    };
    const invalidVerticalTruth: PartDefinition = {
      ...valid,
      dimensions: { ...valid.dimensions, heightLdu: valid.dimensions.heightLdu + 2 },
    };
    const body = valid.collision.primitives.find((primitive) => primitive.tag === "body")!;
    if (body.kind !== "box") throw new Error("Test fixture requires one box body primitive");
    const inconsistentCollisionBounds: PartDefinition = {
      ...valid,
      collision: {
        ...valid.collision,
        primitives: valid.collision.primitives.map((primitive) =>
          primitive.id === body.id
            ? { ...body, maxLdu: [body.maxLdu[0] - 1, body.maxLdu[1], body.maxLdu[2]] }
            : primitive,
        ),
      },
    };
    const invalidWedgeRepresentation: PartDefinition = {
      ...valid,
      collision: {
        ...valid.collision,
        primitives: valid.collision.primitives.map((primitive) =>
          primitive.id === body.id
            ? {
                ...body,
                kind: "wedge" as const,
                cutNormalXZ: [0, 0] as const,
                cutOffsetLdu: 0,
              }
            : primitive,
        ),
      },
    };
    const invalidCollisionVersion: PartDefinition = {
      ...valid,
      collision: { ...valid.collision, modelVersion: " " },
    };

    expect(issueCodes(invalidDimensions)).toContain("MESH_ADMISSION_DIMENSIONS_INVALID");
    expect(issueCodes(invalidConnector)).toContain("MESH_ADMISSION_CONNECTOR_INVALID");
    expect(issueCodes(incompatibleGrid)).toContain("MESH_ADMISSION_CONNECTOR_GRID_MISMATCH");
    expect(issueCodes(invalidVerticalTruth)).toContain("MESH_ADMISSION_VERTICAL_EXTENTS_INVALID");
    expect(issueCodes(inconsistentCollisionBounds)).toContain("MESH_ADMISSION_COLLISION_INVALID");
    expect(issueCodes(invalidWedgeRepresentation)).toContain("MESH_ADMISSION_COLLISION_INVALID");
    expect(issueCodes(invalidCollisionVersion)).toContain("MESH_ADMISSION_COLLISION_INVALID");
  });

  it("admits an explicitly preserved collision envelope without calling it mesh-derived", () => {
    const valid = definition();
    if (valid.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
      throw new Error("Test fixture must use a preloaded mesh recipe");
    }
    const body = valid.collision.primitives.find((primitive) => primitive.tag === "body")!;
    if (body.kind !== "box") throw new Error("Test fixture requires one box body primitive");
    const preserved: PartDefinition = {
      ...valid,
      geometry: { ...valid.geometry, collisionMode: "preserved-catalog-recipe" },
      collision: {
        ...valid.collision,
        primitives: valid.collision.primitives.map((primitive) =>
          primitive.id === body.id
            ? { ...body, maxLdu: [body.maxLdu[0] + 1, body.maxLdu[1], body.maxLdu[2]] }
            : primitive,
        ),
      },
    };
    const malformed: PartDefinition = {
      ...preserved,
      collision: {
        ...preserved.collision,
        primitives: preserved.collision.primitives.map((primitive) =>
          primitive.id === body.id && primitive.kind === "box"
            ? { ...primitive, maxLdu: [Number.NaN, primitive.maxLdu[1], primitive.maxLdu[2]] }
            : primitive,
        ),
      },
    };
    const unbounded: PartDefinition = {
      ...preserved,
      collision: {
        ...preserved.collision,
        primitives: preserved.collision.primitives.map((primitive) =>
          primitive.id === body.id && primitive.kind === "box"
            ? {
                ...primitive,
                maxLdu: [
                  valid.boundsLdu.max[0] + STUD_PITCH_LDU + 1,
                  primitive.maxLdu[1],
                  primitive.maxLdu[2],
                ],
              }
            : primitive,
        ),
      },
    };
    const withoutBody: PartDefinition = {
      ...preserved,
      collision: {
        ...preserved.collision,
        primitives: preserved.collision.primitives.filter((primitive) => primitive.tag !== "body"),
      },
    };

    expect(issueCodes(preserved)).not.toContain("MESH_ADMISSION_COLLISION_INVALID");
    expect(issueCodes(malformed)).toContain("MESH_ADMISSION_COLLISION_INVALID");
    expect(issueCodes(unbounded)).toContain("MESH_ADMISSION_COLLISION_INVALID");
    expect(issueCodes(withoutBody)).toContain("MESH_ADMISSION_COLLISION_INVALID");
  });

  it("uses the clipped wedge polygon for collision bounds and rejects empty or zero-area cuts", () => {
    const valid = definition();
    const body = valid.collision.primitives.find((primitive) => primitive.tag === "body")!;
    if (body.kind !== "box") throw new Error("Test fixture requires one box body primitive");
    const withWedge = (cutNormalXZ: readonly [number, number], cutOffsetLdu: number) => ({
      ...valid,
      collision: {
        ...valid.collision,
        primitives: valid.collision.primitives.map((primitive) =>
          primitive.id === body.id
            ? {
                ...body,
                kind: "wedge" as const,
                cutNormalXZ,
                cutOffsetLdu,
              }
            : primitive,
        ),
      },
    });
    const clipped = withWedge([1, 0], 10);
    const clippedResult = validateMeshPartDefinitionAdmission(
      clipped,
      createPreloadedMeshAssetResolver({ [ASSET_ID]: ASSET }),
    );

    expect(issueCodes(withWedge([1, 1], 10))).not.toContain("MESH_ADMISSION_COLLISION_INVALID");
    expect(clippedResult.issues).toContainEqual(
      expect.objectContaining({
        code: "MESH_ADMISSION_COLLISION_INVALID",
        message: expect.stringContaining("[0, -4, -40]..[10, 4, 0]"),
      }),
    );
    expect(issueCodes(withWedge([1, 0], -1))).toContain("MESH_ADMISSION_COLLISION_INVALID");
    expect(issueCodes(withWedge([1, 0], 0))).toContain("MESH_ADMISSION_COLLISION_INVALID");
  });

  it("cross-checks stud connectors, stud collision cylinders, and underside allowances", () => {
    const valid = definition();
    const sourceStud = getPartDefinition("builtin:brick-1x1")!.connectors.find(
      ({ kind }) => kind === "stud",
    )!;
    const orphanStudConnector: PartDefinition = {
      ...valid,
      connectors: [
        ...valid.connectors,
        {
          ...sourceStud,
          id: "stud:orphan",
          positionLdu: [10, valid.bodyBoundsLdu.min[1], -20],
        },
      ],
    };
    const orphanStudCylinder: PartDefinition = {
      ...valid,
      collision: {
        ...valid.collision,
        primitives: [
          ...valid.collision.primitives,
          {
            id: "stud:orphan",
            kind: "cylinder",
            tag: "stud",
            axis: "y",
            centerLdu: [10, 0, -20],
            radiusLdu: 2,
            heightLdu: 4,
          },
        ],
      },
    };
    const mismatchedAllowance: PartDefinition = {
      ...valid,
      collision: {
        ...valid.collision,
        allowances: valid.collision.allowances.map((allowance, index) =>
          index === 0
            ? {
                ...allowance,
                centerLdu: [
                  allowance.centerLdu[0] + 1,
                  allowance.centerLdu[1],
                  allowance.centerLdu[2],
                ],
              }
            : allowance,
        ),
      },
    };
    const sidewaysUndersideConnector: PartDefinition = {
      ...valid,
      connectors: valid.connectors.map((connector) =>
        connector.kind === "undersideClutch"
          ? { ...connector, normal: [1, 0, 0] as const }
          : connector,
      ),
    };
    const missingAllowances: PartDefinition = {
      ...valid,
      collision: { ...valid.collision, allowances: [] },
    };
    const duplicatedAllowance = valid.collision.allowances[0]!;
    const duplicatePortAllowance: PartDefinition = {
      ...valid,
      collision: {
        ...valid.collision,
        allowances: [
          ...valid.collision.allowances,
          { ...duplicatedAllowance, id: `${duplicatedAllowance.id}:duplicate` },
        ],
      },
    };

    expect(issueCodes(orphanStudConnector)).toContain(
      "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
    );
    expect(issueCodes(orphanStudCylinder)).toContain("MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH");
    expect(issueCodes(mismatchedAllowance)).toContain("MESH_ADMISSION_COLLISION_INVALID");
    expect(issueCodes(sidewaysUndersideConnector)).toContain("MESH_ADMISSION_CONNECTOR_INVALID");
    expect(issueCodes(missingAllowances)).toContain("MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH");
    expect(issueCodes(duplicatePortAllowance)).toContain(
      "MESH_ADMISSION_CONNECTOR_COLLISION_MISMATCH",
    );
  });
});
