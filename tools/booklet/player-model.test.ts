import { describe, expect, it } from "vitest";

import { mainModelStepRows } from "../../apps/web/src/player/player-data.ts";
import {
  libraryCandidates,
  packPlayerModel,
  PLAYER_MODEL_LIMITS,
  PlayerModelError,
  type LibraryReader,
  type ModelRow,
} from "./player-model.ts";

const library = (files: Record<string, string>): LibraryReader => ({
  read: (path) => files[path] ?? null,
});

const SYNTHETIC_LIBRARY = {
  "parts/3001.dat": [
    "0 Brick 2 x 4",
    "0 Name: 3001.dat",
    "0 Author: Synthetic",
    "0 !LDRAW_ORG Part UPDATE 2004-03",
    "1 16 0 0 0 1 0 0 0 1 0 0 0 1 s\\3001s01.dat",
    "1 16 0 0 0 1 0 0 0 1 0 0 0 1 stud.dat",
  ].join("\r\n"),
  "parts/s/3001s01.dat":
    "0 ~Brick 2 x 4 - body\n0 !LDRAW_ORG Subpart\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 48\\4-4cyli.dat\n4 16 0 0 0 1 0 0 1 1 0 0 1 0",
  "p/stud.dat": "0 Stud\n0 !LDRAW_ORG Primitive\n3 16 0 0 0 1 0 0 0 0 1",
  "p/48/4-4cyli.dat": "0 Cylinder\n0 !LDRAW_ORG 48_Primitive\n3 16 0 0 0 1 0 0 0 1 0",
  "parts/3024.dat": "0 Plate 1 x 1\n0 !LDRAW_ORG Part\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 stud.dat",
  // A primitive with the same name as a part: parts/ wins, as LDraw's search order says.
  "p/3024.dat": "0 decoy",
};

const COLOURS = [
  "0 LDraw.org Configuration File",
  "0 !COLOUR Red CODE 4 VALUE #C91A09 EDGE #333333",
  "0 !COLOUR Trans_Clear CODE 47 VALUE #FCFCFC EDGE #C3C3C3 ALPHA 128",
].join("\n");

const row = (filename: string, colorCode = 4, x = 0): ModelRow => ({
  colorCode,
  positionLdu: [x, -0, 0],
  matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  filename,
});

const pack = (
  steps: readonly (readonly ModelRow[])[],
  files: Record<string, string> = SYNTHETIC_LIBRARY,
  submodels = new Map([["assembly_0", [row("3024.dat", 47, 10)]]]),
) =>
  packPlayerModel({
    name: "fixture.ldr",
    header: ["0 Synthetic fixture", "0 Name: fixture.ldr"],
    steps,
    submodels,
    colours: COLOURS,
    library: library(files),
  });

/** A library file whose only row names `reference`. */
const naming = (reference: string) => `0 Synthetic\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${reference}`;

