import { describe, expect, it } from "vitest";

import { canonicalDigest, createEmptyBrickDocument } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, RigidTransform } from "@lego-studio/protocol";

import { __testOnly as exactCompilerTestOnly } from "../e2e/real-build-prefix50-exact-compiler";
import type {
  RealBuildPrefix50SearchBudget,
  RealBuildPrefix50TargetOccurrence,
} from "../e2e/real-build-prefix50-exact-compiler-contract";
import {
  PLACEMENT_ENUMERATION_VERSION,
  type PlacementCandidate,
  type PlacementEnumeration,
} from "../src/assembly/enumerate-placements";

type TestEnumerator = NonNullable<Parameters<typeof exactCompilerTestOnly.searchStep>[5]>;

function emptyDocument(): BrickDocumentV1 {
  return createEmptyBrickDocument({
    id: "prefix50-enumeration-cache-synthetic",
    name: "Prefix 50 enumeration cache synthetic",
  });
}

function target(
  ordinal: number,
  catalogPartId: string,
  positionLdu: readonly [number, number, number],
  orientationId = "upright-yaw-0",
): RealBuildPrefix50TargetOccurrence {
  const transform: RigidTransform = { positionLdu, orientationId };
  return {
    ordinal,
    printedStepNumber: 1,
    phaseSequence: 1,
    phaseMemberOrdinal: ordinal,
    subBuildPath: ["synthetic-root"],
    colorId: "builtin:red",
    partIdentity: {
      publishedCatalogPartId: catalogPartId,
      reconciledCatalogPartId: catalogPartId,
      officialDesignId: `synthetic-${ordinal}`,
      officialDesignRevision: `synthetic-${ordinal}:1`,
      sourceLDrawPartId: `synthetic-${ordinal}`,
      catalogLDrawPartId: `synthetic-${ordinal}`,
      identityProofId: null,
      basis: "published-exact",
    },
    sourceWorldTransform: transform,
    targetTransform: transform,
  };
}

function budget(): RealBuildPrefix50SearchBudget {
  return {
    nodes: 0,
    enumerations: 0,
    orientationNarrowedEnumerations: 0,
    targetAttempts: new Map(),
  };
}

function enumeration(
  catalogPartId: string,
  orientationId: string,
  candidates: readonly PlacementCandidate[],
): PlacementEnumeration {
  return {
    schemaVersion: PLACEMENT_ENUMERATION_VERSION,
    catalogPartId,
    orientationIds: [orientationId],
    connectorSeedReceipt: [],
    candidates,
    counts: {
      freeStuds: 0,
      freeClutches: 0,
      rawFromStuds: 0,
      rawFromClutches: 0,
      rawFromBuildPlate: candidates.length,
      distinctTransforms: candidates.length,
      rejectedUnsupported: 0,
      rejectedDetached: 0,
      rejectedBelowBuildPlate: 0,
      rejectedColliding: 0,
      accepted: candidates.length,
    },
  };
}

