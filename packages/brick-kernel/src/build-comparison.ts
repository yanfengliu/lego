import type { BrickDocumentV1, PartInstance } from "@lego-studio/protocol";

import { deriveBuildSequence } from "./build-sequence.ts";
import { documentStructuralHash } from "./document.ts";

/**
 * Scores a rebuilt model against the one it was meant to reproduce.
 *
 * Interpreting instructions has a long feedback loop if the only question asked
 * is "did the finished model come out right". This answers a more useful one:
 * how much of the reference was recovered, and which step first went wrong.
 *
 * Parts are matched by what they are and where they sit, never by identifier,
 * because a rebuilt model invents its own ids. A part that is the right piece in
 * the wrong place is counted separately from a part that is simply wrong: the
 * two mean different things about an interpreter, and lumping them together
 * hides the more tractable failure.
 */
export const BUILD_COMPARISON_SCHEMA_VERSION = "lego.build-comparison/1" as const;

/** Identity of a placement: the piece, its colour, and its pose. */
function placementKey(part: PartInstance): string {
  const [x, y, z] = part.transform.positionLdu;
  return `${part.catalogPartId}|${part.colorId}|${x},${y},${z}|${part.transform.orientationId}`;
}

/** Identity of a piece regardless of where it ended up. */
function pieceKey(part: PartInstance): string {
  return `${part.catalogPartId}|${part.colorId}`;
}

function countBy(parts: readonly PartInstance[], key: (part: PartInstance) => string) {
  const counts = new Map<string, number>();
  for (const part of parts) counts.set(key(part), (counts.get(key(part)) ?? 0) + 1);
  return counts;
}

/** Total overlap between two multisets. */
function intersectionSize(
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>,
): number {
  let total = 0;
  for (const [key, count] of left) total += Math.min(count, right.get(key) ?? 0);
  return total;
}

export interface PartSetScore {
  readonly expectedParts: number;
  readonly actualParts: number;
  /** Right piece, right colour, right pose. */
  readonly correct: number;
  /** Right piece and colour, but not where the reference put it. */
  readonly misplaced: number;
  /** In the reference, with no counterpart of any kind. */
  readonly missing: number;
  /** In the rebuild, matching nothing in the reference. */
  readonly extra: number;
  /** correct / actualParts, or 1 when both sides are empty. */
  readonly precision: number;
  /** correct / expectedParts, or 1 when both sides are empty. */
  readonly recall: number;
  readonly f1: number;
}

function scoreParts(
  expected: readonly PartInstance[],
  actual: readonly PartInstance[],
): PartSetScore {
  const expectedPlacements = countBy(expected, placementKey);
  const actualPlacements = countBy(actual, placementKey);
  const correct = intersectionSize(expectedPlacements, actualPlacements);

  // Of the pieces that are the right type and colour, those beyond the exactly
  // correct ones are in the wrong place rather than wrong outright.
  const piecesInCommon = intersectionSize(countBy(expected, pieceKey), countBy(actual, pieceKey));
  const misplaced = piecesInCommon - correct;

  const precision = actual.length === 0 ? (expected.length === 0 ? 1 : 0) : correct / actual.length;
  const recall = expected.length === 0 ? (actual.length === 0 ? 1 : 0) : correct / expected.length;

  return {
    expectedParts: expected.length,
    actualParts: actual.length,
    correct,
    misplaced,
    missing: expected.length - correct - misplaced,
    extra: actual.length - correct - misplaced,
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
  };
}

export interface StepComparison {
  readonly stepIndex: number;
  /** Score over everything placed up to and including this step. */
  readonly cumulative: PartSetScore;
  /** Score over only what this step added. */
  readonly added: PartSetScore;
  /** Whether the assembly matches the reference exactly at this point. */
  readonly exact: boolean;
}

export interface BuildComparison {
  readonly schemaVersion: typeof BUILD_COMPARISON_SCHEMA_VERSION;
  /** Informational only: these differ whenever part identifiers differ. */
  readonly expectedHash: string;
  readonly actualHash: string;
  /**
   * The binary goal: the same pieces in the same places. Deliberately not hash
   * equality, because the structural hash covers part identifiers and a rebuild
   * invents its own, so two identical models never hash alike.
   */
  readonly structuralMatch: boolean;
  /** Score over the finished models. This is the headline number. */
  readonly overall: PartSetScore;
  readonly steps: readonly StepComparison[];
  /** Where the rebuild first stopped matching, or null if it never did. */
  readonly firstDivergentStepIndex: number | null;
  /** Steps compared; a shorter rebuild is scored against the reference's length. */
  readonly expectedStepCount: number;
  readonly actualStepCount: number;
}

/**
 * Compares a rebuild against a reference, overall and step by step. Both are
 * read as authored: neither is mutated, and neither needs to share identifiers
 * with the other.
 */
export function compareBuilds(expected: BrickDocumentV1, actual: BrickDocumentV1): BuildComparison {
  const expectedSequence = deriveBuildSequence(expected);
  const actualSequence = deriveBuildSequence(actual);
  const stepCount = Math.max(expectedSequence.states.length, actualSequence.states.length);
  const steps: StepComparison[] = [];

  for (let position = 0; position < stepCount; position += 1) {
    const expectedState = expectedSequence.states[position];
    const actualState = actualSequence.states[position];
    const cumulative = scoreParts(
      expectedState?.document.parts ?? [],
      actualState?.document.parts ?? [],
    );
    const addedExpected = (expectedState?.addedPartIds ?? [])
      .map((id) => expectedState?.document.parts.find((part) => part.id === id))
      .filter((part): part is PartInstance => part !== undefined);
    const addedActual = (actualState?.addedPartIds ?? [])
      .map((id) => actualState?.document.parts.find((part) => part.id === id))
      .filter((part): part is PartInstance => part !== undefined);

    steps.push({
      stepIndex: expectedState?.stepIndex ?? actualState?.stepIndex ?? position - 1,
      cumulative,
      added: scoreParts(addedExpected, addedActual),
      exact: cumulative.correct === cumulative.expectedParts && cumulative.extra === 0,
    });
  }

  const overall = scoreParts(expected.parts, actual.parts);
  return {
    schemaVersion: BUILD_COMPARISON_SCHEMA_VERSION,
    expectedHash: documentStructuralHash(expected),
    actualHash: documentStructuralHash(actual),
    structuralMatch: overall.missing === 0 && overall.extra === 0 && overall.misplaced === 0,
    overall,
    steps,
    firstDivergentStepIndex: steps.find(({ exact }) => !exact)?.stepIndex ?? null,
    expectedStepCount: expectedSequence.states.length - 1,
    actualStepCount: actualSequence.states.length - 1,
  };
}

/** One line a human or a log can read at a glance. */
export function summarizeComparison(comparison: BuildComparison): string {
  const { overall, structuralMatch, firstDivergentStepIndex } = comparison;
  const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;
  if (structuralMatch) return `exact match: ${overall.expectedParts} parts, every step agrees`;
  return [
    `recall ${percent(overall.recall)}`,
    `precision ${percent(overall.precision)}`,
    `${overall.correct}/${overall.expectedParts} placed correctly`,
    overall.misplaced > 0 ? `${overall.misplaced} misplaced` : null,
    overall.missing > 0 ? `${overall.missing} missing` : null,
    overall.extra > 0 ? `${overall.extra} extra` : null,
    firstDivergentStepIndex === null ? null : `first divergence at step ${firstDivergentStepIndex}`,
  ]
    .filter((part): part is string => part !== null)
    .join(", ");
}
