import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PART_DEFINITIONS } from "./index.js";
import {
  BUNDLED_LDRAW_ARCHIVE,
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";

const NOTICES_PATH = resolve(import.meta.dirname, "../../../docs/bundled-geometry-notices.md");

const LDCAD_CONNECTOR_SOURCE_ID = "lego-studio:ldcad-shadow-measured-part-admission";

/**
 * The attribution the selected CC BY 4.0 option and CC BY-SA 4.0 require,
 * rendered from the catalog it describes.
 *
 * A notices file nobody regenerates is the failure mode this exists to prevent:
 * the document is derived here, so admitting or removing a bundled file — or a
 * part whose connectors a share-alike source authored — moves it in the same
 * commit or turns this test red.
 */
function renderNotices(): string {
  const meshParts = PART_DEFINITIONS.filter(
    ({ geometry }) => geometry.generatorId === "builtin:preloaded-mesh-reference/1",
  );
  const shadowParts = PART_DEFINITIONS.filter(
    ({ provenance }) => provenance.sourceId === LDCAD_CONNECTOR_SOURCE_ID,
  );
  const shadowProvenance = shadowParts[0]?.provenance;
  const fileByPath = new Map(BUNDLED_LDRAW_SOURCE_FILES.map((file) => [file.path, file]));
  const licenseCounts = new Map<string, number>();
  for (const file of BUNDLED_LDRAW_SOURCE_FILES) {
    licenseCounts.set(file.licenseExpression, (licenseCounts.get(file.licenseExpression) ?? 0) + 1);
  }
  const ccBy4Count = licenseCounts.get("CC-BY-4.0") ?? 0;
  const dualLicenseCount = licenseCounts.get("CC-BY-2.0 OR CC-BY-4.0") ?? 0;
  if (licenseCounts.size !== 2 || dualLicenseCount !== 1) {
    throw new Error(
      `Bundled LDraw licence summary expected CC-BY-4.0 plus one dual-licensed root; received ${JSON.stringify(Object.fromEntries(licenseCounts))}. Review every new licence before regenerating notices.`,
    );
  }
  const partRows = meshParts.map((part) => {
    const ldrawId = part.aliases.find(({ namespace }) => namespace === "ldraw")!.value;
    const closure = BUNDLED_LDRAW_CLOSURES[ldrawId.replace(".dat", "")]!;
    const root = fileByPath.get(`parts/${ldrawId}`)!;
    return `| \`${part.id}\` | \`${ldrawId}\` | ${root.title} | ${root.author} | \`${root.licenseExpression}\` | ${closure.length} |`;
  });
  const fileRows = BUNDLED_LDRAW_SOURCE_FILES.map(
    (file) =>
      `| \`${file.path}\` | ${file.title} | ${file.author} | \`${file.licenseExpression}\` | ${file.ldrawOrg} | \`${file.sha256.replace("sha256:", "")}\` |`,
  );
  return [
    "# Bundled geometry notices",
    "",
    "> Generated from the catalog by `packages/catalog/src/bundled-geometry-notices.test.ts`, which fails if this file and the catalog disagree. Do not edit by hand.",
    "",
    `The render mesh of the parts below is real LDraw geometry, bundled and redistributed under the [Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/). Of the ${BUNDLED_LDRAW_SOURCE_FILES.length} source files, ${ccBy4Count} declare CC BY 4.0 and \`parts/30503.dat\` declares \`CC-BY-2.0 OR CC-BY-4.0\`; this bundle selects its CC BY 4.0 option. Attribution therefore names every file whose triangles are bundled with its author, title, licence and content hash rather than flattening it into project-owned data.`,
    "",
    "Permission to reuse this geometry is **not** permission to train on it. That right is not held, and no bundled file is designated as a model-training or benchmark corpus.",
    "",
    "The geometry supplies the expanded source-derived triangles, LDraw hard-edge normals, and envelope used by the app and palette. Catalog `/13` changes render geometry and normals for all 24 catalog parts: 23 generated meshes use corrected source-exact triangulation, while `54200` replaces its `/12` parametric drawing with its exact mesh. Connector and collision truth remain independently authored; the sixteen in-place `/12` and `/13` render promotions explicitly preserve their prior conservative collision recipes instead of deriving collision from the mesh.",
    "",
    `Source archive: \`${BUNDLED_LDRAW_ARCHIVE.version}\`, ${BUNDLED_LDRAW_ARCHIVE.bytes} bytes, \`${BUNDLED_LDRAW_ARCHIVE.sha256}\`, from ${BUNDLED_LDRAW_ARCHIVE.source}.`,
    "",
    "## Bundled parts",
    "",
    "| Catalog part | LDraw file | Title | Author | Root licence | Closure files |",
    "| --- | --- | --- | --- | --- | --- |",
    ...partRows,
    "",
    "## Every bundled file",
    "",
    `The ${BUNDLED_LDRAW_SOURCE_FILES.length} files below comprise ${ccBy4Count} \`CC-BY-4.0\` declarations and one \`CC-BY-2.0 OR CC-BY-4.0\` declaration.`,
    "",
    "| File | Title | Author | Licence | LDraw.org status | SHA-256 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...fileRows,
    "",
    "## Derived connector data",
    "",
    "The parts below take their underside clutch cells from the [LDCad Shadow Library](https://github.com/RolandMelkert/LDCadShadowLibrary), which is licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). LEGO Builder has no record of any of these designs, and a female connector is not recoverable from LDraw geometry at all, so without that source each of them would carry studs and no clutch cell — a part that can be built on and can never be placed on anything.",
    "",
    "No shadow file is bundled. What is admitted is derived data: clutch-cell positions composed through each part's own LDraw reference tree in exact rational arithmetic. ShareAlike still attaches to that derived data if it is redistributed — the licence's sui generis database-rights clause reaches an extracted database too — and reading and sharing the library is **not** permission to train on it, which stays an unheld right.",
    "",
    ...(shadowProvenance === undefined
      ? []
      : [`Source: \`${shadowProvenance.sourceVersion}\`.`, ""]),
    "| Catalog part | LDraw file | Clutch cells |",
    "| --- | --- | --- |",
    ...shadowParts.map((part) => {
      const ldrawId = part.aliases.find(({ namespace }) => namespace === "ldraw")!.value;
      const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch").length;
      return `| \`${part.id}\` | \`${ldrawId}\` | ${clutches} |`;
    }),
    "",
  ].join("\n");
}

describe("bundled geometry notices", () => {
  it("reproduces docs/bundled-geometry-notices.md from the catalog", async () => {
    await expect(renderNotices()).toMatchFileSnapshot(NOTICES_PATH);
  });

  it("names every part whose geometry is bundled and no part whose geometry is not", () => {
    const notices = readFileSync(NOTICES_PATH, "utf8");

    for (const part of PART_DEFINITIONS) {
      const bundled = part.geometry.generatorId === "builtin:preloaded-mesh-reference/1";
      expect([part.id, notices.includes(`\`${part.id}\``)]).toEqual([part.id, bundled]);
    }
  });
});
