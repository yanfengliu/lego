import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { PART_DEFINITIONS, PROPER_ORIENTATIONS } from "../packages/catalog/src/index.ts";
import {
  DEFAULT_OFFICIAL_ARCHIVE,
  GENERATED_PATH,
  deriveRows,
  readPinnedArchive,
  renderGenerated,
} from "./derive-ldraw-catalog-frames.mjs";
import {
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

describeWithRunEvidence(`reads the pinned official LDraw archive at ${DEFAULT_OFFICIAL_ARCHIVE}`)(
  "committed LDraw frame table",
  () => {
    it("reproduces byte for byte from the pinned archive", () => {
      const archive = openExactLdrawArchive(readPinnedArchive(DEFAULT_OFFICIAL_ARCHIVE));
      const text = renderGenerated(deriveRows({ PART_DEFINITIONS, PROPER_ORIENTATIONS }, archive));
      expect(readFileSync(GENERATED_PATH, "utf8").replaceAll("\r\n", "\n")).toBe(text);
    }, 120_000);
  },
);
