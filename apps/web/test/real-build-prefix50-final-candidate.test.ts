import { describe, expect, it } from "vitest";

import {
  canonicalBrickDocument,
  canonicalDigest,
  createEmptyBrickDocument,
  createPartInstance,
  documentStructuralHash,
  normalizeBrickDocument,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import {
  compileRealBuildPrefix50FinalCandidate,
  isRealBuildPrefix50FinalCandidateResult,
  REAL_BUILD_PREFIX50_FINAL_CANDIDATE_MANIFEST,
} from "../e2e/real-build-prefix50-final-candidate";

const PART_COUNT = 320;

function digest(value: unknown): `sha256:${string}` {
  return canonicalDigest(value);
}

function snapshot(document: BrickDocumentV1) {
  return createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(document),
    expectedDocumentHash: documentStructuralHash(document),
  });
}

function hardValidSyntheticTower(): {
  readonly base: BrickDocumentV1;
  readonly final: BrickDocumentV1;
} {
  const base = normalizeBrickDocument(
    createEmptyBrickDocument({ id: "untrusted-prefix50", name: "Untrusted prefix 50" }),
  );
  const activeStepIndexes = Array.from({ length: 50 }, (_, index) => index).filter(
    (index) => index !== 43,
  );
  const steps = Array.from({ length: 50 }, (_, index) => ({
    id: `untrusted-step-${String(index + 1).padStart(2, "0")}`,
    index,
    name: `Printed step ${index + 1}`,
    partIds: [] as string[],
  }));
  const parts = Array.from({ length: PART_COUNT }, (_, index) => {
    const stepIndex =
      activeStepIndexes[Math.floor((index * activeStepIndexes.length) / PART_COUNT)]!;
    const part = createPartInstance({
      id: `untrusted-part-${String(index + 1).padStart(3, "0")}`,
      catalogPartId: "builtin:brick-1x1",
      colorId: index % 2 === 0 ? "builtin:red" : "builtin:blue",
      transform: { positionLdu: [0, -24 * index, 0], orientationId: "upright-yaw-0" },
      stepId: steps[stepIndex]!.id,
      source: "ai",
      sourceId: `untrusted-step-${stepIndex + 1}`,
    });
    steps[stepIndex]!.partIds.push(part.id);
    return part;
  });
  const final = normalizeBrickDocument({
    ...base,
    revision: "untrusted-prefix50-final",
    parts,
    connections: Array.from({ length: PART_COUNT - 1 }, (_, index) => ({
      id: `untrusted-edge-${String(index + 1).padStart(3, "0")}`,
      kind: "stud-tube" as const,
      a: { partId: parts[index]!.id, portId: "stud:0:0" },
      b: { partId: parts[index + 1]!.id, portId: "undersideClutch:0:0" },
      provenance: { source: "ai" as const, sourceId: `untrusted-edge-${index + 1}` },
    })),
    submodels: [{ ...base.submodels[0]!, partIds: parts.map(({ id }) => id) }],
    steps,
  });
  return { base, final };
}

function rawExactCompilationLookalike(final: BrickDocumentV1) {
  const selectedSubBuildReturn = {
    schemaVersion: "lego.real-build-prefix50-selected-subbuild-return/1",
    authority: "none",
    sourceSetId: "6651557",
    returnResultCommitment: digest({ return: "result" }),
    reviewedVisualBinding: { commitment: digest({ review: "binding" }) },
    candidateKey: "0".repeat(64),
    groupDelta: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
    crossPorts: [],
    selectedDocumentHash: documentStructuralHash(final),
    selectedDocument: final,
    commitment: digest({ selected: "return" }),
  };
  return {
    schemaVersion: "lego.real-build-prefix50-exact-compilation/5",
    projectionCommitment: digest({ projection: "lookalike" }),
    placementOrdinals: Array.from({ length: PART_COUNT }, (_, index) => index + 1),
    stateCommitments: Array.from({ length: 51 }, (_, completedPrintedStep) => ({
      completedPrintedStep,
      partCount: completedPrintedStep === 50 ? PART_COUNT : 0,
      documentHash:
        completedPrintedStep === 50
          ? documentStructuralHash(final)
          : digest({ completedPrintedStep }),
      canonicalDocumentDigest:
        completedPrintedStep === 50
          ? canonicalDigest(final)
          : digest({ completedPrintedStep, canonical: true }),
    })),
    candidateStepCommitments: Array.from({ length: 50 }, (_, index) => ({
      printedStepNumber: index + 1,
      commitment: digest({ step: index + 1 }),
    })),
    selectedSubBuildReturn,
    document: final,
  };
}

describe("authenticated prefix-50 final candidate boundary", () => {
  it("rejects the former raw-digest API before any patch can be minted", () => {
    const { base, final } = hardValidSyntheticTower();
    expect(() =>
      compileRealBuildPrefix50FinalCandidate({
        emptyRootSnapshot: snapshot(base),
        finalDocument: final,
        finalStepMetadata: [],
        placementOrdinals: Array.from({ length: PART_COUNT }, (_, index) => index + 1),
        projectionCommitment: digest({ projection: "raw" }),
        stateCommitments: [],
        subbuildReturnCommitment: digest({ return: "raw" }),
        subbuildReturnReceiptCommitment: digest({ receipt: "raw" }),
      }),
    ).toThrow(/must contain exactly emptyRootSnapshot, exactCompilation, selectedSubBuildReturn/u);
  });

  it("rejects an unrelated hard-valid 320-part tower wrapped as an exact-compilation lookalike", () => {
    const { base, final } = hardValidSyntheticTower();
    expect(validateBrickDocument(final)).toMatchObject({ documentGloballyValid: true });
    const exactCompilation = rawExactCompilationLookalike(final);
    expect(() =>
      compileRealBuildPrefix50FinalCandidate({
        emptyRootSnapshot: snapshot(base),
        exactCompilation,
        selectedSubBuildReturn: exactCompilation.selectedSubBuildReturn,
      }),
    ).toThrow(/exact runtime-branded real-evidence compilation/u);
  });

  it("states that scope is only a bounded replay envelope with no acceptance authority", () => {
    expect(REAL_BUILD_PREFIX50_FINAL_CANDIDATE_MANIFEST).toMatchObject({
      scopePolicy: "bounded-replay-envelope-not-operation-authority/1",
      exactnessPolicy: "runtime-branded-exact-compilation-plus-digest-bound-patch-receipt/1",
      userAcceptanceAuthority: false,
    });
  });

  it("does not let WeakSet prototype tampering manufacture a final-candidate brand", () => {
    const descriptor = Object.getOwnPropertyDescriptor(WeakSet.prototype, "has")!;
    try {
      Object.defineProperty(WeakSet.prototype, "has", {
        ...descriptor,
        value: () => true,
      });
      expect(isRealBuildPrefix50FinalCandidateResult({ kind: "forged" })).toBe(false);
    } finally {
      Object.defineProperty(WeakSet.prototype, "has", descriptor);
    }
  });
});
