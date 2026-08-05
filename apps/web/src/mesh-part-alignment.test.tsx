import {
  MESH_RENDER_QUANTIZATION_TOLERANCE_LDU,
  STUD_PITCH_LDU,
  createPreloadedMeshAssetResolver,
  getPartDefinition,
  meshAssetContentHash,
  validateMeshPartDefinitionAdmission,
  type CollisionPrimitive,
  type LduVector3,
  type PartDefinition,
  type PreloadedMeshAsset,
  type SourceProvenance,
} from "@lego-studio/catalog";
import { createPartInstance, transformLduPoint } from "@lego-studio/brick-kernel";
import {
  createCatalogPartGeometry,
  createPlacementGhost,
  disposeObjectTree,
  lduTransformToThreeMatrix,
} from "@lego-studio/rendering";
import { renderToStaticMarkup } from "react-dom/server";
import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { PartPreview } from "./components/PartPreview";
import { snapPlacementOriginForDefinition, worldFootprint } from "./placement";

const ASSET_ID = "test:off-centre-box/1";
const CATALOG_OFFSET_LDU = [10, 0, -20] as const;
const ASSET: PreloadedMeshAsset = {
  assetId: ASSET_ID,
  positionsLdu: [
    0, 0, 0, 40, 0, 0, 40, 0, 20, 0, 0, 20, 0, 24, 0, 40, 24, 0, 40, 24, 20, 0, 24, 20, 8, -4, 8,
    12, -4, 8, 10, -4, 12, 28, -4, 8, 32, -4, 8, 30, -4, 12,
  ],
  indices: [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0,
    4, 3, 4, 7, 8, 9, 10, 11, 12, 13,
  ],
  groups: [
    { role: "body", triangleStart: 0, triangleCount: 12 },
    { role: "stud", triangleStart: 12, triangleCount: 2 },
  ],
};
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

function offCentreDefinition(): PartDefinition {
  const base = getPartDefinition("builtin:brick-1x2")!;
  return {
    ...base,
    id: "test:off-centre-mesh-part",
    connectorGridCenterLdu: [CATALOG_OFFSET_LDU[0], CATALOG_OFFSET_LDU[2]],
    bodyBoundsLdu: {
      min: shifted(base.bodyBoundsLdu.min),
      max: shifted(base.bodyBoundsLdu.max),
    },
    boundsLdu: { min: shifted(base.boundsLdu.min), max: shifted(base.boundsLdu.max) },
    geometry: {
      generatorId: "builtin:preloaded-mesh-reference/1",
      assetId: ASSET_ID,
      contentHash: meshAssetContentHash(ASSET),
      assetToCatalogFrame: {
        schemaVersion: "mesh-asset-to-catalog-frame/1",
        orientationId: "upright-yaw-90",
        translationLdu: [0, -12, 0],
      },
      provenance: MESH_PROVENANCE,
    },
    connectors: base.connectors.map((connector) => ({
      ...connector,
      positionLdu: shifted(connector.positionLdu),
    })),
    collision: {
      ...base.collision,
      primitives: base.collision.primitives.map(shiftedPrimitive),
      allowances: base.collision.allowances.map((allowance) => ({
        ...allowance,
        centerLdu: shifted(allowance.centerLdu),
      })),
    },
  };
}

function expectStudLatticeCoordinate(coordinate: number): void {
  const residue =
    (((coordinate - STUD_PITCH_LDU / 2) % STUD_PITCH_LDU) + STUD_PITCH_LDU) % STUD_PITCH_LDU;
  expect(residue).toBeCloseTo(0);
}

function expectQuantizedBounds(
  coordinates: readonly number[],
  expected: readonly [number, number],
): void {
  expect(Math.abs(Math.min(...coordinates) - expected[0])).toBeLessThanOrEqual(
    MESH_RENDER_QUANTIZATION_TOLERANCE_LDU,
  );
  expect(Math.abs(Math.max(...coordinates) - expected[1])).toBeLessThanOrEqual(
    MESH_RENDER_QUANTIZATION_TOLERANCE_LDU,
  );
}

