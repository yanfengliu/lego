import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AnswerKeyFormatError,
  loadAnswerKey,
  pairOfficialLdraw,
  parseLxfml,
  parseOfficialLdraw,
} from "./index.ts";
import { exportRows, exportText, FRAMES, LXFML } from "./pairing-fixture.ts";

/** The pairing check on a faithful and on a shifted export of the fixture model. */
describe("official LDraw pairing", () => {
  it("verifies designs placed more than once and reports the rest as unverified", () => {
    const model = parseLxfml(LXFML, "fixture");
    const pairing = pairOfficialLdraw(model.bricks, parseOfficialLdraw(exportText(exportRows())));
    expect(pairing.invarianceFailures).toEqual([]);
    expect(pairing.colorConflicts).toEqual([]);
    expect(pairing.counts).toEqual({
      verifiedDesigns: 2,
      verifiedBricks: 6,
      singleInstanceDesigns: 1,
      compositeBricks: 1,
      contradictedDesigns: 0,
    });
    expect(pairing.byBrick.get("b1")!.pairing).toBe("single-instance");
    expect(pairing.byBrick.get("c1")!.pairing).toBe("composite");
    expect(pairing.byBrick.get("p2")!.pairing).toBe("verified");
    // The frame the export applied comes back out, in the pins' convention.
    const plate = pairing.designFrames.get("3023;S")!;
    expect(plate.turn).toEqual(FRAMES["3023;S"]!.turn);
    expect(plate.originLdu).toEqual(FRAMES["3023;S"]!.origin);
    expect(pairing.designFrames.get("3001;A")!.originLdu).toEqual([30, 24, -10]);
  });

  it("turns red on an export shifted by one row", () => {
    const rows = exportRows();
    const shifted = [...rows.slice(1), rows[0]!];
    const model = parseLxfml(LXFML, "fixture");
    const pairing = pairOfficialLdraw(
      model.bricks,
      parseOfficialLdraw(exportText(shifted)),
      "shifted.ldr",
    );
    expect(pairing.invarianceFailures.length).toBeGreaterThan(0);
    expect(pairing.invarianceFailures[0]).toMatch(/shifted\.ldr line \d+/u);
    expect(pairing.counts.contradictedDesigns).toBeGreaterThan(0);
  });

  it("turns red when two rows of one design trade places, where file names still agree", () => {
    const rows = exportRows();
    const swapped = [...rows];
    [swapped[0], swapped[1]] = [rows[1]!, rows[0]!];
    const model = parseLxfml(LXFML, "fixture");
    const pairing = pairOfficialLdraw(model.bricks, parseOfficialLdraw(exportText(swapped)));
    expect(pairing.invarianceFailures.length).toBeGreaterThan(0);
    expect(pairing.byBrick.get("p1")!.pairing).toBe("contradicted");
  });

  describe("loading", () => {
    const dirs: string[] = [];
    afterEach(() => {
      for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    });
    const load = (ldraw: string) => {
      const dir = mkdtempSync(join(tmpdir(), "official-ldraw-"));
      dirs.push(dir);
      writeFileSync(join(dir, "model.xml"), LXFML);
      writeFileSync(join(dir, "model.ldr"), ldraw);
      const result = loadAnswerKey({
        lxfmlPath: join(dir, "model.xml"),
        ldrawPath: join(dir, "model.ldr"),
      });
      if (result.status !== "loaded") throw new Error("fixture LXFML did not load");
      return result.key.ldraw;
    };

    it("loads a faithful export as paired and a shifted one as contradicted", () => {
      expect(load(exportText(exportRows())).status).toBe("paired");
      const rows = exportRows();
      expect(load(exportText([...rows.slice(1), rows[0]!])).status).toBe("contradicted");
    });

    it("reports a present but malformed export as malformed, naming the fault", () => {
      const ldraw = load("0 FILE main.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1\n");
      expect(ldraw.status).toBe("malformed");
      expect(ldraw.status === "malformed" && ldraw.reason).toMatch(/is not a type-1 row/u);
      const short = load(exportText(exportRows().slice(1)));
      expect(short.status === "malformed" && short.reason).toMatch(/re-export the LDraw file/u);
    });
  });

  it("refuses LDraw rows that are not type-1 lines instead of guessing", () => {
    expect(() => parseOfficialLdraw("1 16 0 0 0 1 0 0 0 1 0 0 0 1 a.dat")).toThrow(
      AnswerKeyFormatError,
    );
    expect(() => parseOfficialLdraw("0 FILE a.ldr\n1 16 x 0 0 1 0 0 0 1 0 0 0 1 a.dat")).toThrow(
      /is not a type-1 row/u,
    );
  });
});