describe("packPlayerModel", () => {
  it("resolves references in LDraw's search order", () => {
    expect(libraryCandidates("3001.dat")).toEqual(["parts/3001.dat", "p/3001.dat"]);
    expect(libraryCandidates("S\\3001S01.DAT")).toEqual(["parts/s/3001s01.dat"]);
    expect(libraryCandidates("48\\4-4cyli.dat")).toEqual(["p/48/4-4cyli.dat"]);
    expect(libraryCandidates("8/4-4cyli.dat")).toEqual(["p/8/4-4cyli.dat"]);
  });

  it("closes each printed step with one 0 STEP, an empty step included, and embeds every reached file once", () => {
    const packed = pack([
      [row("3001.dat"), row("3024.dat", 47, 20)],
      [],
      [row("ASSEMBLY_0", 16, 40)],
    ]);
    expect(mainModelStepRows(packed.text)).toEqual([2, 0, 1]);
    const files = [...packed.text.matchAll(/^0 FILE (.+)$/gmu)].map((match) => match[1]);
    expect(files).toEqual([
      "fixture.ldr",
      "parts/3001.dat",
      "parts/3024.dat",
      "assembly_0",
      "parts/s/3001s01.dat",
      "p/stud.dat",
      "p/48/4-4cyli.dat",
    ]);
    expect(packed.libraryFiles).toBe(5);
    expect(packed.submodels).toBe(1);
    // References point at the embedded names; the decoy primitive is never reached.
    expect(packed.text).toContain("1 16 0 0 0 1 0 0 0 1 0 0 0 1 parts/s/3001s01.dat");
    expect(packed.text).toContain("1 16 0 0 0 1 0 0 0 1 0 0 0 1 p/48/4-4cyli.dat");
    expect(packed.text).toContain("1 4 0 0 0 1 0 0 0 1 0 0 0 1 parts/3001.dat");
    expect(packed.text).not.toContain("decoy");
    expect(packed.text).not.toContain("\r");
    expect(packed.text).not.toContain("-0 ");
  });

  it("puts the library's colours in the main model, before the first part row", () => {
    const packed = pack([[row("3024.dat", 47)]]);
    const main = packed.text.slice(0, packed.text.indexOf("\n0 FILE parts/"));
    expect(main).toContain("0 !COLOUR Trans_Clear CODE 47 VALUE #FCFCFC EDGE #C3C3C3 ALPHA 128");
    expect(main).not.toContain("Configuration File");
    expect(main.indexOf("!COLOUR")).toBeLessThan(main.indexOf("\n1 "));
    expect(packed.colours).toBe(2);
  });

  it("refuses a reference no library file answers, naming it and the step", () => {
    expect(() => pack([[row("3001.dat")], [row("9999.dat")]])).toThrowError(
      /Printed step 2 names 9999\.dat, which the LDraw library does not hold \(looked in parts\/9999\.dat, p\/9999\.dat\)/u,
    );
    const missingSubpart = { ...SYNTHETIC_LIBRARY, "parts/s/3001s01.dat": undefined } as never;
    expect(() => pack([[row("3001.dat")]], missingSubpart)).toThrowError(
      /parts\/3001\.dat names s\\3001s01\.dat/u,
    );
  });

  it("refuses a file that reaches itself, directly or through others, naming the cycle", () => {
    const selfPart = { ...SYNTHETIC_LIBRARY, "parts/3024.dat": naming("3024.dat") };
    expect(() => pack([[row("3024.dat")]], selfPart)).toThrowError(
      /reference cycle: parts\/3024\.dat -> parts\/3024\.dat\. An LDraw loader would expand it forever/u,
    );
    const selfModel = new Map([["assembly_0", [row("ASSEMBLY_0")]]]);
    expect(() => pack([[row("assembly_0")]], SYNTHETIC_LIBRARY, selfModel)).toThrowError(
      /reference cycle: assembly_0 -> assembly_0\./u,
    );
    // Entered through x.dat: the message names the loop, not the way in.
    const loop = {
      ...SYNTHETIC_LIBRARY,
      "parts/x.dat": naming("a.dat"),
      "parts/a.dat": naming("b.dat"),
      "parts/b.dat": naming("A.DAT"),
    };
    expect(() => pack([[row("3001.dat")], [row("x.dat")]], loop)).toThrowError(
      /reference cycle: parts\/a\.dat -> parts\/b\.dat -> parts\/a\.dat\./u,
    );
    expect(() => pack([[row("x.dat")]], loop)).toThrowError(PlayerModelError);
  });

  describe("nesting depth", () => {
    const { maxDepth } = PLAYER_MODEL_LIMITS;
    /** parts/c0.dat -> c1.dat -> ... : a chain of `length` files. */
    const chain = (length: number) =>
      Object.fromEntries(
        Array.from({ length }, (_, index) => [
          `parts/c${index}.dat`,
          index + 1 < length ? naming(`c${index + 1}.dat`) : "0 Leaf\n3 16 0 0 0 1 0 0 0 1 0",
        ]),
      );
    const tooDeep =
      /nests files more than 64 deep: parts\/c0\.dat -> parts\/c1\.dat -> parts\/c2\.dat -> … 59 more … -> parts\/c62\.dat -> parts\/c63\.dat -> parts\/c64\.dat;/u;

    it("allows a chain of maxDepth files and refuses a longer one, naming it", () => {
      expect(maxDepth).toBe(64);
      expect(() => pack([[row("c0.dat")]], chain(maxDepth))).not.toThrow();
      expect(() => pack([[row("c0.dat")]], chain(maxDepth + 1))).toThrowError(tooDeep);
    });

    it("measures the longest chain, not the shortest path packing reached a file by", () => {
      // The main model names c63 before c0, so packing first reaches c63 and c64 one and
      // two levels down; a loader still expands c0's chain 65 files deep.
      expect(() =>
        pack([[row(`c${maxDepth - 1}.dat`)], [row("c0.dat")]], chain(maxDepth + 1)),
      ).toThrowError(tooDeep);
    });
  });

  it("refuses a sub-model named like the main model", () => {
    const shadow = new Map([["Fixture.ldr", [row("3024.dat")]]]);
    expect(() => pack([[row("3001.dat")]], SYNTHETIC_LIBRARY, shadow)).toThrowError(
      /A sub-model is named fixture\.ldr, like the main model/u,
    );
  });

  it("refuses a library file that would split the document", () => {
    const hostile = {
      ...SYNTHETIC_LIBRARY,
      "parts/3024.dat": "0 FILE other.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    };
    expect(() => pack([[row("3024.dat")]], hostile)).toThrowError(PlayerModelError);
  });
});
