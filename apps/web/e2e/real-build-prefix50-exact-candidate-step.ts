import { canonicalDigest, deepFreeze, documentStructuralHash } from "@lego-studio/brick-kernel";
import type {
  AddPartOperation,
  BrickDocumentV1,
  PlacePartInstruction,
} from "@lego-studio/protocol";

import {
  compileRealBuildAutomaticPlacementCandidate,
  compileRealBuildIntentionalDetachedSubassemblyCandidate,
  isRealBuildAutomaticPlacementCandidateResult,
  type RealBuildAutomaticPlacementCandidateDraft,
} from "./real-build-automatic-placement-candidate";
import type { RealBuildAutomaticPlacementWitness } from "./real-build-automatic-placement-input";
import { snapshot, verifyStepResult } from "./real-build-prefix50-exact-compiler-operations";
import type { RealBuildPrefix50TargetOccurrence } from "./real-build-prefix50-exact-compiler-contract";
import type { RealBuildPrefix50ProjectionStep } from "./real-build-prefix50-projection";
import {
  isolateRealBuildPrefix50DetachedSubBuild,
  type RealBuildPrefix50DetachedSubBuildState,
} from "./real-build-prefix50-subbuild-state";

export interface RealBuildPrefix50CandidateStepResult {
  readonly document: BrickDocumentV1;
  readonly assignments: readonly (readonly [occurrenceOrdinal: number, partId: string])[];
  readonly candidateCommitment: `sha256:${string}`;
  readonly candidate: RealBuildAutomaticPlacementCandidateDraft;
  readonly detachedState: RealBuildPrefix50DetachedSubBuildState | null;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactBlockingCodes(
  candidate: RealBuildAutomaticPlacementCandidateDraft,
  expected: readonly string[],
  printedStepNumber: number,
): void {
  const observed = [
    ...new Set(
      candidate.validationReport.issues
        .filter(({ severity }) => severity === "blocking")
        .map(({ code }) => code),
    ),
  ].sort(compareStrings);
  const wanted = [...expected].sort(compareStrings);
  if (
    observed.length !== wanted.length ||
    observed.some((code, index) => code !== wanted[index]) ||
    candidate.validationReport.targetDocumentHash !== documentStructuralHash(candidate.document) ||
    candidate.validationReport.documentGloballyValid !== (wanted.length === 0)
  ) {
    throw new TypeError(
      `Prefix-50 authority-free candidate at printed step ${printedStepNumber} requires exact blocking-code set [${wanted.join(", ")}]; observed [${observed.join(", ")}].`,
    );
  }
}

/** Expands one exact printed step without creating an intermediate patch. */
type RealBuildPrefix50CandidateStepInput = {
  readonly document: BrickDocumentV1;
  readonly printedStepNumber: number;
  readonly printedStep: RealBuildPrefix50ProjectionStep;
  readonly targets: readonly RealBuildPrefix50TargetOccurrence[];
  readonly placementOrdinals: readonly number[];
  readonly witnesses: readonly RealBuildAutomaticPlacementWitness[];
} & (
  | {
      readonly mode: "ordinary";
      readonly expectedBlockingCodes: readonly string[];
      readonly detachedChildPartIdsBeforeStep?: never;
    }
  | {
      readonly mode: "ordinary";
      readonly detachedChildPartIdsBeforeStep: readonly string[];
      readonly expectedBlockingCodes?: never;
    }
  | {
      readonly mode: "intentionalDetachedSubassembly";
      readonly detachedChildPartIdsBeforeStep: readonly string[];
      readonly expectedBlockingCodes?: never;
    }
);

export function compileRealBuildPrefix50CandidateStep(
  input: RealBuildPrefix50CandidateStepInput,
): RealBuildPrefix50CandidateStepResult {
  const before = input.document;
  const compile =
    input.mode === "intentionalDetachedSubassembly"
      ? compileRealBuildIntentionalDetachedSubassemblyCandidate
      : compileRealBuildAutomaticPlacementCandidate;
  const candidate = compile({
    documentSnapshot: snapshot(before),
    printedStepNumber: input.printedStepNumber,
    printedStep: input.printedStep,
    witnesses: input.witnesses,
  });
  if (!isRealBuildAutomaticPlacementCandidateResult(candidate)) {
    throw new TypeError(
      `Prefix-50 candidate at printed step ${input.printedStepNumber} lost its runtime compiler brand.`,
    );
  }
  if (candidate.status !== "draft") {
    const first = candidate.issues[0];
    throw new TypeError(
      `Prefix-50 candidate expansion failed at printed step ${input.printedStepNumber}${first ? ` (${first.code}: ${first.message})` : ""}.`,
    );
  }
  if (candidate.mode !== input.mode || candidate.authority !== "none") {
    throw new TypeError(
      `Prefix-50 candidate at printed step ${input.printedStepNumber} changed its requested authority-free mode.`,
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
    input.printedStepNumber,
  );
  const observedBlockingCodes = [
    ...new Set(
      candidate.validationReport.issues
        .filter(({ severity }) => severity === "blocking")
        .map(({ code }) => code),
    ),
  ].sort(compareStrings);
  const detachedState =
    input.detachedChildPartIdsBeforeStep !== undefined
      ? isolateRealBuildPrefix50DetachedSubBuild({
          document: candidate.document,
          childPartIds: [
            ...input.detachedChildPartIdsBeforeStep,
            ...assignments.map(([, partId]) => partId),
          ],
          completedPrintedStep: input.printedStepNumber,
        })
      : null;
  if (input.expectedBlockingCodes !== undefined) {
    exactBlockingCodes(candidate, input.expectedBlockingCodes, input.printedStepNumber);
  } else if (
    candidate.validationReport.targetDocumentHash !== documentStructuralHash(candidate.document) ||
    candidate.validationReport.documentGloballyValid
  ) {
    throw new TypeError(
      `Prefix-50 detached candidate at printed step ${input.printedStepNumber} lost its invalid-draft validation receipt.`,
    );
  }
  return deepFreeze({
    document: candidate.document,
    assignments,
    candidateCommitment: canonicalDigest({
      schemaVersion: "lego.real-build-prefix50-candidate-step-commitment/1",
      printedStepNumber: input.printedStepNumber,
      mode: input.mode,
      targetOrdinals: input.targets.map(({ ordinal }) => ordinal),
      placementOrdinals: input.placementOrdinals,
      lineage: candidate.lineage,
      operations: candidate.operations,
      resultDocumentHash: documentStructuralHash(candidate.document),
      blockingCodes: observedBlockingCodes,
      detachedStateCommitment: detachedState?.commitment ?? null,
    }),
    candidate,
    detachedState,
  });
}
