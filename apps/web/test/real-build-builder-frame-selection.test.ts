import { getPartDefinition } from "@lego-studio/catalog";
import type { CollisionPrimitive, PartDefinition, ResolvedMeshAsset } from "@lego-studio/catalog";
import { describe, expect, it } from "vitest";

import {
  deriveCatalogToBuilderFrames,
  FRAME_WITNESS_MINIMUM_MARGIN_MICRO_RATIO,
  invertUpright,
  isCatalogPartSelfSymmetry,
  isResolvedMeshAssetSelfSymmetry,
  residualTransform,
  selectCatalogToBuilderAnchorFrame,
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
   * The two halves of what the square-plate case above actually rests on, with
   * everything but the body held fixed.
   *
   * `plate-8x8`'s wall ring is cut by sweeping x before z, so it comes out as
   * two boxes running the full length and two inset between them — a set the
   * quarter turn does not map onto itself even though the ring does. Cutting
   * the same ring the other way must not change the verdict, and moving one
   * wall must.
   */
  it("judges a square plate by the volume its body occupies, not by how it was cut", () => {
    const catalog = studCenters("builtin:plate-8x8");
    const frame: LedgerTransform = { positionLdu: [70, -4, 70], orientationId: "upright-yaw-270" };
    const plate = getPartDefinition("builtin:plate-8x8")!;
    const withBody = (body: readonly CollisionPrimitive[]): PartDefinition => ({
      ...plate,
      collision: {
        ...plate.collision,
        primitives: [
          ...body,
          ...plate.collision.primitives.filter(
            ({ tag, id }) => tag !== "body" || id.startsWith("tube:"),
          ),
        ],
      },
    });
    const box = (id: string, min: Point, max: Point): CollisionPrimitive => ({
      id,
      kind: "box",
      tag: "body",
      minLdu: min,
      maxLdu: max,
    });
    const ceiling = box("body:0", [-80, -4, -80], [80, 0, 80]);
    const select = (definition: PartDefinition) =>
      selectCatalogToBuilderFrame({
        definition,
        designRevision: "41539;F",
        catalogStudCenters: catalog,
        builderStudCenters: move(catalog, frame),
        measure: (candidate) => [
          candidate.orientationId === frame.orientationId ? 100_000 : 4_000_000,
        ],
      });

    // The same wall ring, swept z before x.
    const cutTheOtherWay = select(
      withBody([
        ceiling,
        box("body:1", [-80, 0, -80], [80, 4, -76]),
        box("body:2", [-80, 0, 76], [80, 4, 80]),
        box("body:3", [-80, 0, -76], [-76, 4, 76]),
        box("body:4", [76, 0, -76], [80, 4, 76]),
      ]),
    );
    expect(cutTheOtherWay.method).toBe("catalog-part-self-symmetry");
    expect(cutTheOtherWay.equivalenceClassCount).toBe(1);

    // One wall moved 4 LDU inward: the same four boxes, a different solid.
    const oneWallMoved = select(
      withBody([
        ceiling,
        box("body:1", [-80, 0, -80], [-76, 4, 80]),
        box("body:2", [-76, 0, -80], [76, 4, -76]),
        box("body:3", [-76, 0, 76], [76, 4, 80]),
        box("body:4", [72, 0, -80], [76, 4, 80]),
      ]),
    );
    expect(oneWallMoved.method).toBe("ldraw-surface-witness");
    expect(oneWallMoved.equivalenceClassCount).toBe(4);
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

  it("refuses an inequivalent exact-zero witness tie but accepts zero against positive", () => {
    const definition = getPartDefinition("builtin:wedge-plate-2x4-wing")!;
    const catalog = studCenters(definition.id);
    const frame: LedgerTransform = {
      positionLdu: [30, -4, -10],
      orientationId: "upright-yaw-270",
    };
    const builder = move(catalog, frame);

    expect(() =>
      selectCatalogToBuilderFrame({
        definition,
        designRevision: "51739;H",
        catalogStudCenters: catalog,
        builderStudCenters: builder,
        measure: () => [0],
      }),
    ).toThrow(/surface witness exactly ties the best two at 0 LDU mean.*stays uncalibrated/su);

    const uniqueExact = selectCatalogToBuilderFrame({
      definition,
      designRevision: "51739;H",
      catalogStudCenters: catalog,
      builderStudCenters: builder,
      measure: (candidate) => (candidate.orientationId === frame.orientationId ? [0] : [1_000_000]),
    });
    expect(uniqueExact).toMatchObject({
      transform: frame,
      method: "ldraw-surface-witness",
      witnessMarginMicroRatio: "infinite",
    });
  });

  it("keeps the selected frame under 2 LDU without hiding the inequivalent runner-up", () => {
    const definition = getPartDefinition("builtin:wedge-plate-2x4-wing")!;
    const catalog = studCenters(definition.id);
    const frame: LedgerTransform = {
      positionLdu: [30, -4, -10],
      orientationId: "upright-yaw-270",
    };
    const select = (measure: (candidate: LedgerTransform) => readonly number[]) =>
      selectCatalogToBuilderAnchorFrame({
        definition,
        designRevision: "project-authored-hard-surface-bound;1",
        catalogAnchorCenters: catalog,
        builderAnchorCenters: move(catalog, frame),
        anchorDescription: "project-authored exact anchor centers",
        measure,
      });

    expect(() => select(() => [2_000_001])).toThrow(
      /best representative whose independent source-surface maximum is 2.000001 LDU/u,
    );

    expect(() =>
      select((candidate) =>
        candidate.orientationId === frame.orientationId ? [1_000_000] : [2_000_001],
      ),
    ).toThrow(/separates the best two by only 2.000001x.*4x is required/su);

    expect(() =>
      select((candidate) => {
        if (candidate.orientationId === frame.orientationId) return [1_000_000];
        if (candidate.orientationId === "upright-yaw-0") return [1_500_000];
        return [2_000_001];
      }),
    ).toThrow(/separates the best two by only 1.5x.*4x is required/su);

    expect(() =>
      select((candidate) =>
        candidate.orientationId === frame.orientationId
          ? [1_000_000, 1_500_000]
          : [4_999_999, 5_000_000],
      ),
    ).toThrow(/separates the best two by only 3.9999996x.*4x is required/su);

    const exactFourfold = select((candidate) => {
      if (candidate.orientationId === frame.orientationId) return [400_000];
      if (candidate.orientationId === "upright-yaw-0") return [2_000_001];
      return [2_000_001];
    });
    expect(exactFourfold.method).toBe("ldraw-surface-witness");
    expect(exactFourfold.witnessMarginMicroRatio).toBe(5_000_003);
  });

  it("proves the current resolved 35480 and 3659 meshes under their exact half turns", () => {
    const halfTurn: LedgerTransform = {
      positionLdu: [0, 0, 0],
      orientationId: "upright-yaw-180",
    };
    expect(
      isCatalogPartSelfSymmetry(getPartDefinition("builtin:plate-1x2-round-end")!, halfTurn),
    ).toBe(true);
    expect(isCatalogPartSelfSymmetry(getPartDefinition("builtin:arch-1x4")!, halfTurn)).toBe(true);
  });

  it("requires the effective placement grid center and legal yaws to share the quotient symmetry", () => {
    const plate = getPartDefinition("builtin:plate-8x8")!;
    const quarterTurn: LedgerTransform = {
      positionLdu: [0, 0, 0],
      orientationId: "upright-yaw-90",
    };
    expect(isCatalogPartSelfSymmetry(plate, quarterTurn)).toBe(true);
    expect(
      isCatalogPartSelfSymmetry({ ...plate, connectorGridCenterLdu: [10, 0] }, quarterTurn),
    ).toBe(false);
    expect(
      isCatalogPartSelfSymmetry({ ...plate, legalOrientationIds: ["upright-yaw-0"] }, quarterTurn),
    ).toBe(false);
  });

  it("refuses resolved-mesh coverage, normal, index, and group drift hidden by aggregates", () => {
    const halfTurn: LedgerTransform = {
      positionLdu: [0, 0, 0],
      orientationId: "upright-yaw-180",
    };
    const mesh = (overrides: Partial<ResolvedMeshAsset> = {}): ResolvedMeshAsset => ({
      assetId: "test:exact-indexed-half-turn/1",
      positionsLdu: [-2, 0, -1, -2, 0, 1, -1, 0, 0, 2, 0, 1, 2, 0, -1, 1, 0, 0],
      normalsCatalogLocal: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      indices: [0, 1, 2, 3, 4, 5],
      groups: [{ role: "body", triangleStart: 0, triangleCount: 2 }],
      componentFirstTriangles: [0, 1],
      extremalTriangles: [0, 1],
      vertexCount: 6,
      triangleCount: 2,
      ...overrides,
    });
    expect(isResolvedMeshAssetSelfSymmetry(mesh(), halfTurn)).toBe(true);

    const coverage = mesh({ indices: [0, 1, 2, 3, 5, 4] });
    expect(() => isResolvedMeshAssetSelfSymmetry(coverage, halfTurn)).toThrow(
      /exact indexed vertices/u,
    );

    const normals = [...mesh().normalsCatalogLocal!];
    normals[9] = 1;
    normals[10] = 0;
    expect(() =>
      isResolvedMeshAssetSelfSymmetry(mesh({ normalsCatalogLocal: normals }), halfTurn),
    ).toThrow(/exact indexed vertices/u);

    const duplicated = mesh({
      positionsLdu: [...mesh().positionsLdu, -2, 0, -1],
      normalsCatalogLocal: [...mesh().normalsCatalogLocal!, 0, 1, 0],
      indices: [6, 1, 2, 3, 4, 5],
      vertexCount: 7,
    });
    expect(() => isResolvedMeshAssetSelfSymmetry(duplicated, halfTurn)).toThrow(
      /ambiguous vertex bijection/u,
    );

    const groups = mesh({
      groups: [
        { role: "body", triangleStart: 0, triangleCount: 1 },
        { role: "stud", triangleStart: 1, triangleCount: 1 },
      ],
    });
    expect(() => isResolvedMeshAssetSelfSymmetry(groups, halfTurn)).toThrow(
      /exact indexed vertices/u,
    );
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
      /11 centers while the catalog anchor set has 12/u,
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
