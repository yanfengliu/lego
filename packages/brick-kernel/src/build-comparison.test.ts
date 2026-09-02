import { BRICK_HEIGHT_LDU } from "@lego-studio/catalog";
import type { BrickDocumentV1, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { compareBuilds, summarizeComparison } from "./build-comparison.ts";
import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";

function part(
  id: string,
  stepId: string,
  positionLdu: [number, number, number],
  options: { catalogPartId?: string; colorId?: string; orientationId?: string } = {},
): PartInstance {
  return createPartInstance({
    id,
    stepId,
    catalogPartId: options.catalogPartId ?? "builtin:brick-2x2",
    colorId: options.colorId ?? "builtin:red",
    transform: { positionLdu, orientationId: options.orientationId ?? "upright-yaw-0" },
  });
}

function documentOf(parts: readonly PartInstance[], name = "fixture"): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: name, name });
  const stepIds = [...new Set(parts.map(({ stepId }) => stepId))].sort();
  return {
    ...base,
    parts: [...parts],
    submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id }) => id) }],
    steps: stepIds.map((stepId, index) => ({
      id: stepId,
      index,
      name: `Step ${index + 1}`,
      partIds: parts.filter((entry) => entry.stepId === stepId).map(({ id }) => id),
    })),
  };
}

/** Two bricks, one per step, stacked. */
function reference(): BrickDocumentV1 {
  return documentOf([
    part("a", "step-1", [0, 0, 0]),
    part("b", "step-2", [0, -BRICK_HEIGHT_LDU, 0]),
  ]);
}

/**
 * The structural hash covers part identifiers, so it cannot decide whether two
 * models are the same.
 *
 * `documentStructuralHash` includes each part's id, and a rebuild invents its
 * own. Two identical models built independently therefore never hash alike, so a
 * rebuild scored by hash equality is always a miss: it measures whether the same
 * object came back, not whether the same model was made. Comparison has to match
 * parts on what they are and where they sit. Put `part.id` back into
 * `placementKey` and the first two cases below go to zero.
 */