describe("exact prefix-50 complete-enumeration reuse", () => {
  it("keys every enumeration input while deliberately ignoring occurrence and target position", () => {
    const first = target(1, "builtin:brick-1x1", [0, 0, 0]);
    const second = target(2, "builtin:brick-1x1", [40, 0, 0]);
    const query = exactCompilerTestOnly.buildRealBuildPrefix50ExactEnumerationQuery(first, false);
    const key = exactCompilerTestOnly.stateLocalEnumerationQueryCommitment(first, false);

    expect(query).toEqual({
      schemaVersion: "lego.real-build-prefix50-exact-enumeration-query/1",
      catalogPartId: "builtin:brick-1x1",
      options: {
        orientationIds: ["upright-yaw-0"],
        includeBuildPlate: false,
        allowDetached: false,
        maxDistinctTransforms: 200_000,
      },
    });
    expect(key).toBe(canonicalDigest(query));
    expect(exactCompilerTestOnly.stateLocalEnumerationQueryCommitment(second, false)).toBe(key);
    expect(exactCompilerTestOnly.stateLocalEnumerationQueryCommitment(second, true)).not.toBe(key);
    expect(
      exactCompilerTestOnly.stateLocalEnumerationQueryCommitment(
        target(3, "builtin:plate-1x1", [40, 0, 0]),
        false,
      ),
    ).not.toBe(key);
    expect(
      exactCompilerTestOnly.stateLocalEnumerationQueryCommitment(
        target(4, "builtin:brick-1x1", [40, 0, 0], "upright-yaw-90"),
        false,
      ),
    ).not.toBe(key);

    const { targetTransform: _targetTransform, ...projectionOccurrence } = first;
    void _targetTransform;
    expect(
      exactCompilerTestOnly.buildRealBuildPrefix50ExactEnumerationQuery(
        projectionOccurrence,
        false,
      ),
    ).toEqual({
      schemaVersion: "lego.real-build-prefix50-exact-enumeration-query/1",
      catalogPartId: "builtin:brick-1x1",
      options: {
        includeBuildPlate: false,
        allowDetached: false,
        maxDistinctTransforms: 200_000,
      },
    });
  });

  it("reuses one ordered complete result only within its document state", () => {
    const a = target(1, "builtin:brick-1x1", [0, 0, 0]);
    const b = target(2, "builtin:brick-1x1", [40, 0, 0]);
    const run = (reuseCompleteEnumerations: boolean) => {
      const calls: number[] = [];
      const searchBudget = budget();
      const enumerate: TestEnumerator = (document, occurrence, _allowDetached, currentBudget) => {
        if (!("targetTransform" in occurrence)) {
          throw new TypeError("Synthetic enumeration-cache search requires an exact target.");
        }
        calls.push(document.parts.length);
        currentBudget.enumerations += 1;
        currentBudget.orientationNarrowedEnumerations += 1;
        const offeredTransform =
          document.parts.length === 0 ? b.targetTransform : a.targetTransform;
        return enumeration(
          occurrence.partIdentity.reconciledCatalogPartId,
          occurrence.targetTransform.orientationId,
          [
            {
              catalogPartId: occurrence.partIdentity.reconciledCatalogPartId,
              transform: offeredTransform,
              connections: [],
              restsOnBuildPlate: true,
            },
          ],
        );
      };
      const result = exactCompilerTestOnly.searchStep(
        {
          document: emptyDocument(),
          remaining: [a, b],
          witnesses: [],
          ordinals: [],
          witnessIndexByTempId: new Map(),
        },
        new Set(),
        true,
        searchBudget,
        new Set(),
        enumerate,
        reuseCompleteEnumerations,
      );
      return { calls, result, searchBudget };
    };

    const uncached = run(false);
    const cached = run(true);

    expect(uncached.calls).toEqual([0, 0, 1]);
    expect(cached.calls).toEqual([0, 1]);
    expect(cached.result?.ordinals).toEqual([2, 1]);
    expect(cached.result).toEqual(uncached.result);
    expect(cached.searchBudget.targetAttempts).toEqual(uncached.searchBudget.targetAttempts);
    expect(cached.searchBudget).toMatchObject({ enumerations: 2, nodes: 3 });
    expect(uncached.searchBudget).toMatchObject({ enumerations: 3, nodes: 3 });
  });

  it("refuses an incomplete receipt before it can enter the cache", () => {
    const occurrence = target(1, "builtin:brick-1x1", [0, 0, 0]);
    const searchBudget = budget();
    const enumerate: TestEnumerator = (
      _document,
      candidateOccurrence,
      _allowDetached,
      currentBudget,
    ) => {
      if (!("targetTransform" in candidateOccurrence)) {
        throw new TypeError("Synthetic enumeration-cache search requires an exact target.");
      }
      currentBudget.enumerations += 1;
      const incomplete = enumeration(
        candidateOccurrence.partIdentity.reconciledCatalogPartId,
        candidateOccurrence.targetTransform.orientationId,
        [],
      );
      return { ...incomplete, counts: { ...incomplete.counts, accepted: 1 } };
    };

    expect(() =>
      exactCompilerTestOnly.searchStep(
        {
          document: emptyDocument(),
          remaining: [occurrence],
          witnesses: [],
          ordinals: [],
          witnessIndexByTempId: new Map(),
        },
        new Set(),
        true,
        searchBudget,
        new Set(),
        enumerate,
        true,
      ),
    ).toThrow(/incomplete or internally inconsistent/u);
    expect(searchBudget.enumerations).toBe(1);
  });
});
