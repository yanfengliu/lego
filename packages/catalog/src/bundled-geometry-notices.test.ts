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
    "The geometry supplies the expanded source-derived triangles, LDraw hard-edge normals, and envelope used by the app and palette. Catalog `/19` adds the fully measured `41682` vertical-stud bracket: its official 14-file closure supplies the exact horizontal plate, vertical wall, and two source-stud surfaces, while the pinned LDCad route authors four underside clutch cells and the two horizontal stud frames; its conservative collision field carries 54 boxes plus two source-radius stud cylinders. The side studs remain represented and collision-checked but unusable under the unchanged upright-only transform policy. Catalog `/18` added the fully measured `15254` thin-top arch: its official 15-file closure supplies the exact shell, six source-authored studs, and a 167-box conservative collision height field, while the checksum-pinned native Builder revision-J record authors two end clutch cells through one exact symmetry-canonicalized Builder-to-catalog frame. Catalog `/17` added the fully measured `11253` roller skate: its official 17-file closure supplies the exact irregular footwear-and-roller surface, one source-authored stud, and a 78-box conservative collision height field, while the pinned LDCad Shadow Library walk authors one clutch cell; the stud's exact source cylinder remains ordinary collision truth at radius `6.0001514980873605` LDU, and a separately cross-bound nominal 6 LDU profile may be used only by its exact validated stud-clutch edge. The unframed native Builder record remains count-only counterevidence. Catalog `/16` added the fully measured `35787` triangular tile: its official 22-file closure supplies the exact canonical diagonal surface and source-derived collision height field, while the pinned LDCad Shadow Library subpart authors three clutch cells; the unframed native Builder field remains counterevidence and is not merged. Catalog `/15` added the fully measured `28802` rounded-bottom bracket: its official 19-file closure supplies the exact render surface and source-derived collision height field, while the pinned LDCad route authors six outward stud frames and two clutch cells. Four studs face horizontally and remain unusable under the unchanged upright-only transform policy. Catalog `/14` added the fully measured `25269` quarter tile with a source-derived collision height field and one LDCad-authored clutch cell. The preceding `/13` change moved render geometry and normals for 24 catalog parts: 23 generated meshes use corrected source-exact triangulation, while `54200` replaced its `/12` parametric drawing with its exact mesh. The sixteen in-place `/12` and `/13` render promotions still preserve their prior conservative collision recipes instead of deriving collision from the mesh.",
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
    "The parts below take their connector cells from the [LDCad Shadow Library](https://github.com/RolandMelkert/LDCadShadowLibrary), which is licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). LEGO Builder has no record of the first three designs or `41682`; the exact `41682` shadow route authors four clutch cells and two outward side-stud frames that are independently reconciled with the official visible surface. Builder metadata does name `25269`, but record presence grants no connector authority; the shadow subpart directly authors its single central seat, so that admission does not consume or reinterpret the Builder record. For `28802`, the inspected Builder source instead identifies `10201`; that contradictory record is refused, while the exact shadow route authors two clutch cells and six outward stud frames that are independently reconciled with the official visible surface. Builder also names `35787`, but its type-23 field has no reviewed Builder-to-catalog frame and exposes only one family-15 node where the exact shadow subpart authors three cells. The catalog therefore selects the exclusive three-cell LDCad route. Builder's `11253` record likewise has no reviewed Builder-to-catalog frame; its one clutch agrees only in count with the exact one-cell shadow route and grants no connector authority. Both native records remain retained counterevidence and are not merged into the selected routes. A female connector is not recoverable from LDraw geometry alone, so the named authored source is retained separately from the visible mesh and collision measurement.",
    "",
    "No shadow file is bundled. What is admitted is derived data: connector frames and positions composed through each part's own LDraw reference tree in exact rational arithmetic. ShareAlike still attaches to that derived data if it is redistributed — the licence's sui generis database-rights clause reaches an extracted database too — and reading and sharing the library is **not** permission to train on it, which stays an unheld right.",
    "",
    ...(shadowProvenance === undefined
      ? []
      : [`Source: \`${shadowProvenance.sourceVersion}\`.`, ""]),
    "| Catalog part | LDraw file | Stud frames | Clutch cells |",
    "| --- | --- | --- | --- |",
    ...shadowParts.map((part) => {
      const ldrawId = part.aliases.find(({ namespace }) => namespace === "ldraw")!.value;
      const studs = part.connectors.filter(({ kind }) => kind === "stud").length;
      const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch").length;
      return `| \`${part.id}\` | \`${ldrawId}\` | ${studs} | ${clutches} |`;
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
