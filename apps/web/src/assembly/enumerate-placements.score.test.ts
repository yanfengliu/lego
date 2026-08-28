import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

import { applyBuildOperations, createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createPlacePartTransaction } from "../manual-commands";
import {
  enumeratePlacements,
  type PlacementEnumerationCounts,
  type PlacementEnumerationWork,
} from "./enumerate-placements";

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
  readonly processCpuMicroseconds: number;
  readonly orderedCandidateDigest: string;
  readonly populationDigest: string;
  readonly work: PlacementEnumerationWork;
}

const BOUNDED_WORK_KEYS = [
  "worldParts",
  "worldPrimitives",
  "worldCellInsertions",
  "collisionQueries",
  "candidateConnectionEdges",
  "candidatePrimitives",
  "queryCellVisits",
  "broadphaseCellEntries",
  "broadphaseUniquePrimitives",
  "legacyOrderWorldCellKeys",
  "legacyOrderCandidateCellKeys",
  "legacyOrderSetInsertions",
  "legacyOrderCellChecks",
  "legacyOrderComparisons",
  "primitivePairAabbTests",
  "primitivePairNarrowphaseTests",
  "collisionFindings",
  "occupiedCapacitySeedEdges",
  "occupiedCapacityClaims",
  "freePortPartsVisited",
  "freePortConnectorVisits",
  "freePortCapacityChecks",
  "seedAxisChecks",
  "originProposals",
  "candidateTransformsVisited",
  "connectorPortLookups",
  "connectorDiscoveries",
  "candidateSortComparisons",
] as const satisfies readonly (keyof PlacementEnumerationWork)[];

const POSITIVE_CONTROL_KEYS = [
  "positiveControl2dCellEntries",
  "positiveControlAllPrimitiveAabbTests",
] as const satisfies readonly (keyof PlacementEnumerationWork)[];

const EXPECTED_ORDERED_CANDIDATE_DIGESTS_DIGEST =
  "5438fbb22bab86c36e72cc441632d1addead783e51b3b16ba141d249941cdf3a";
