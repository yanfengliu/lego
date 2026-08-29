import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { PART_DEFINITIONS } from "./index.js";
import {
  BUNDLED_LDRAW_ARCHIVE,
  BUNDLED_LDRAW_CLOSURES,
  BUNDLED_LDRAW_SOURCE_FILES,
} from "./ldraw-bundled-sources-6651557.ts";
import { SET_6651557_MEASURED_BLUEPRINTS } from "./part-blueprints-6651557-measured.ts";

const NOTICES_PATH = resolve(import.meta.dirname, "../../../docs/bundled-geometry-notices.md");
const PINNED_SHADOW_ROOT = "C:/tmp/ldcad-shadow-20260802";

const LDCAD_CONNECTOR_SOURCE_ID = "lego-studio:ldcad-shadow-measured-part-admission";

// Exact !HISTORY names read from the pinned admitted routes. The generator
// refuses an unlisted route file so a new contributor cannot disappear behind
// the catalog's intentionally compact shared attribution sentence.
const LDCAD_HISTORY_CONTRIBUTORS_BY_FILE: Readonly<Record<string, readonly string[]>> = {
  "p/axlehol4.dat": ["Roland Melkert"],
  "p/axlehol5.dat": ["Roland Melkert"],
  "p/stud.dat": ["Roland Melkert"],
  "p/stud2.dat": ["Roland Melkert"],
  "p/stud3.dat": ["Roland Melkert"],
  "p/stud4.dat": ["Roland Melkert"],
  "parts/11212.dat": ["Roland Melkert"],
  "parts/11253.dat": ["Jason McReynolds"],
  "parts/2436a.dat": ["Roland Melkert"],
  "parts/2436b.dat": ["Roland Melkert"],
  "parts/2453b.dat": ["Roland Melkert"],
  "parts/2450.dat": ["Roland Melkert"],
  "parts/28802.dat": ["Philippe Hurbain"],
  "parts/30357.dat": ["Roland Melkert"],
  "parts/30503.dat": ["Roland Melkert"],
  "parts/30565.dat": ["Roland Melkert"],
  "parts/32064a.dat": ["Roland Melkert"],
  "parts/3245a.dat": ["Roland Melkert"],
  "parts/3245b.dat": ["Roland Melkert"],
  "parts/3245c.dat": ["Roland Melkert"],
  "parts/33909.dat": ["Roland Melkert"],
  "parts/35464.dat": ["Roland Melkert"],
  "parts/41682.dat": ["Roland Melkert"],
  "parts/4519.dat": ["Roland Melkert"],
  "parts/49307.dat": ["Roland Melkert"],
  "parts/6106.dat": ["Roland Melkert"],
  "parts/73230.dat": ["Roland Melkert"],
  "parts/78329.dat": ["Roland Melkert"],
  "parts/79491.dat": ["Philippe Hurbain"],
  "parts/96910.dat": ["Roland Melkert"],
  "parts/s/25269s01.dat": ["Roland Melkert"],
  "parts/s/3245bs02.dat": ["Roland Melkert"],
  "parts/s/3245cs01.dat": ["Roland Melkert"],
  "parts/s/35787s01.dat": ["Roland Melkert"],
};

