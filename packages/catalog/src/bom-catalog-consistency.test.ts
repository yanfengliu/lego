import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BUILTIN_CATALOG_VERSION, PART_DEFINITIONS, getPartDefinition } from "./index.ts";

interface BomDataAsset {
  readonly id: string;
  readonly intent: string;
  readonly currentCatalogHistory?: string;
}

interface BomData {
  readonly dataAssets: readonly BomDataAsset[];
}

const bomMarkdown = readFileSync(
  new URL("../../../docs/dependency-data-bom.md", import.meta.url),
  "utf8",
);

function bomData(): BomData {
  const match = bomMarkdown.match(
    /<!-- bom-data:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- bom-data:end -->/u,
  );
  if (match?.[1] === undefined) throw new Error("dependency-data-bom.md has no BOM data block");
  return JSON.parse(match[1]) as BomData;
}

function requireAsset(id: string): BomDataAsset {
  const asset = bomData().dataAssets.find((candidate) => candidate.id === id);
  if (asset === undefined) throw new Error(`dependency-data-bom.md has no ${id} data record`);
  return asset;
}

describe("catalog BOM consistency", () => {
  it("binds the current human summary to the live catalog populations", () => {
    const sourceMeshCount = PART_DEFINITIONS.filter(
      ({ geometry }) => geometry.generatorId === "builtin:preloaded-mesh-reference/1",
    ).length;
    const measuredCount = PART_DEFINITIONS.filter(({ provenance }) =>
      [
        "lego-studio:measured-part-admission",
        "lego-studio:ldcad-shadow-measured-part-admission",
      ].includes(provenance.sourceId),
    ).length;
    const ldcadCount = PART_DEFINITIONS.filter(
      ({ provenance }) =>
        provenance.sourceId === "lego-studio:ldcad-shadow-measured-part-admission",
    ).length;
    const parametricRenderCount = PART_DEFINITIONS.length - sourceMeshCount;
    const renderOnlySourceMeshCount = sourceMeshCount - measuredCount;
    const currentSummary = bomMarkdown
      .split(/\r?\n/u)
      .find((line) => line.startsWith("The current `"));

    expect(currentSummary).toContain(
      `The current \`${BUILTIN_CATALOG_VERSION}\` catalog has ${PART_DEFINITIONS.length} parts: ${parametricRenderCount} retain parametric render recipes, ${renderOnlySourceMeshCount} retain project-authored physical recipes behind render-only source-mesh promotions, and ${measuredCount} are fully measured.`,
    );
    expect(currentSummary).toContain(`Its ${sourceMeshCount} official LDraw roots/closures`);
    expect(currentSummary).toContain(
      `${ldcadCount === 21 ? "Twenty-one" : String(ldcadCount)} fully measured definitions use exact LDCad connector routes.`,
    );
  });

  it("keeps the live 3245b one-sided socket consistent across machine BOM records", () => {
    const part = getPartDefinition("builtin:brick-1x2x2-inside-axle-holder");
    expect(part).toBeDefined();
    const sockets = part!.connectors.filter(({ kind }) => kind === "blindAxleHole");
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.axialSpan).toMatchObject({ depthLdu: 44, sliding: false });

    const taxonomy = requireAsset("builtin-stud-clutch-taxonomy");
    const shadow = requireAsset("ldcad-shadow-library-connectors");
    const currentClaims = [
      bomMarkdown.split(/\r?\n/u).find((line) => line.startsWith("The current `")) ?? "",
      taxonomy.intent,
      shadow.currentCatalogHistory ?? "",
      shadow.intent,
    ];
    for (const claim of currentClaims) {
      expect(claim).toContain("blindAxleHole");
      expect(claim).toMatch(/(?:one-cap|one admitted mouth side|closed end).*?(?:44 LDU|A6x44)/u);
      expect(claim).not.toMatch(
        /3245b[^.]*?(?:deliberately unprojected|emits no axle|projects no axle)/u,
      );
    }
  });
});
