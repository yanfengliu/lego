import { beforeAll, describe, expect, it } from "vitest";

import {
  createEmptyBrickDocument,
  createPartInstance,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, ConnectionEdge, PartInstance } from "@lego-studio/protocol";

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
import {
  __testOnly,
  createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope,
  enumerateRealBuildPrefix50SubBuildReturn,
  REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS,
  RealBuildPrefix50SubBuildReturnError,
  requireRealBuildPrefix50SelectedSubBuildReturn,
  requireRealBuildPrefix50SubBuildReturnResult,
  selectRepositoryReviewedRealBuildPrefix50SubBuildReturn,
  type RealBuildPrefix50Step43ReturnPredecessorMintInput,
  type RealBuildPrefix50SubBuildReturnResult,
} from "../e2e/real-build-prefix50-subbuild-return";
import { REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE } from "../e2e/real-build-prefix50-subbuild-return-review-fixture";
import { hydrateRealBuildPrefix50Step44ReviewEnvelope } from "../e2e/real-build-prefix50-subbuild-return-review-batch-replay";
import { mintRealBuildPrefix50Step43ReturnPredecessor } from "../e2e/real-build-prefix50-subbuild-return-predecessor";
import {
  readRealBuildPrefix50VerifiedProjection,
  type RealBuildPrefix50VerifiedProjection,
} from "../e2e/real-build-prefix50-projection";
import { isolateRealBuildPrefix50DetachedSubBuild } from "../e2e/real-build-prefix50-subbuild-state";
import {
  enumerateRigidSubassemblyReturns,
  type RigidSubassemblyReturnEnumeration,
} from "../src/assembly/rigid-subassembly-return";
const digest = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;
const PRODUCTION_RESULT_REJECTION =
  /^Prefix-50 return requires the exact runtime-branded enumeration receipt; caller clones carry no selection authority\.$/u;
const REVIEW_RESULT_REJECTION = /^Prefix-50 review requires a runtime-branded return receipt\.$/u;

let projection: RealBuildPrefix50VerifiedProjection;
type SyntheticReturnRequest = Omit<
  RealBuildPrefix50Step43ReturnPredecessorMintInput,
  "step42_43SourceRepairProof"
>;

let request: SyntheticReturnRequest;
let ambiguous: RealBuildPrefix50SubBuildReturnResult;

function stackEdge(
  prefix: string,
  lower: PartInstance,
  upper: PartInstance,
  index: number,
): ConnectionEdge {
  return {
    id: `${prefix}-edge-${index.toString().padStart(3, "0")}`,
    kind: "stud-tube",
    a: { partId: lower.id, portId: "stud:0:0" },
    b: { partId: upper.id, portId: "undersideClutch:0:0" },
    provenance: { source: "manual" },
  };
}

function buildStep43Fixture(source: RealBuildPrefix50VerifiedProjection) {
  const base = createEmptyBrickDocument({
    id: "prefix50-return-fixture",
    name: "Prefix 50 return fixture",
    maxParts: 500,
  });
  const steps = Array.from({ length: 43 }, (_, index) => ({
    id: `step-${index + 1}`,
    index,
    name: `Printed step ${index + 1}`,
    partIds: [] as string[],
  }));
  const parents = Array.from({ length: 257 }, (_, index) =>
    createPartInstance({
      id: `parent-${(index + 1).toString().padStart(3, "0")}`,
      catalogPartId: "builtin:plate-1x1",
      transform: {
        positionLdu: [1_000, 8 - index * 8, 0],
        orientationId: "upright-yaw-0",
      },
      stepId: steps[0]!.id,
    }),
  );
  steps[0]!.partIds.push(...parents.map(({ id }) => id));
  const parentEdges = parents
    .slice(0, -1)
    .map((part, index) => stackEdge("parent", part, parents[index + 1]!, index));

  const childParts = source.occurrences.slice(257, 280).map((occurrence, index) =>
    createPartInstance({
      id: `child-${occurrence.ordinal}`,
      catalogPartId: "builtin:plate-1x1",
      colorId: occurrence.colorId,
      transform: {
        positionLdu: [100, 8 - index * 8, 0],
        orientationId: "upright-yaw-0",
      },
      stepId: steps[occurrence.printedStepNumber - 1]!.id,
      source: "ai",
      sourceId: `fixture-occurrence-${occurrence.ordinal}`,
    }),
  );
  const childEdges = childParts
    .slice(0, -1)
    .map((part, index) => stackEdge("child", part, childParts[index + 1]!, index));
  const rows = source.occurrences.slice(257, 280).map((occurrence, index) => {
    const part = childParts[index]!;
    steps[occurrence.printedStepNumber - 1]!.partIds.push(part.id);
    return { ordinal: occurrence.ordinal, partId: part.id };
  });
  const parts = [...parents, ...childParts];
  const document: BrickDocumentV1 = {
    ...base,
    parts,
    connections: [...parentEdges, ...childEdges],
    submodels: [{ id: "root", name: "Root", partIds: parts.map(({ id }) => id) }],
    steps,
  };
  const detached = isolateRealBuildPrefix50DetachedSubBuild({
    document,
    childPartIds: rows.map(({ partId }) => partId),
    completedPrintedStep: 43,
  });
  return {
    document,
    rows,
    detached,
    combinedDraft: {
      schemaVersion: "lego.real-build-prefix50-step43-combined-draft/1" as const,
      authority: "none" as const,
      sourceSetId: "6651557" as const,
      completedPrintedStep: 43 as const,
      documentHash: documentStructuralHash(document),
      document,
    },
  };
}

