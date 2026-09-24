import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PART_DEFINITIONS, PROPER_ORIENTATIONS } from "../packages/catalog/src/index.ts";
import { LDRAW_INTERCHANGE_FRAME_ROWS } from "../packages/catalog/src/ldraw-interchange-frames.generated.ts";
import {
  DEFAULT_OFFICIAL_ARCHIVE,
  GENERATED_PATH,
  deriveRows,
  officialArchivePath,
  readPinnedArchive,
  renderGenerated,
} from "./derive-ldraw-catalog-frames.mjs";
import {
  REVIEWED_FRAME_CHOICES,
  deriveLdrawCatalogFrame,
  expandLdrawPartForFrame,
} from "./ldraw-catalog-frame-derivation.mjs";
import { openExactLdrawArchive } from "./part-identification-prefix50-ldraw-catalog-frames-archive.mjs";
import { describeWithRunEvidence } from "./run-evidence-gate.mjs";

/**
 * Frame derivation on synthetic LDraw files, plus an opt-in check that the
 * committed frame table reproduces from the pinned official archive. Bound:
 * the synthetic files are boxes with stud primitives; the real library's
 * curves, subfile nesting and header variants are covered only by the opt-in
 * run over all parametric catalog parts.
 */
const HEADER = [
  "0 Test Part",
  "0 Name: test.dat",
  "0 Author: Test Author",
  "0 !LDRAW_ORG Part UPDATE 2026-01",
  "0 !LICENSE Licensed under CC BY 4.0 : see CAreadme.txt",
];

/** Quads of an axis-aligned box, as LDraw type-4 lines. */
function box([x0, y0, z0], [x1, y1, z1]) {
  const quad = (points) => `4 16 ${points.flat().join(" ")}`;
  return [
    quad([
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
      [x0, y0, z1],
    ]),
    quad([
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ]),
    quad([
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
    ]),
    quad([
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ]),
    quad([
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
    ]),
    quad([
      [x1, y0, z0],
      [x1, y0, z1],
      [x1, y1, z1],
      [x1, y1, z0],
    ]),
  ];
}

const stud = ([x, y, z]) => `1 16 ${x} ${y} ${z} 1 0 0 0 1 0 0 0 1 stud.dat`;

function archiveOf(lines) {
  const files = new Map([
    ["ldraw/parts/test.dat", Buffer.from([...HEADER, ...lines].join("\n"))],
    ["ldraw/p/stud.dat", Buffer.from(["0 Stud", ...box([-6, -4, -6], [6, 0, 6])].join("\n"))],
  ]);
  return {
    read(path) {
      const bytes = files.get(path);
      if (!bytes) throw new TypeError(`Pinned LDraw archive lacks exact member ${path}.`);
      return bytes;
    },
  };
}

const connector = (kind, positionLdu, normal) => ({
  id: `${kind}:${positionLdu.join(",")}`,
  kind,
  positionLdu,
  normal,
});
const UP = [0, -1, 0];

