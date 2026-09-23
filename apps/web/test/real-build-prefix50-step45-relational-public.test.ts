import { getPartDefinition } from "@lego-studio/catalog";
import { canonicalDigest, deepFreeze, documentStructuralHash } from "@lego-studio/brick-kernel";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  RealBuildPrefix50SearchBudget,
  RealBuildPrefix50Step44SelectionEvidence,
  RealBuildPrefix50TargetOccurrence,
} from "../e2e/real-build-prefix50-exact-compiler-contract";
import type { RealBuildPrefix50SelectedSubBuildReturn } from "../e2e/real-build-prefix50-subbuild-return-contract";
import { compileRealBuildPrefix50ZeroPieceStepCandidate } from "../e2e/real-build-automatic-placement-candidate";
import { snapshot } from "../e2e/real-build-prefix50-exact-compiler-operations";

const authority = vi.hoisted(() => ({
  evidence: new WeakSet<object>(),
  resolverCalls: 0,
  selections: new WeakSet<object>(),
}));

vi.mock("../e2e/real-build-prefix50-subbuild-return-runtime", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../e2e/real-build-prefix50-subbuild-return-runtime")>();
  return {
    ...actual,
    requireRealBuildPrefix50SelectedSubBuildReturn(value: unknown) {
      if (value === null || typeof value !== "object" || !authority.selections.has(value)) {
        throw new TypeError("test runtime-branded selected receipt required");
      }
      return value;
    },
  };
});

vi.mock("../e2e/real-build-prefix50-exact-loop-step44", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../e2e/real-build-prefix50-exact-loop-step44")>();
  return {
    ...actual,
    requireRealBuildPrefix50Step44SelectionEvidence(value: unknown) {
      if (value === null || typeof value !== "object" || !authority.evidence.has(value)) {
        throw new TypeError("test runtime-branded Step-44 evidence required");
      }
      return value;
    },
  };
});

vi.mock("../e2e/real-build-prefix50-step45-relational-resolver", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../e2e/real-build-prefix50-step45-relational-resolver")>();
  return {
    ...actual,
    resolveRealBuildPrefix50Step45RelationalPlacements(
      ...args: Parameters<typeof actual.resolveRealBuildPrefix50Step45RelationalPlacements>
    ) {
      authority.resolverCalls += 1;
      return actual.resolveRealBuildPrefix50Step45RelationalPlacements(...args);
    },
  };
});

import { compileRealBuildPrefix50Step45RelationalTransition } from "../e2e/real-build-prefix50-step45-relational-compilation";
import { resolveRealBuildPrefix50Step45RelationalPlacements } from "../e2e/real-build-prefix50-step45-relational-resolver";
import {
  step45RelationalSelectedStep43Document,
  step45RelationalTestInput,
} from "./real-build-prefix50-step45-relational-test-support";

const digest = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;

type PublicInput = Parameters<typeof compileRealBuildPrefix50Step45RelationalTransition>[0];

let baseInput: Omit<PublicInput, "budget">;
let selection: RealBuildPrefix50SelectedSubBuildReturn;
let evidence: RealBuildPrefix50Step44SelectionEvidence;

function budget(): RealBuildPrefix50SearchBudget {
  return {
    nodes: 20,
    enumerations: 30,
    orientationNarrowedEnumerations: 10,
    targetAttempts: new Map(),
  };
}

function brandSelection<T extends object>(value: T): T {
  authority.selections.add(value);
  return value;
}

function brandEvidence<T extends object>(value: T): T {
  authority.evidence.add(value);
  return value;
}

