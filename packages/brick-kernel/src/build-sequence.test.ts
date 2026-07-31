import { BRICK_HEIGHT_LDU } from "@lego-studio/catalog";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { BuildSequenceError, deriveBuildInventory, deriveBuildSequence } from "./build-sequence.ts";
import { createEmptyBrickDocument, createPartInstance } from "./factory.ts";

const BRICK_2X2 = "builtin:brick-2x2";

function partAt(
  id: string,
  stepId: string,
  positionLdu: [number, number, number],
  colorId = "builtin:red",
): PartInstance {
  return createPartInstance({
    id,
    catalogPartId: BRICK_2X2,
    colorId,
    stepId,
    transform: { positionLdu, orientationId: "upright-yaw-0" },
  });
}

/** All four stud/tube pairs, so the upper brick's studs are legally seated. */
function stackConnections(lowerId: string, upperId: string): ConnectionEdge[] {
  return [0, 1].flatMap((x) =>
    [0, 1].map((z) => ({
      id: `connection-${lowerId}-${upperId}-${x}-${z}`,
      kind: "stud-tube" as const,
      a: { partId: lowerId, portId: `stud:${x}:${z}` },
      b: { partId: upperId, portId: `undersideClutch:${x}:${z}` },
      provenance: { source: "manual" as const },
    })),
  );
}

function documentWith(
  parts: readonly PartInstance[],
  connections: readonly ConnectionEdge[],
  stepIds: readonly string[],
): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "sequence-fixture", name: "Sequence fixture" });
  return {
    ...base,
    parts: [...parts],
    connections: [...connections],
    submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id }) => id) }],
    steps: stepIds.map((stepId, index) => ({
      id: stepId,
      index,
      name: `Step ${index + 1}`,
      partIds: parts.filter((part) => part.stepId === stepId).map(({ id }) => id),
    })),
  };
}

/** Two bricks stacked, one per step — the simplest genuinely buildable order. */
function stackedTower(): BrickDocumentV1 {
  const lower = partAt("lower", "step-1", [0, 0, 0]);
  const upper = partAt("upper", "step-2", [0, -BRICK_HEIGHT_LDU, 0], "builtin:blue");
  return documentWith([lower, upper], stackConnections("lower", "upper"), ["step-1", "step-2"]);
}

