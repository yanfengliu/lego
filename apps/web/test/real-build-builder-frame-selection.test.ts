import { getPartDefinition } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import {
  deriveCatalogToBuilderFrames,
  FRAME_WITNESS_MINIMUM_MARGIN_MICRO_RATIO,
  invertUpright,
  residualTransform,
  selectCatalogToBuilderFrame,
} from "../e2e/real-build-builder-frame-selection";
import type { LedgerTransform } from "../e2e/real-build-official";

type Point = readonly [number, number, number];

const studCenters = (partId: string): Point[] => {
  const definition = getPartDefinition(partId);
  if (definition === undefined) throw new Error(`missing catalog part ${partId}`);
  return definition.connectors
    .filter(({ kind }) => kind === "stud")
    .map(({ positionLdu }) => positionLdu as Point);
};

const move = (points: readonly Point[], frame: LedgerTransform): Point[] => {
  const matrix: Record<string, readonly number[]> = {
    "upright-yaw-0": [1, 0, 0, 0, 1, 0, 0, 0, 1],
    "upright-yaw-90": [0, 0, 1, 0, 1, 0, -1, 0, 0],
    "upright-yaw-180": [-1, 0, 0, 0, 1, 0, 0, 0, -1],
    "upright-yaw-270": [0, 0, -1, 0, 1, 0, 1, 0, 0],
  };
  const rows = matrix[frame.orientationId]!;
  return points.map(
    (point) =>
      [0, 1, 2].map(
        (row) =>
          frame.positionLdu[row]! +
          [0, 1, 2].reduce((sum, column) => sum + rows[row * 3 + column]! * point[column]!, 0),
      ) as unknown as Point,
  );
};

const never = (): readonly number[] => {
  throw new Error("the surface witness must not be consulted when symmetry settles the frame");
};

