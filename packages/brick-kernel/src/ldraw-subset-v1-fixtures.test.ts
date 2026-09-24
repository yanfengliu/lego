import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { exportBrickDocumentToLDraw, importBrickDocumentFromLDraw } from "./ldraw.ts";
import { validateBrickDocument } from "./validation.ts";

/**
 * Real `lego.ldraw-subset/1` files, written by commit 982634d at catalog /29,
 * read back by today's kernel at the catalog placement they were written from.
 *
 * Bound: /1 fidelity holds for the frames of /29, when every parametric part
 * had a zero offset and only the 2 x 14 plate a turn. The five files are the
 * 2 x 14 plate at yaw 0 and yaw 90, a 2 x 4 plate, a corner plate and 15573 on
 * a 1 x 2 plate with both grid clutches connected. A /1 file written before a
 * part's mesh promotion (/12, /13) is read through today's mesh frame, not the
 * frame it was written with, and nothing here covers that.
 */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "ldraw-subset-v1");

interface FixtureFile {
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly parts: readonly Pick<PartInstance, "id" | "catalogPartId" | "transform">[];
  readonly connections: readonly Pick<ConnectionEdge, "id" | "a" | "b">[];
}

const manifest = JSON.parse(readFileSync(join(FIXTURES, "manifest.json"), "utf8")) as {
  readonly sourceCommit: string;
  readonly files: readonly FixtureFile[];
};

const byId = <T extends { readonly id: string }>(values: readonly T[]) =>
  [...values].sort((left, right) => left.id.localeCompare(right.id));
const placements = (parts: readonly PartInstance[]) =>
  byId(parts.map(({ id, catalogPartId, transform }) => ({ id, catalogPartId, transform })));
const edges = (connections: readonly ConnectionEdge[]) =>
  byId(connections.map(({ id, a, b }) => ({ id, a, b })));

describe("LDraw subset /1 files written at catalog /29", () => {
  it("names the five files commit 982634d wrote", () => {
    expect(manifest.sourceCommit).toBe("982634de7ddcb75310a802b9cc4dbba9d19d3d9c");
    expect(manifest.files.map(({ file }) => file)).toEqual([
      "plate-2x14-yaw0.ldr",
      "plate-2x14-yaw90.ldr",
      "plate-2x4-yaw270.ldr",
      "corner-plate-2x2-yaw180.ldr",
      "jumper-on-plate-1x2.ldr",
    ]);
  });

  for (const fixture of manifest.files) {
    it(`reads ${fixture.file} back at the placement it was written from`, () => {
      const bytes = readFileSync(join(FIXTURES, fixture.file));
      expect(bytes.length).toBe(fixture.bytes);
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(fixture.sha256);
      const text = bytes.toString("utf8");
      expect(text).toContain("0 !BRICK-STUDIO FORMAT lego.ldraw-subset/1\n");

      const document = importBrickDocumentFromLDraw(text);

      expect(placements(document.parts)).toEqual(byId(fixture.parts));
      expect(edges(document.connections)).toEqual(byId(fixture.connections));
      expect(validateBrickDocument(document).documentGloballyValid).toBe(true);
      // Written again it is a /2 file, which reads back to the same placement.
      const again = importBrickDocumentFromLDraw(exportBrickDocumentToLDraw(document));
      expect(placements(again.parts)).toEqual(placements(document.parts));
      expect(edges(again.connections)).toEqual(edges(document.connections));
    });
  }
});
