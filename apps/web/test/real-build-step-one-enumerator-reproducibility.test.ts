import { describe, expect, it } from "vitest";

import {
  applyBuildOperations,
  canonicalDigest,
  createEmptyBrickDocument,
} from "@lego-studio/brick-kernel";
import { BUILTIN_CATALOG_VERSION } from "@lego-studio/catalog";

import { snapshotRealBuildEnumeratedPlacementOffer } from "../e2e/real-build-enumerated-placement-witness";
import {
  enumeratePlacements,
  placementOccupancyKey,
  type PlacementCandidate,
} from "../src/assembly/enumerate-placements";
import { createPlacePartTransaction } from "../src/manual-commands";

const FIRST_PART = "builtin:corner-plate-5x5-quarter-ring";
const SECOND_PART = "builtin:corner-plate-4x4-round";

function distinct(candidates: readonly PlacementCandidate[]): readonly PlacementCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = placementOccupancyKey(candidate.catalogPartId, candidate.transform);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

describe("current /26 step-one catalog enumeration", () => {
  it("retains the complete 4 by 100 no-model offer product without target transforms", () => {
    const empty = createEmptyBrickDocument({
      id: "step-one-enumerator-reproducibility",
      name: "Step-one enumerator reproducibility",
      maxParts: 1_464,
    });
    const first = distinct(
      enumeratePlacements(empty, FIRST_PART, { includeBuildPlate: true }).candidates,
    );
    const branches = first.map((firstCandidate) => {
      const transaction = createPlacePartTransaction(empty, {
        catalogPartId: firstCandidate.catalogPartId,
        colorId: "builtin:black",
        transform: firstCandidate.transform,
      });
      const firstDocument = applyBuildOperations(empty, transaction.operations);
      const second = distinct(enumeratePlacements(firstDocument, SECOND_PART, {}).candidates);
      return {
        first: snapshotRealBuildEnumeratedPlacementOffer(firstCandidate),
        second: second.map((candidate) => snapshotRealBuildEnumeratedPlacementOffer(candidate)),
      };
    });
    const digest = canonicalDigest({
      schemaVersion: "lego.real-build-step-one-enumerator-reproducibility/1",
      catalogVersion: BUILTIN_CATALOG_VERSION,
      firstPart: FIRST_PART,
      secondPart: SECOND_PART,
      branches,
    });

    expect(first.map(({ transform }) => transform)).toEqual([
      { positionLdu: [0, 8, 0], orientationId: "upright-yaw-0" },
      { positionLdu: [0, 8, 0], orientationId: "upright-yaw-180" },
      { positionLdu: [0, 8, 0], orientationId: "upright-yaw-270" },
      { positionLdu: [0, 8, 0], orientationId: "upright-yaw-90" },
    ]);
    expect(branches.map(({ second }) => second.length)).toEqual([100, 100, 100, 100]);
    expect(branches.flatMap(({ second }) => second)).toHaveLength(400);
    const completeOffers = branches.reduce((count, branch) => count + branch.second.length, 0);
    const retainedRootEdges = completeOffers * 8;
    const logicalCameraBranches = retainedRootEdges * 8;
    expect({ completeOffers, retainedRootEdges, logicalCameraBranches }).toEqual({
      completeOffers: 400,
      retainedRootEdges: 3_200,
      logicalCameraBranches: 25_600,
    });
    expect(logicalCameraBranches).toBeGreaterThan(8_192);
    expect(
      branches
        .flatMap(({ second }) => second)
        .every(
          ({ connections, restsOnBuildPlate }) => connections.length > 0 && !restsOnBuildPlate,
        ),
    ).toBe(true);
    expect(digest).toBe("sha256:18647bdea99ba4756aee66466ef6193efc6eda36d1417bd7318a7f5fe4bf0469");
  });
});
