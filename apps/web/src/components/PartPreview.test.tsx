import {
  createPreloadedMeshAssetResolver,
  getPartDefinition,
  meshAssetContentHash,
  type PartDefinition,
  type PreloadedMeshAsset,
  type SourceProvenance,
} from "@lego-studio/catalog";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PartPreview } from "./PartPreview";

const ASSET: PreloadedMeshAsset = {
  assetId: "test:asymmetric-tetrahedron/1",
  positionsLdu: [0, 0, 0, 20, 0, 0, 0, -8, 0, 0, 0, 10],
  indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3],
  groups: [{ role: "body", triangleStart: 0, triangleCount: 4 }],
};
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

function meshDefinition(asset: PreloadedMeshAsset = ASSET): PartDefinition {
  return {
    ...getPartDefinition("builtin:brick-1x2")!,
    id: "test:mesh-part",
    geometry: {
      generatorId: "builtin:preloaded-mesh-reference/1",
      assetId: asset.assetId,
      contentHash: meshAssetContentHash(asset),
      assetToCatalogFrame: {
        schemaVersion: "mesh-asset-to-catalog-frame/1",
        orientationId: "upright-yaw-90",
        translationLdu: [0, 0, 0],
      },
      provenance: TEST_MESH_PROVENANCE,
    },
  };
}

describe("PartPreview mesh recipes", () => {
  it("projects the same resolved mesh and does not invent studs from collision", () => {
    const resolver = createPreloadedMeshAssetResolver({ [ASSET.assetId]: ASSET });
    const markup = renderToStaticMarkup(
      <PartPreview part={meshDefinition()} colorHex="#C91A09" resolveMeshAsset={resolver} />,
    );

    expect(markup).toContain('data-preview-source="preloaded-mesh-asset"');
    expect(markup).toContain(`data-mesh-asset-id="${ASSET.assetId}"`);
    expect(markup.match(/data-preview-surface="mesh-triangle"/g)).toHaveLength(4);
    expect(markup).not.toContain("<ellipse");
  });

  it("reports a missing mesh as a conspicuous preview placeholder", () => {
    const markup = renderToStaticMarkup(<PartPreview part={meshDefinition()} colorHex="#C91A09" />);

    expect(markup).toContain('data-preview-source="mesh-placeholder"');
    expect(markup).toContain('data-preview-diagnostic="MESH_ASSET_MISSING"');
    expect(markup).toContain("#ff2bd6");
    expect(markup).toContain("Paths and network URLs are not accepted");
  });

  it("renders a deterministic bounded geometry sample above 4120 source triangles", () => {
    const triangleCount = 4_121;
    const denseAsset: PreloadedMeshAsset = {
      assetId: "test:dense-preview/1",
      positionsLdu: [
        -100, 0, 0, -90, 0, 0, -100, -8, 0, 0, 0, 0, 20, 0, 0, 0, -8, 0, 0, -20, 100, 20, -20, 100,
        0, -28, 100, 0, 0, -100,
      ],
      indices: Array.from({ length: triangleCount }, (_, triangle) =>
        triangle === 0
          ? [0, 2, 1]
          : triangle === 4
            ? [3, 9, 4]
            : triangle === triangleCount - 1
              ? [6, 8, 7]
              : [3, 5, 4],
      ).flat(),
      groups: [
        { role: "body", triangleStart: 0, triangleCount: triangleCount - 1 },
        { role: "stud", triangleStart: triangleCount - 1, triangleCount: 1 },
      ],
    };
    const resolver = createPreloadedMeshAssetResolver({ [denseAsset.assetId]: denseAsset });
    const definition = meshDefinition(denseAsset);
    const markup = renderToStaticMarkup(
      <PartPreview part={definition} colorHex="#C91A09" resolveMeshAsset={resolver} />,
    );
    if (definition.geometry.generatorId !== "builtin:preloaded-mesh-reference/1") {
      throw new Error("Test fixture must use a preloaded mesh recipe");
    }
    const resolution = resolver(definition.geometry);
    if (!resolution.ok) throw new Error(resolution.message);
    const withoutExtrema = renderToStaticMarkup(
      <PartPreview
        part={definition}
        colorHex="#C91A09"
        resolveMeshAsset={() => ({
          ok: true,
          asset: { ...resolution.asset, extremalTriangles: [] },
        })}
      />,
    );

    expect(markup).toContain('data-preview-source="preloaded-mesh-asset"');
    expect(markup).toContain('data-preview-source-triangles="4121"');
    expect(markup).toContain('data-preview-rendered-triangles="2000"');
    expect(markup).toContain('data-preview-sampled="true"');
    expect(markup).toContain('data-preview-source-triangle="0"');
    expect(markup).toContain('data-preview-source-triangle="1"');
    expect(markup).toContain('data-preview-source-triangle="4"');
    expect(markup).toContain('data-preview-source-triangle="4120"');
    expect(withoutExtrema).not.toContain('data-preview-source-triangle="4"');
    expect(markup.match(/data-preview-surface="mesh-triangle"/g)).toHaveLength(2_000);
    expect(markup).not.toContain('data-preview-source="mesh-placeholder"');
  });
});