describe("LDraw-to-catalog frame derivation", () => {
  it("turns a 1 x 2 plate a quarter and lifts its origin to the top face", () => {
    // LDraw draws the plate along x with the origin on its top face.
    const expanded = expandLdrawPartForFrame(
      archiveOf([...box([-20, 0, -10], [20, 8, 10]), stud([-10, 0, 0]), stud([10, 0, 0])]),
      "test.dat",
    );
    const definition = {
      id: "test:plate-1x2",
      boundsLdu: { min: [-10, -8, -20], max: [10, 4, 20] },
      connectors: [connector("stud", [0, -4, -10], UP), connector("stud", [0, -4, 10], UP)],
    };
    expect(deriveLdrawCatalogFrame(definition, expanded, PROPER_ORIENTATIONS)).toEqual({
      orientationId: "upright-yaw-90",
      translationLdu: [0, -4, 0],
      candidates: 2,
      basis: "derived",
    });
    expect(expanded.header).toEqual({
      title: "Test Part",
      author: "Test Author",
      ldrawOrg: "Part UPDATE 2026-01",
      licenseExpression: "CC-BY-4.0",
    });
  });

  it("uses the studs to pick one turn of a square part whose studs are not symmetric", () => {
    // An L of three studs on a 2 x 2 square: the extent fits every yaw, the studs only one.
    const expanded = expandLdrawPartForFrame(
      archiveOf([
        ...box([-20, 0, -20], [20, 8, 20]),
        stud([-10, 0, -10]),
        stud([10, 0, -10]),
        stud([-10, 0, 10]),
      ]),
      "test.dat",
    );
    const definition = {
      id: "test:corner",
      boundsLdu: { min: [-20, -8, -20], max: [20, 4, 20] },
      connectors: [
        connector("stud", [10, -4, 10], UP),
        connector("stud", [-10, -4, 10], UP),
        connector("stud", [10, -4, -10], UP),
      ],
    };
    const frame = deriveLdrawCatalogFrame(definition, expanded, PROPER_ORIENTATIONS);
    expect(frame).toMatchObject({
      orientationId: "upright-yaw-180",
      translationLdu: [0, -4, 0],
      candidates: 1,
    });
  });

  it("refuses a file whose extent the catalog part does not match, naming both", () => {
    const expanded = expandLdrawPartForFrame(
      archiveOf(box([-20, 0, -10], [20, 8, 10])),
      "test.dat",
    );
    const definition = {
      id: "test:wrong",
      boundsLdu: { min: [-10, -8, -30], max: [10, 4, 30] },
      connectors: [],
    };
    expect(() => deriveLdrawCatalogFrame(definition, expanded, PROPER_ORIENTATIONS)).toThrow(
      /test:wrong: no proper orientation puts parts\/test\.dat .* fix the catalog part/u,
    );
  });

  it("refuses candidates the file cannot tell apart when the file is not symmetric between them", () => {
    // A 1 x 2 body with a notch at one end: the extent fits both half turns.
    const expanded = expandLdrawPartForFrame(
      archiveOf([...box([-20, 0, -10], [20, 8, 10]), ...box([14, 2, -2], [18, 6, 2])]),
      "test.dat",
    );
    const definition = {
      id: "test:notched",
      boundsLdu: { min: [-10, -4, -20], max: [10, 4, 20] },
      connectors: [],
    };
    expect(() => deriveLdrawCatalogFrame(definition, expanded, PROPER_ORIENTATIONS)).toThrow(
      /does not determine one frame/u,
    );
  });

  it("refuses a file whose licence is neither CC BY 2.0 nor 4.0", () => {
    const archive = archiveOf(box([-10, 0, -10], [10, 8, 10]));
    const original = archive.read;
    archive.read = (path) =>
      path === "ldraw/parts/test.dat"
        ? Buffer.from(original(path).toString("utf8").replace("CC BY 4.0", "All rights reserved"))
        : original(path);
    expect(() => expandLdrawPartForFrame(archive, "test.dat")).toThrow(
      /neither CC BY 2\.0 nor CC BY 4\.0/u,
    );
  });
});

/** A synthetic archive holding exactly `files` (path under ldraw/ -> lines). */
function archiveWith(files) {
  const bytes = new Map(
    Object.entries(files).map(([path, lines]) => [`ldraw/${path}`, Buffer.from(lines.join("\n"))]),
  );
  return {
    read(path) {
      const found = bytes.get(path);
      if (!found) throw new TypeError(`Pinned LDraw archive lacks exact member ${path}.`);
      return found;
    },
  };
}

const PLATE_1X2_LINES = [...box([-20, 0, -10], [20, 8, 10]), stud([-10, 0, 0]), stud([10, 0, 0])];
const STUD_FILE = ["0 Stud", ...box([-6, -4, -6], [6, 0, 6])];
const plate1x2Definition = (id) => ({
  id,
  boundsLdu: { min: [-10, -8, -20], max: [10, 4, 20] },
  connectors: [connector("stud", [0, -4, -10], UP), connector("stud", [0, -4, 10], UP)],
});

