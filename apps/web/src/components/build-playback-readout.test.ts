import { describe, expect, it } from "vitest";

import {
  createEmptyBrickDocument,
  createPartInstance,
  deriveBuildSequence,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { playbackReadoutDetail } from "./build-playback-readout";

/** Two stacked bricks over three steps, the middle one empty: a zero-piece printed step. */
function documentWithAnEmptyStep(): BrickDocumentV1 {
  const base = createEmptyBrickDocument({ id: "empty-step", name: "Empty step" });
  const lower = createPartInstance({ id: "lower", stepId: "step-a" });
  const upper = createPartInstance({
    id: "upper",
    transform: { positionLdu: [0, -24, 0], orientationId: "upright-yaw-0" },
    stepId: "step-c",
  });
  return {
    ...base,
    parts: [lower, upper],
    connections: [
      {
        id: "connection-1",
        kind: "stud-tube",
        a: { partId: "lower", portId: "stud:0:0" },
        b: { partId: "upper", portId: "undersideClutch:0:0" },
        provenance: { source: "manual" },
      },
    ],
    submodels: [{ ...base.submodels[0]!, partIds: ["lower", "upper"] }],
    steps: [
      { id: "step-a", index: 1, name: "Printed step 1", partIds: ["lower"] },
      { id: "step-b", index: 2, name: "Printed step 2", partIds: [] },
      { id: "step-c", index: 3, name: "Printed step 3", partIds: ["upper"] },
    ],
  };
}

describe("playback readout", () => {
  it("tells a zero-piece step from the one before it, which draws the same parts", () => {
    const { states } = deriveBuildSequence(documentWithAnEmptyStep());
    const last = states.length - 1;
    const lines = states.map((state, position) => playbackReadoutDetail(state, position, last));
    expect(lines).toEqual([
      "0 / 3 · 0 parts",
      "1 / 3 · 1 parts · +1",
      "2 / 3 · 1 parts · no new parts",
      "3 / 3 · 2 parts · +1",
    ]);
    expect(new Set(lines).size).toBe(lines.length);
  });
});