const EXPECTED_POPULATION_DIGESTS_DIGEST =
  "b98fb9f500f0c9446f9a2e4e5429ecea6e53a5cc786bc849539dba2fc0642481";

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function populationDigest(
  catalogPartId: string,
  counts: PlacementEnumerationCounts,
  orderedCandidateDigest: string,
): string {
  // The explicit typed copy makes a newly required count fail compilation
  // until it is deliberately added to the frozen population contract.
  const boundCounts: PlacementEnumerationCounts = {
    freeStuds: counts.freeStuds,
    freeClutches: counts.freeClutches,
    rawFromStuds: counts.rawFromStuds,
    rawFromClutches: counts.rawFromClutches,
    rawFromBuildPlate: counts.rawFromBuildPlate,
    distinctTransforms: counts.distinctTransforms,
    rejectedUnsupported: counts.rejectedUnsupported,
    rejectedDetached: counts.rejectedDetached,
    rejectedBelowBuildPlate: counts.rejectedBelowBuildPlate,
    rejectedColliding: counts.rejectedColliding,
    accepted: counts.accepted,
  };
  return sha256({ catalogPartId, counts: boundCounts, orderedCandidateDigest });
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function medianQuarterComparison(values: readonly number[]): {
  readonly firstQuarter: number;
  readonly lastQuarter: number;
  readonly growth: number;
} {
  const quarter = Math.floor(values.length / 4);
  const firstQuarter = median(values.slice(0, quarter));
  const lastQuarter = median(values.slice(-quarter));
  return { firstQuarter, lastQuarter, growth: lastQuarter / firstQuarter };
}

function summedWorkQuarterComparison(
  records: readonly StepRecord[],
  key: keyof PlacementEnumerationWork,
): ReturnType<typeof medianQuarterComparison> {
  const quarter = Math.floor(records.length / 4);
  const workPerTransform = (selected: readonly StepRecord[]): number =>
    selected.reduce((sum, record) => sum + record.work[key], 0) /
    selected.reduce((sum, record) => sum + record.distinctTransforms, 0);
  const firstQuarter = workPerTransform(records.slice(0, quarter));
  const lastQuarter = workPerTransform(records.slice(-quarter));
  return { firstQuarter, lastQuarter, growth: lastQuarter / firstQuarter };
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
      let work: PlacementEnumerationWork | undefined;
      const cpuStarted = process.cpuUsage();
      const started = performance.now();
      const enumeration = enumeratePlacements(document, catalogPartId, {
        observeWork: (measured) => {
          work = measured;
        },
      });
      const milliseconds = performance.now() - started;
      const cpu = process.cpuUsage(cpuStarted);
      if (!work) throw new Error(`Step ${step} did not report deterministic enumeration work`);
      const orderedCandidateDigest = sha256(enumeration.candidates);
      records.push({
        step,
        partsPlaced: document.parts.length,
        catalogPartId,
        milliseconds: Math.round(milliseconds * 100) / 100,
        processCpuMicroseconds: cpu.user + cpu.system,
        orderedCandidateDigest,
        populationDigest: populationDigest(
          catalogPartId,
          enumeration.counts,
          orderedCandidateDigest,
        ),
        work,
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
    const wallMicrosecondsPerTransform = records.map(
      (record) => (record.milliseconds * 1000) / Math.max(1, record.distinctTransforms),
    );
    const cpuMicrosecondsPerTransform = records.map(
      (record) => record.processCpuMicroseconds / Math.max(1, record.distinctTransforms),
    );
    const boundedDeterministicWork = Object.fromEntries(
      BOUNDED_WORK_KEYS.map((key) => [key, summedWorkQuarterComparison(records, key)]),
    ) as Record<(typeof BOUNDED_WORK_KEYS)[number], ReturnType<typeof summedWorkQuarterComparison>>;
    const positiveControls = Object.fromEntries(
      POSITIVE_CONTROL_KEYS.map((key) => [key, summedWorkQuarterComparison(records, key)]),
    ) as Record<
      (typeof POSITIVE_CONTROL_KEYS)[number],
      ReturnType<typeof summedWorkQuarterComparison>
    >;
    const orderedCandidateDigests = records.map((record) => record.orderedCandidateDigest);
    const populationDigests = records.map((record) => record.populationDigest);
    const summary = {
      steps: records.length,
      finalParts: document.parts.length,
      orderedCandidateDigestsDigest: sha256(orderedCandidateDigests),
      populationDigestsDigest: sha256(populationDigests),
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
      processCpuMicroseconds: {
        median: median(records.map((record) => record.processCpuMicroseconds)),
        max: Math.max(...records.map((record) => record.processCpuMicroseconds)),
        total: records.reduce((sum, record) => sum + record.processCpuMicroseconds, 0),
      },
      /**
       * What fraction of the raw (free stud x clutch x orientation) triples
       * survive to be real candidates. This is the whole value of enumerating
       * from connections rather than sweeping a lattice.
       */
      survivalOfRaw:
        records.reduce((sum, record) => sum + record.accepted, 0) /
        records.reduce((sum, record) => sum + record.rawFromStuds, 0),
      timingDiagnostics: {
        includes: "deterministic-work observer and positive-control overhead",
        wallMicrosecondsPerTransform: medianQuarterComparison(wallMicrosecondsPerTransform),
        processCpuMicrosecondsPerTransform: medianQuarterComparison(cpuMicrosecondsPerTransform),
      },
      boundedDeterministicWork,
      positiveControls,
    };

    mkdirSync("output", { recursive: true });
    writeFileSync(OUT, JSON.stringify({ summary, perStep: records }, null, 1));

    // The build has to actually get somewhere for the curve to mean anything.
    expect(summary.finalParts).toBeGreaterThan(100);
    expect(summary.accepted.min).toBeGreaterThan(0);
    // The candidate digest is a differential negative control over every
    // ordered transform and connection in the frozen trajectory.
    expect(summary.orderedCandidateDigestsDigest).toBe(EXPECTED_ORDERED_CANDIDATE_DIGESTS_DIGEST);
    // The population digest additionally binds the requested catalog part and
    // every branching/count outcome at each step.
    expect(summary.populationDigestsDigest).toBe(EXPECTED_POPULATION_DIGESTS_DIGEST);
    // Wall and process CPU clocks are retained as diagnostics; suite scheduling
    // cannot decide the hard scalability claim. Every recorded size-dependent
    // operation must remain below the unchanged factor-of-three ceiling.
    for (const key of BOUNDED_WORK_KEYS) {
      expect(
        summary.boundedDeterministicWork[key].growth,
        `${key} grew by ${summary.boundedDeterministicWork[key].growth}`,
      ).toBeLessThan(3);
    }
    // Both deliberately bad controls operate on the same candidate queries.
    // If either falls below the threshold, the instrument can no longer see
    // the size-dependent work it exists to gate.
    for (const key of POSITIVE_CONTROL_KEYS) {
      expect(
        summary.positiveControls[key].growth,
        `${key} positive control only grew by ${summary.positiveControls[key].growth}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