describe("reviewed frame choices", () => {
  // A 1 x 2 body with a notch at one end: yaw 90 and yaw 270 both fit its
  // extent, and the notch tells them apart, so only review can pick one.
  const notched = () =>
    expandLdrawPartForFrame(
      archiveOf([...box([-20, 0, -10], [20, 8, 10]), ...box([14, 2, -2], [18, 6, 2])]),
      "test.dat",
    );
  const definition = {
    id: "test:notched",
    boundsLdu: { min: [-10, -4, -20], max: [10, 4, 20] },
    connectors: [],
  };

  it("keeps the reviewed candidate and carries its why", () => {
    const choices = { "test.dat": { orientationId: "upright-yaw-270", why: "review picked it" } };
    expect(deriveLdrawCatalogFrame(definition, notched(), PROPER_ORIENTATIONS, choices)).toEqual({
      orientationId: "upright-yaw-270",
      translationLdu: [0, -4, 0],
      candidates: 2,
      basis: "reviewed-choice",
      why: "review picked it",
    });
  });

  it("refuses a reviewed frame the extent and studs do not leave as a candidate", () => {
    const choices = { "test.dat": { orientationId: "upright-yaw-0", why: "not measured" } };
    expect(() =>
      deriveLdrawCatalogFrame(definition, notched(), PROPER_ORIENTATIONS, choices),
    ).toThrow(
      /^test:notched: the reviewed frame upright-yaw-0 for test\.dat is not among the candidates the file's extent and studs leave \(upright-yaw-\d+, upright-yaw-\d+\); re-review it\.$/u,
    );
  });

  it("refuses a stale review of a file that already determines its frame", () => {
    const plate = expandLdrawPartForFrame(archiveOf(PLATE_1X2_LINES), "test.dat");
    const choices = { "test.dat": { orientationId: "upright-yaw-90", why: "no longer needed" } };
    expect(() =>
      deriveLdrawCatalogFrame(
        plate1x2Definition("test:plate"),
        plate,
        PROPER_ORIENTATIONS,
        choices,
      ),
    ).toThrow(
      "test:plate: test.dat has a reviewed frame choice, but the file already determines its frame; remove the stale review from REVIEWED_FRAME_CHOICES.",
    );
  });

  it("gives each committed reviewed choice a why, and the generated rows carry it", () => {
    const reviewedRows = LDRAW_INTERCHANGE_FRAME_ROWS.filter(
      ({ basis }) => basis === "reviewed-choice",
    );
    expect(
      reviewedRows.map(({ ldrawId, orientationId, why }) => ({ ldrawId, orientationId, why })),
    ).toEqual(
      Object.entries(REVIEWED_FRAME_CHOICES).map(([ldrawId, { orientationId, why }]) => ({
        ldrawId,
        orientationId,
        why,
      })),
    );
    expect(LDRAW_INTERCHANGE_FRAME_ROWS.filter(({ why }) => why !== undefined)).toHaveLength(2);
  });
});