function errorFrom(run: () => unknown): RealBuildPrefix50SubBuildReturnError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(RealBuildPrefix50SubBuildReturnError);
    return error as RealBuildPrefix50SubBuildReturnError;
  }
  throw new Error("Expected prefix-50 return construction to fail closed.");
}

function withAccepted(
  source: RigidSubassemblyReturnEnumeration,
  accepted: number,
): RigidSubassemblyReturnEnumeration {
  const removed = source.candidates.length - accepted;
  return {
    ...source,
    candidates: source.candidates.slice(0, accepted),
    counts: {
      ...source.counts,
      accepted,
      rejectedNoCrossEdge: source.counts.rejectedNoCrossEdge + removed,
    },
  };
}

beforeAll(async () => {
  const reproduced = await reproduceCurrentPrefix50OfficialWorldReconciliation();
  const reconciliation = await verifyPrefix50OfficialWorldReconciliation({
    ...reproduced.input,
    artifactBytes: reproduced.bytes,
  });
  const structural = await verifyCurrentPrefix50StructuralEvents();
  projection = readRealBuildPrefix50VerifiedProjection(
    createRealBuildPrefix50VerifiedProjectionReader({
      actionPreparation: {
        bytes: bytesFromVerifiedPrefix50ActionPreparation(reproduced.input.actionPreparation),
        verified: reproduced.input.actionPreparation,
      },
      officialWorldReconciliation: {
        bytes: bytesFromVerifiedPrefix50OfficialWorldReconciliation(reconciliation),
        verified: reconciliation,
      },
      structuralEvents: { bytes: structural.bytes, verified: structural.verified },
    }),
  );
  const fixture = buildStep43Fixture(projection);
  expect(
    validateBrickDocument(fixture.document)
      .issues.filter(({ severity }) => severity === "blocking")
      .map(({ code }) => code),
  ).toEqual(["DISCONNECTED_ASSEMBLY"]);
  request = {
    projection,
    window: projection.childSubBuildWindow!,
    combinedDraft: fixture.combinedDraft,
    ordinalPartRows: fixture.rows,
    detachedStateCommitment: fixture.detached.commitment,
  };
  const construct = __testOnly.constructSyntheticWithEnumerator;
  if (construct === undefined) throw new Error("Synthetic test constructor is unavailable.");
  const error = errorFrom(() => construct(request, enumerateRigidSubassemblyReturns));
  expect(error.code).toBe("AMBIGUOUS_RETURN_REQUIRES_VISUAL_BINDING");
  ambiguous = error.result;
}, 240_000);

