import { getPartDefinition } from "@lego-studio/catalog";
import { deepFreeze, validateBrickDocument } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import {
  enumeratePlacements,
  type PlacementEnumeration,
  type PlacementEnumerationOptions,
  type PlacementEnumerationWork,
} from "../src/assembly/enumerate-placements";
import {
  __testOnly,
  requireRealBuildPrefix50Step45RelationalResolution,
  resolveRealBuildPrefix50Step45RelationalPlacements,
  type RealBuildPrefix50Step45RelationalResolverInput,
} from "../e2e/real-build-prefix50-step45-relational-resolver";
import {
  step45RelationalTestInput,
  translateStep45Input,
} from "./real-build-prefix50-step45-relational-test-support";

type EnumerationMutation = (
  enumeration: PlacementEnumeration,
  work: PlacementEnumerationWork,
) => {
  readonly enumeration: PlacementEnumeration;
  readonly work: PlacementEnumerationWork;
};

function enumeratorWithMutation(mutate: EnumerationMutation) {
  return (
    document: RealBuildPrefix50Step45RelationalResolverInput["selectedStep44Document"],
    catalogPartId: string,
    options: PlacementEnumerationOptions,
  ): PlacementEnumeration => {
    let observed: PlacementEnumerationWork | undefined;
    const enumeration = enumeratePlacements(document, catalogPartId, {
      ...options,
      observeWork: (work) => {
        observed = work;
      },
    });
    if (observed === undefined)
      throw new Error("Mutation harness did not observe enumeration work.");
    const mutated = mutate(enumeration, observed);
    options.observeWork?.(deepFreeze(mutated.work));
    return mutated.enumeration;
  };
}

function candidateOrder(
  left: PlacementEnumeration["candidates"][number],
  right: PlacementEnumeration["candidates"][number],
): number {
  return (
    left.transform.positionLdu[0] - right.transform.positionLdu[0] ||
    left.transform.positionLdu[1] - right.transform.positionLdu[1] ||
    left.transform.positionLdu[2] - right.transform.positionLdu[2] ||
    left.transform.orientationId.localeCompare(right.transform.orientationId)
  );
}

