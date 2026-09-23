import type { ColorDefinition, PartDefinition } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import type { AnswerKey } from "./answer-key/index.ts";
import type { AlignStage } from "./align-stage.ts";
import { runCatalogStage } from "./catalog-coverage.ts";

/** A synthetic catalog and answer key: only the fields coverage reads. */
const part = (id: string, alias: string, connectors = 1) =>
  ({
    id,
    aliases: [{ namespace: "ldraw", value: alias }],
    connectors: Array(connectors).fill({}),
    collision: { primitives: [{}] },
  }) as unknown as PartDefinition;
const CATALOG = {
  version: "fixture/1",
  parts: [
    part("brick", "3001.dat"),
    part("plate", "3023.dat"),
    part("hinge", "2453a.dat"),
    part("bare", "3005.dat", 0),
  ],
  colors: [{ id: "red", ldrawCode: 4 }] as unknown as ColorDefinition[],
};

function keyWith(files: readonly string[]): AnswerKey {
  const bricks = files.map((_, index) => ({
    uuid: `u${index}`,
    designId: String(index),
    parts: [{}],
  }));
  const byBrick = new Map(
    files.map(
      (filename, index) =>
        [`u${index}`, { filename, colorCode: index === 0 ? 4 : 47, composite: false }] as const,
    ),
  );
  return {
    model: { bricks },
    ldraw: { status: "paired", pairing: { byBrick } },
  } as unknown as AnswerKey;
}

describe("catalog coverage", () => {
  it("separates exact, interchangeable and missing designs, and names the first step each gap blocks", () => {
    const key = keyWith(["3001.dat", "3023b.dat", "2453b.dat", "86996.dat", "3005.dat"]);
    const align = {
      steps: [
        { step: 1, bricks: ["u0", "u1"] },
        { step: 2, bricks: ["u2", "u3", "u4"] },
      ],
    } as unknown as AlignStage;
    const stage = runCatalogStage(key, align, CATALOG);
    const coverage = Object.fromEntries(
      stage.designs.map(({ design, coverage: kind }) => [design, kind]),
    );
    expect(coverage).toEqual({
      "3001.dat": "exact",
      // The catalog's variant policy calls 3023 revisions interchangeable…
      "3023b.dat": "interchangeable",
      // …and 2453 revisions physically distinct, so 2453a cannot stand in for 2453b.
      "2453b.dat": "missing",
      "86996.dat": "missing",
      // A declared part without connectors cannot be placed.
      "3005.dat": "missing",
    });
    expect(stage.totals).toMatchObject({
      designs: 5,
      exact: 1,
      interchangeable: 1,
      missing: 3,
      piecesMissing: 3,
    });
    expect(stage.firstStepNeedingMissing).toEqual({
      step: 2,
      designs: ["2453b.dat", "3005.dat", "86996.dat"],
    });
    expect(stage.firstStepNeedingMissingColor).toEqual({ step: 1, codes: [47] });
  });
});