describe("rows for the generated table", () => {
  const parametric = (id, aliases) => ({
    ...plate1x2Definition(id),
    aliases,
    geometry: { generatorId: "builtin:parametric-rectilinear-part/1" },
  });

  it("names a parametric part that has no ldraw alias", () => {
    const catalog = {
      PART_DEFINITIONS: [parametric("test:no-alias", [{ namespace: "display", value: "x" }])],
      PROPER_ORIENTATIONS,
    };
    expect(() => deriveRows(catalog, archiveOf(PLATE_1X2_LINES))).toThrow(
      'No frame for 1 parametric part(s):\n- test:no-alias: has no "ldraw" alias, so no official LDraw file names it and no frame can be measured; add its LDraw id as an alias ({ namespace: "ldraw", value: "<id>.dat" })',
    );
  });

  it("attributes a ~Moved to redirect to the part it moved to", () => {
    const archive = archiveWith({
      "parts/test.dat": [
        "0 ~Moved to testb",
        "0 Name: test.dat",
        "0 Author: Redirect Author",
        "0 !LDRAW_ORG Part UPDATE 2026-02",
        "0 !LICENSE Licensed under CC BY 4.0 : see CAreadme.txt",
        "1 16 0 0 0 1 0 0 0 1 0 0 0 1 testb.dat",
      ],
      "parts/testb.dat": [
        "0 Plate  1 x  2",
        "0 Name: testb.dat",
        "0 Author: Part Author",
        "0 !LDRAW_ORG Part UPDATE 2026-01",
        "0 !LICENSE Licensed under CC BY 2.0 and CC BY 4.0 : see CAreadme.txt",
        ...PLATE_1X2_LINES,
      ],
      "p/stud.dat": STUD_FILE,
    });
    const catalog = {
      PART_DEFINITIONS: [parametric("test:plate", [{ namespace: "ldraw", value: "test.dat" }])],
      PROPER_ORIENTATIONS,
    };

    const [row] = deriveRows(catalog, archive);

    expect(row).toMatchObject({
      ldrawId: "test.dat",
      orientationId: "upright-yaw-90",
      translationLdu: [0, -4, 0],
      basis: "derived",
      closureFileCount: 3,
      resolvedRoot: { ldrawId: "testb.dat", bytes: archive.read("ldraw/parts/testb.dat").length },
      title: "Plate  1 x  2",
      author: "Part Author",
      ldrawOrg: "Part UPDATE 2026-01",
      licenseExpression: "CC-BY-2.0 OR CC-BY-4.0",
    });
    expect(row.resolvedRoot.sha256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(renderGenerated([row])).toContain(
      `resolvedRoot: { ldrawId: "testb.dat", sha256: "${row.resolvedRoot.sha256}", bytes: ${row.resolvedRoot.bytes} }, title: "Plate  1 x  2", author: "Part Author"`,
    );
  });

  it("refuses a ~Moved to file that does more than place its target at the origin", () => {
    const archive = archiveWith({
      "parts/test.dat": [
        "0 ~Moved to testb",
        "0 Name: test.dat",
        "0 Author: Redirect Author",
        "0 !LDRAW_ORG Part UPDATE 2026-02",
        "0 !LICENSE Licensed under CC BY 4.0 : see CAreadme.txt",
        "1 16 0 -8 0 1 0 0 0 1 0 0 0 1 testb.dat",
      ],
    });
    expect(() => expandLdrawPartForFrame(archive, "test.dat")).toThrow(
      'ldraw/parts/test.dat is titled "~Moved to testb" but does not place exactly one file unturned at the origin; a redirect must, so that its target\'s frame is its own.',
    );
  });
});

describe("official archive path", () => {
  it("honours LEGO_LDRAW_OFFICIAL_ARCHIVE the way the script does, else the default", () => {
    expect(officialArchivePath({ LEGO_LDRAW_OFFICIAL_ARCHIVE: "D:/ldraw/pinned.zip" })).toBe(
      "D:/ldraw/pinned.zip",
    );
    expect(officialArchivePath({})).toBe(DEFAULT_OFFICIAL_ARCHIVE);
  });
});

describeWithRunEvidence(`reads the pinned official LDraw archive at ${officialArchivePath()}`)(
  "committed LDraw frame table",
  () => {
    it("reproduces byte for byte from the pinned archive", () => {
      const archive = openExactLdrawArchive(readPinnedArchive(officialArchivePath()));
      const text = renderGenerated(deriveRows({ PART_DEFINITIONS, PROPER_ORIENTATIONS }, archive));
      expect(readFileSync(GENERATED_PATH, "utf8").replaceAll("\r\n", "\n")).toBe(text);
    }, 120_000);
  },
);
