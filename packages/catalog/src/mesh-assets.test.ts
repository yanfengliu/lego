import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  BUILTIN_CATALOG_VERSION,
  MESH_RENDER_QUANTIZATION_TOLERANCE_LDU,
  MESH_RENDER_UNITS_PER_LDU,
  PART_DEFINITIONS,
  createPreloadedMeshAssetResolver,
  meshAssetContentHash,
  type MeshAssetResolutionErrorCode,
  type MeshReferenceGeometryRecipe,
  type PartDefinition,
  type PreloadedMeshAsset,
  type SourceProvenance,
} from "./index.js";

const ASSET_ID = "test:asymmetric-tetrahedron/1";
type MeshPartDefinition = PartDefinition & { readonly geometry: MeshReferenceGeometryRecipe };

const isMeshPartDefinition = (part: PartDefinition): part is MeshPartDefinition =>
  part.geometry.generatorId === "builtin:preloaded-mesh-reference/1";

const TEST_MESH_PROVENANCE: SourceProvenance = {
  sourceId: "lego-studio:test-asymmetric-render-mesh",
  sourceType: "project-authored",
  sourceVersion: "1",
  licenseExpression: "MIT",
  attribution: "Synthetic test fixture authored for LEGO Studio.",
  runtimeRole: "render-mesh-asset",
  redistributionAllowed: true,
  trainingUseAllowed: false,
  externalGeometryBundled: false,
};

function asymmetricAsset(): PreloadedMeshAsset {
  return {
    assetId: ASSET_ID,
    positionsLdu: [0, 0, 0, 20, 0, 0, 0, -8, 0, 0, 0, 10],
    indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3],
    groups: [{ role: "body", triangleStart: 0, triangleCount: 4 }],
  };
}

function recipe(
  asset: PreloadedMeshAsset,
  contentHash = meshAssetContentHash(asset),
): MeshReferenceGeometryRecipe {
  return {
    generatorId: "builtin:preloaded-mesh-reference/1",
    assetId: asset.assetId,
    contentHash,
    assetToCatalogFrame: {
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-0",
      translationLdu: [0, 0, 0],
    },
    provenance: TEST_MESH_PROVENANCE,
  };
}

