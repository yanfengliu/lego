import {
  createPreloadedMeshAssetResolver,
  getColorDefinition,
  getPartDefinition,
  meshAssetContentHash,
  type MeshAssetResolutionErrorCode,
  type MeshAssetResolver,
  type MeshReferenceGeometryRecipe,
  type PartDefinition,
  type PreloadedMeshAsset,
  type SourceProvenance,
} from "@lego-studio/catalog";
import { createPartInstance } from "@lego-studio/brick-kernel";
import { BufferGeometry, Color, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it, vi } from "vitest";

import { createCatalogPartGeometry } from "./geometry.ts";
import {
  RENDER_LIMITS,
  assertMeshGeometryBudget,
  createPlacementGhost,
  disposeObjectTree,
  estimateMeshRenderCost,
  instructionTone,
} from "./index.ts";

const ASSET_ID = "test:asymmetric-tetrahedron/1";
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

function meshRecipe(asset: PreloadedMeshAsset): MeshReferenceGeometryRecipe {
  return {
    generatorId: "builtin:preloaded-mesh-reference/1",
    assetId: asset.assetId,
    contentHash: meshAssetContentHash(asset),
    assetToCatalogFrame: {
      schemaVersion: "mesh-asset-to-catalog-frame/1",
      orientationId: "upright-yaw-90",
      translationLdu: [0, 0, 0],
    },
    provenance: TEST_MESH_PROVENANCE,
  };
}

function meshDefinition(): {
  readonly definition: PartDefinition;
  readonly resolver: MeshAssetResolver;
} {
  const base = getPartDefinition("builtin:brick-1x2")!;
  const asset = asymmetricAsset();
  return {
    definition: {
      ...base,
      id: "test:mesh-part",
      geometry: meshRecipe(asset),
    },
    resolver: createPreloadedMeshAssetResolver({ [ASSET_ID]: asset }),
  };
}

function part() {
  return createPartInstance({
    id: "mesh-part",
    catalogPartId: "test:mesh-part",
    colorId: "builtin:red",
  });
}

function meshes(root: ReturnType<typeof createCatalogPartGeometry>): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) found.push(object);
  });
  return found;
}

