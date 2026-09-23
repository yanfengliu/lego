import { getPartDefinition } from "@lego-studio/catalog";
import {
  canonicalDigest,
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import { beforeAll, describe, expect, it } from "vitest";

import type {
  RealBuildPrefix50SearchBudget,
  RealBuildPrefix50Step44SelectionEvidence,
  RealBuildPrefix50TargetOccurrence,
} from "../e2e/real-build-prefix50-exact-compiler-contract";
import { __testOnly as compilationTestOnly } from "../e2e/real-build-prefix50-step45-relational-compilation";
import { resolveRealBuildPrefix50Step45RelationalPlacements } from "../e2e/real-build-prefix50-step45-relational-resolver";
import { requireRealBuildPrefix50Step44SelectionEvidence } from "../e2e/real-build-prefix50-exact-loop-step44";
import { step45RelationalTestInput } from "./real-build-prefix50-step45-relational-test-support";
import { step45RelationalSelectedStep43Document } from "./real-build-prefix50-step45-relational-test-support";

const digest = (digit: string): `sha256:${string}` => `sha256:${digit.repeat(64)}`;

type CoreInput = Parameters<
  NonNullable<(typeof compilationTestOnly)["compileResolvedTransition"]>
>[0];

let coreInput: Omit<CoreInput, "budget">;

function budget(): RealBuildPrefix50SearchBudget {
  return {
    nodes: 20,
    enumerations: 30,
    orientationNarrowedEnumerations: 10,
    targetAttempts: new Map(),
  };
}

describe("prefix-50 Step-45 relational compiler bridge", () => {
  beforeAll(() => {
    const input = step45RelationalTestInput();
    const resolution = resolveRealBuildPrefix50Step45RelationalPlacements(input);
    const selectedDocument = step45RelationalSelectedStep43Document();
    const step44PrintedStep = deepFreeze({
      printedStepNumber: 44,
      name: "Printed step 44",
      sourceActionDigest: digest("4"),
    });
    const selectionEvidenceBody = deepFreeze({
      schemaVersion: "lego.real-build-prefix50-step44-selection-evidence/2" as const,
      authority: "none" as const,
      printedStepNumber: 44 as const,
      step44PrintedStep,
      step44PrintedStepCommitment: canonicalDigest(step44PrintedStep),
      returnResultCommitment: digest("1"),
      candidateRosterCommitment: digest("2"),
      selectedSubBuildReturnCommitment: digest("3"),
      reviewedVisualBindingCommitment: input.selectedStep44EvidenceCommitment,
      candidateKey: "a".repeat(64),
      selectedDocumentHash: documentStructuralHash(selectedDocument),
      selectedDocumentCommitment: canonicalDigest(selectedDocument),
    });
    const selectionEvidence: RealBuildPrefix50Step44SelectionEvidence = deepFreeze({
      ...selectionEvidenceBody,
      commitment: canonicalDigest(selectionEvidenceBody),
    });
    const colorId = getPartDefinition("builtin:axle-1x3")!.availableColorIds[0]!;
    const repairByOrdinal = new Map(
      input.sourceRepairs.map((repair) => [repair.occurrenceOrdinal, repair] as const),
    );
    const targets: readonly RealBuildPrefix50TargetOccurrence[] = resolution.rows.map((row) => {
      const repair = repairByOrdinal.get(row.occurrenceOrdinal)!;
      return deepFreeze({
        ordinal: row.occurrenceOrdinal,
        printedStepNumber: 45,
        phaseSequence: row.occurrenceOrdinal,
        phaseMemberOrdinal: 1,
        subBuildPath: ["step45-relational-test"],
        colorId,
        partIdentity: {
          publishedCatalogPartId: "builtin:axle-1x3",
          reconciledCatalogPartId: "builtin:axle-1x3",
          officialDesignId: "4519",
          officialDesignRevision: "4519;E",
          sourceLDrawPartId: "4519",
          catalogLDrawPartId: "4519",
          identityProofId: null,
          basis: "published-exact" as const,
        },
        sourceWorldTransform: repair.sourceWorldTransform,
        targetTransform: row.enumeratedTransform,
      });
    });
    coreInput = {
      document: input.selectedStep44Document,
      printedStep: {
        printedStepNumber: 45,
        name: "Printed step 45",
        sourceActionDigest: digest("5"),
      },
      targets,
      selection: {
        schemaVersion: "lego.real-build-prefix50-selected-subbuild-return/1",
        authority: "none",
        returnResultCommitment: selectionEvidence.returnResultCommitment,
        candidateRosterCommitment: selectionEvidence.candidateRosterCommitment,
        candidateKey: selectionEvidence.candidateKey,
        selectedSubBuildReturnCommitment: selectionEvidence.selectedSubBuildReturnCommitment,
        reviewedVisualBindingCommitment: selectionEvidence.reviewedVisualBindingCommitment,
        selectedDocument,
        selectedDocumentHash: selectionEvidence.selectedDocumentHash,
        selectedDocumentCommitment: selectionEvidence.selectedDocumentCommitment,
      },
      selectionEvidence,
      resolution,
      routingAccounting: { relationalResolverCallCount: 1, genericSearchCallCount: 0 },
    };
  });

  it("compiles the exact three receiver pairs without a generic transform-search call", () => {
    const workBudget = budget();
    const transition = compilationTestOnly.compileResolvedTransition!({
      ...coreInput,
      budget: workBudget,
    });

    expect(validateBrickDocument(transition.document).documentGloballyValid).toBe(true);
    expect(transition.document.parts).toHaveLength(283);
    expect(transition.document.steps).toHaveLength(45);
    expect(transition.assignments.map(([ordinal]) => ordinal)).toEqual([281, 282, 283]);
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
    expect(transition.evidence.accounting).toEqual({
      relationalResolverCallCount: 1,
      genericSearchCallCount: 0,
      enumerationDelta: 1,
      orientationNarrowedEnumerationDelta: 0,
      searchNodeDelta: 3,
    });
    expect(workBudget).toMatchObject({
      nodes: 23,
      enumerations: 31,
      orientationNarrowedEnumerations: 10,
    });
    for (const pair of transition.evidence.receiverPairs) {
      expect(
        transition.document.connections.filter(
          ({ a, b }) =>
            (a.partId === pair.candidatePartId && b.partId === pair.receiverPartId) ||
            (b.partId === pair.candidatePartId && a.partId === pair.receiverPartId),
        ),
      ).toHaveLength(1);
    }
  });

  it("rejects a self-consistent but unbranded Step-44 evidence forgery", () => {
    expect(() =>
      requireRealBuildPrefix50Step44SelectionEvidence(coreInput.selectionEvidence),
    ).toThrow(/runtime-branded Step-44 selection evidence/u);
  });

  it("conserves the shared budget when routing is duplicated or a target is duplicated", () => {
    const duplicateRoutingBudget = budget();
    expect(() =>
      compilationTestOnly.compileResolvedTransition!({
        ...coreInput,
        routingAccounting: { relationalResolverCallCount: 2, genericSearchCallCount: 0 },
        budget: duplicateRoutingBudget,
      }),
    ).toThrow(/drifted from the exact selected return/u);
    expect(duplicateRoutingBudget).toEqual(budget());

    const duplicateTargetBudget = budget();
    expect(() =>
      compilationTestOnly.compileResolvedTransition!({
        ...coreInput,
        targets: [coreInput.targets[0]!, coreInput.targets[0]!, coreInput.targets[2]!],
        budget: duplicateTargetBudget,
      }),
    ).toThrow(/three distinct exact targets/u);
    expect(duplicateTargetBudget).toEqual(budget());
  });

  it("rejects arbitrary Step-44 BuildStep metadata even when the relational roster is live", () => {
    const relational = step45RelationalTestInput();
    const hostileDocument = deepFreeze({
      ...relational.selectedStep44Document,
      steps: relational.selectedStep44Document.steps.map((step, index) =>
        index === 43 ? { ...step, name: "Caller-authored empty Step 44" } : step,
      ),
    });
    const hostileResolution = resolveRealBuildPrefix50Step45RelationalPlacements({
      ...relational,
      selectedStep44Document: hostileDocument,
    });
    const workBudget = budget();
    expect(() =>
      compilationTestOnly.compileResolvedTransition!({
        ...coreInput,
        document: hostileDocument,
        resolution: hostileResolution,
        budget: workBudget,
      }),
    ).toThrow(/exactly one deterministic empty Step-44 transition/u);
    expect(workBudget).toEqual(budget());
  });
});