describe("off-centre mesh part alignment", () => {
  it("uses one framed asset and explicit connector-grid truth for snap, render, ghost, and preview", () => {
    const definition = offCentreDefinition();
    const resolver = createPreloadedMeshAssetResolver({ [ASSET_ID]: ASSET });
    if (definition.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
      throw new Error("Test fixture must use a preloaded mesh recipe");
    }
    expect(definition.ldrawFrame).toBeUndefined();
    expect(validateMeshPartDefinitionAdmission(definition, resolver)).toEqual({
      accepted: true,
      issues: [],
    });
    const resolution = resolver(definition.geometry);
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    const resolvedBodyY = resolution.asset.positionsLdu
      .slice(0, 8 * 3)
      .filter((_, index) => index % 3 === 1);
    const resolvedY = resolution.asset.positionsLdu.filter((_, index) => index % 3 === 1);
    const resolvedX = resolution.asset.positionsLdu.filter((_, index) => index % 3 === 0);
    const resolvedZ = resolution.asset.positionsLdu.filter((_, index) => index % 3 === 2);
    expectQuantizedBounds(resolvedBodyY, [-12, 12]);
    expectQuantizedBounds(resolvedY, [-16, 12]);
    expectQuantizedBounds(resolvedX, [0, 20]);
    expectQuantizedBounds(resolvedZ, [-40, 0]);
    const transform = {
      positionLdu: snapPlacementOriginForDefinition({
        definition,
        orientationId: "upright-yaw-0",
        rawLdu: [7, 0, -7],
      }),
      orientationId: "upright-yaw-0",
    } as const;

    expect(transform.positionLdu).toEqual([0, 0, 0]);
    for (const connector of definition.connectors) {
      const world = transformLduPoint(transform, connector.positionLdu);
      expectStudLatticeCoordinate(world[0]);
      expectStudLatticeCoordinate(world[2]);
    }

    const diagnostics: Parameters<typeof createCatalogPartGeometry>[3] = [];
    const rendered = createCatalogPartGeometry(
      createPartInstance({
        id: "off-centre-mesh-part",
        catalogPartId: definition.id,
        colorId: "builtin:red",
        transform,
      }),
      definition,
      true,
      diagnostics,
      "flat",
      resolver,
    );
    rendered.applyMatrix4(lduTransformToThreeMatrix(transform));
    const ghost = createPlacementGhost(definition, transform, "valid", resolver);
    const renderedBounds = new Box3().setFromObject(rendered);
    const ghostBounds = new Box3().setFromObject(ghost);

    expect(diagnostics).toEqual([]);
    expect(renderedBounds.min.toArray()).toEqual(ghostBounds.min.toArray());
    expect(renderedBounds.max.toArray()).toEqual(ghostBounds.max.toArray());
    expect(renderedBounds.getCenter(new Vector3()).toArray()).toEqual([
      expect.closeTo(0.5),
      expect.closeTo(0.1),
      expect.closeTo(-1),
    ]);

    const markup = renderToStaticMarkup(
      <PartPreview part={definition} colorHex="#C91A09" resolveMeshAsset={resolver} />,
    );
    expect(markup).toContain('data-preview-source="preloaded-mesh-asset"');
    expect(markup).toContain(`data-mesh-asset-id="${ASSET_ID}"`);
    expect(markup).toContain("0.00,-10.80");
    expect(markup).not.toContain("<ellipse");

    const { connectorGridCenterLdu, ...withoutConnectorGridTruth } = definition;
    expect(connectorGridCenterLdu).toEqual([10, -20]);
    expect(() => worldFootprint(withoutConnectorGridTruth, "upright-yaw-0")).toThrow(
      /connectorGridCenterLdu is missing/,
    );

    disposeObjectTree(rendered);
    disposeObjectTree(ghost);
  });
});