describe("compareBuilds", () => {
  it("scores an identical rebuild as an exact structural match", () => {
    // Different part identifiers, same pieces in the same places.
    const rebuilt = documentOf([
      part("x", "step-1", [0, 0, 0]),
      part("y", "step-2", [0, -BRICK_HEIGHT_LDU, 0]),
    ]);
    const comparison = compareBuilds(reference(), rebuilt);

    expect(comparison.overall.recall).toBe(1);
    expect(comparison.overall.precision).toBe(1);
    expect(comparison.firstDivergentStepIndex).toBeNull();
    expect(comparison.steps.every(({ exact }) => exact)).toBe(true);
    expect(summarizeComparison(comparison)).toMatch(/exact match: 2 parts/);
  });

  it("does not depend on part identifiers matching", () => {
    const renamed = documentOf([
      part("totally-different", "step-1", [0, 0, 0]),
      part("also-different", "step-2", [0, -BRICK_HEIGHT_LDU, 0]),
    ]);

    expect(compareBuilds(reference(), renamed).overall.correct).toBe(2);
  });

  it("separates a right piece in the wrong place from a wrong piece", () => {
    const misplaced = documentOf([
      part("a", "step-1", [0, 0, 0]),
      // Right brick and colour, shifted one stud sideways.
      part("b", "step-2", [20, -BRICK_HEIGHT_LDU, 0]),
    ]);
    const wrongPiece = documentOf([
      part("a", "step-1", [0, 0, 0]),
      part("b", "step-2", [0, -BRICK_HEIGHT_LDU, 0], { catalogPartId: "builtin:plate-2x2" }),
    ]);

    const misplacedScore = compareBuilds(reference(), misplaced).overall;
    expect(misplacedScore).toMatchObject({ correct: 1, misplaced: 1, missing: 0, extra: 0 });

    const wrongScore = compareBuilds(reference(), wrongPiece).overall;
    expect(wrongScore).toMatchObject({ correct: 1, misplaced: 0, missing: 1, extra: 1 });
  });

  it("counts a wrong colour as a different piece", () => {
    const recoloured = documentOf([
      part("a", "step-1", [0, 0, 0]),
      part("b", "step-2", [0, -BRICK_HEIGHT_LDU, 0], { colorId: "builtin:blue" }),
    ]);
    const score = compareBuilds(reference(), recoloured).overall;

    expect(score).toMatchObject({ correct: 1, misplaced: 0, missing: 1, extra: 1 });
  });

  it("counts a wrong orientation as misplaced rather than missing", () => {
    const turned = documentOf([
      part("a", "step-1", [0, 0, 0]),
      part("b", "step-2", [0, -BRICK_HEIGHT_LDU, 0], { orientationId: "upright-yaw-90" }),
    ]);

    expect(compareBuilds(reference(), turned).overall).toMatchObject({ correct: 1, misplaced: 1 });
  });

  it("names the first step that stopped matching", () => {
    const divergent = documentOf([
      part("a", "step-1", [0, 0, 0]),
      part("b", "step-2", [200, 0, 200]),
    ]);
    const comparison = compareBuilds(reference(), divergent);

    // Step 0 still agrees; step 1 is where it goes wrong.
    expect(comparison.steps[1]!.exact).toBe(true);
    expect(comparison.firstDivergentStepIndex).toBe(1);
    expect(summarizeComparison(comparison)).toMatch(/first divergence at step 1/);
  });

  it("scores what each step added, not just the running total", () => {
    const divergent = documentOf([
      part("a", "step-1", [0, 0, 0]),
      part("b", "step-2", [200, 0, 200]),
    ]);
    const comparison = compareBuilds(reference(), divergent);

    expect(comparison.steps[1]!.added).toMatchObject({ correct: 1, expectedParts: 1 });
    // Same brick and colour, placed elsewhere: misplaced, not an extra piece.
    expect(comparison.steps[2]!.added).toMatchObject({
      correct: 0,
      expectedParts: 1,
      misplaced: 1,
    });
  });

  it("scores a rebuild that stopped early without crediting the missing steps", () => {
    const truncated = documentOf([part("a", "step-1", [0, 0, 0])]);
    const comparison = compareBuilds(reference(), truncated);

    expect(comparison.overall).toMatchObject({ correct: 1, missing: 1, extra: 0 });
    expect(comparison.overall.recall).toBe(0.5);
    expect(comparison.overall.precision).toBe(1);
    expect(comparison.expectedStepCount).toBe(2);
    expect(comparison.actualStepCount).toBe(1);
  });

  it("scores an empty rebuild as nothing recovered", () => {
    const comparison = compareBuilds(reference(), createEmptyBrickDocument({ id: "e", name: "e" }));

    expect(comparison.overall).toMatchObject({ correct: 0, recall: 0, precision: 0, f1: 0 });
    expect(comparison.structuralMatch).toBe(false);
  });

  it("treats two empty models as a match rather than a division by zero", () => {
    const empty = createEmptyBrickDocument({ id: "e", name: "e" });
    const comparison = compareBuilds(empty, empty);

    expect(comparison.overall).toMatchObject({ recall: 1, precision: 1, f1: 1 });
    expect(comparison.structuralMatch).toBe(true);
  });

  it("handles repeated identical parts as a multiset", () => {
    const twoOfThem = documentOf([
      part("a", "step-1", [0, 0, 0]),
      part("b", "step-1", [200, 0, 0]),
    ]);
    const onlyOne = documentOf([part("x", "step-1", [0, 0, 0])]);
    const threeOfThem = documentOf([
      part("a", "step-1", [0, 0, 0]),
      part("b", "step-1", [200, 0, 0]),
      part("c", "step-1", [400, 0, 0]),
    ]);

    expect(compareBuilds(twoOfThem, onlyOne).overall).toMatchObject({ correct: 1, missing: 1 });
    expect(compareBuilds(twoOfThem, threeOfThem).overall).toMatchObject({ correct: 2, extra: 1 });
  });

  it("scores the same way every time and leaves both models untouched", () => {
    const expected = reference();
    const actual = documentOf([part("x", "step-1", [0, 0, 0])]);
    const before = [JSON.stringify(expected), JSON.stringify(actual)];

    expect(compareBuilds(expected, actual)).toEqual(compareBuilds(expected, actual));
    expect([JSON.stringify(expected), JSON.stringify(actual)]).toEqual(before);
  });
});