describe("preloaded mesh asset resolution", () => {
  it("keeps the exact promotions in place and appends the new source mesh", () => {
    // Sixteen existing rows render exact source meshes at /13; /14 through /17
    // each append one complete measured part. These literals pin the remaining
    // parametric geometry identities and full definitions; the full-definition
    // digest moves with catalog-version provenance.
    const promotedIds = new Set([
      "builtin:wedge-plate-2x4-left",
      "builtin:wedge-plate-2x4-right",
      "builtin:wedge-plate-2x3-left",
      "builtin:wedge-plate-2x3-right",
      "builtin:arch-1x4",
      "builtin:arch-1x6",
      "builtin:curved-slope-1x2",
      "builtin:curved-slope-1x3",
      "builtin:curved-slope-1x4",
      "builtin:cheese-slope-1x1",
      "builtin:cheese-slope-2x1",
      "builtin:wedge-plate-4x4-cut-corner",
      "builtin:wedge-plate-6x6-cut-corner",
      "builtin:wedge-plate-3x6-right",
      "builtin:corner-plate-4x4-round",
      "builtin:corner-plate-5x5-quarter-ring",
    ]);
    const legacyParts = PART_DEFINITIONS.slice(0, 77).filter(({ id }) => !promotedIds.has(id));
    const meshParts = PART_DEFINITIONS.filter(isMeshPartDefinition);
    const legacyRows = legacyParts.map(({ id, geometry }) => [id, geometry.contentHash]);
    const legacyHashes = JSON.stringify(legacyRows);

    expect(BUILTIN_CATALOG_VERSION).toBe("builtin.basic-parts/19");
    expect(PART_DEFINITIONS).toHaveLength(91);
    expect(
      PART_DEFINITIONS.filter(isMeshPartDefinition)
        .filter(({ geometry }) => geometry.collisionMode === "preserved-catalog-recipe")
        .map(({ id }) => id),
    ).toEqual([...promotedIds]);
    expect(
      legacyParts.every(
        ({ geometry }) => geometry.generatorId !== "builtin:preloaded-mesh-reference/1",
      ),
    ).toBe(true);
    expect(meshParts).toHaveLength(30);
    expect(
      meshParts
        .filter(({ geometry }) => geometry.collisionMode !== "preserved-catalog-recipe")
        .every(({ geometry }) => geometry.collisionMode === "mesh-derived-height-field"),
    ).toBe(true);
    expect(createHash("sha256").update(legacyHashes).digest("hex")).toBe(
      "1a24d723074372b10e3d5bb7b52a4487ef3c4f93e12ed9019da123e7103635b5",
    );
    expect(
      legacyParts
        .filter(
          ({ geometry }) =>
            !("undersideMode" in geometry) || geometry.undersideMode !== "modelled-shell-cavity",
        )
        .map(({ id }) => id),
    ).toEqual(["builtin:axle-1x2", "builtin:axle-1x4", "builtin:wheel-1x2"]);
    expect(
      createHash("sha256")
        .update(
          JSON.stringify(legacyParts)
            .replaceAll("builtin.basic-parts/19", "builtin.basic-parts/15")
            .replaceAll("rectilinear-stud-clearance/3", "rectilinear-stud-clearance/2"),
        )
        .digest("hex"),
    ).toBe("f21fdb9e016b1b6fba7bb25776f4b91eacff6d949bd938f5fd3cc94868df3984");
  });

  it("copies preloaded data and applies explicit orientation plus translation exactly once", () => {
    const asset = asymmetricAsset();
    const expectedRecipe: MeshReferenceGeometryRecipe = {
      ...recipe(asset),
      assetToCatalogFrame: {
        schemaVersion: "mesh-asset-to-catalog-frame/1",
        orientationId: "upright-yaw-90",
        translationLdu: [3, -4, 5],
      },
    };
    const resolver = createPreloadedMeshAssetResolver({ [ASSET_ID]: asset });
    (asset.positionsLdu as number[])[3] = 999;
    (asset.indices as number[])[0] = 3;
    (
      asset.groups as Array<{ role: "body"; triangleStart: number; triangleCount: number }>
    )[0]!.triangleCount = 1;

    const resolution = resolver(expectedRecipe);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    const framedPositions = [3, -4, 5, 3, -4, -15, 3, -12, 5, 13, -4, 5];
    const rendererPositions = framedPositions.map((coordinate, index) =>
      Math.fround(coordinate * MESH_RENDER_UNITS_PER_LDU * (index % 3 === 1 ? -1 : 1)),
    );
    const quantizedCatalogPositions = rendererPositions.map(
      (coordinate, index) => (coordinate * (index % 3 === 1 ? -1 : 1)) / MESH_RENDER_UNITS_PER_LDU,
    );
    expect(resolution.asset.positionsLdu).toEqual(quantizedCatalogPositions);
    expect(resolution.asset.normalsCatalogLocal).toBeNull();
    expect(
      resolution.asset.positionsLdu.map((coordinate, index) =>
        Math.fround(coordinate * MESH_RENDER_UNITS_PER_LDU * (index % 3 === 1 ? -1 : 1)),
      ),
    ).toEqual(rendererPositions);
    expect(resolution.asset.indices).toEqual([0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3]);
    expect(resolution.asset.groups).toEqual([{ role: "body", triangleStart: 0, triangleCount: 4 }]);
    expect(resolution.asset).toMatchObject({ vertexCount: 4, triangleCount: 4 });
    expect(Object.isFrozen(resolution.asset)).toBe(true);
    expect(Object.isFrozen(resolution.asset.positionsLdu)).toBe(true);
    expect(Object.isFrozen(resolution.asset.indices)).toBe(true);
    expect(Object.isFrozen(resolution.asset.groups)).toBe(true);
    expect(resolver(expectedRecipe)).toBe(resolution);

    const movedRecipe: MeshReferenceGeometryRecipe = {
      ...expectedRecipe,
      assetToCatalogFrame: {
        ...expectedRecipe.assetToCatalogFrame,
        translationLdu: [4, -4, 5],
      },
    };
    expect(movedRecipe.contentHash).toBe(expectedRecipe.contentHash);
    expect(JSON.stringify(movedRecipe)).not.toBe(JSON.stringify(expectedRecipe));
    expect(createHash("sha256").update(JSON.stringify(movedRecipe)).digest("hex")).not.toBe(
      createHash("sha256").update(JSON.stringify(expectedRecipe)).digest("hex"),
    );
    expect(resolver(movedRecipe)).not.toBe(resolution);
  });

  it("integrity-binds and rotates one source-faithful unit normal per position", () => {
    const asset: PreloadedMeshAsset = {
      ...asymmetricAsset(),
      normalsAssetLocal: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
    };
    const framedRecipe: MeshReferenceGeometryRecipe = {
      ...recipe(asset),
      assetToCatalogFrame: {
        schemaVersion: "mesh-asset-to-catalog-frame/1",
        orientationId: "upright-yaw-90",
        translationLdu: [3, -4, 5],
      },
    };
    const resolver = createPreloadedMeshAssetResolver({ [ASSET_ID]: asset });
    (asset.normalsAssetLocal as number[])[0] = 0;

    const resolution = resolver(framedRecipe);

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    expect(resolution.asset.normalsCatalogLocal).toEqual([0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1]);
    expect(Object.isFrozen(resolution.asset.normalsCatalogLocal)).toBe(true);
    expect(meshAssetContentHash(asset)).not.toBe(framedRecipe.contentHash);
  });

  it("refuses missing, nonfinite, and non-unit source normal rows by name", () => {
    const cases: Array<[string, readonly number[]]> = [
      ["missing", [1, 0, 0]],
      ["nonfinite", [Number.NaN, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]],
      ["non-unit", [2, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0]],
    ];
    for (const [label, normalsAssetLocal] of cases) {
      const asset: PreloadedMeshAsset = { ...asymmetricAsset(), normalsAssetLocal };
      const resolution = createPreloadedMeshAssetResolver({ [ASSET_ID]: asset })(recipe(asset));
      expect(resolution.ok, label).toBe(false);
      if (resolution.ok) continue;
      expect(resolution.code, label).toMatch(/MESH_ASSET_(?:NORMAL_INVALID|NONFINITE)/);
      expect(resolution.message, label).toMatch(/normal/i);
    }
  });

  it("admits coincident hard-normal islands but refuses a duplicate position-and-normal face", () => {
    const positionsLdu = [0, 0, 0, 20, 0, 0, 0, -8, 0, 0, 0, 0, 20, 0, 0, 0, -8, 0];
    const hardSeam: PreloadedMeshAsset = {
      assetId: ASSET_ID,
      positionsLdu,
      normalsAssetLocal: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      indices: [0, 1, 2, 3, 4, 5],
      groups: [{ role: "body", triangleStart: 0, triangleCount: 2 }],
    };
    const admitted = createPreloadedMeshAssetResolver({ [ASSET_ID]: hardSeam })(recipe(hardSeam));
    expect(admitted.ok).toBe(true);
    if (admitted.ok) expect(admitted.asset.componentFirstTriangles).toEqual([0]);

    const duplicateFace: PreloadedMeshAsset = {
      ...hardSeam,
      normalsAssetLocal: Array.from({ length: 6 }, () => [0, 0, 1]).flat(),
    };
    const refused = createPreloadedMeshAssetResolver({ [ASSET_ID]: duplicateFace })(
      recipe(duplicateFace),
    );
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.code).toBe("MESH_ASSET_RENDER_PRECISION");
    expect(refused.message).toMatch(/vertices 0 and 3 duplicate renderer-space position/);

    const precisionCollapsedAcrossNormals: PreloadedMeshAsset = {
      assetId: "test:normal-does-not-hide-position-collapse/1",
      positionsLdu: [1_000, 0, 0, 1_000.000_03, 0, 0, 1_000, 20, 0],
      normalsAssetLocal: [0, 0, 1, 0, 1, 0, 0, 0, 1],
      indices: [0, 1, 2],
      groups: [{ role: "body", triangleStart: 0, triangleCount: 1 }],
    };
    const collapsed = createPreloadedMeshAssetResolver({
      [precisionCollapsedAcrossNormals.assetId]: precisionCollapsedAcrossNormals,
    })(recipe(precisionCollapsedAcrossNormals));
    expect(collapsed).toMatchObject({ ok: false, code: "MESH_ASSET_RENDER_PRECISION" });
    if (!collapsed.ok) expect(collapsed.message).toMatch(/even though their normals may differ/);
  });

  it("rejects material coordinate drift and collapse after exact renderer Float32 quantization", () => {
    const vertexCollapseAsset = asymmetricAsset();
    const vertexCollapseResolver = createPreloadedMeshAssetResolver({
      [vertexCollapseAsset.assetId]: vertexCollapseAsset,
    });
    const vertexCollapseRecipe: MeshReferenceGeometryRecipe = {
      ...recipe(vertexCollapseAsset),
      assetToCatalogFrame: {
        ...recipe(vertexCollapseAsset).assetToCatalogFrame,
        translationLdu: [1_000_000_000, 0, 0],
      },
    };

    const vertexCollapse = vertexCollapseResolver(vertexCollapseRecipe);
    expect(vertexCollapse).toMatchObject({ ok: false, code: "MESH_ASSET_RENDER_PRECISION" });
    if (vertexCollapse.ok) return;
    expect(vertexCollapse.message).toMatch(/framed vertex.*drifting.*beyond tolerance/);
    expect(vertexCollapseResolver(vertexCollapseRecipe)).not.toBe(vertexCollapse);

    const boundsCollapseAsset: PreloadedMeshAsset = {
      assetId: "test:renderer-bounds-collapse/1",
      positionsLdu: [0, 0, 0, 20, 20, 0, 0, 0, 20],
      indices: [0, 1, 2],
      groups: [{ role: "body", triangleStart: 0, triangleCount: 1 }],
    };
    const boundsCollapseResolver = createPreloadedMeshAssetResolver({
      [boundsCollapseAsset.assetId]: boundsCollapseAsset,
    });
    const boundsCollapse = boundsCollapseResolver({
      ...recipe(boundsCollapseAsset),
      assetToCatalogFrame: {
        ...recipe(boundsCollapseAsset).assetToCatalogFrame,
        translationLdu: [1_000_000_000, 0, 0],
      },
    });

    expect(boundsCollapse).toMatchObject({ ok: false, code: "MESH_ASSET_RENDER_PRECISION" });
    if (boundsCollapse.ok) return;
    expect(boundsCollapse.message).toMatch(/framed vertex.*drifting.*beyond tolerance/);

    const materialDriftAsset: PreloadedMeshAsset = {
      assetId: "test:renderer-material-bound-drift/1",
      positionsLdu: [-10, 0, 0, 10, 0, 0, -10, -8, 0, -10, 0, 10],
      indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3],
      groups: [{ role: "body", triangleStart: 0, triangleCount: 4 }],
    };
    const materialDriftResolver = createPreloadedMeshAssetResolver({
      [materialDriftAsset.assetId]: materialDriftAsset,
    });
    const materialDrift = materialDriftResolver({
      ...recipe(materialDriftAsset),
      assetToCatalogFrame: {
        ...recipe(materialDriftAsset).assetToCatalogFrame,
        translationLdu: [100_000_003, 0, 0],
      },
    });

    expect(materialDrift).toMatchObject({ ok: false, code: "MESH_ASSET_RENDER_PRECISION" });
    if (materialDrift.ok) return;
    expect(materialDrift.message).toContain("X=99999993");
    expect(materialDrift.message).toContain("back to 99999990");
    expect(materialDrift.message).toContain(`tolerance ${MESH_RENDER_QUANTIZATION_TOLERANCE_LDU}`);
  });

  it.each(
    (() => {
      const valid = asymmetricAsset();
      const validRecipe = recipe(valid);
      const tampered = {
        ...asymmetricAsset(),
        positionsLdu: [0, 0, 0, 19, 0, 0, 0, -8, 0, 0, 0, 10],
      };
      const nonfinite = {
        ...asymmetricAsset(),
        positionsLdu: [0, 0, 0, Number.NaN, 0, 0, 0, -8, 0],
      };
      const outsideFloat32 = {
        ...asymmetricAsset(),
        positionsLdu: [0, 0, 0, 1e100, 0, 0, 0, -8, 0],
        indices: [0, 2, 1],
        groups: [{ role: "body" as const, triangleStart: 0, triangleCount: 1 }],
      };
      const badIndex = { ...asymmetricAsset(), indices: [0, 1, 99] };
      const badGroups = {
        ...asymmetricAsset(),
        groups: [{ role: "body" as const, triangleStart: 0, triangleCount: 3 }],
      };
      const unusedOutlier = {
        ...asymmetricAsset(),
        positionsLdu: [...asymmetricAsset().positionsLdu, 10_000, 10_000, 10_000],
      };
      const tooManyComponents: PreloadedMeshAsset = {
        ...asymmetricAsset(),
        positionsLdu: [0, 0, 0, 20, 0, 0, 0, -8, 0, 100, 0, 0, 120, 0, 0, 100, -8, 0],
        indices: [0, 2, 1, 3, 5, 4],
        groups: [{ role: "body", triangleStart: 0, triangleCount: 2 }],
      };
      const repeatedStudExtremum: PreloadedMeshAsset = {
        ...asymmetricAsset(),
        positionsLdu: [
          0, 0, 0, 20, 0, 0, 0, -8, 0, 10_000, -10_000, 10_000, 10_000, -10_000, 10_000, 10_000,
          -10_000, 10_000,
        ],
        indices: [0, 2, 1, 3, 4, 5],
        groups: [
          { role: "body", triangleStart: 0, triangleCount: 1 },
          { role: "stud", triangleStart: 1, triangleCount: 1 },
        ],
      };
      const collinearTriangle: PreloadedMeshAsset = {
        ...asymmetricAsset(),
        positionsLdu: [0, 0, 0, 10, 0, 0, 20, 0, 0],
        indices: [0, 1, 2],
        groups: [{ role: "body", triangleStart: 0, triangleCount: 1 }],
      };
      const nonfiniteArea: PreloadedMeshAsset = {
        ...asymmetricAsset(),
        positionsLdu: [0, 0, 0, 1e200, 0, 0, 0, 1e200, 0],
        indices: [0, 1, 2],
        groups: [{ role: "body", triangleStart: 0, triangleCount: 1 }],
      };
      const missingFrame = {
        ...validRecipe,
        assetToCatalogFrame: undefined,
      } as unknown as MeshReferenceGeometryRecipe;
      const invalidFrame: MeshReferenceGeometryRecipe = {
        ...validRecipe,
        assetToCatalogFrame: {
          ...validRecipe.assetToCatalogFrame,
          translationLdu: [0, 0.5, 0],
        },
      };
      return [
        ["missing", createPreloadedMeshAssetResolver({}), validRecipe, "MESH_ASSET_MISSING"],
        [
          "tampered",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: tampered }),
          validRecipe,
          "MESH_ASSET_TAMPERED",
        ],
        [
          "oversized",
          createPreloadedMeshAssetResolver(
            { [ASSET_ID]: valid },
            { maxVertices: 3, maxTriangles: 4 },
          ),
          validRecipe,
          "MESH_ASSET_OVERSIZED",
        ],
        [
          "nonfinite",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: nonfinite }),
          recipe(nonfinite),
          "MESH_ASSET_NONFINITE",
        ],
        [
          "index-invalid",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: badIndex }),
          recipe(badIndex),
          "MESH_ASSET_INDEX_INVALID",
        ],
        [
          "group-invalid",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: badGroups }),
          recipe(badGroups),
          "MESH_ASSET_GROUP_INVALID",
        ],
        [
          "unreferenced-vertex",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: unusedOutlier }),
          recipe(unusedOutlier),
          "MESH_ASSET_VERTEX_UNREFERENCED",
        ],
        [
          "component-limit",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: tooManyComponents }, { maxComponents: 1 }),
          recipe(tooManyComponents),
          "MESH_ASSET_COMPONENT_LIMIT",
        ],
        [
          "repeated-position-stud-extremum",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: repeatedStudExtremum }),
          recipe(repeatedStudExtremum),
          "MESH_ASSET_TRIANGLE_INVALID",
        ],
        [
          "collinear-triangle",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: collinearTriangle }),
          recipe(collinearTriangle),
          "MESH_ASSET_TRIANGLE_INVALID",
        ],
        [
          "nonfinite-area",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: nonfiniteArea }),
          recipe(nonfiniteArea),
          "MESH_ASSET_TRIANGLE_INVALID",
        ],
        [
          "outside-float32",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: outsideFloat32 }),
          recipe(outsideFloat32),
          "MESH_ASSET_FLOAT32_RANGE",
        ],
        [
          "frame-missing",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: valid }),
          missingFrame,
          "MESH_FRAME_MISSING",
        ],
        [
          "frame-invalid",
          createPreloadedMeshAssetResolver({ [ASSET_ID]: valid }),
          invalidFrame,
          "MESH_FRAME_INVALID",
        ],
      ] as const;
    })(),
  )("returns a typed %s failure", (_name, resolver, targetRecipe, expectedCode) => {
    const resolution = resolver(targetRecipe);

    expect(resolution).toMatchObject({
      ok: false,
      code: expectedCode satisfies MeshAssetResolutionErrorCode,
    });
    if (resolution.ok) return;
    expect(resolution.message).toContain(targetRecipe.assetId);
  });

  it("rejects delimiter/control ids and non-canonical hashes before registry lookup", () => {
    const asset = asymmetricAsset();
    const resolver = createPreloadedMeshAssetResolver({ [ASSET_ID]: asset });
    const validRecipe = recipe(asset);
    const invalidId: MeshReferenceGeometryRecipe = {
      ...validRecipe,
      assetId: "test:bad\0id",
    };
    const invalidHash: MeshReferenceGeometryRecipe = {
      ...validRecipe,
      contentHash: validRecipe.contentHash.toUpperCase() as `sha256:${string}`,
    };

    expect(resolver(invalidId)).toMatchObject({
      ok: false,
      code: "MESH_ASSET_ID_INVALID",
    });
    expect(resolver(invalidHash)).toMatchObject({
      ok: false,
      code: "MESH_ASSET_HASH_INVALID",
    });
  });

  it("rejects the generator before cache-key construction and never retains it as a success", () => {
    const asset = asymmetricAsset();
    const resolver = createPreloadedMeshAssetResolver(
      { [ASSET_ID]: asset },
      { maxResolvedCacheEntries: 1 },
    );
    const validRecipe = recipe(asset);
    const retainedSuccess = resolver(validRecipe);
    const wrongGenerator = {
      ...validRecipe,
      generatorId: `attacker:${"x".repeat(100_000)}`,
    } as unknown as MeshReferenceGeometryRecipe;

    const firstFailure = resolver(wrongGenerator);
    const secondFailure = resolver(wrongGenerator);

    expect(firstFailure).toMatchObject({ ok: false, code: "MESH_GENERATOR_INVALID" });
    expect(secondFailure).toMatchObject({ ok: false, code: "MESH_GENERATOR_INVALID" });
    expect(secondFailure).not.toBe(firstFailure);
    expect(resolver(validRecipe)).toBe(retainedSuccess);
  });

  it("caches only bounded successful resolutions, not attacker-controlled misses", () => {
    const asset = asymmetricAsset();
    const missingResolver = createPreloadedMeshAssetResolver({});
    const targetRecipe = recipe(asset);

    const firstMiss = missingResolver(targetRecipe);
    const secondMiss = missingResolver(targetRecipe);

    expect(firstMiss).toMatchObject({ ok: false, code: "MESH_ASSET_MISSING" });
    expect(secondMiss).not.toBe(firstMiss);
  });

  it("uses a deterministic hard-capped LRU for successful frame translations", () => {
    const asset = asymmetricAsset();
    const resolver = createPreloadedMeshAssetResolver(
      { [ASSET_ID]: asset },
      { maxResolvedCacheEntries: 2 },
    );
    const translated = (x: number): MeshReferenceGeometryRecipe => ({
      ...recipe(asset),
      assetToCatalogFrame: {
        ...recipe(asset).assetToCatalogFrame,
        translationLdu: [x, 0, 0],
      },
    });
    let maximumObservedDriftLdu = 0;
    const observeDrift = (resolution: ReturnType<typeof resolver>, translation: number): void => {
      if (!resolution.ok) return;
      for (let index = 0; index < resolution.asset.positionsLdu.length; index += 1) {
        const expected = asset.positionsLdu[index]! + (index % 3 === 0 ? translation : 0);
        maximumObservedDriftLdu = Math.max(
          maximumObservedDriftLdu,
          Math.abs(resolution.asset.positionsLdu[index]! - expected),
        );
      }
    };
    const first = resolver(translated(0));
    observeDrift(first, 0);
    let newest = resolver(translated(1));
    observeDrift(newest, 1);
    expect(resolver(translated(1))).toBe(newest);
    for (let translation = 2; translation <= 256; translation += 1) {
      newest = resolver(translated(translation));
      expect(newest).toMatchObject({ ok: true });
      observeDrift(newest, translation);
    }

    expect(maximumObservedDriftLdu).toBe(0.000_007_629_394_531_25);
    expect(MESH_RENDER_QUANTIZATION_TOLERANCE_LDU / maximumObservedDriftLdu).toBeGreaterThan(13);
    expect(resolver(translated(256))).toBe(newest);
    expect(resolver(translated(0))).not.toBe(first);
  });

  it("rejects aggregate registry asset, vertex, triangle, and logical-byte excess", () => {
    const first = asymmetricAsset();
    const second: PreloadedMeshAsset = { ...asymmetricAsset(), assetId: "test:second-mesh/1" };

    expect(() => createPreloadedMeshAssetResolver({ first, second }, { maxAssets: 1 })).toThrow(
      /aggregate limit is 1/,
    );
    expect(() => createPreloadedMeshAssetResolver({ first }, { maxTotalVertices: 3 })).toThrow(
      /aggregate limits are 3 vertices/,
    );
    expect(() => createPreloadedMeshAssetResolver({ first }, { maxTotalTriangles: 3 })).toThrow(
      /3 triangles/,
    );
    expect(() => createPreloadedMeshAssetResolver({ first }, { maxTotalBytes: 1 })).toThrow(
      /1 bytes/,
    );
  });
});
