import { describe, expect, it } from "vitest";

import { validateDeterministicMakerOutputV1, type DeterministicMakerOutputV1 } from "./index.ts";

const output = {
  schemaVersion: "lego.deterministic-maker-output/1",
  makerVersion: "lego.generation/1",
  slots: [
    {
      index: 0,
      strategyId: "deterministic.compact-tower/1",
      shape: "tower",
      outcome: {
        kind: "program",
        program: {
          schemaVersion: "lego.build-program/1",
          operations: [
            {
              kind: "placePart",
              operationId: "place-1",
              localPartId: "part-1",
              catalogPartId: "builtin:brick-1x1",
              colorId: "builtin:red",
              transform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
              submodelId: "root",
              stepId: "step-1",
              semanticTags: ["generated"],
            },
          ],
        },
        normalizedProgramHash: `sha256:${"a".repeat(64)}`,
      },
    },
  ],
} satisfies DeterministicMakerOutputV1;

describe("deterministic maker output protocol", () => {
  it("accepts only the closed authority-free maker boundary", () => {
    expect(validateDeterministicMakerOutputV1(output)).toBe(true);
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: [
          {
            ...output.slots[0],
            candidateId: "forged-candidate",
          },
        ],
      }),
    ).toBe(false);
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: [
          {
            ...output.slots[0],
            outcome: { ...output.slots[0]!.outcome, valid: true },
          },
        ],
      }),
    ).toBe(false);
  });

  it("bounds slots and rejects malformed failure alternatives", () => {
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: Array.from({ length: 5 }, (_, index) => ({
          ...output.slots[0],
          index,
        })),
      }),
    ).toBe(false);
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: [output.slots[0], { ...output.slots[0], index: 1 }],
      }),
    ).toBe(false);
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: [{ ...output.slots[0], index: 1 }],
      }),
    ).toBe(false);
    expect(
      validateDeterministicMakerOutputV1({
        ...output,
        slots: [
          {
            index: 0,
            strategyId: "deterministic.failed/1",
            shape: "tower",
            outcome: {
              kind: "generationFailure",
              failure: { stage: "generation", code: "SELF_APPROVED", message: "forged" },
            },
          },
        ],
      }),
    ).toBe(false);
  });
});