describe("preloaded mesh rendering", () => {
  it("budgets disposable per-instance mesh allocations for a 1465-piece scene", () => {
    const costs = Array.from({ length: 1_465 }, (_, index) => ({
      partId: `mesh-part-${index}`,
      vertexCount: 8,
      triangleCount: 12,
      bufferBytes: 8 * 36 + 12 * 24,
    }));

    expect(RENDER_LIMITS.maxParts).toBeGreaterThanOrEqual(costs.length);
    expect(() => assertMeshGeometryBudget(costs)).not.toThrow();
    expect(() =>
      assertMeshGeometryBudget([
        {
          partId: "vertex-overflow",
          vertexCount: RENDER_LIMITS.maxMeshVerticesPerScene + 1,
          triangleCount: 1,
          bufferBytes: 0,
        },
      ]),
    ).toThrow(/per-instance vertices.*renderer limit/);
    expect(() =>
      assertMeshGeometryBudget([
        {
          partId: "triangle-overflow",
          vertexCount: 3,
          triangleCount: RENDER_LIMITS.maxMeshTrianglesPerScene + 1,
          bufferBytes: 0,
        },
      ]),
    ).toThrow(/per-instance triangles.*renderer limit/);
    expect(() =>
      assertMeshGeometryBudget([
        {
          partId: "buffer-overflow",
          vertexCount: 0,
          triangleCount: 0,
          bufferBytes: RENDER_LIMITS.maxMeshBufferBytesPerScene + 1,
        },
      ]),
    ).toThrow(/BufferAttribute bytes.*renderer limit/);
  });

  it("budgets de-indexed instruction fills, role splits, colors, and worst-case outlines", () => {
    const triangleCount = 100_000;
    const heavilyIndexed: PreloadedMeshAsset = {
      assetId: "test:heavily-indexed-instruction/1",
      positionsLdu: [0, 0, 0, 20, 0, 0, 0, -8, 0],
      indices: Array.from({ length: triangleCount }, () => [0, 2, 1]).flat(),
      groups: [{ role: "body", triangleStart: 0, triangleCount }],
    };
    const heavyResolver = createPreloadedMeshAssetResolver({
      [heavilyIndexed.assetId]: heavilyIndexed,
    });
    const heavyResolution = heavyResolver(meshRecipe(heavilyIndexed));
    expect(heavyResolution.ok).toBe(true);
    if (!heavyResolution.ok) return;
    const flat = estimateMeshRenderCost("flat-heavy", heavyResolution.asset, {
      finish: "flat",
      includeStuds: true,
    });
    const instruction = estimateMeshRenderCost("instruction-heavy", heavyResolution.asset, {
      finish: "instruction",
      includeStuds: true,
    });

    expect(flat).toMatchObject({
      vertexCount: 3,
      triangleCount,
      bufferBytes: 3 * 36 + triangleCount * 24,
    });
    expect(instruction).toMatchObject({
      vertexCount: 3 + triangleCount * 9,
      triangleCount,
      bufferBytes: 3 * 36 + triangleCount * 240,
    });
    expect(() => assertMeshGeometryBudget([instruction, instruction, instruction])).toThrow(
      /per-instance vertices.*renderer limit/,
    );

    const sharedRoleVertices: PreloadedMeshAsset = {
      assetId: "test:shared-body-stud-vertices/1",
      positionsLdu: [0, 0, 0, 20, 0, 0, 0, -8, 0],
      indices: [0, 2, 1, 0, 2, 1],
      groups: [
        { role: "body", triangleStart: 0, triangleCount: 1 },
        { role: "stud", triangleStart: 1, triangleCount: 1 },
      ],
    };
    const sharedResolver = createPreloadedMeshAssetResolver({
      [sharedRoleVertices.assetId]: sharedRoleVertices,
    });
    const sharedResolution = sharedResolver(meshRecipe(sharedRoleVertices));
    expect(sharedResolution.ok).toBe(true);
    if (!sharedResolution.ok) return;
    expect(
      estimateMeshRenderCost("shared-roles", sharedResolution.asset, {
        finish: "instruction",
        includeStuds: true,
      }),
    ).toMatchObject({
      vertexCount: 6 + 2 * 9,
      triangleCount: 2,
      bufferBytes: 6 * 36 + 2 * 240,
    });
  });

  it("renders one cloned mesh, applies the asset frame once, and never draws collision studs", () => {
    const { definition, resolver } = meshDefinition();
    const diagnostics: Parameters<typeof createCatalogPartGeometry>[3] = [];
    const first = createCatalogPartGeometry(
      part(),
      definition,
      true,
      diagnostics,
      "flat",
      resolver,
    );
    const second = createCatalogPartGeometry(part(), definition, true, [], "flat", resolver);
    const firstMeshes = meshes(first);
    const secondMeshes = meshes(second);

    expect(diagnostics).toEqual([]);
    expect(firstMeshes).toHaveLength(1);
    expect(firstMeshes.filter(({ userData }) => userData.renderRole === "stud")).toEqual([]);
    expect(firstMeshes[0]!.userData).toMatchObject({
      renderRole: "body",
      primitiveId: `mesh:${ASSET_ID}`,
    });
    const firstGeometry = firstMeshes[0]!.geometry as BufferGeometry;
    const secondGeometry = secondMeshes[0]!.geometry as BufferGeometry;
    firstGeometry.computeBoundingBox();
    expect(firstGeometry.boundingBox?.min.toArray()).toEqual([
      expect.closeTo(0),
      expect.closeTo(0),
      expect.closeTo(-1),
    ]);
    expect(firstGeometry.boundingBox?.max.toArray()).toEqual([
      expect.closeTo(0.5),
      expect.closeTo(0.4),
      expect.closeTo(0),
    ]);
    expect(firstGeometry).not.toBe(secondGeometry);
    expect(firstGeometry.getAttribute("position").array).not.toBe(
      secondGeometry.getAttribute("position").array,
    );
    expect(firstGeometry.index?.array).not.toBe(secondGeometry.index?.array);
    expect(Array.from(firstGeometry.index!.array)).toEqual(asymmetricAsset().indices);
    expect(firstGeometry.getAttribute("normal").count).toBe(4);

    const disposed = vi.fn();
    firstGeometry.addEventListener("dispose", disposed);
    disposeObjectTree(first);
    expect(disposed).toHaveBeenCalledOnce();
    expect(secondGeometry.getAttribute("position").count).toBe(4);
    disposeObjectTree(second);
  });

  it("uses integrity-bound hard-normal islands instead of recomputing across coincident seams", () => {
    const asset: PreloadedMeshAsset = {
      assetId: "test:hard-normal-islands/1",
      positionsLdu: [0, 0, 0, 20, 0, 0, 0, -20, 0, 0, 0, 0, 20, 0, 0, 0, 0, 20],
      normalsAssetLocal: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      indices: [0, 1, 2, 3, 4, 5],
      groups: [{ role: "body", triangleStart: 0, triangleCount: 2 }],
    };
    const base = meshDefinition().definition;
    const geometryRecipe: MeshReferenceGeometryRecipe = {
      ...meshRecipe(asset),
      assetToCatalogFrame: {
        schemaVersion: "mesh-asset-to-catalog-frame/1",
        orientationId: "upright-yaw-0",
        translationLdu: [0, 0, 0],
      },
    };
    const definition: PartDefinition = { ...base, geometry: geometryRecipe };
    const resolver = createPreloadedMeshAssetResolver({ [asset.assetId]: asset });
    const rendered = createCatalogPartGeometry(part(), definition, true, [], "flat", resolver);
    const geometry = meshes(rendered)[0]!.geometry as BufferGeometry;

    expect(Array.from(geometry.getAttribute("normal").array)).toEqual([
      0, 0, 1, 0, 0, 1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    ]);
    expect(Array.from(geometry.index!.array)).toEqual([0, 2, 1, 3, 5, 4]);
    expect(geometry.getAttribute("position").count).toBe(6);
    disposeObjectTree(rendered);
  });

  it("honors includeStuds=false through integrity-bound triangle groups", () => {
    const asset: PreloadedMeshAsset = {
      assetId: "test:body-and-stud-triangles/1",
      positionsLdu: [0, 0, 0, 20, 0, 0, 0, -8, 0, 100, 0, 0, 120, 0, 0, 100, -8, 0],
      indices: [0, 2, 1, 3, 5, 4],
      groups: [
        { role: "body", triangleStart: 0, triangleCount: 1 },
        { role: "stud", triangleStart: 1, triangleCount: 1 },
      ],
    };
    const base = meshDefinition().definition;
    const definition: PartDefinition = { ...base, geometry: meshRecipe(asset) };
    const resolver = createPreloadedMeshAssetResolver({ [asset.assetId]: asset });
    const bodyOnly = createCatalogPartGeometry(part(), definition, false, [], "flat", resolver);
    const complete = createCatalogPartGeometry(part(), definition, true, [], "flat", resolver);
    const bodyGeometry = meshes(bodyOnly)[0]!.geometry as BufferGeometry;
    const completeGeometry = meshes(complete)[0]!.geometry as BufferGeometry;

    expect(bodyGeometry.index?.count).toBe(3);
    expect(completeGeometry.index?.count).toBe(6);
    expect(bodyGeometry.getAttribute("position").count).toBe(3);
    expect(completeGeometry.getAttribute("position").count).toBe(6);
    expect(bodyGeometry.userData).toMatchObject({ includedMeshRoles: ["body"] });
    expect(completeGeometry.userData).toMatchObject({ includedMeshRoles: ["body", "stud"] });
    expect(bodyGeometry.groups).toEqual([{ start: 0, count: 3, materialIndex: 0 }]);
    expect(completeGeometry.groups).toEqual([
      { start: 0, count: 3, materialIndex: 0 },
      { start: 3, count: 3, materialIndex: 0 },
    ]);
    bodyGeometry.computeBoundingBox();
    completeGeometry.computeBoundingBox();
    expect(bodyGeometry.boundingBox?.min.z).toBeCloseTo(-1);
    expect(completeGeometry.boundingBox?.min.z).toBeCloseTo(-6);

    disposeObjectTree(bodyOnly);
    disposeObjectTree(complete);
  });

  it("splits instruction body and stud groups so each receives its own booklet tone", () => {
    const asset: PreloadedMeshAsset = {
      assetId: "test:instruction-body-and-stud-triangles/1",
      positionsLdu: [0, 0, 0, 20, 0, 0, 0, 0, 20, 100, 0, 0, 120, 0, 0, 100, 0, 20],
      indices: [0, 2, 1, 3, 5, 4],
      groups: [
        { role: "body", triangleStart: 0, triangleCount: 1 },
        { role: "stud", triangleStart: 1, triangleCount: 1 },
      ],
    };
    const base = meshDefinition().definition;
    const definition: PartDefinition = { ...base, geometry: meshRecipe(asset) };
    const resolver = createPreloadedMeshAssetResolver({ [asset.assetId]: asset });
    const rendered = createCatalogPartGeometry(
      part(),
      definition,
      true,
      [],
      "instruction",
      resolver,
    );
    const renderedMeshes = meshes(rendered);
    const body = renderedMeshes.find(({ userData }) => userData.renderRole === "body")!;
    const stud = renderedMeshes.find(({ userData }) => userData.renderRole === "stud")!;
    const toneOf = (mesh: Mesh): number => {
      const color = mesh.geometry.getAttribute("color");
      return new Color().setRGB(color.getX(0), color.getY(0), color.getZ(0)).getHex();
    };
    const displayHex = Number.parseInt(getColorDefinition("builtin:red")!.displayHex.slice(1), 16);

    expect(renderedMeshes).toHaveLength(2);
    expect((body.geometry as BufferGeometry).userData).toMatchObject({
      renderRole: "body-geometry",
      includedMeshRoles: ["body"],
    });
    expect((stud.geometry as BufferGeometry).userData).toMatchObject({
      renderRole: "stud-geometry",
      includedMeshRoles: ["stud"],
    });
    expect(toneOf(body)).toBe(instructionTone(displayHex, 0, 1, 0));
    expect(toneOf(stud)).toBe(instructionTone(displayHex, 0, 1, 0, "stud-cap"));
    expect(toneOf(stud)).not.toBe(toneOf(body));
    disposeObjectTree(rendered);
  });

  it("uses the same resolved mesh for the placement ghost", () => {
    const { definition, resolver } = meshDefinition();
    const ghost = createPlacementGhost(
      definition,
      { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
      "valid",
      resolver,
    );
    const ghostMeshes = meshes(ghost);

    expect(ghost.userData).toMatchObject({
      sourceOfTruth: "catalog-derived-display",
      placeholder: false,
    });
    expect(ghostMeshes).toHaveLength(1);
    expect(ghostMeshes[0]!.userData).toMatchObject({
      renderRole: "placement-ghost-piece",
      primitiveId: `mesh:${ASSET_ID}`,
    });
    const geometry = ghostMeshes[0]!.geometry as BufferGeometry;
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.min.z).toBeCloseTo(-1);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(0.5);
    disposeObjectTree(ghost);
  });

  it.each([
    "MESH_GENERATOR_INVALID",
    "MESH_ASSET_MISSING",
    "MESH_ASSET_TAMPERED",
    "MESH_ASSET_OVERSIZED",
    "MESH_ASSET_NONFINITE",
    "MESH_ASSET_FLOAT32_RANGE",
    "MESH_ASSET_RENDER_PRECISION",
    "MESH_ASSET_INDEX_INVALID",
    "MESH_ASSET_TRIANGLE_INVALID",
    "MESH_ASSET_VERTEX_UNREFERENCED",
    "MESH_ASSET_GROUP_INVALID",
    "MESH_ASSET_COMPONENT_LIMIT",
    "MESH_ASSET_ID_INVALID",
    "MESH_ASSET_HASH_INVALID",
    "MESH_FRAME_MISSING",
    "MESH_FRAME_INVALID",
  ] as const)("reports %s and returns a conspicuous disposable placeholder", (code) => {
    const { definition } = meshDefinition();
    const diagnostics: Parameters<typeof createCatalogPartGeometry>[3] = [];
    const failingResolver: MeshAssetResolver = () => ({
      ok: false,
      code: code satisfies MeshAssetResolutionErrorCode,
      message: `${code} for ${ASSET_ID}`,
    });

    const group = createCatalogPartGeometry(
      part(),
      definition,
      true,
      diagnostics,
      "flat",
      failingResolver,
    );
    const placeholder = meshes(group)[0]!;

    expect(diagnostics).toEqual([
      { code, message: `${code} for ${ASSET_ID}`, partId: "mesh-part" },
    ]);
    expect(group.userData).toMatchObject({ placeholder: true, reason: code });
    expect(placeholder.userData).toMatchObject({ renderRole: "placeholder", reason: code });
    expect(placeholder.material).toBeInstanceOf(MeshBasicMaterial);
    expect((placeholder.material as MeshBasicMaterial).wireframe).toBe(true);
    expect((placeholder.material as MeshBasicMaterial).color.getHex()).toBe(0xff2bd6);
    disposeObjectTree(group);
  });

  it("keeps a missing placement mesh visible and attaches its typed diagnostic", () => {
    const { definition } = meshDefinition();
    const ghost = createPlacementGhost(
      definition,
      { positionLdu: [20, 0, 0], orientationId: "upright-yaw-0" },
      "blocked",
    );

    expect(ghost.userData).toMatchObject({
      sourceOfTruth: "catalog-mesh-placeholder",
      placeholder: true,
      diagnostics: [{ code: "MESH_ASSET_MISSING" }],
    });
    expect(meshes(ghost)[0]!.userData.renderRole).toBe("placeholder");
    disposeObjectTree(ghost);
  });
});
