import { canonicalStringify } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { RealBuildAutomaticPlacementWitness } from "./real-build-automatic-placement-input";
import {
  measureRealBuildAutomaticCollisionPrimitiveCount,
  REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS,
  REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NUMBER,
  realBuildAutomaticUtf8ByteLength,
  type RealBuildAutomaticPrintedStepMetadata,
} from "./real-build-automatic-placement-step";

export interface RealBuildAutomaticPlacementWork {
  readonly placementOperations: number;
  readonly preparationOperations: number;
  readonly combinedOperations: number;
  readonly finalGraphEntries: number;
  readonly graphVisits: number;
  readonly proposalBytes: number;
  readonly byteVisits: number;
}

export interface RealBuildAutomaticPlacementBaseWork {
  readonly canonicalByteLength: number;
  readonly graphEntries: number;
  readonly collisionPrimitives: number;
}

function safeSum(label: string, values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0 || total > Number.MAX_SAFE_INTEGER - value) {
      throw new RangeError(`Automatic placement ${label} exceeds the safe-integer work boundary.`);
    }
    total += value;
  }
  return total;
}

function safeProduct(label: string, values: readonly number[]): number {
  let total = 1;
  for (const value of values) {
    if (
      !Number.isSafeInteger(value) ||
      value < 0 ||
      (value !== 0 && total > Math.floor(Number.MAX_SAFE_INTEGER / value))
    ) {
      throw new RangeError(`Automatic placement ${label} exceeds the safe-integer work boundary.`);
    }
    total *= value;
  }
  return total;
}

function describePrintedStepNumber(value: unknown): string {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (value === Number.POSITIVE_INFINITY) return "Infinity";
    if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
    if (Object.is(value, -0)) return "-0";
    return String(value);
  }
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null) return "null";
  return `a value of type ${typeof value}`;
}

/**
 * Measures the compiler's conservative three-pass work-policy units. These are
 * admission-policy meters, not a claim about literal CPU or allocation counts.
 */
export function measureRealBuildAutomaticPlacementWork(input: {
  readonly base: RealBuildAutomaticPlacementBaseWork;
  readonly printedStepNumber: number;
  readonly printedStep: Readonly<RealBuildAutomaticPrintedStepMetadata>;
  readonly witnesses: readonly RealBuildAutomaticPlacementWitness[];
}): RealBuildAutomaticPlacementWork {
  if (
    !Number.isSafeInteger(input.printedStepNumber) ||
    input.printedStepNumber < 1 ||
    input.printedStepNumber > REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NUMBER
  ) {
    throw new RangeError(
      `Automatic placement work received printedStepNumber ${describePrintedStepNumber(input.printedStepNumber)}; expected a safe integer from 1 through ${REAL_BUILD_AUTOMATIC_MAXIMUM_STEP_NUMBER}.`,
    );
  }
  const preparationOperations = input.printedStepNumber === 1 ? 2 : 1;
  const placementOperations = safeSum(
    "placement-operation count",
    input.witnesses.map((witness) => 1 + witness.connections.length),
  );
  const combinedOperations = safeSum("combined-operation count", [
    placementOperations,
    preparationOperations,
  ]);
  const addedConnections = safeSum(
    "added-connection count",
    input.witnesses.map((witness) => witness.connections.length),
  );
  const witnessCollisionPrimitives = measureRealBuildAutomaticCollisionPrimitiveCount(
    input.witnesses.map(({ catalogPartId }) => catalogPartId),
  );
  const finalGraphEntries = safeSum("final-graph entry count", [
    input.base.graphEntries,
    input.base.collisionPrimitives,
    input.witnesses.length,
    addedConnections,
    witnessCollisionPrimitives,
    1,
  ]);
  const graphVisits = safeProduct("graph-visit count", [3, finalGraphEntries, combinedOperations]);
  const proposalBytes = realBuildAutomaticUtf8ByteLength(
    canonicalStringify({ printedStep: input.printedStep, witnesses: input.witnesses }),
  );
  const byteVisits = safeProduct("byte-visit count", [
    3,
    safeSum("base-plus-proposal byte count", [input.base.canonicalByteLength, proposalBytes]),
    combinedOperations,
  ]);
  return Object.freeze({
    placementOperations,
    preparationOperations,
    combinedOperations,
    finalGraphEntries,
    graphVisits,
    proposalBytes,
    byteVisits,
  });
}

export function measureRealBuildAutomaticPlacementBaseWork(
  document: BrickDocumentV1,
  canonicalByteLength: number,
): RealBuildAutomaticPlacementBaseWork {
  return Object.freeze({
    canonicalByteLength,
    graphEntries: safeSum("base-graph entry count", [
      document.parts.length,
      document.connections.length,
      document.submodels.length,
      document.steps.length,
      document.semanticRegions.length,
    ]),
    collisionPrimitives: measureRealBuildAutomaticCollisionPrimitiveCount(
      document.parts.map(({ catalogPartId }) => catalogPartId),
    ),
  });
}

export function requireRealBuildAutomaticPlacementWorkWithinCompilerLimits(
  work: RealBuildAutomaticPlacementWork,
): void {
  if (
    work.graphVisits > REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS ||
    work.byteVisits > REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS
  ) {
    throw new RangeError(
      `Automatic placement would require ${work.graphVisits} graph-entry visits and ${work.byteVisits} byte-visits across two compiler passes plus one combined hard-validation replay; ` +
        `the bounded limits are ${REAL_BUILD_AUTOMATIC_MAXIMUM_GRAPH_VISITS} and ${REAL_BUILD_AUTOMATIC_MAXIMUM_BYTE_VISITS}. Reduce the proposal or split it into separately verified printed steps.`,
    );
  }
}