describe("deriveBuildSequence", () => {
  it("starts from an empty base and adds one state per ordered step", () => {
    const sequence = deriveBuildSequence(stackedTower());

    expect(sequence.states.map(({ stepIndex }) => stepIndex)).toEqual([-1, 0, 1]);
    expect(sequence.states[0]!.document.parts).toHaveLength(0);
    expect(sequence.states[1]!.cumulativePartCount).toBe(1);
    expect(sequence.states[2]!.cumulativePartCount).toBe(2);
    expect(sequence.states[2]!.document.parts).toHaveLength(2);
  });

  it("reports which parts each step contributes", () => {
    const sequence = deriveBuildSequence(stackedTower());

    expect(sequence.states[0]!.addedPartIds).toEqual([]);
    expect(sequence.states[1]!.addedPartIds).toEqual(["lower"]);
    expect(sequence.states[2]!.addedPartIds).toEqual(["upper"]);
  });

  it("only carries the connections whose endpoints are both placed yet", () => {
    const sequence = deriveBuildSequence(stackedTower());

    expect(sequence.states[1]!.document.connections).toHaveLength(0);
    expect(sequence.states[2]!.document.connections).toHaveLength(4);
  });

  it("verifies a sound order as buildable at every prefix", () => {
    const sequence = deriveBuildSequence(stackedTower());

    expect(sequence.buildable).toBe(true);
    expect(sequence.firstUnbuildableStepIndex).toBeNull();
    expect(sequence.states.every(({ buildable }) => buildable)).toBe(true);
  });

  it("treats an open subassembly as buildable but not yet connected", () => {
    // Two bricks placed far apart: a normal intermediate, not a defect.
    const document = documentWith(
      [partAt("left", "step-1", [0, 0, 0]), partAt("right", "step-2", [200, 0, 200])],
      [],
      ["step-1", "step-2"],
    );
    const sequence = deriveBuildSequence(document);
    const afterSecondStep = sequence.states[2]!;

    expect(afterSecondStep.connected).toBe(false);
    expect(afterSecondStep.blockingCodes).toContain("DISCONNECTED_ASSEMBLY");
    expect(afterSecondStep.buildable).toBe(true);
    expect(sequence.buildable).toBe(true);
  });

  it("fails a step whose result no build order could make legal", () => {
    // The second brick is driven into the first: a genuine collision.
    const document = documentWith(
      [partAt("first", "step-1", [0, 0, 0]), partAt("second", "step-2", [0, 8, 0])],
      [],
      ["step-1", "step-2"],
    );
    const sequence = deriveBuildSequence(document);

    expect(sequence.states[1]!.buildable).toBe(true);
    expect(sequence.states[2]!.buildable).toBe(false);
    expect(sequence.states[2]!.blockingCodes).toContain("PART_BODY_COLLISION");
    expect(sequence.buildable).toBe(false);
    expect(sequence.firstUnbuildableStepIndex).toBe(1);
  });

  it("catches an order that places a part before the step that supports it", () => {
    // 'floating' is placed first at the upper level; its support only arrives
    // in step 2, so the step-1 prefix cannot stand on its own.
    const floating = partAt("floating", "step-1", [0, -BRICK_HEIGHT_LDU, 0]);
    const support = partAt("support", "step-2", [0, 0, 0]);
    const document = documentWith([floating, support], stackConnections("support", "floating"), [
      "step-1",
      "step-2",
    ]);
    const sequence = deriveBuildSequence(document);

    expect(sequence.states[1]!.document.parts.map(({ id }) => id)).toEqual(["floating"]);
    expect(sequence.states[1]!.document.connections).toHaveLength(0);
    // The finished model is sound, which is exactly why prefix checking matters.
    expect(sequence.states[2]!.buildable).toBe(true);
    expect(sequence.states[2]!.connected).toBe(true);
  });

  it("orders by step index rather than array position", () => {
    const document = stackedTower();
    const reversed = { ...document, steps: [...document.steps].reverse() };

    expect(deriveBuildSequence(reversed).states.map(({ stepId }) => stepId)).toEqual([
      null,
      "step-1",
      "step-2",
    ]);
  });

  it("refuses an ambiguous order instead of guessing", () => {
    const document = stackedTower();
    const ambiguous = {
      ...document,
      steps: document.steps.map((step) => ({ ...step, index: 0 })),
    };

    expect(() => deriveBuildSequence(ambiguous)).toThrow(BuildSequenceError);
    expect(() => deriveBuildSequence(ambiguous)).toThrow(
      /unique indices to define an order; found duplicates in \[0, 0\]/,
    );
  });

  it("derives the same sequence every time", () => {
    expect(deriveBuildSequence(stackedTower())).toEqual(deriveBuildSequence(stackedTower()));
  });

  it("leaves the authored document untouched", () => {
    const document = stackedTower();
    const before = JSON.stringify(document);
    deriveBuildSequence(document);
    expect(JSON.stringify(document)).toBe(before);
  });
});

describe("deriveBuildInventory", () => {
  it("counts parts by catalog part and colour", () => {
    const inventory = deriveBuildInventory(stackedTower());

    expect(inventory.totalParts).toBe(2);
    expect(inventory.lines).toHaveLength(2);
    expect(inventory.lines.map(({ colorId, quantity }) => [colorId, quantity])).toEqual([
      ["builtin:blue", 1],
      ["builtin:red", 1],
    ]);
  });

  it("groups identical parts into one line", () => {
    const document = documentWith(
      [
        partAt("a", "step-1", [0, 0, 0]),
        partAt("b", "step-1", [200, 0, 0]),
        partAt("c", "step-1", [400, 0, 0]),
      ],
      [],
      ["step-1"],
    );
    const inventory = deriveBuildInventory(document);

    expect(inventory.lines).toHaveLength(1);
    expect(inventory.lines[0]).toMatchObject({
      catalogPartId: BRICK_2X2,
      colorId: "builtin:red",
      partDisplayName: "Brick 2 x 2",
      colorDisplayName: "Red",
      quantity: 3,
    });
  });

  it("names parts it cannot resolve instead of miscounting them", () => {
    const document = documentWith([partAt("known", "step-1", [0, 0, 0])], [], ["step-1"]);
    const withUnknown = {
      ...document,
      parts: [...document.parts, { ...document.parts[0]!, id: "mystery", colorId: "builtin:gone" }],
    };
    const inventory = deriveBuildInventory(withUnknown);

    expect(inventory.unresolvedPartIds).toEqual(["mystery"]);
    expect(inventory.lines.reduce((total, { quantity }) => total + quantity, 0)).toBe(1);
    expect(inventory.totalParts).toBe(2);
  });

  it("reports an empty model as an empty bill of materials", () => {
    const empty = createEmptyBrickDocument({ id: "empty", name: "Empty" });
    const inventory = deriveBuildInventory(empty);

    expect(inventory.totalParts).toBe(0);
    expect(inventory.lines).toEqual([]);
  });
});
