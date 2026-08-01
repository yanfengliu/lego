import { mkdirSync, writeFileSync } from "node:fs";

import { applyBuildOperations, createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createPlacePartTransaction } from "../manual-commands";
import { enumeratePlacements, type PlacementEnumerationCounts } from "./enumerate-placements";

/**
 * The branching factor of the closed-loop search, measured rather than assumed.
 *
 * A beam search over 359 steps is only tractable if the number of legal places
 * a part can go stays bounded as the model grows. This grows an assembly one
 * part at a time and records how many candidates each step really had, so the
 * shape of that curve is a number in `output/` and not a hope.
 */
const OUT = "output/placement-branching.json";

/** Deterministic choice, so the recorded curve is reproducible run to run. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

const PART_CYCLE = [
  "builtin:brick-2x4",
  "builtin:plate-2x4",
  "builtin:brick-1x2",
  "builtin:brick-2x2",
  "builtin:plate-1x4",
] as const;

interface StepRecord extends PlacementEnumerationCounts {
  readonly step: number;
  readonly partsPlaced: number;
  readonly catalogPartId: string;
  readonly milliseconds: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

describe("placement branching factor", () => {
  // A hundred and twenty real enumerations against a growing assembly; the
  // default five-second budget is for unit tests, not for a measurement.
  it("stays bounded as the assembly grows, and records the curve", { timeout: 120_000 }, () => {
    const steps = 120;
    const random = lcg(20260801);
    let document: BrickDocumentV1 = createEmptyBrickDocument({
      id: "branching",
      name: "Branching factor",
    });

    // A 6x6 plate on the build plate is the seed the rest is built onto.
    document = applyBuildOperations(
      document,
      createPlacePartTransaction(document, {
        catalogPartId: "builtin:plate-6x6",
        colorId: "builtin:light-bluish-gray",
        transform: { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
      }).operations,
    );

    const records: StepRecord[] = [];
    for (let step = 1; step <= steps; step += 1) {
      const catalogPartId = PART_CYCLE[step % PART_CYCLE.length]!;
      const started = performance.now();
      const enumeration = enumeratePlacements(document, catalogPartId);
      const milliseconds = performance.now() - started;
      records.push({
        step,
        partsPlaced: document.parts.length,
        catalogPartId,
        milliseconds: Math.round(milliseconds * 100) / 100,
        ...enumeration.counts,
      });
      if (enumeration.candidates.length === 0) break;

      const chosen = enumeration.candidates[Math.floor(random() * enumeration.candidates.length)]!;
      document = applyBuildOperations(
        document,
        createPlacePartTransaction(document, {
          catalogPartId: chosen.catalogPartId,
          colorId: "builtin:red",
          transform: chosen.transform,
        }).operations,
      );
    }

    const accepted = records.map((record) => record.accepted);
    const milliseconds = records.map((record) => record.milliseconds);
    const perTransform = records.map(
      (record) => (record.milliseconds * 1000) / Math.max(1, record.distinctTransforms),
    );
    const summary = {
      steps: records.length,
      finalParts: document.parts.length,
      accepted: {
        min: Math.min(...accepted),
        median: median(accepted),
        max: Math.max(...accepted),
        atFinalStep: records.at(-1)!.accepted,
      },
      milliseconds: {
        median: median(milliseconds),
        max: Math.max(...milliseconds),
        total: Math.round(milliseconds.reduce((sum, value) => sum + value, 0)),
      },
      /**
       * What fraction of the raw (free stud x clutch x orientation) triples
       * survive to be real candidates. This is the whole value of enumerating
       * from connections rather than sweeping a lattice.
       */
      survivalOfRaw:
        records.reduce((sum, record) => sum + record.accepted, 0) /
        records.reduce((sum, record) => sum + record.rawFromStuds, 0),
      /**
       * Cost of deciding one candidate, early in the build against late in it.
       * Absolute times depend on the machine and on what else is running;
       * whether the cost per candidate grows with assembly size does not, and
       * that is the property that decides whether the search scales.
       */
      microsecondsPerTransform: {
        firstQuarter: median(perTransform.slice(0, Math.floor(perTransform.length / 4))),
        lastQuarter: median(perTransform.slice(-Math.floor(perTransform.length / 4))),
      },
    };

    mkdirSync("output", { recursive: true });
    writeFileSync(OUT, JSON.stringify({ summary, perStep: records }, null, 1));

    // The build has to actually get somewhere for the curve to mean anything.
    expect(summary.finalParts).toBeGreaterThan(100);
    expect(summary.accepted.min).toBeGreaterThan(0);
    // The cost of deciding one candidate must not grow with the assembly. A
    // wall-clock bound would measure the machine and whatever else is running
    // on it; this measures the algorithm. Rebuilding the neighbourhood per
    // candidate showed here as a factor of about eight.
    const { firstQuarter, lastQuarter } = summary.microsecondsPerTransform;
    expect({ firstQuarter, lastQuarter, growth: lastQuarter / firstQuarter }).toMatchObject({
      growth: expect.any(Number),
    });
    expect(lastQuarter / firstQuarter).toBeLessThan(3);
  });
});
