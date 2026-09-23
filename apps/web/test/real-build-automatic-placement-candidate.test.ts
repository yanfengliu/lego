import { describe, expect, it } from "vitest";

import {
  canonicalBrickDocument,
  canonicalDigest,
  createEmptyBrickDocument,
  documentStructuralHash,
  normalizeBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import {
  compileRealBuildAutomaticPlacementCandidate,
  compileRealBuildIntentionalDetachedSubassemblyCandidate,
  compileRealBuildPrefix50ZeroPieceStepCandidate,
  isRealBuildAutomaticPlacementCandidateResult,
  isRealBuildPrefix50ZeroPieceStepCandidate,
} from "../e2e/real-build-automatic-placement-candidate";
import { compileRealBuildAutomaticPlacement } from "../e2e/real-build-automatic-placement-compiler";
import { prepareRealBuildAutomaticPrintedStep } from "../e2e/real-build-automatic-placement-step";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import { compileRealBuildPrefix50ZeroPieceStep } from "../e2e/real-build-prefix50-zero-step";

const digest = (digit: string) => `sha256:${digit.repeat(64)}` as const;

const snapshot = (document: BrickDocumentV1) =>
  createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(document),
    expectedDocumentHash: documentStructuralHash(document),
  });

const emptyPrefix = () =>
  normalizeBrickDocument(createEmptyBrickDocument({ id: "candidate-prefix", name: "Candidate" }));

const stepOneInput = () => ({
  documentSnapshot: snapshot(emptyPrefix()),
  printedStepNumber: 1,
  printedStep: { name: "Printed step 1", sourceActionDigest: digest("1") },
  witnesses: [
    {
      catalogPartId: "builtin:brick-1x1",
      colorId: "builtin:red",
      transform: { positionLdu: [0, 0, 0] as const, orientationId: "upright-yaw-0" },
      connections: [],
    },
  ],
});

function retainedStepOne(): BrickDocumentV1 {
  const result = compileRealBuildAutomaticPlacement(stepOneInput());
  if (!result.ok) throw new Error("Step-one fixture must compile.");
  return result.document;
}

function detachedInput(secondY: number) {
  const base = retainedStepOne();
  return {
    base,
    input: {
      documentSnapshot: snapshot(base),
      printedStepNumber: 2,
      printedStep: { name: "Printed step 2", sourceActionDigest: digest("2") },
      witnesses: [
        {
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:blue",
          transform: {
            positionLdu: [100, -100, 0] as const,
            orientationId: "upright-yaw-0",
          },
          connections: [],
        },
        {
          catalogPartId: "builtin:brick-1x1",
          colorId: "builtin:red",
          transform: {
            positionLdu: [100, secondY, 0] as const,
            orientationId: "upright-yaw-0",
          },
          connections: [
            {
              target: { kind: "witness" as const, witnessIndex: 0 },
              targetPortId: "stud:0:0",
              candidatePortId: "undersideClutch:0:0",
              connectionKind: "stud-tube" as const,
            },
          ],
        },
      ],
    },
  };
}

function documentWith43Steps(): BrickDocumentV1 {
  let document = retainedStepOne();
  for (let printedStepNumber = 2; printedStepNumber <= 43; printedStepNumber += 1) {
    const sourceActionDigest = canonicalDigest({ printedStepNumber });
    document = prepareRealBuildAutomaticPrintedStep({
      document,
      printedStepNumber,
      metadata: { name: `Printed step ${printedStepNumber}`, sourceActionDigest },
      compilerInputDigest: canonicalDigest({ document: documentStructuralHash(document) }),
    }).documentWithStep;
  }
  return document;
}

