import { describe, expect, it } from "vitest";

import {
  enumerateWholeStepCandidates,
  type WholeStepPlacementTransform,
} from "../e2e/real-build-deferral";

type SyntheticDocument = { readonly placements: readonly string[] };

describe("whole-step opaque offer snapshots", () => {
  it("retains a detached immutable payload when the producer rows are later rewritten", () => {
    type MutableOffer = {
      transform: { positionLdu: [number, number, number]; orientationId: string };
      connections: { targetPartId: string }[];
      restsOnBuildPlate: boolean;
    };
    const source: MutableOffer = {
      transform: { positionLdu: [1, 2, 3], orientationId: "upright-yaw-0" },
      connections: [{ targetPartId: "base-part" }],
      restsOnBuildPlate: false,
    };
    const enumeration = enumerateWholeStepCandidates<SyntheticDocument, Readonly<MutableOffer>>({
      baseDocument: { placements: [] },
      stepId: null,
      pieces: [{ catalogPartId: "piece", colorId: "black" }],
      enumerateDistinct: () => [source],
      narrow: null,
      narrowingRenderBudget: 10,
      transformOf: (candidate) => candidate.transform,
      snapshotOfferedCandidate: (candidate) =>
        Object.freeze({
          ...candidate,
          transform: Object.freeze({
            ...candidate.transform,
            positionLdu: Object.freeze([...candidate.transform.positionLdu]) as [
              number,
              number,
              number,
            ],
          }),
          connections: Object.freeze(
            candidate.connections.map((connection) => Object.freeze({ ...connection })),
          ) as unknown as { targetPartId: string }[],
        }),
      place: (document, _catalogPartId, _candidate, _colorId, stepId) => ({
        document,
        partId: "part-1",
        stepId: stepId ?? "synthetic-step",
      }),
      budget: 10,
    });
    source.transform.positionLdu[0] = 999;
    source.connections[0]!.targetPartId = "rewritten";
    source.restsOnBuildPlate = true;
    expect(enumeration.candidates[0]?.offeredCandidates[0]).toMatchObject({
      transform: { positionLdu: [1, 2, 3] },
      connections: [{ targetPartId: "base-part" }],
      restsOnBuildPlate: false,
    });
  });

  it("refuses malformed transform tuples without JSON coercion", () => {
    const malformed = {
      transform: { positionLdu: [0, Number.NaN, 0], orientationId: "upright-yaw-0" },
    };
    expect(() =>
      enumerateWholeStepCandidates<SyntheticDocument, typeof malformed>({
        baseDocument: { placements: [] },
        stepId: null,
        pieces: [{ catalogPartId: "piece", colorId: "black" }],
        enumerateDistinct: () => [malformed],
        narrow: null,
        narrowingRenderBudget: 10,
        transformOf: (candidate) => candidate.transform as unknown as WholeStepPlacementTransform,
        snapshotOfferedCandidate: (candidate) => candidate,
        place: (document, _catalogPartId, _candidate, _colorId, stepId) => ({
          document,
          partId: "part-1",
          stepId: stepId ?? "synthetic-step",
        }),
        budget: 10,
      }),
    ).toThrowError(/dense 3-safe-integer positionLdu tuple/u);
  });
});