describe("prefix-50 Step-45 relational placement resolution", () => {
  it("derives the exact three pairs from one unrestricted pass and follows a moved root", () => {
    const input = step45RelationalTestInput();
    expect(validateBrickDocument(input.selectedStep44Document).documentGloballyValid).toBe(true);
    expect(input.selectedStep44Document.parts).toHaveLength(280);
    expect(input.selectedStep44Document.steps).toHaveLength(44);
    expect(input.selectedStep44Document.steps[43]?.partIds).toEqual([]);

    let calls = 0;
    const resolution = __testOnly.resolveWithEnumerator!(
      input,
      (document, catalogPartId, options) => {
        calls += 1;
        expect(catalogPartId).toBe("builtin:axle-1x3");
        expect(Object.hasOwn(options, "orientationIds")).toBe(false);
        expect(options).toMatchObject({
          includeBuildPlate: false,
          allowDetached: false,
          maxDistinctTransforms: 200_000,
        });
        return enumeratePlacements(document, catalogPartId, options);
      },
    );

    expect(calls).toBe(1);
    expect(resolution).toMatchObject({
      authority: "none",
      selectionAuthority: false,
      placementAuthority: false,
      completionAuthority: false,
      selectedStep44BuildStepCount: 44,
      limits: {
        exactDocumentPartCount: 280,
        maxDocumentConnections: 4_096,
        maxDistinctTransforms: 200_000,
        maxRecordedWorkPerCounter: 1_000_000_000,
        maxSeedReceiptRows: 64,
        maxCandidateConnections: 256,
      },
      query: {
        orientationIdsOmitted: true,
        freshEnumeration: true,
        enumerationCallCount: 1,
      },
      enumeration: { complete: true, bounded: true },
      combinedValidation: {
        candidatePartCount: 3,
        combinedPartCount: 283,
        combinedBuildStepCount: 45,
        prospectivePrintedStepNumber: 45,
        collisionFindingCount: 0,
        blockingIssueCount: 0,
        documentGloballyValid: true,
      },
    });
    expect(resolution.enumeration.orientationIds).toEqual(
      getPartDefinition("builtin:axle-1x3")!.legalOrientationIds,
    );
    expect(
      resolution.rows.map(
        ({
          occurrenceOrdinal,
          receiverOrdinal,
          candidatePortId,
          receiverPortId,
          connectionKind,
        }) => [occurrenceOrdinal, receiverOrdinal, candidatePortId, receiverPortId, connectionKind],
      ),
    ).toEqual([
      [281, 265, "axle:2", "axleHole:0", "stud-tube"],
      [282, 261, "axle:2", "axleHole:0", "stud-tube"],
      [283, 264, "axle:2", "axleHole:0", "stud-tube"],
    ]);
    expect(resolution.coherentSourceToResolvedTransform).toEqual({
      positionLdu: [0, -3_000, 0],
      orientationId: "upright-yaw-0",
    });
    expect(requireRealBuildPrefix50Step45RelationalResolution(resolution)).toBe(resolution);
    expect(() =>
      requireRealBuildPrefix50Step45RelationalResolution(structuredClone(resolution)),
    ).toThrow(/runtime-branded authority-free resolution/u);

    const translation = [80, 0, -40] as const;
    const moved = resolveRealBuildPrefix50Step45RelationalPlacements(
      translateStep45Input(input, translation),
    );
    expect(moved.coherentSourceToResolvedTransform).toEqual({
      positionLdu: [translation[0], -3_000 + translation[1], translation[2]],
      orientationId: "upright-yaw-0",
    });
    expect(
      moved.rows.map(({ occurrenceOrdinal, receiverOrdinal }) => [
        occurrenceOrdinal,
        receiverOrdinal,
      ]),
    ).toEqual(
      resolution.rows.map(({ occurrenceOrdinal, receiverOrdinal }) => [
        occurrenceOrdinal,
        receiverOrdinal,
      ]),
    );
    expect(moved.rows.map(({ enumeratedTransform }) => enumeratedTransform.positionLdu)).toEqual(
      resolution.rows.map(({ enumeratedTransform }) => [
        enumeratedTransform.positionLdu[0] + translation[0],
        enumeratedTransform.positionLdu[1] + translation[1],
        enumeratedTransform.positionLdu[2] + translation[2],
      ]),
    );
  });

  it("fails closed on zero or multiple exact pair candidates without a fallback pass", () => {
    const input = step45RelationalTestInput();
    const receiverPartId = input.ordinalPartRows[264]!.partId;
    let zeroCalls = 0;
    const zero = enumeratorWithMutation((enumeration, work) => {
      const index = enumeration.candidates.findIndex(({ connections }) =>
        connections.some(
          ({ targetPartId, targetPortId, candidatePortId }) =>
            targetPartId === receiverPartId &&
            targetPortId === "axleHole:0" &&
            candidatePortId === "axle:2",
        ),
      );
      if (index < 0) throw new Error("Fixture lacks the expected receiver-265 candidate.");
      return {
        enumeration: {
          ...enumeration,
          candidates: enumeration.candidates.filter(
            (_, candidateIndex) => candidateIndex !== index,
          ),
          counts: {
            ...enumeration.counts,
            accepted: enumeration.counts.accepted - 1,
            rejectedColliding: enumeration.counts.rejectedColliding + 1,
          },
        },
        work,
      };
    });
    expect(() =>
      __testOnly.resolveWithEnumerator!(input, (...args) => {
        zeroCalls += 1;
        return zero(...args);
      }),
    ).toThrow(/occurrence 281 requires exactly one.*found 0/u);
    expect(zeroCalls).toBe(1);

    let multipleCalls = 0;
    const multiple = enumeratorWithMutation((enumeration, work) => {
      const original = enumeration.candidates.find(({ connections }) =>
        connections.some(
          ({ targetPartId, targetPortId, candidatePortId }) =>
            targetPartId === receiverPartId &&
            targetPortId === "axleHole:0" &&
            candidatePortId === "axle:2",
        ),
      )!;
      const duplicate = {
        ...original,
        transform: {
          ...original.transform,
          positionLdu: [
            original.transform.positionLdu[0] + 1,
            original.transform.positionLdu[1],
            original.transform.positionLdu[2],
          ] as const,
        },
      };
      const candidates = [...enumeration.candidates, duplicate].sort(candidateOrder);
      const connectorSeedReceipt = enumeration.connectorSeedReceipt.map((seed) =>
        seed.targetKind === "axleHole" && seed.candidateKind === "axle"
          ? { ...seed, axisCompatibleSeeds: seed.axisCompatibleSeeds + 1 }
          : seed,
      );
      return {
        enumeration: {
          ...enumeration,
          connectorSeedReceipt,
          candidates,
          counts: {
            ...enumeration.counts,
            accepted: enumeration.counts.accepted + 1,
            distinctTransforms: enumeration.counts.distinctTransforms + 1,
          },
        },
        work: {
          ...work,
          originProposals: work.originProposals + 1,
          candidateTransformsVisited: work.candidateTransformsVisited + 1,
        },
      };
    });
    expect(() =>
      __testOnly.resolveWithEnumerator!(input, (...args) => {
        multipleCalls += 1;
        return multiple(...args);
      }),
    ).toThrow(/occurrence 281 requires exactly one.*found 2/u);
    expect(multipleCalls).toBe(1);
  });

  it("rejects mapping/source/accounting drift and any caller-supplied target transform", () => {
    const input = step45RelationalTestInput();
    const swappedRows = input.ordinalPartRows.map((row) =>
      row.ordinal === 261
        ? { ...row, partId: input.ordinalPartRows[263]!.partId }
        : row.ordinal === 264
          ? { ...row, partId: input.ordinalPartRows[260]!.partId }
          : row,
    );
    expect(() =>
      resolveRealBuildPrefix50Step45RelationalPlacements({
        ...input,
        ordinalPartRows: swappedRows,
      }),
    ).toThrow(/receiver ordinal 261 has the wrong identity/u);
    expect(() =>
      resolveRealBuildPrefix50Step45RelationalPlacements({
        ...input,
        sourceRepairs: input.sourceRepairs.map((repair, index) =>
          index === 0
            ? {
                ...repair,
                repairedSourceWorldTransform: {
                  ...repair.repairedSourceWorldTransform,
                  positionLdu: [411, -118, -96],
                },
              }
            : repair,
        ),
      }),
    ).toThrow(/source repair 281 does not match/u);
    expect(() =>
      __testOnly.resolveWithEnumerator!(
        input,
        enumeratorWithMutation((enumeration, work) => ({
          enumeration: {
            ...enumeration,
            counts: { ...enumeration.counts, accepted: enumeration.counts.accepted + 1 },
          },
          work,
        })),
      ),
    ).toThrow(/incomplete, narrowed, unbounded, or inconsistent/u);

    let calls = 0;
    const callerTarget = {
      ...input,
      targetTransform: { positionLdu: [410, -118, -96], orientationId: "proper-m-00pp000p0" },
    } as unknown as RealBuildPrefix50Step45RelationalResolverInput;
    expect(() =>
      __testOnly.resolveWithEnumerator!(callerTarget, (...args) => {
        calls += 1;
        return enumeratePlacements(...args);
      }),
    ).toThrow(/must contain exactly/u);
    expect(calls).toBe(0);
  });

  it("rejects a live receiver transform that drifted from the repaired source relation", () => {
    const input = step45RelationalTestInput();
    const driftedInput = translateStep45Input(input, [1, 0, 0]);
    const driftedDocument = driftedInput.selectedStep44Document;
    expect(validateBrickDocument(driftedDocument).documentGloballyValid).toBe(true);
    expect(() =>
      __testOnly.resolveWithEnumerator!(driftedInput, (_document, catalogPartId, options) =>
        enumeratePlacements(input.selectedStep44Document, catalogPartId, options),
      ),
    ).toThrow(/live receiver ordinal 265 drifted from its exact source-to-resolved transform/u);
  });
});