describe("catalog-to-Builder frame selection", () => {
  it("takes the one frame when the stud lattice has no symmetry to hide behind", () => {
    const catalog = studCenters("builtin:corner-plate-4x4-round");
    const frame: LedgerTransform = { positionLdu: [30, -4, -30], orientationId: "upright-yaw-0" };
    const selection = selectCatalogToBuilderFrame({
      definition: getPartDefinition("builtin:corner-plate-4x4-round")!,
      designRevision: "30565;E",
      catalogStudCenters: catalog,
      builderStudCenters: move(catalog, frame),
      measure: never,
    });

    expect(selection).toEqual({
      transform: frame,
      candidateCount: 1,
      equivalenceClassCount: 1,
      method: "unique-stud-correspondence",
      witnessMarginMicroRatio: null,
    });
  });

  /**
   * The whole reason this module exists. A 4x6 plate's studs are unchanged by a
   * half turn, so an exact correspondence returns two frames and the previous
   * rule — exactly one, or refuse — could never calibrate a plate at all. What
   * makes the second frame safe to drop is measured rather than assumed: the
   * half turn maps every connector, every collision body, every clutch
   * allowance and both bounds of the part onto itself.
   */
  it("quotients a rectangular plate's two exact frames by the part's own half turn", () => {
    const catalog = studCenters("builtin:plate-4x6");
    const frame: LedgerTransform = { positionLdu: [50, -4, 30], orientationId: "upright-yaw-90" };
    const selection = selectCatalogToBuilderFrame({
      definition: getPartDefinition("builtin:plate-4x6")!,
      designRevision: "3032;F",
      catalogStudCenters: catalog,
      builderStudCenters: move(catalog, frame),
      measure: never,
    });

    expect(selection.candidateCount).toBe(2);
    expect(selection.equivalenceClassCount).toBe(1);
    expect(selection.method).toBe("catalog-part-self-symmetry");
    expect(selection.witnessMarginMicroRatio).toBeNull();
    expect(residualTransform(selection.transform, frame).orientationId).toMatch(
      /^upright-yaw-(0|180)$/u,
    );
  });

  it("quotients a square plate's four exact frames and stays deterministic", () => {
    const catalog = studCenters("builtin:plate-8x8");
    const frame: LedgerTransform = { positionLdu: [70, -4, 70], orientationId: "upright-yaw-270" };
    const first = selectCatalogToBuilderFrame({
      definition: getPartDefinition("builtin:plate-8x8")!,
      designRevision: "41539;F",
      catalogStudCenters: catalog,
      builderStudCenters: move(catalog, frame),
      measure: never,
    });
    const second = selectCatalogToBuilderFrame({
      definition: getPartDefinition("builtin:plate-8x8")!,
      designRevision: "41539;F",
      catalogStudCenters: catalog,
      builderStudCenters: move(catalog, frame),
      measure: never,
    });

    expect(first.candidateCount).toBe(4);
    expect(first.equivalenceClassCount).toBe(1);
    expect(first.method).toBe("catalog-part-self-symmetry");
    expect(second.transform).toEqual(first.transform);
  });

  /**
   * 51739's four studs are a square, so all four quarter turns fit them exactly,
   * and the part is a wing that none of those turns maps onto itself. This is
   * the case where geometry has to decide, and where a tie is a refusal rather
   * than a coin toss.
   */
  it("sends a wing's four exact frames to the surface witness and refuses a thin margin", () => {
    const catalog = studCenters("builtin:wedge-plate-2x4-wing");
    const frame: LedgerTransform = { positionLdu: [30, -4, -10], orientationId: "upright-yaw-270" };
    const builder = move(catalog, frame);
    const decisive = (candidate: LedgerTransform): readonly number[] =>
      candidate.orientationId === frame.orientationId ? [100_000] : [4_000_000];
    const thin = (candidate: LedgerTransform): readonly number[] =>
      candidate.orientationId === frame.orientationId ? [1_000_000] : [1_500_000];

    const selection = selectCatalogToBuilderFrame({
      definition: getPartDefinition("builtin:wedge-plate-2x4-wing")!,
      designRevision: "51739;H",
      catalogStudCenters: catalog,
      builderStudCenters: builder,
      measure: decisive,
    });
    expect(selection.candidateCount).toBe(4);
    expect(selection.equivalenceClassCount).toBe(4);
    expect(selection.method).toBe("ldraw-surface-witness");
    expect(selection.transform).toEqual(frame);
    expect(selection.witnessMarginMicroRatio).toBe(40_000_000);
    expect(selection.witnessMarginMicroRatio!).toBeGreaterThanOrEqual(
      FRAME_WITNESS_MINIMUM_MARGIN_MICRO_RATIO,
    );

    expect(() =>
      selectCatalogToBuilderFrame({
        definition: getPartDefinition("builtin:wedge-plate-2x4-wing")!,
        designRevision: "51739;H",
        catalogStudCenters: catalog,
        builderStudCenters: builder,
        measure: thin,
      }),
    ).toThrow(/separates the best two by only 1.5x.*4x is required/su);
  });

  it("leaves no frame at all when one stud centre moves off the lattice", () => {
    const catalog = studCenters("builtin:plate-2x6");
    const frame: LedgerTransform = { positionLdu: [50, -4, 10], orientationId: "upright-yaw-90" };
    const moved = move(catalog, frame).map((point, index) =>
      index === 0 ? ([point[0] + 1, point[1], point[2]] as Point) : point,
    );

    expect(deriveCatalogToBuilderFrames(catalog, moved)).toEqual([]);
    expect(() =>
      selectCatalogToBuilderFrame({
        definition: getPartDefinition("builtin:plate-2x6")!,
        designRevision: "3795;I",
        catalogStudCenters: catalog,
        builderStudCenters: moved,
        measure: never,
      }),
    ).toThrow(/yield no upright local frame at all/u);
  });

  it("refuses a stud set of a different size rather than fitting the overlap", () => {
    const catalog = studCenters("builtin:plate-2x6");

    expect(() => deriveCatalogToBuilderFrames(catalog, catalog.slice(1))).toThrow(
      /11 centers while the catalog has 12/u,
    );
  });

  it("inverts and composes upright frames exactly", () => {
    for (const orientationId of [
      "upright-yaw-0",
      "upright-yaw-90",
      "upright-yaw-180",
      "upright-yaw-270",
    ]) {
      const frame: LedgerTransform = { positionLdu: [13, -4, -27], orientationId };
      expect(residualTransform(frame, frame)).toEqual({
        positionLdu: [0, 0, 0],
        orientationId: "upright-yaw-0",
      });
      expect(invertUpright(invertUpright(frame))).toEqual(frame);
    }
  });
});