describe("prefix-50 exact detached SubBuild return", () => {
  it("retains the complete ambiguous roster without selecting a pose", () => {
    expect(ambiguous).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-subbuild-return/1",
      authority: "none",
      sourceSetId: "6651557",
      completedPrintedStep: 43,
      returnPrintedStepNumber: 44,
      parentPartCount: 257,
      childPartCount: 23,
      workLimits: REAL_BUILD_PREFIX50_SUBBUILD_RETURN_WORK_LIMITS,
    });
    expect(ambiguous.candidateRoster).toHaveLength(4);
    expect(ambiguous.candidateRoster).toHaveLength(ambiguous.enumeration.counts.accepted);
    expect(ambiguous.enumeration.counts).toMatchObject({
      existingInternalEdges: 278,
      freeParentConnectors: 2,
      freeChildConnectors: 2,
      connectorPairingChecks: 96,
      distinctGroupDeltas: 8,
      groupDeltasVisited: 8,
      rejectedBelowGround: 4,
      candidateValidationRuns: 4,
      accepted: 4,
    });
    expect(
      ambiguous.candidateRoster.every(
        ({ candidateKey, crossPorts }) =>
          /^[0-9a-f]{64}$/u.test(candidateKey) && crossPorts.length > 0,
      ),
    ).toBe(true);
    expect(Object.isFrozen(ambiguous)).toBe(true);
    expect(() => requireRealBuildPrefix50SubBuildReturnResult(ambiguous)).toThrow(
      PRODUCTION_RESULT_REJECTION,
    );
    expect(() => requireRealBuildPrefix50SubBuildReturnResult({ ...ambiguous })).toThrow(
      PRODUCTION_RESULT_REJECTION,
    );
  });

  it("returns a synthetic review receipt only when complete accounting has one candidate", () => {
    const construct = __testOnly.constructSyntheticWithEnumerator;
    if (construct === undefined) throw new Error("Test constructor is unavailable.");
    const unique = construct(request, () => withAccepted(ambiguous.enumeration, 1));

    expect(unique.candidateRoster).toHaveLength(1);
    expect(unique.enumeration.counts.accepted).toBe(1);
    expect(() => requireRealBuildPrefix50SubBuildReturnResult(unique)).toThrow(
      PRODUCTION_RESULT_REJECTION,
    );
  });

  it("requires the exact opaque Step-43 predecessor and rejects proof and identity forgeries", () => {
    const mintSynthetic = __testOnly.mintSyntheticPredecessorForTest;
    const construct = __testOnly.constructWithEnumerator;
    if (mintSynthetic === undefined || construct === undefined)
      throw new Error("Step-43 predecessor test hooks are unavailable.");
    const predecessor = mintSynthetic(request);
    const unique = construct({ predecessor }, () => withAccepted(ambiguous.enumeration, 1));
    expect(() => requireRealBuildPrefix50SubBuildReturnResult(unique)).toThrow(
      PRODUCTION_RESULT_REJECTION,
    );
    expect(() =>
      enumerateRealBuildPrefix50SubBuildReturn({ predecessor: { ...predecessor } }),
    ).toThrow(/runtime-branded Step-43 predecessor/u);
    expect(() =>
      mintRealBuildPrefix50Step43ReturnPredecessor({
        ...request,
        step42_43SourceRepairProof: {} as never,
      }),
    ).toThrow(/opaque proof/u);
  });

  it("throws NO_HARD_VALID_RETURN with a complete empty roster", () => {
    const construct = __testOnly.constructSyntheticWithEnumerator;
    if (construct === undefined) throw new Error("Test constructor is unavailable.");
    const error = errorFrom(() => construct(request, () => withAccepted(ambiguous.enumeration, 0)));

    expect(error.code).toBe("NO_HARD_VALID_RETURN");
    expect(error.result.candidateRoster).toEqual([]);
    expect(error.result.enumeration.counts.accepted).toBe(0);
  });

  it("keeps production selection closed to synthetic returns before page-45 review", () => {
    const construct = __testOnly.constructSyntheticWithEnumerator;
    if (construct === undefined) throw new Error("Test constructor is unavailable.");
    const unique = construct(request, () => withAccepted(ambiguous.enumeration, 1));

    expect(REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-step44-return-review-fixture/1",
      reviewStatus: "unreviewed",
      authority: "none",
      sourceSetId: "6651557",
      source: {
        logicalPath: "recipes/6651557.pdf",
        digest: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
        pageNumber: 45,
        structuralEventSequence: 8,
        structuralEventDigest:
          "sha256:4a4a56a9a4a802601d2fff37d8cc788cfd479e5573bf68d9013bf2aecca9f9ad",
        precedingPhaseSequence: 71,
        followingPhaseSequence: 72,
        firstChildOccurrenceOrdinal: 258,
        lastChildOccurrenceOrdinal: 280,
      },
    });
    expect(Object.isFrozen(REAL_BUILD_PREFIX50_STEP44_RETURN_REVIEW_FIXTURE)).toBe(true);
    expect(__testOnly).toHaveProperty("selectWithReviewedFixtureForTest");
    expect(() => selectRepositoryReviewedRealBuildPrefix50SubBuildReturn(unique)).toThrow(
      PRODUCTION_RESULT_REJECTION,
    );
    expect(() => selectRepositoryReviewedRealBuildPrefix50SubBuildReturn(ambiguous)).toThrow(
      PRODUCTION_RESULT_REJECTION,
    );
  });

  it("builds an all-candidate review batch without granting caller selection authority", () => {
    const batch = createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope(ambiguous);
    const expectedKeys = ambiguous.candidateRoster
      .map(({ candidateKey }) => candidateKey)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    expect(batch).toMatchObject({
      schemaVersion: "lego.real-build-prefix50-subbuild-return-review-batch-input/2",
      authority: "none",
      sourceSetId: "6651557",
      returnResultCommitment: ambiguous.commitment,
      candidateRosterCommitment: ambiguous.candidateRosterCommitment,
      ordering: "candidate-key-lexicographic",
      candidateCount: 4,
    });
    expect(batch.candidates.map(({ candidateKey }) => candidateKey)).toEqual(expectedKeys);
    expect(
      batch.candidates.every((row) => {
        const candidate = ambiguous.enumeration.candidates.find(
          ({ candidateKey }) => candidateKey === row.candidateKey,
        );
        const envelope = hydrateRealBuildPrefix50Step44ReviewEnvelope(batch, row);
        return (
          candidate !== undefined &&
          envelope.selectedDocumentCommitment ===
            batch.rosterSummary.candidates[row.rosterIndex]!.selectedDocumentCommitment &&
          documentStructuralHash(envelope.selectedDocument) ===
            documentStructuralHash(candidate.hardValidDocument) &&
          envelope.returnResultCommitment === ambiguous.commitment
        );
      }),
    ).toBe(true);
    expect(() =>
      createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope({ ...ambiguous }),
    ).toThrow(REVIEW_RESULT_REJECTION);
    const createBatchWithKey =
      createRealBuildPrefix50SubBuildReturnReviewBatchEnvelope as unknown as (
        result: unknown,
        candidateKey: string,
      ) => unknown;
    expect(() => createBatchWithKey(ambiguous, expectedKeys[0]!)).toThrow(
      /accepts only one runtime-branded/u,
    );
  });

  it("rejects caller-minted visual evidence, receipt clones, and mutated returned documents", () => {
    const construct = __testOnly.constructSyntheticWithEnumerator;
    if (construct === undefined) throw new Error("Test constructor is unavailable.");
    const unique = construct(request, () => withAccepted(ambiguous.enumeration, 1));
    const rawBinding = {
      sourcePdfDigest: digest("1"),
      panelPageNumber: 45,
      panelCropDigest: digest("2"),
      renderCommitments: {
        canonicalIsometric: digest("3"),
        frontOrthographic: digest("4"),
        sideOrthographic: digest("5"),
      },
    };
    const callWithEvidence = selectRepositoryReviewedRealBuildPrefix50SubBuildReturn as unknown as (
      result: unknown,
      binding: unknown,
    ) => unknown;
    expect(() => callWithEvidence(unique, rawBinding)).toThrow(/does not accept caller-provided/u);
    expect(() => selectRepositoryReviewedRealBuildPrefix50SubBuildReturn({ ...unique })).toThrow(
      /caller clones/u,
    );

    const changedDocument = {
      ...structuredClone(unique.enumeration.candidates[0]!.hardValidDocument),
      name: "mutated returned document",
    };
    const changedCandidate = {
      ...unique.enumeration.candidates[0]!,
      hardValidDocument: changedDocument,
    };
    const changedResult = {
      ...unique,
      enumeration: { ...unique.enumeration, candidates: [changedCandidate] },
    };
    expect(() => selectRepositoryReviewedRealBuildPrefix50SubBuildReturn(changedResult)).toThrow(
      /caller clones/u,
    );
    expect(() =>
      requireRealBuildPrefix50SelectedSubBuildReturn({
        schemaVersion: "lego.real-build-prefix50-selected-subbuild-return/1",
        authority: "none",
        selectedDocument: changedDocument,
      }),
    ).toThrow(/runtime-branded/u);
  });

  it("rejects projection, window, row, draft-hash, and detached-receipt mutations", () => {
    const construct = __testOnly.constructSyntheticWithEnumerator;
    if (construct === undefined) throw new Error("Test constructor is unavailable.");
    const enumerate = () => ambiguous.enumeration;
    expect(() =>
      enumerateRealBuildPrefix50SubBuildReturn(
        request as unknown as Parameters<typeof enumerateRealBuildPrefix50SubBuildReturn>[0],
      ),
    ).toThrow(/exactly predecessor/u);
    expect(() => construct({ ...request, projection: { ...projection } }, enumerate)).toThrow(
      /exact projection value/u,
    );
    expect(() => construct({ ...request, window: { ...request.window } }, enumerate)).toThrow(
      /exact branded/u,
    );
    expect(() =>
      construct(
        {
          ...request,
          ordinalPartRows: [request.ordinalPartRows[1]!, ...request.ordinalPartRows.slice(1)],
        },
        enumerate,
      ),
    ).toThrow(/exact occurrence 258/u);
    expect(() =>
      construct(
        {
          ...request,
          combinedDraft: { ...request.combinedDraft, documentHash: digest("9") },
        },
        enumerate,
      ),
    ).toThrow(/280-part\/43-step/u);
    expect(() =>
      construct({ ...request, detachedStateCommitment: digest("8") }, enumerate),
    ).toThrow(/detached-state commitment/u);
  });
});