function admittedShadowHistoryContributors(
  shadowParts: typeof PART_DEFINITIONS,
): readonly string[] {
  const blueprints = new Map<string, (typeof SET_6651557_MEASURED_BLUEPRINTS)[number]>(
    SET_6651557_MEASURED_BLUEPRINTS.map((row) => [row.designId, row]),
  );
  const contributors = new Set<string>();
  for (const part of shadowParts) {
    const designId = part.aliases
      .find(({ namespace }) => namespace === "ldraw")!
      .value.replace(/\.dat$/u, "");
    const blueprint = blueprints.get(designId);
    if (blueprint === undefined || !("ldcadShadowSource" in blueprint)) {
      throw new Error(`LDCad-attributed catalog part ${part.id} has no measured shadow route.`);
    }
    for (const file of blueprint.ldcadShadowSource.shadowFiles) {
      const fileContributors = LDCAD_HISTORY_CONTRIBUTORS_BY_FILE[file];
      if (fileContributors === undefined) {
        throw new Error(
          `LDCad-attributed catalog part ${part.id} uses ${file}, whose pinned !HISTORY contributors are not recorded for the release notice.`,
        );
      }
      for (const contributor of fileContributors) contributors.add(contributor);
    }
  }
  return [...contributors].sort((left, right) => left.localeCompare(right));
}

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
  const shadowProvenances = [
    ...new Map(
      shadowParts.map(({ provenance }) => [
        `${provenance.sourceVersion}\0${provenance.attribution}`,
        provenance,
      ]),
    ).values(),
  ].sort((left, right) => left.attribution.localeCompare(right.attribution));
  const shadowHistoryContributors = admittedShadowHistoryContributors(shadowParts);
  const fileByPath = new Map(BUNDLED_LDRAW_SOURCE_FILES.map((file) => [file.path, file]));
  const licenseCounts = new Map<string, number>();
  for (const file of BUNDLED_LDRAW_SOURCE_FILES) {
    licenseCounts.set(file.licenseExpression, (licenseCounts.get(file.licenseExpression) ?? 0) + 1);
  }
  const ccBy4Count = licenseCounts.get("CC-BY-4.0") ?? 0;
  const dualLicenseCount = licenseCounts.get("CC-BY-2.0 OR CC-BY-4.0") ?? 0;
  const dualLicenseFiles = BUNDLED_LDRAW_SOURCE_FILES.filter(
    ({ licenseExpression }) => licenseExpression === "CC-BY-2.0 OR CC-BY-4.0",
  ).map(({ path }) => path);
  const expectedDualLicenseFiles = [
    "parts/2453b.dat",
    "parts/30503.dat",
    "parts/32064a.dat",
    "parts/3245c.dat",
  ];
  if (
    licenseCounts.size !== 2 ||
    dualLicenseCount !== 4 ||
    JSON.stringify(dualLicenseFiles) !== JSON.stringify(expectedDualLicenseFiles)
  ) {
    throw new Error(
      `Bundled LDraw licence summary expected CC-BY-4.0 plus four exact dual-licensed roots ${JSON.stringify(expectedDualLicenseFiles)}; received counts ${JSON.stringify(Object.fromEntries(licenseCounts))} and roots ${JSON.stringify(dualLicenseFiles)}. Review every new licence before regenerating notices.`,
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
    `The render mesh of the parts below is real LDraw geometry, bundled and redistributed under the [Creative Commons Attribution 4.0 International licence](https://creativecommons.org/licenses/by/4.0/). Of the ${BUNDLED_LDRAW_SOURCE_FILES.length} source files, ${ccBy4Count} declare CC BY 4.0 and ${dualLicenseFiles.map((path) => `\`${path}\``).join(", ")} declare \`CC-BY-2.0 OR CC-BY-4.0\`; this bundle selects their CC BY 4.0 option. Attribution therefore names every file whose triangles are bundled with its author, title, licence and content hash rather than flattening it into project-owned data.`,
    "",
    "Permission to reuse this geometry is **not** permission to train on it. That right is not held, and no bundled file is designated as a model-training or benchmark corpus.",
    "",
    "Catalog `/29` adds the two exact fully measured roots that close the remaining printed-step-50 catalogue identities. `10201` Bracket 1 x 2 - 1 x 4 with Rounded Corners uses an official 21-file closure, 660 triangles, 23 conservative body boxes plus six source-radius stud cylinders, and an exact LDCad route for four outward side studs, two top studs, and two explicitly opted-in square-S6 underside sockets. The official `10201.dat` root is an alias of `2436b.dat`, but only `10201.dat` is exposed as this catalogue identity. `3245b` Brick 1 x 2 x 2 with Inside Axle Holder uses an official 11-file closure, 144 triangles, 29 conservative body boxes plus two source-radius stud cylinders, and an exact LDCad route for two top studs, two round underside sockets, and one fixed female one-cap A6 x 44 blind axle socket. The socket preserves its exact catalog span from closed end `[0,-20,0]` to open mouth `[0,24,0]`, midpoint `[0,2,0]`, outward normal `[0,1,0]`, depth 44 LDU, and `slide=false`; it is not flattened into a directionless through-hole and grants no bore-relief or insertion-access claim. These definitions grant no bare or cross-suffix alias and, by themselves, no printed occurrence assignment, physical frame, placement, action-ledger, replay, document mutation, acceptance, or completion authority.",
    "",
    "Catalog `/28` adds two exact-suffix fully measured parts without treating the suffixes as interchangeable. `3245c` Brick 1 x 2 x 2 Without Understud uses an official 10-file closure, 152 triangles, 25 conservative body boxes plus two source-radius stud cylinders, and an exact LDCad route for two top studs and three half-pitch underside seats. Its two outer seats consume separate capacity cells while the center consumes both, so the two outers may coexist and the center conflicts with either. `2453b` Brick 1 x 1 x 5 with Solid Stud uses an official 6-file closure, 76 triangles, five conservative body boxes plus one source-radius stud cylinder, and an exact LDCad route for its top stud and one explicitly opted-in square-S6 underside socket. These generic catalog facts do not reinterpret the unresolved `3245;M` Builder record, the suffix-absent `2453;I` record, or any booklet pixel diagnostic. They grant no source-execution, printed identity, physical assignment, frame, placement, action-ledger, replay, document mutation, acceptance, or completion authority.",
    "",
    "Catalog `/27` adds four fully measured parts required by the bounded printed-step-50 prefix. `99563` Tile 1 x 2 Chamfered with 2 Top Indentations uses an official 10-file closure, 228 triangles, and 20 conservative body boxes; its exact LDCad route authors three half-pitch underside seats at z = -10, 0, and 10 LDU. Each outer seat consumes its adjacent half-capacity cell and the center consumes both, so the center conflicts with either outer while the two outer seats may coexist; these are exact occupancy semantics, not three independent full-pitch cells. `73230` Technic Brick 1 x 1 with Axle Hole uses an official 18-file closure, 294 triangles, 10 conservative body boxes plus one source-radius stud cylinder, and an exact LDCad route for its top stud, underside clutch, and transverse axle-hole endpoint at `[0,-2,0]` with normal `[-1,0,0]`. `35464` Slope 45 1 x 1 Double and `49307` Curved Slope 1 x 1 Outside Bow use official 5- and 7-file closures, 52 and 100 triangles, 75 conservative body boxes each, and one exact central LDCad underside seat each. Their catalog-local source frames and connector rows create no source-execution, prepared-run, printed-step physical-frame, placement, replay, or completion authority; they also make no claim of clutch strength, physical stability, insertion access, continuous axle sliding, or axle-bore collision relief.",
    "",
    "Catalog `/26` adds the fully measured `78329` Plate 1 x 5. Its official 9-file closure supplies the regular five-stud shell, 460 triangles, and a conservative field of 39 body boxes plus five source-radius stud cylinders; the checksum-pinned LDCad composition authors the matching five-cell underside clutch line and independently repeats the five visible stud frames. The width-first catalog frame uses yaw 90 and translation `[0,-4,0]`. The exact source stud radius remains ordinary collision truth at `6.0001514980873605` LDU, while the separately cross-bound nominal 6 LDU profile applies only when a validated stud/clutch edge authorizes insertion. This admission does not claim clutch strength, physical stability, insertion access, or a trusted step placement.",
    "",
    "Catalog `/25` adds the fully measured `33909` Plate 2 x 2 with 2 Studs on One Edge. Its official 9-file closure supplies the exact two-stud edge-plate shell, 220 triangles, and a conservative field of 41 body boxes plus two source-radius stud cylinders; the checksum-pinned LDCad composition authors the matching four-cell underside clutch lattice and independently repeats the two visible stud frames. Yaw 0 is retained as the measured canonical orientation. The exact source stud radius remains ordinary collision truth at `6.0001514980873605` LDU, while the separately cross-bound nominal 6 LDU profile applies only when a validated stud/clutch edge authorizes insertion. Revision-E record metadata from the checksum-pinned native pack reports four clutches but supplies no reviewed frame, so it remains count-only corroboration. This admission does not claim clutch strength, physical stability, insertion access, or a trusted step-76 placement.",
    "",
    "Catalog `/24` adds the fully measured `11212` Plate 3 x 3. Its official 10-file closure supplies the regular square shell, 844 triangles, and a conservative field of 129 body boxes plus nine source-radius stud cylinders; the checksum-pinned LDCad composition authors the matching nine-cell underside clutch lattice. The square geometry is quarter-turn symmetric, with yaw 0 retained as the canonical representative. The exact source stud radius remains ordinary collision truth at `6.0001514980873605` LDU, while the separately cross-bound nominal 6 LDU profile applies only when a validated stud/clutch edge authorizes insertion. Revision-I record metadata from the checksum-pinned native pack reports nine clutches but supplies no reviewed frame, so it remains count-only counterevidence. This admission does not claim clutch strength, physical stability, insertion access, or a trusted step-59 placement.",
    "",
    "Catalog `/23` adds the fully measured `32064` Technic Brick 1 x 2 with Axle Hole. Its moved-to official 23-file closure supplies the exact open-sided shell, 458 triangles, and a conservative field of 23 body boxes plus two source-radius stud cylinders; the checksum-pinned LDCad female A6 x 1 route authors one transverse axle-hole endpoint at `[0,-2,0]` in catalog space. Revision-I record metadata from the checksum-pinned native pack supplies no reviewed frame and remains counterevidence only. This admission does not claim continuous sliding, axle-through-bore collision relief, grip, stability, insertion access, or a trusted step placement; a structurally compatible axle edge can therefore remain blocked by body collision.",
    "",
    "The geometry supplies the expanded source-derived triangles, LDraw hard-edge normals, and envelope used by the app and palette. Catalog `/22` adds the fully measured `4519` Technic Axle 3: its official 4-file closure supplies the exact shaft-and-end surface, 176 triangles, and a 41-box conservative collision field, while the checksum-pinned direct LDCad `SNAP_CYL` A6 x 60 route authors three discrete axle seats at -20, 0, and 20 LDU along the source axis. This admission does not claim continuous sliding, grip, stability, axle-through-bore collision relief, or a trusted step-45 crop identity. Catalog `/21` added the fully measured `3040` 45-degree 1 x 2 slope: its official 11-file closure supplies the exact sloped shell, one source-stud surface, and the underside tube surfaces, while the checksum-pinned native Builder revision-F record authors two underside clutch cells through one exact reviewed Builder-to-catalog frame; its conservative collision field carries 67 boxes plus one source-radius stud cylinder. Catalog `/20` added the fully measured `2877` grille brick: its official 7-file closure supplies the exact grille shell and two source-stud surfaces, while the checksum-pinned native Builder revision-E record authors two underside clutch cells through one exact reviewed Builder-to-catalog frame; its conservative collision field carries 26 boxes plus two source-radius stud cylinders. Catalog `/19` added the fully measured `41682` vertical-stud bracket: its official 14-file closure supplies the exact horizontal plate, vertical wall, and two source-stud surfaces, while the pinned LDCad route authors four underside clutch cells and the two horizontal stud frames; its conservative collision field carries 54 boxes plus two source-radius stud cylinders. The side studs remain represented and collision-checked but unusable under the unchanged upright-only transform policy. Catalog `/18` added the fully measured `15254` thin-top arch: its official 15-file closure supplies the exact shell, six source-authored studs, and a 167-box conservative collision height field, while the checksum-pinned native Builder revision-J record authors two end clutch cells through one exact symmetry-canonicalized Builder-to-catalog frame. Catalog `/17` added the fully measured `11253` roller skate: its official 17-file closure supplies the exact irregular footwear-and-roller surface, one source-authored stud, and a 78-box conservative collision height field, while the pinned LDCad Shadow Library walk authors one clutch cell; the stud's exact source cylinder remains ordinary collision truth at radius `6.0001514980873605` LDU, and a separately cross-bound nominal 6 LDU profile may be used only by its exact validated stud-clutch edge. The unframed native Builder record remains count-only counterevidence. Catalog `/16` added the fully measured `35787` triangular tile: its official 22-file closure supplies the exact canonical diagonal surface and source-derived collision height field, while the pinned LDCad Shadow Library subpart authors three clutch cells; the unframed native Builder field remains counterevidence and is not merged. Catalog `/15` added the fully measured `28802` rounded-bottom bracket: its official 19-file closure supplies the exact render surface and source-derived collision height field, while the pinned LDCad route authors six outward stud frames and two clutch cells. Four studs face horizontally and remain unusable under the unchanged upright-only transform policy. Catalog `/14` added the fully measured `25269` quarter tile with a source-derived collision height field and one LDCad-authored clutch cell. The preceding `/13` change moved render geometry and normals for 24 catalog parts: 23 generated meshes use corrected source-exact triangulation, while `54200` replaced its `/12` parametric drawing with its exact mesh. The sixteen in-place `/12` and `/13` render promotions still preserve their prior conservative collision recipes instead of deriving collision from the mesh.",
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
    `The ${BUNDLED_LDRAW_SOURCE_FILES.length} files below comprise ${ccBy4Count} \`CC-BY-4.0\` declarations and four \`CC-BY-2.0 OR CC-BY-4.0\` declarations.`,
    "",
    "| File | Title | Author | Licence | LDraw.org status | SHA-256 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...fileRows,
    "",
    "## Derived connector data",
    "",
    "For `3245c`, the exact LDCad route authors two top studs and three round half-pitch underside seats; two inherited square-S6 declarations remain excluded. The negative outer and center seats share one capacity cell, while the center and positive outer share another. This admits exact generic connector occupancy without authenticating the unresolved Builder variant, a printed element, or a placement frame.",
    "",
    "For `2453b`, the exact LDCad route authors one top stud and one square-S6 underside socket. The socket passes the same bounded source-room control as the earlier calibrated square-S6 routes, but it does not identify an unsuffixed `2453` record or authorize a printed placement.",
    "",
    "For `3245b`, the exact LDCad route authors two top studs, two underside clutch cells, and one fixed one-sided axle socket. The female `caps=one`, A6 x 44 declaration is projected as `blindAxleHole`, with its finite axial span retained separately from the connector midpoint and its outward normal naming the only admitted mouth side. The span stays inside the measured body bounds; compatibility does not waive collision, prove insertion access, or imply continuous sliding.",
    "",
    "For `99563`, the exact LDCad route authors three half-pitch underside seats. The negative outer and center seats share one capacity cell; the center and positive outer seats share another. The center therefore excludes either outer while the two outers can be occupied together. This is deterministic connector occupancy only and does not authenticate any booklet placement or physical-performance claim.",
    "",
    "For `73230`, the exact LDCad walk authors one top stud frame, one underside clutch cell, and one capless, sliding, YOnly-scaled female A6 segment midpoint projected to a transverse axle-hole endpoint. Its nominal stud profile applies only to a validated stud/clutch edge, and the conservative body boxes remain independent collision truth; no continuous sliding or bore-relief claim follows.",
    "",
    "For `35464` and `49307`, each exact LDCad part route authors one central underside clutch cell in the same catalog frame as its official render geometry. Neither route authenticates a printed-step placement, stability, strength, or insertion path.",
    "",
    "For `78329`, the exact LDCad regular-grid route authors five underside clutch cells and independently repeats the five visible stud frames. The width-first yaw-90 catalog frame is shared by geometry and connectors. The connection-only nominal stud profile is cross-bound to the part collision record; it does not alter the exact source radius used for ordinary collision.",
    "",
    "For `33909`, the exact LDCad regular-grid route authors four underside clutch cells and independently repeats the two visible stud frames. Revision-E record metadata from the checksum-pinned native pack reports four clutches but supplies no reviewed frame, so it remains count-only corroboration. The connection-only nominal stud profile is cross-bound to the part collision record; it does not alter the exact source radius used for ordinary collision.",
    "",
    "For `11212`, the exact LDCad regular-grid route authors nine underside clutch cells and independently repeats the nine visible stud frames. Revision-I record metadata from the checksum-pinned native pack reports nine clutches but supplies no reviewed frame, so it remains count-only counterevidence. The connection-only nominal stud profile is cross-bound to the part collision record; it does not alter the exact source radius used for ordinary collision.",
    "",
    "For `32064`, the exact capless, sliding female A6 x 1 route authors one transverse axle-hole endpoint. Revision-I record metadata from the checksum-pinned native pack supplies no reviewed frame and remains counterevidence only, while the conservative body boxes remain independent collision truth.",
    "",
    `The parts below take connector frames from the [LDCad Shadow Library](https://github.${"com/RolandMelkert/LDCadShadowLibrary"}), which is licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). LEGO Builder has no record of the first three designs or \`41682\`; the exact \`41682\` shadow route authors four clutch cells and two outward side-stud frames that are independently reconciled with the official visible surface. Builder metadata does name \`25269\`, but record presence grants no connector authority; the shadow subpart directly authors its single central seat, so that admission does not consume or reinterpret the Builder record. For \`28802\`, the inspected Builder source instead identifies \`10201\`; that contradictory record is refused, while the exact shadow route authors two clutch cells and six outward stud frames that are independently reconciled with the official visible surface. Builder also names \`35787\`, but its type-23 field has no reviewed Builder-to-catalog frame and exposes only one family-15 node where the exact shadow subpart authors three cells. The catalog therefore selects the exclusive three-cell LDCad route. Builder's \`11253\` record likewise has no reviewed Builder-to-catalog frame; its one clutch agrees only in count with the exact one-cell shadow route and grants no connector authority. Both native records remain retained counterevidence and are not merged into the selected routes. For \`4519\`, the direct exact capless, centred and sliding A6 x 60 shaft route authors three discrete axle seats; those seats do not by themselves authorize continuous sliding or collision relief through a bore. Connector positions and female cells are not recoverable from LDraw geometry alone, so the named authored source is retained separately from the visible mesh and collision measurement.`,
    "",
    "No shadow file is bundled. What is admitted is derived data: connector frames and positions composed through each part's own LDraw reference tree in exact rational arithmetic. ShareAlike still attaches to that derived data if it is redistributed — the licence's sui generis database-rights clause reaches an extracted database too — and reading and sharing the library is **not** permission to train on it, which stays an unheld right.",
    "",
    `Exact admitted-route \`!HISTORY\` attribution: ${shadowHistoryContributors.join(", ")}. The notice generator maps every shadow file named by a catalog-authoritative connector route to its pinned header contributor and refuses an unmapped path.`,
    "",
    ...shadowProvenances.flatMap(({ sourceVersion, attribution }) => [
      `Source: \`${sourceVersion}\`.`,
      "",
      `Catalog-carried attribution: ${attribution}`,
      "",
    ]),
    "| Catalog part | LDraw file | Stud frames | Clutch cells | Axle seats | Through axle-hole seats | Blind axle sockets |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...shadowParts.map((part) => {
      const ldrawId = part.aliases.find(({ namespace }) => namespace === "ldraw")!.value;
      const studs = part.connectors.filter(({ kind }) => kind === "stud").length;
      const clutches = part.connectors.filter(({ kind }) => kind === "undersideClutch").length;
      const axles = part.connectors.filter(({ kind }) => kind === "axle").length;
      const axleHoles = part.connectors.filter(({ kind }) => kind === "axleHole").length;
      const blindAxleHoles = part.connectors.filter(({ kind }) => kind === "blindAxleHole").length;
      return `| \`${part.id}\` | \`${ldrawId}\` | ${studs} | ${clutches} | ${axles} | ${axleHoles} | ${blindAxleHoles} |`;
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

  it("renders every catalog-carried LDCad attribution and source pin", () => {
    const notices = readFileSync(NOTICES_PATH, "utf8");
    const shadowProvenances = PART_DEFINITIONS.filter(
      ({ provenance }) => provenance.sourceId === LDCAD_CONNECTOR_SOURCE_ID,
    ).map(({ provenance }) => provenance);

    for (const provenance of shadowProvenances) {
      expect(notices).toContain(provenance.sourceVersion);
      expect(notices).toContain(provenance.attribution);
    }
    for (const contributor of admittedShadowHistoryContributors(
      PART_DEFINITIONS.filter(
        ({ provenance }) => provenance.sourceId === LDCAD_CONNECTOR_SOURCE_ID,
      ),
    )) {
      expect(notices).toContain(contributor);
    }
  });

  it.skipIf(!existsSync(PINNED_SHADOW_ROOT))(
    "matches every release-notice contributor to the pinned shadow headers",
    () => {
      for (const [file, expected] of Object.entries(LDCAD_HISTORY_CONTRIBUTORS_BY_FILE)) {
        const source = readFileSync(resolve(PINNED_SHADOW_ROOT, file), "utf8");
        const contributors = [
          ...new Set(
            [...source.matchAll(/^0 !HISTORY \d{4}-\d{2}-\d{2} \{([^}]+)\}/gmu)].map(
              (match) => match[1]!,
            ),
          ),
        ].sort((left, right) => left.localeCompare(right));

        expect([file, contributors]).toEqual([file, expected]);
      }
    },
  );
});
