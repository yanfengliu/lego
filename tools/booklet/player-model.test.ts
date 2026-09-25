import { describe, expect, it } from "vitest";

import { mainModelStepRows } from "../../apps/web/src/player/player-data.ts";
import {
  libraryCandidates,
  packPlayerModel,
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

const pack = (steps: readonly (readonly ModelRow[])[], files = SYNTHETIC_LIBRARY) =>
  packPlayerModel({
    name: "fixture.ldr",
    header: ["0 Synthetic fixture", "0 Name: fixture.ldr"],
    steps,
    submodels: new Map([["assembly_0", [row("3024.dat", 47, 10)]]]),
    colours: COLOURS,
    library: library(files),
  });

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

  it("refuses a library file that would split the document", () => {
    const hostile = {
      ...SYNTHETIC_LIBRARY,
      "parts/3024.dat": "0 FILE other.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 3001.dat",
    };
    expect(() => pack([[row("3024.dat")]], hostile)).toThrowError(PlayerModelError);
  });
});
