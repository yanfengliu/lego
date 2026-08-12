import { STUD_PITCH_LDU, getPartDefinition, type LduVector3 } from "@lego-studio/catalog";
import {
  applyBuildOperations,
  createEmptyBrickDocument,
  transformLduPoint,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { describe, expect, it } from "vitest";

import { createPlacePartTransaction } from "../manual-commands";
import { GROUND_UNDERSIDE_LDU, bodyBoundsLdu, findStudConnections } from "../placement";
import {
  enumeratePlacements,
  placementOccupancyKey,
  type PlacementCandidate,
} from "./enumerate-placements";

function build(
  placements: readonly { part: string; at: LduVector3; orientationId?: string }[],
): BrickDocumentV1 {
  let document = createEmptyBrickDocument({ id: "enumeration", name: "Enumeration fixture" });
  for (const placement of placements) {
    const transaction = createPlacePartTransaction(document, {
      catalogPartId: placement.part,
      colorId: "builtin:red",
      transform: {
        positionLdu: placement.at,
        orientationId: placement.orientationId ?? "upright-yaw-0",
      },
    });
    document = applyBuildOperations(document, transaction.operations);
  }
  return document;
}

function key(candidate: PlacementCandidate): string {
  return `${candidate.transform.positionLdu.join(",")}|${candidate.transform.orientationId}`;
}

/**
 * Every lattice placement in a box around the assembly, judged by whether the
 * editor places it, the document validator accepts the result, and the part
 * stays out of the build plate. Slow and obviously correct, which is the point:
 * it is the oracle the fast enumeration is checked against.
 *
 * The plate clause is the one rule stated here rather than read off the kernel,
 * because the kernel has no collider for the build plate: a part hanging from
 * the underside clutches of something resting on the plate is validator-legal
 * and physically impossible. It is written from the same surface `assessSupport`
 * treats as the floor, so it is a statement of the domain rule and not a copy of
 * how enumeration implements it.
 */
function bruteForce(
  document: BrickDocumentV1,
  catalogPartId: string,
  reachStuds: number,
): { readonly legal: ReadonlySet<string>; readonly sweptY: ReadonlySet<number> } {
  const definition = getPartDefinition(catalogPartId)!;
  const legal = new Set<string>();
  const sweptY = new Set<number>();
  const heights = [-2, -1, 0, 1, 2, 3, 4, 5];
  for (const orientationId of definition.legalOrientationIds) {
    for (let xStep = -reachStuds; xStep <= reachStuds; xStep += 1) {
      for (let zStep = -reachStuds; zStep <= reachStuds; zStep += 1) {
        for (const level of heights) {
          const y = GROUND_UNDERSIDE_LDU - definition.dimensions.heightLdu / 2 - level * 8;
          sweptY.add(y);
          const positionLdu: LduVector3 = [
            xStep * (STUD_PITCH_LDU / 2),
            y,
            zStep * (STUD_PITCH_LDU / 2),
          ];
          let candidate: BrickDocumentV1;
          try {
            const transaction = createPlacePartTransaction(document, {
              catalogPartId,
              colorId: "builtin:red",
              transform: { positionLdu, orientationId },
            });
            candidate = applyBuildOperations(document, transaction.operations);
          } catch {
            continue;
          }
          const buried =
            bodyBoundsLdu({ catalogPartId, transform: { positionLdu, orientationId } }).max[1] >
            GROUND_UNDERSIDE_LDU;
          if (!buried && validateBrickDocument(candidate).documentGloballyValid) {
            legal.add(`${positionLdu.join(",")}|${orientationId}`);
          }
        }
      }
    }
  }
  return { legal, sweptY };
}

describe("enumerating legal placements", () => {
  it("offers only the origin when there is nothing to build on", () => {
    const document = createEmptyBrickDocument({ id: "empty", name: "Empty" });

    const enumeration = enumeratePlacements(document, "builtin:brick-2x4");

    expect(enumeration.counts.freeStuds).toBe(0);
    expect(enumeration.candidates).toHaveLength(4);
    for (const candidate of enumeration.candidates) {
      expect(candidate.restsOnBuildPlate).toBe(true);
      expect(candidate.transform.positionLdu).toEqual([0, 0, 0]);
    }
    // Four spellings, two distinct placements: a 2x4 at yaw 0 occupies exactly
    // what it occupies at yaw 180. Enumeration keeps both; collapsing them is
    // the caller's job, so that completeness stays exactly checkable.
    expect(
      new Set(
        enumeration.candidates.map((c) => placementOccupancyKey(c.catalogPartId, c.transform)),
      ).size,
    ).toBe(2);
  });

  it("enumerates from free ports, not from a lattice sweep", () => {
    const document = build([{ part: "builtin:plate-2x2", at: [0, 8, 0] }]);

    const enumeration = enumeratePlacements(document, "builtin:brick-1x1");

    // Four free studs, one clutch, four orientations that all coincide.
    expect(enumeration.counts.freeStuds).toBe(4);
    expect(enumeration.counts.rawFromStuds).toBe(16);
    // And four free clutches on the plate's underside, seeded the other way.
    // The plate rests on the build plate, so every one of those origins puts the
    // brick inside it and every one is refused — which is the point of counting
    // them separately from a collision.
    expect(enumeration.counts.freeClutches).toBe(4);
    expect(enumeration.counts.rawFromClutches).toBe(16);
    expect(enumeration.counts.distinctTransforms).toBe(32);
    expect(enumeration.counts.rejectedBelowBuildPlate).toBe(16);
    expect(enumeration.candidates).toHaveLength(16);
    // A 1x1 brick occupies the same space in all four, so four studs is four
    // real placements written sixteen ways.
    expect(
      new Set(
        enumeration.candidates.map((c) => placementOccupancyKey(c.catalogPartId, c.transform)),
      ).size,
    ).toBe(4);
    expect(new Set(enumeration.candidates.map((c) => c.transform.positionLdu.join(","))).size).toBe(
      4,
    );
  });

  /**
   * Brute force only sweeps its own window, so the enumeration is compared
   * inside that window — in every axis. A candidate at a height the sweep never
   * tried is a difference in what was searched, not in what is legal, and
   * leaving the height out of this check once made fourteen of them look like
   * unsoundness.
   */
  function compareWithBruteForce(
    document: BrickDocumentV1,
    catalogPartId: string,
    reachStuds: number,
  ): { missed: string[]; invented: string[]; bruteSize: number } {
    const { legal, sweptY } = bruteForce(document, catalogPartId, reachStuds);
    const reachLdu = reachStuds * (STUD_PITCH_LDU / 2);
    const enumerated = new Set(
      enumeratePlacements(document, catalogPartId, { includeBuildPlate: true })
        .candidates.map(key)
        .filter((entry) => {
          const [x, y, z] = entry.split("|")[0]!.split(",").map(Number) as [number, number, number];
          return Math.abs(x) <= reachLdu && Math.abs(z) <= reachLdu && sweptY.has(y);
        }),
    );
    return {
      missed: [...legal].filter((entry) => !enumerated.has(entry)).sort(),
      invented: [...enumerated].filter((entry) => !legal.has(entry)).sort(),
      bruteSize: legal.size,
    };
  }

  it("finds exactly what brute force finds, and nothing it does not", () => {
    const document = build([
      { part: "builtin:plate-2x4", at: [0, 8, 0] },
      { part: "builtin:brick-1x2", at: [-10, -8, -20] },
    ]);

    const { missed, invented, bruteSize } = compareWithBruteForce(document, "builtin:brick-1x2", 8);

    expect({ missed, invented }).toEqual({ missed: [], invented: [] });
    expect(bruteSize).toBeGreaterThan(10);
  });

  it("stays exact for a part whose footprint is not square", () => {
    const document = build([
      { part: "builtin:plate-4x4", at: [0, 8, 0] },
      { part: "builtin:brick-2x2", at: [20, -8, 20] },
    ]);

    const { missed, invented, bruteSize } = compareWithBruteForce(document, "builtin:brick-1x3", 8);

    expect({ missed, invented }).toEqual({ missed: [], invented: [] });
    expect(bruteSize).toBeGreaterThan(10);
  }, 15_000);

  /**
   * A part arriving from underneath, which is what an upward arrow in a printed
   * instruction step means.
   *
   * The fixture is an overhang: a 2x2 brick on the plate carrying a 2x4 plate
   * that reaches two stud columns past it. The space under that reach is empty
   * and open, and the only way into it is a candidate's own studs entering the
   * overhanging plate's free underside clutches — no free stud is anywhere near
   * it, so an enumeration seeded from studs alone offers nothing there.
   *
   * Nothing here is taken from the enumeration. The seat is derived from the
   * catalog's connector positions, the editor is asked to place it, and the
   * document validator is asked whether the result stands; then the brute-force
   * oracle, which never calls the enumerator, is asked whether it agrees about
   * the whole window.
   */
  it("offers the placements that arrive from underneath", () => {
    const document = build([
      { part: "builtin:brick-2x2", at: [0, 0, 0] },
      { part: "builtin:plate-2x4", at: [0, -16, 20] },
    ]);
    // The overhang is real: the plate is held by the brick's four studs and
    // still has clutches out past it.
    expect(document.connections).toHaveLength(4);

    // Where a 1x2 plate would have to sit for its studs to enter the free
    // clutch furthest out along the overhang. Computed from the catalog, in the
    // world frame, with no reference to what enumeration produced.
    const overhanging = document.parts.find((part) => part.catalogPartId === "builtin:plate-2x4")!;
    const used = new Set(
      document.connections.flatMap((connection) => [
        `${connection.a.partId} ${connection.a.portId}`,
        `${connection.b.partId} ${connection.b.portId}`,
      ]),
    );
    const freeClutchWorld = getPartDefinition(overhanging.catalogPartId)!
      .connectors.filter(
        (connector) =>
          connector.kind === "undersideClutch" && !used.has(`${overhanging.id} ${connector.id}`),
      )
      .map((connector) => transformLduPoint(overhanging.transform, connector.positionLdu))
      .sort((left, right) => right[2] - left[2])[0]!;
    const hangingStud = getPartDefinition("builtin:plate-1x2")!.connectors.find(
      (connector) => connector.kind === "stud",
    )!.positionLdu;
    const seat: LduVector3 = [
      freeClutchWorld[0] - hangingStud[0],
      freeClutchWorld[1] - hangingStud[1],
      freeClutchWorld[2] - hangingStud[2],
    ];
    // It hangs: entirely under the overhanging plate and clear of the build
    // plate, so nothing is holding it up except the clutches above it.
    const seated = bodyBoundsLdu({
      catalogPartId: "builtin:plate-1x2",
      transform: { positionLdu: seat, orientationId: "upright-yaw-0" },
    });
    expect(seated.max[1]).toBeLessThan(GROUND_UNDERSIDE_LDU);
    expect(seated.min[1]).toBeGreaterThanOrEqual(bodyBoundsLdu(overhanging).max[1]);

    // The editor and the validator both accept it, so it is a placement the
    // enumeration is obliged to offer rather than a shape this test invented.
    const applied = applyBuildOperations(
      document,
      createPlacePartTransaction(document, {
        catalogPartId: "builtin:plate-1x2",
        colorId: "builtin:red",
        transform: { positionLdu: seat, orientationId: "upright-yaw-0" },
      }).operations,
    );
    expect(validateBrickDocument(applied).documentGloballyValid).toBe(true);

    const enumeration = enumeratePlacements(document, "builtin:plate-1x2");
    const offered = enumeration.candidates.find(
      (candidate) => key(candidate) === `${seat.join(",")}|upright-yaw-0`,
    );
    expect(offered?.transform.positionLdu).toEqual(seat);
    // And it is offered because of the joint it actually makes: every one of its
    // connections is one of its own studs, entering a clutch above it.
    expect(offered!.connections.length).toBeGreaterThan(0);
    expect(
      offered!.connections.every(({ candidatePortId }) => candidatePortId.startsWith("stud")),
    ).toBe(true);
    expect(enumeration.counts.freeClutches).toBeGreaterThan(0);

    // Completeness over the whole window, not just this one seat.
    const { missed, invented } = compareWithBruteForce(document, "builtin:plate-1x2", 8);
    expect({ missed, invented }).toEqual({ missed: [], invented: [] });
  });

  it("authors the same connections the editor's own discovery does", () => {
    const document = build([{ part: "builtin:plate-4x4", at: [0, 8, 0] }]);
    const occupied = new Set(
      document.connections.flatMap((connection) => [
        `${connection.a.partId} ${connection.a.portId}`,
        `${connection.b.partId} ${connection.b.portId}`,
      ]),
    );

    for (const candidate of enumeratePlacements(document, "builtin:brick-2x2").candidates) {
      const viaEditor = findStudConnections(
        {
          id: "enumeration-candidate",
          catalogPartId: candidate.catalogPartId,
          transform: candidate.transform,
        },
        document.parts,
        occupied,
      );
      expect(candidate.connections).toEqual(viaEditor);
    }
  });

  it("every candidate really applies and validates", () => {
    const document = build([
      { part: "builtin:plate-4x4", at: [0, 8, 0] },
      { part: "builtin:brick-1x4", at: [0, -8, -30], orientationId: "upright-yaw-90" },
    ]);

    const enumeration = enumeratePlacements(document, "builtin:plate-1x2");
    expect(enumeration.candidates.length).toBeGreaterThan(20);

    for (const candidate of enumeration.candidates) {
      const transaction = createPlacePartTransaction(document, {
        catalogPartId: candidate.catalogPartId,
        colorId: "builtin:red",
        transform: candidate.transform,
      });
      const applied = applyBuildOperations(document, transaction.operations);
      const report = validateBrickDocument(applied);
      expect({
        at: candidate.transform,
        issues: report.issues.filter((issue) => issue.severity === "blocking").map((i) => i.code),
      }).toEqual({ at: candidate.transform, issues: [] });
    }
  });

  it("prunes far more than it keeps, and says by how much", () => {
    const document = build([
      { part: "builtin:plate-6x6", at: [0, 8, 0] },
      { part: "builtin:brick-2x2", at: [0, -8, 0] },
    ]);

    const { counts } = enumeratePlacements(document, "builtin:brick-2x4");

    // Four studs of the plate are taken by the brick, and the brick's own four
    // are free, so the free-stud count is not simply the plate's.
    expect(counts.freeStuds).toBe(36 - 4 + 4);
    expect(counts.rawFromStuds).toBe(counts.freeStuds * 8 * 4);
    expect(counts.rawFromClutches).toBe(counts.freeClutches * 8 * 4);
    expect(counts.distinctTransforms).toBeLessThan(counts.rawFromStuds + counts.rawFromClutches);
    expect(
      counts.rejectedUnsupported +
        counts.rejectedDetached +
        counts.rejectedBelowBuildPlate +
        counts.rejectedColliding +
        counts.accepted,
    ).toBe(counts.distinctTransforms);
    expect(counts.rejectedColliding).toBeGreaterThan(0);
    expect(counts.accepted).toBeGreaterThan(0);
    expect(counts.accepted).toBeLessThan(counts.distinctTransforms);
  });

  it("refuses to enumerate past its bound, and shows the arithmetic", () => {
    const document = build([{ part: "builtin:plate-6x6", at: [0, 8, 0] }]);

    // The message has to carry the factors, or the next reader has to
    // re-derive why the bound was hit before they can choose what to change.
    expect(() =>
      enumeratePlacements(document, "builtin:brick-2x4", { maxDistinctTransforms: 10 }),
    ).toThrowError(
      /passed the 10 distinct-transform bound \(36 free studs x 8 clutches, plus 36 free clutches x 8 studs, x 4 orientations\)/,
    );
  });

  it("names what it cannot enumerate", () => {
    const document = createEmptyBrickDocument({ id: "empty", name: "Empty" });

    expect(() => enumeratePlacements(document, "builtin:not-a-part")).toThrowError(
      /unknown catalog part builtin:not-a-part; it is absent from the pinned catalog/,
    );
    expect(() =>
      enumeratePlacements(document, "builtin:brick-2x4", { orientationIds: ["sideways"] }),
    ).toThrowError(/Orientation sideways is not legal/);
  });

  it("is a pure function of the document", () => {
    const document = build([{ part: "builtin:plate-4x4", at: [0, 8, 0] }]);

    const first = enumeratePlacements(document, "builtin:brick-1x2");
    const second = enumeratePlacements(document, "builtin:brick-1x2");

    expect(first.candidates.map(key)).toEqual(second.candidates.map(key));
  });
});
