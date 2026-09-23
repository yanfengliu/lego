import { createEmptyBrickDocument, deepFreeze } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";
import { beforeAll, describe, expect, it } from "vitest";

// @ts-expect-error The opaque verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50ActionPreparation } from "../../../scripts/part-identification-prefix50-action-preparation.mjs";
// @ts-expect-error The opaque verifier intentionally has no caller-facing TS surface.
import { bytesFromVerifiedPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error The opaque verifier intentionally has no caller-facing TS surface.
import { verifyPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation.mjs";
// @ts-expect-error The ignored-evidence reproducer intentionally has no caller-facing TS surface.
import { reproduceCurrentPrefix50OfficialWorldReconciliation } from "../../../scripts/part-identification-prefix50-official-world-reconciliation-current.mjs";
// @ts-expect-error The ignored-evidence verifier intentionally has no caller-facing TS surface.
import { verifyCurrentPrefix50StructuralEvents } from "../../../scripts/part-identification-prefix50-structural-events-current.mjs";
import { createRealBuildPrefix50VerifiedProjectionReader } from "../../../scripts/part-identification-prefix50-verified-projection.mjs";
import type { RealBuildPrefix50TargetOccurrence } from "../e2e/real-build-prefix50-exact-compiler-contract";
import {
  readRealBuildPrefix50VerifiedProjection,
  type RealBuildPrefix50VerifiedProjection,
} from "../e2e/real-build-prefix50-projection";
import {
  __testOnly,
  constructRealBuildPrefix50AtomicSubBuildRoot,
  requireRealBuildPrefix50AtomicSubBuildRoot,
  type RealBuildPrefix50SubBuildRootInput,
  type RealBuildPrefix50SubBuildRootProbeEnumerator,
} from "../e2e/real-build-prefix50-subbuild-root";
import {
  enumeratePlacements,
  type PlacementEnumeration,
} from "../src/assembly/enumerate-placements";

const TARGETS = [
  { positionLdu: [-120, -86, 108] as const, orientationId: "proper-m-00nn000p0" },
  { positionLdu: [-220, -86, 116] as const, orientationId: "proper-m-00nn000p0" },
] as const;

let projection: RealBuildPrefix50VerifiedProjection;
let rows: readonly [RealBuildPrefix50TargetOccurrence, RealBuildPrefix50TargetOccurrence];

function freshBudget() {
  return {
    nodes: 0,
    enumerations: 0,
    orientationNarrowedEnumerations: 0,
    targetAttempts: new Map(),
  };
}

function input(
  overrides: Partial<RealBuildPrefix50SubBuildRootInput> = {},
): RealBuildPrefix50SubBuildRootInput {
  return {
    projection,
    window: projection.childSubBuildWindow!,
    parentDraft: createEmptyBrickDocument({
      id: "prefix50-subbuild-root-parent",
      name: "Prefix 50 exact parent truth",
    }),
    rootRows: rows,
    budget: freshBudget(),
    ...overrides,
  };
}

function mutateRow(
  index: 0 | 1,
  mutation: Partial<RealBuildPrefix50TargetOccurrence>,
): readonly [RealBuildPrefix50TargetOccurrence, RealBuildPrefix50TargetOccurrence] {
  const changed = { ...rows[index], ...mutation };
  return index === 0 ? [changed, rows[1]] : [rows[0], changed];
}

function withEnumerationMutation(
  mutate: (enumeration: PlacementEnumeration, catalogPartId: string) => PlacementEnumeration,
): RealBuildPrefix50SubBuildRootProbeEnumerator {
  return (document, catalogPartId, options) =>
    mutate(enumeratePlacements(document, catalogPartId, options), catalogPartId);
}

function constructForTest(enumerate: RealBuildPrefix50SubBuildRootProbeEnumerator) {
  const construct = __testOnly.constructWithEnumerator;
  if (construct === undefined) throw new Error("SubBuild-root test constructor is unavailable.");
  return construct(input(), enumerate);
}

beforeAll(async () => {
  const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
  const reconciliation = await verifyPrefix50OfficialWorldReconciliation({
    ...reproduced.input,
    artifactBytes: reproduced.bytes,
  });
  const structural = await verifyCurrentPrefix50StructuralEvents();
  const reader = createRealBuildPrefix50VerifiedProjectionReader({
    actionPreparation: {
      bytes: bytesFromVerifiedPrefix50ActionPreparation(reproduced.input.actionPreparation),
      verified: reproduced.input.actionPreparation,
    },
    officialWorldReconciliation: {
      bytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(reconciliation),
      verified: reconciliation,
    },
    structuralEvents: { bytes: structural.bytes, verified: structural.verified },
  });
  projection = readRealBuildPrefix50VerifiedProjection(reader);
  rows = projection.occurrences
    .slice(257, 259)
    .map((occurrence, index) =>
      deepFreeze({ ...occurrence, targetTransform: TARGETS[index]! }),
    ) as unknown as readonly [RealBuildPrefix50TargetOccurrence, RealBuildPrefix50TargetOccurrence];
}, 180_000);

describe("prefix-50 atomic detached SubBuild root", () => {
  it("discovers one identical reciprocal endpoint set and returns only a branded atomic witness", () => {
    const request = input();
    const result = constructRealBuildPrefix50AtomicSubBuildRoot(request);

    expect(result).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-atomic-subbuild-root/1",
      authority: "none",
      atomic: true,
      sourceSetId: "6651557",
      printedStepNumber: 38,
      ordinals: [258, 259],
      accounting: {
        nodeDelta: 2,
        enumerationDelta: 2,
        orientationNarrowedEnumerationDelta: 2,
        nodesAfter: 2,
        enumerationsAfter: 2,
        orientationNarrowedEnumerationsAfter: 2,
      },
      proof: {
        sourceOrder: "258-then-259",
        reciprocalEnumeration: "complete-one-exact-candidate-each-direction",
        collisionFindingCount: 0,
        directions: [
          { baseOrdinal: 258, candidateOrdinal: 259, exactCandidateCount: 1 },
          { baseOrdinal: 259, candidateOrdinal: 258, exactCandidateCount: 1 },
        ],
      },
    });
    expect(result.proof.normalizedConnections.length).toBeGreaterThan(0);
    expect(result.proof.capacityClaimCount).toBeGreaterThan(0);
    expect(result.witnesses[0]!.connections).toEqual([]);
    expect(result.witnesses[1]!.connections.length).toBe(result.proof.normalizedConnections.length);
    expect(
      result.witnesses[1]!.connections.every(
        ({ target }) => target.kind === "witness" && target.witnessIndex === 0,
      ),
    ).toBe(true);
    expect(request.budget.targetAttempts.get(258)).toMatchObject({ attempts: 1, matches: 1 });
    expect(request.budget.targetAttempts.get(259)).toMatchObject({ attempts: 1, matches: 1 });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.proof.normalizedConnections)).toBe(true);
    expect(Object.isFrozen(result.proof.normalizedConnections[0])).toBe(true);
    expect(Object.isFrozen(result.proof.directions[0]!.counts)).toBe(true);
    expect(Object.isFrozen(result.witnesses[0]!.transform)).toBe(true);
    expect(Object.isFrozen(result.witnesses[0]!.transform.positionLdu)).toBe(true);
    expect(requireRealBuildPrefix50AtomicSubBuildRoot(result)).toBe(result);
    expect(Object.keys(result)).not.toContain("document");
    expect(Object.keys(result)).not.toContain("parentDraft");
  });

  it("uses two independent isolated one-part worlds with exact orientation narrowing", () => {
    const probes: BrickDocumentV1[] = [];
    const result = constructForTest((document, catalogPartId, options) => {
      probes.push(document);
      expect(options).toMatchObject({
        includeBuildPlate: false,
        allowDetached: false,
        orientationIds: ["proper-m-00nn000p0"],
      });
      return enumeratePlacements(document, catalogPartId, options);
    });

    expect(result.ordinals).toEqual([258, 259]);
    expect(probes).toHaveLength(2);
    expect(probes[0]).not.toBe(probes[1]);
    expect(probes.map(({ parts }) => parts.length)).toEqual([1, 1]);
    expect(probes.map(({ parts }) => parts[0]!.catalogPartId)).toEqual([
      "builtin:plate-1x2-round-end",
      "builtin:plate-1x12",
    ]);
  });

  it.each([
    [
      "one-LDU target",
      () => mutateRow(0, { targetTransform: { ...TARGETS[0], positionLdu: [-119, -86, 108] } }),
    ],
    ["wrong root", () => mutateRow(0, { ordinal: 257 })],
    ["wrong source order", () => [rows[1], rows[0]] as const],
    ["wrong child path", () => mutateRow(1, { subBuildPath: ["wrong-child"] })],
    ["wrong phase", () => mutateRow(1, { phaseSequence: 65 })],
  ])("rejects a %s row", (_label, mutate) => {
    expect(() =>
      constructRealBuildPrefix50AtomicSubBuildRoot(input({ rootRows: mutate() })),
    ).toThrow(/must be exact source ordinal/u);
  });

  it("rejects a third root body and any cloned or mutated structural window", () => {
    const threeRows = [
      ...rows,
      rows[0],
    ] as unknown as RealBuildPrefix50SubBuildRootInput["rootRows"];
    expect(() =>
      constructRealBuildPrefix50AtomicSubBuildRoot(input({ rootRows: threeRows })),
    ).toThrow(/exactly two source-order target rows/u);
    expect(() =>
      constructRealBuildPrefix50AtomicSubBuildRoot(
        input({ window: { ...projection.childSubBuildWindow! } }),
      ),
    ).toThrow(/exact branded 258\.\.280/u);
    expect(() =>
      constructRealBuildPrefix50AtomicSubBuildRoot(
        input({
          window: {
            ...projection.childSubBuildWindow!,
            returnPrintedStepNumber: 43,
          },
        }),
      ),
    ).toThrow(/exact branded 258\.\.280/u);
  });

  it("rejects a projection clone and a cloned or caller-forged result", () => {
    expect(() =>
      constructRealBuildPrefix50AtomicSubBuildRoot(input({ projection: { ...projection } })),
    ).toThrow(/exact projection value minted by the opaque verified-projection reader/u);
    const result = constructRealBuildPrefix50AtomicSubBuildRoot(input());
    expect(() => requireRealBuildPrefix50AtomicSubBuildRoot({ ...result })).toThrow(
      /caller clones and witness forgeries/u,
    );
    expect(() =>
      requireRealBuildPrefix50AtomicSubBuildRoot({ ...result, authority: "manual" }),
    ).toThrow(/caller clones and witness forgeries/u);
  });

  it("binds the parent draft only through the current exact truth snapshot", () => {
    const request = input();
    const parentDraft = {
      ...request.parentDraft,
      truth: {
        ...request.parentDraft.truth,
        catalog: { ...request.parentDraft.truth.catalog, version: "forged-catalog-version" },
      },
    } as BrickDocumentV1;
    expect(() => constructRealBuildPrefix50AtomicSubBuildRoot(input({ parentDraft }))).toThrow(
      /does not retain the current exact truth snapshot/u,
    );
  });

  it("rejects a complete exact candidate with no edge or an edge to a third body", () => {
    const noEdge = withEnumerationMutation((enumeration) => ({
      ...enumeration,
      candidates: enumeration.candidates.map((candidate) => ({
        ...candidate,
        connections: [],
      })),
    }));
    expect(() => constructForTest(noEdge)).toThrow(/no edge or a third body is forbidden/u);

    const thirdBody = withEnumerationMutation((enumeration) => ({
      ...enumeration,
      candidates: enumeration.candidates.map((candidate) => ({
        ...candidate,
        connections: candidate.connections.map((connection) => ({
          ...connection,
          targetPartId: "forged-third-body",
        })),
      })),
    }));
    expect(() => constructForTest(thirdBody)).toThrow(/no edge or a third body is forbidden/u);
  });

  it("rejects incomplete and silently truncated enumeration receipts", () => {
    const incomplete = withEnumerationMutation((enumeration) => ({
      ...enumeration,
      counts: { ...enumeration.counts, accepted: enumeration.counts.accepted + 1 },
    }));
    expect(() => constructForTest(incomplete)).toThrow(/incomplete or internally inconsistent/u);

    const truncated = withEnumerationMutation((enumeration) => ({
      ...enumeration,
      candidates: enumeration.candidates.slice(1),
    }));
    expect(() => constructForTest(truncated)).toThrow(/incomplete or internally inconsistent/u);
  });

  it("rejects nonidentical forward and reverse endpoint sets", () => {
    const reciprocalMismatch = withEnumerationMutation((enumeration, catalogPartId) =>
      catalogPartId !== "builtin:plate-1x2-round-end"
        ? enumeration
        : {
            ...enumeration,
            candidates: enumeration.candidates.map((candidate) => ({
              ...candidate,
              connections:
                candidate.connections.length === 0
                  ? candidate.connections
                  : [...candidate.connections, candidate.connections[0]!],
            })),
          },
    );
    expect(() => constructForTest(reciprocalMismatch)).toThrow(
      /identical nonempty reciprocal role\/port\/connection-kind endpoint sets/u,
    );
  });
});