describe("prefix-50 public Step-45 relational bridge", () => {
  beforeAll(() => {
    const relational = step45RelationalTestInput();
    const selectedDocument = step45RelationalSelectedStep43Document();
    const selectedDocumentHash = documentStructuralHash(selectedDocument);
    const selectedDocumentCommitment = canonicalDigest(selectedDocument);
    const step44PrintedStep = deepFreeze({
      printedStepNumber: 44,
      name: "Printed step 44",
      sourceActionDigest: digest("4"),
    });
    const reviewedVisualBinding = deepFreeze({
      returnResultCommitment: digest("1"),
      candidateRosterCommitment: digest("2"),
      candidateKey: "a".repeat(64),
      selectedDocumentHash,
      selectedDocumentCommitment,
      commitment: relational.selectedStep44EvidenceCommitment,
    });
    selection = brandSelection(
      deepFreeze({
        schemaVersion: "lego.real-build-prefix50-selected-subbuild-return/1",
        authority: "none",
        sourceSetId: "6651557",
        returnResultCommitment: digest("1"),
        reviewedVisualBinding,
        candidateKey: "a".repeat(64),
        groupDelta: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        crossPorts: [],
        selectedDocumentHash,
        selectedDocument,
        commitment: digest("3"),
      }) as unknown as RealBuildPrefix50SelectedSubBuildReturn,
    );
    const evidenceBody = deepFreeze({
      schemaVersion: "lego.real-build-prefix50-step44-selection-evidence/2" as const,
      authority: "none" as const,
      printedStepNumber: 44 as const,
      step44PrintedStep,
      step44PrintedStepCommitment: canonicalDigest(step44PrintedStep),
      returnResultCommitment: digest("1"),
      candidateRosterCommitment: digest("2"),
      selectedSubBuildReturnCommitment: digest("3"),
      reviewedVisualBindingCommitment: relational.selectedStep44EvidenceCommitment,
      candidateKey: "a".repeat(64),
      selectedDocumentHash,
      selectedDocumentCommitment,
    });
    evidence = brandEvidence(
      deepFreeze({ ...evidenceBody, commitment: canonicalDigest(evidenceBody) }),
    );
    const resolution = resolveRealBuildPrefix50Step45RelationalPlacements(relational);
    const repairByOrdinal = new Map(
      relational.sourceRepairs.map((repair) => [repair.occurrenceOrdinal, repair] as const),
    );
    const colorId = getPartDefinition("builtin:axle-1x3")!.availableColorIds[0]!;
    const targets: readonly RealBuildPrefix50TargetOccurrence[] = resolution.rows.map((row) => ({
      ordinal: row.occurrenceOrdinal,
      printedStepNumber: 45,
      phaseSequence: row.occurrenceOrdinal,
      phaseMemberOrdinal: 1,
      subBuildPath: ["step45-relational-public-test"],
      colorId,
      partIdentity: {
        publishedCatalogPartId: "builtin:axle-1x3",
        reconciledCatalogPartId: "builtin:axle-1x3",
        officialDesignId: "4519",
        officialDesignRevision: "4519;E",
        sourceLDrawPartId: "4519",
        catalogLDrawPartId: "4519",
        identityProofId: null,
        basis: "published-exact",
      },
      sourceWorldTransform: repairByOrdinal.get(row.occurrenceOrdinal)!.sourceWorldTransform,
      targetTransform: row.enumeratedTransform,
    }));
    baseInput = {
      document: relational.selectedStep44Document,
      printedStep: {
        printedStepNumber: 45,
        name: "Printed step 45",
        sourceActionDigest: digest("5"),
      },
      targets,
      ordinalPartRows: relational.ordinalPartRows,
      sourceRepairs: relational.sourceRepairs,
      selectedReturn: selection,
      selectionEvidence: evidence,
      genericSearchCallCount: 0,
    };
  });

  beforeEach(() => {
    authority.resolverCalls = 0;
  });

  it("accepts the exact branded selection and invokes the relational resolver exactly once", () => {
    const workBudget = budget();
    const transition = compileRealBuildPrefix50Step45RelationalTransition({
      ...baseInput,
      budget: workBudget,
    });
    expect(authority.resolverCalls).toBe(1);
    expect(transition.evidence.accounting).toEqual({
      relationalResolverCallCount: 1,
      genericSearchCallCount: 0,
      enumerationDelta: 1,
      orientationNarrowedEnumerationDelta: 0,
      searchNodeDelta: transition.evidence.resolution.rows.length,
    });
    expect(
      transition.evidence.receiverPairs.map(({ occurrenceOrdinal, receiverOrdinal }) => [
        occurrenceOrdinal,
        receiverOrdinal,
      ]),
    ).toEqual([
      [281, 265],
      [282, 261],
      [283, 264],
    ]);
  });

  it("rejects raw, extra-key, and branded-but-cross-inconsistent public inputs", () => {
    expect(() =>
      compileRealBuildPrefix50Step45RelationalTransition({
        ...baseInput,
        selectedReturn: structuredClone(selection),
        budget: budget(),
      }),
    ).toThrow(/runtime-branded selected receipt/u);
    expect(() =>
      compileRealBuildPrefix50Step45RelationalTransition({
        ...baseInput,
        budget: budget(),
        step44PrintedStep: evidence.step44PrintedStep,
      } as unknown as PublicInput),
    ).toThrow(/must contain exactly/u);

    const drifts: Partial<RealBuildPrefix50Step44SelectionEvidence>[] = [
      { schemaVersion: "wrong" as RealBuildPrefix50Step44SelectionEvidence["schemaVersion"] },
      { authority: "wrong" as RealBuildPrefix50Step44SelectionEvidence["authority"] },
      { printedStepNumber: 45 as RealBuildPrefix50Step44SelectionEvidence["printedStepNumber"] },
      { returnResultCommitment: digest("6") },
      { candidateRosterCommitment: digest("6") },
      { candidateKey: "b".repeat(64) },
      { selectedDocumentHash: digest("6") },
      { selectedDocumentCommitment: digest("6") },
      { reviewedVisualBindingCommitment: digest("6") },
      { selectedSubBuildReturnCommitment: digest("6") },
      { step44PrintedStepCommitment: digest("6") },
      {
        step44PrintedStep: {
          ...evidence.step44PrintedStep,
          name: "Caller-authored Step 44",
        },
      },
    ];
    for (const drift of drifts) {
      const body = { ...evidence, ...drift };
      const { commitment: oldCommitment, ...commitmentBody } = body;
      void oldCommitment;
      const drifted = brandEvidence(
        deepFreeze({ ...commitmentBody, commitment: canonicalDigest(commitmentBody) }),
      ) as RealBuildPrefix50Step44SelectionEvidence;
      expect(() =>
        compileRealBuildPrefix50Step45RelationalTransition({
          ...baseInput,
          selectionEvidence: drifted,
          budget: budget(),
        }),
      ).toThrow(/every Step-44 evidence field to cross-bind/u);
      expect(authority.resolverCalls).toBe(0);
    }
  });

  it("cannot represent a caller-paired Step-44 metadata and zero-step document rewrite", () => {
    const hostileMetadata = deepFreeze({
      ...evidence.step44PrintedStep,
      name: "Caller-paired Step 44",
    });
    const hostileDocument = compileRealBuildPrefix50ZeroPieceStepCandidate({
      documentSnapshot: snapshot(selection.selectedDocument),
      printedStepNumber: 44,
      printedStep: hostileMetadata,
    }).document;
    const { commitment: oldCommitment, ...evidenceBody } = evidence;
    void oldCommitment;
    const hostileEvidenceBody = deepFreeze({
      ...evidenceBody,
      step44PrintedStep: hostileMetadata,
      step44PrintedStepCommitment: canonicalDigest(hostileMetadata),
    });
    const hostileEvidence = deepFreeze({
      ...hostileEvidenceBody,
      commitment: canonicalDigest(hostileEvidenceBody),
    });
    expect(() =>
      compileRealBuildPrefix50Step45RelationalTransition({
        ...baseInput,
        document: hostileDocument,
        selectionEvidence: hostileEvidence,
        budget: budget(),
      }),
    ).toThrow(/runtime-branded Step-44 evidence required/u);
    expect(authority.resolverCalls).toBe(0);
  });

  it("conserves the budget when the single public resolver call fails", () => {
    const workBudget = budget();
    const invalidRows = baseInput.ordinalPartRows.map((row) =>
      row.ordinal === 261 ? { ...row, partId: baseInput.ordinalPartRows[263]!.partId } : row,
    );
    expect(() =>
      compileRealBuildPrefix50Step45RelationalTransition({
        ...baseInput,
        ordinalPartRows: invalidRows,
        budget: workBudget,
      }),
    ).toThrow(/ordinal part row 264 must map exactly once/u);
    expect(authority.resolverCalls).toBe(1);
    expect(workBudget).toEqual(budget());
  });
});
