import { canonicalDigest, deepFreeze, documentStructuralHash } from "@lego-studio/brick-kernel";
import type {
  AddPartOperation,
  BrickDocumentV1,
  PlacePartInstruction,
} from "@lego-studio/protocol";

import {
  compileRealBuildIntentionalDetachedSubassemblyCandidate,
  isRealBuildAutomaticPlacementCandidateResult,
  type RealBuildAutomaticPlacementCandidateDraft,
} from "./real-build-automatic-placement-candidate";
import type { RealBuildAutomaticPlacementWitness } from "./real-build-automatic-placement-input";
import type { RealBuildPrefix50TargetOccurrence } from "./real-build-prefix50-exact-compiler-contract";
import { snapshot, verifyStepResult } from "./real-build-prefix50-exact-compiler-operations";
import type { RealBuildPrefix50ProjectionStep } from "./real-build-prefix50-projection";
import type { RealBuildPrefix50SuffixSubBuildPlan } from "./real-build-prefix50-suffix-subbuild-plan";
import {
  verifyRealBuildPrefix50TerminalDetachedState,
  type RealBuildPrefix50OrdinalPartRow,
  type RealBuildPrefix50TerminalDetachedState,
} from "./real-build-prefix50-suffix-state";

export interface RealBuildPrefix50TerminalDetachedStepResult {
  readonly schemaVersion: "lego.real-build-prefix50-terminal-detached-step/1";
  readonly authority: "none";
  readonly completionAuthority: false;
  readonly printedStepNumber: 50;
  readonly step51Inspected: false;
  readonly document: BrickDocumentV1;
  readonly assignments: readonly (readonly [occurrenceOrdinal: number, partId: string])[];
  readonly candidateCommitment: `sha256:${string}`;
  readonly candidate: RealBuildAutomaticPlacementCandidateDraft;
  readonly terminalState: RealBuildPrefix50TerminalDetachedState;
}

export interface RealBuildPrefix50TerminalDetachedStepInput {
  readonly document: BrickDocumentV1;
  readonly printedStepNumber: 50;
  readonly printedStep: RealBuildPrefix50ProjectionStep;
  readonly targets: readonly RealBuildPrefix50TargetOccurrence[];
  readonly placementOrdinals: readonly number[];
  readonly witnesses: readonly RealBuildAutomaticPlacementWitness[];
  readonly ordinalPartRowsBeforeStep: readonly RealBuildPrefix50OrdinalPartRow[];
  readonly plan: RealBuildPrefix50SuffixSubBuildPlan;
}

function requireExactStepShape(input: RealBuildPrefix50TerminalDetachedStepInput): void {
  const exactTargetOrdinals = input.targets.map(({ ordinal }) => ordinal).sort((a, b) => a - b);
  const exactPlacementOrdinals = [...input.placementOrdinals].sort((a, b) => a - b);
  const expected = input.plan.terminalDetachedChild.occurrenceOrdinals;
  if (
    input.printedStepNumber !== 50 ||
    input.printedStep.printedStepNumber !== 50 ||
    input.document.parts.length !== 311 ||
    input.document.steps.length !== 49 ||
    input.document.steps[43]?.partIds.length !== 0 ||
    input.targets.length !== 9 ||
    input.witnesses.length !== 9 ||
    input.placementOrdinals.length !== 9 ||
    input.placementOrdinals[0] !== 312 ||
    input.placementOrdinals[1] !== 313 ||
    exactTargetOrdinals.some((ordinal, index) => ordinal !== expected[index]) ||
    exactPlacementOrdinals.some((ordinal, index) => ordinal !== expected[index]) ||
    input.ordinalPartRowsBeforeStep.length !== 311 ||
    input.ordinalPartRowsBeforeStep.some(({ ordinal }, index) => ordinal !== index + 1)
  ) {
    throw new TypeError(
      "Prefix-50 terminal detached-step compilation requires the exact hard-valid Step-49 parent, phase-90 roots 312/313 first, all and only ordinals 312 through 320, and no Step-51 suffix.",
    );
  }
}

export function compileRealBuildPrefix50TerminalDetachedStep(
  input: RealBuildPrefix50TerminalDetachedStepInput,
): RealBuildPrefix50TerminalDetachedStepResult {
  requireExactStepShape(input);
  const before = input.document;
  const candidate = compileRealBuildIntentionalDetachedSubassemblyCandidate({
    documentSnapshot: snapshot(before),
    printedStepNumber: input.printedStepNumber,
    printedStep: input.printedStep,
    witnesses: input.witnesses,
  });
  if (!isRealBuildAutomaticPlacementCandidateResult(candidate)) {
    throw new TypeError(
      "Prefix-50 terminal detached-step candidate lost its runtime compiler brand.",
    );
  }
  if (candidate.status !== "draft") {
    const first = candidate.issues[0];
    throw new TypeError(
      `Prefix-50 terminal detached-step expansion failed${first ? ` (${first.code}: ${first.message})` : ""}.`,
    );
  }
  if (candidate.mode !== "intentionalDetachedSubassembly" || candidate.authority !== "none") {
    throw new TypeError(
      "Prefix-50 terminal detached-step candidate changed its authority-free intentional-detached mode.",
    );
  }
  const placementOperations = candidate.lineage.program.placementProgram.operations.filter(
    (operation): operation is PlacePartInstruction => operation.kind === "placePart",
  );
  const compiledPartOperations = candidate.operations.filter(
    (operation): operation is AddPartOperation => operation.kind === "addPart",
  );
  const assignments = verifyStepResult(
    before,
    candidate.document,
    input.targets,
    input.placementOrdinals,
    placementOperations,
    compiledPartOperations,
    50,
  );
  const ordinalPartRows = [
    ...input.ordinalPartRowsBeforeStep,
    ...assignments.map(([ordinal, partId]) => ({ ordinal, partId })),
  ].sort((left, right) => left.ordinal - right.ordinal);
  const terminalState = verifyRealBuildPrefix50TerminalDetachedState({
    document: candidate.document,
    ordinalPartRows,
    plan: input.plan,
  });
  if (
    terminalState.combinedDocumentHash !== documentStructuralHash(candidate.document) ||
    candidate.validationReport.targetDocumentHash !== terminalState.combinedDocumentHash ||
    candidate.validationReport.documentGloballyValid
  ) {
    throw new TypeError(
      "Prefix-50 terminal detached-step candidate lost its exact terminal validation receipt.",
    );
  }
  const body = deepFreeze({
    schemaVersion: "lego.real-build-prefix50-terminal-detached-step/1" as const,
    authority: "none" as const,
    completionAuthority: false as const,
    printedStepNumber: 50 as const,
    step51Inspected: false as const,
    document: candidate.document,
    assignments,
    candidate: candidate as RealBuildAutomaticPlacementCandidateDraft,
    terminalState,
  });
  return deepFreeze({
    ...body,
    candidateCommitment: canonicalDigest({
      schemaVersion: body.schemaVersion,
      authority: body.authority,
      completionAuthority: body.completionAuthority,
      printedStepNumber: body.printedStepNumber,
      step51Inspected: body.step51Inspected,
      placementOrdinals: input.placementOrdinals,
      targetOrdinals: input.targets.map(({ ordinal }) => ordinal),
      lineage: candidate.lineage,
      operations: candidate.operations,
      terminalStateCommitment: terminalState.commitment,
      resultDocumentHash: terminalState.combinedDocumentHash,
    }),
  });
}