describe("authority-free automatic printed-step candidates", () => {
  it("returns frozen branded ordinary evidence without exposing patch or success authority", () => {
    const input = stepOneInput();
    const candidate = compileRealBuildAutomaticPlacementCandidate(input);
    const ordinary = compileRealBuildAutomaticPlacement(input);

    expect(candidate).toMatchObject({
      kind: "realBuildAutomaticPlacementCandidate",
      status: "draft",
      authority: "none",
      mode: "ordinary",
      hardValidationComplete: true,
    });
    expect(Object.hasOwn(candidate, "ok")).toBe(false);
    expect(Object.hasOwn(candidate, "patch")).toBe(false);
    expect(isRealBuildAutomaticPlacementCandidateResult(candidate)).toBe(true);
    expect(isRealBuildAutomaticPlacementCandidateResult(structuredClone(candidate))).toBe(false);
    expect(Object.isFrozen(candidate)).toBe(true);
    if (candidate.status !== "draft" || !ordinary.ok) return;
    expect(candidate.document).toEqual(ordinary.document);
    expect(candidate.operations).toEqual(ordinary.patch.operations);
    expect(candidate.validationReport.documentGloballyValid).toBe(true);
    expect(candidate.lineage.programHash).toBe(canonicalDigest(candidate.lineage.program));
    expect(compileRealBuildAutomaticPlacementCandidate(input)).toEqual(candidate);
  });

  it("admits exactly one internally connected detached component with only disconnection blocking", () => {
    const { input } = detachedInput(-124);
    const candidate = compileRealBuildIntentionalDetachedSubassemblyCandidate(input);

    expect(candidate).toMatchObject({
      status: "draft",
      authority: "none",
      mode: "intentionalDetachedSubassembly",
      hardValidationComplete: true,
    });
    if (candidate.status !== "draft") return;
    expect([
      ...new Set(
        candidate.validationReport.issues
          .filter(({ severity }) => severity === "blocking")
          .map(({ code }) => code),
      ),
    ]).toEqual(["DISCONNECTED_ASSEMBLY"]);
    expect(candidate.document.connections).toHaveLength(1);
    expect(() => compileRealBuildAutomaticPlacement(input)).toThrow(/witness 0 is not supported/u);
  });

  it("makes a single floating part and a second disconnected root unreachable", () => {
    const { base, input } = detachedInput(-124);
    const single = { ...input, witnesses: input.witnesses.slice(0, 1) };
    expect(() => compileRealBuildIntentionalDetachedSubassemblyCandidate(single)).toThrow(
      /at least two witnesses.*one floating placement is never a subassembly/u,
    );
    expect(() => compileRealBuildAutomaticPlacementCandidate(single)).toThrow(/not supported/u);

    const secondRoot = {
      ...input,
      witnesses: [input.witnesses[0], { ...input.witnesses[1], connections: [] }],
    };
    expect(() => compileRealBuildIntentionalDetachedSubassemblyCandidate(secondRoot)).toThrow(
      /witness 1 must connect to an earlier witness/u,
    );

    const firstWithEdge = {
      ...input,
      witnesses: [
        {
          ...input.witnesses[0],
          connections: [
            {
              target: { kind: "base" as const, partId: base.parts[0]!.id },
              targetPortId: "stud:0:0",
              candidatePortId: "undersideClutch:0:0",
              connectionKind: "stud-tube" as const,
            },
          ],
        },
        input.witnesses[1],
      ],
    };
    expect(() => compileRealBuildIntentionalDetachedSubassemblyCandidate(firstWithEdge)).toThrow(
      /witness 0 must be the sole zero-edge root witness/u,
    );
  });

  it("retains collision and extra-blocker evidence but rejects it under detached policy", () => {
    for (const secondY of [-100, -148]) {
      const candidate = compileRealBuildIntentionalDetachedSubassemblyCandidate(
        detachedInput(secondY).input,
      );
      expect(candidate).toMatchObject({
        status: "rejected",
        stage: "intentionalDetachedSubassemblyPolicy",
        authority: "none",
        issues: [{ code: "DETACHED_SUBASSEMBLY_BLOCKING_CODE_SET_MISMATCH" }],
      });
      if (
        candidate.status !== "rejected" ||
        candidate.stage !== "intentionalDetachedSubassemblyPolicy"
      ) {
        continue;
      }
      const codes = candidate.validationReport.issues.map(({ code }) => code);
      expect(codes).toContain("DISCONNECTED_ASSEMBLY");
      expect(codes.some((code) => code !== "DISCONNECTED_ASSEMBLY")).toBe(true);
      expect(isRealBuildAutomaticPlacementCandidateResult(candidate)).toBe(true);
      expect(isRealBuildAutomaticPlacementCandidateResult(structuredClone(candidate))).toBe(false);
    }
  });

  it("returns an empty hard-valid step-44 candidate while ordinary zero-step authority stays intact", () => {
    const prior = documentWith43Steps();
    const input = {
      documentSnapshot: snapshot(prior),
      printedStepNumber: 44,
      printedStep: { name: "Printed step 44", sourceActionDigest: digest("4") },
    };
    const candidate = compileRealBuildPrefix50ZeroPieceStepCandidate(input);
    const ordinary = compileRealBuildPrefix50ZeroPieceStep(input);

    expect(candidate).toMatchObject({
      kind: "realBuildPrefix50ZeroPieceStepCandidate",
      status: "draft",
      authority: "none",
      hardValidationComplete: true,
    });
    expect(Object.hasOwn(candidate, "ok")).toBe(false);
    expect(Object.hasOwn(candidate, "patch")).toBe(false);
    expect(isRealBuildPrefix50ZeroPieceStepCandidate(candidate)).toBe(true);
    expect(isRealBuildPrefix50ZeroPieceStepCandidate(structuredClone(candidate))).toBe(false);
    expect(candidate.document.parts).toEqual(prior.parts);
    expect(candidate.document.connections).toEqual(prior.connections);
    expect(candidate.document.steps[43]).toMatchObject({ index: 43, partIds: [] });
    expect(candidate.validationReport.documentGloballyValid).toBe(true);
    expect(ordinary.ok).toBe(true);
    expect(ordinary.patch.operations).toEqual(candidate.operations);
    expect(ordinary.document).toEqual(candidate.document);
  });
});
