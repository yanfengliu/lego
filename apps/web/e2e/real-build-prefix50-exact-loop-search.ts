import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { diagnosePlacementTransform } from "../src/assembly/enumerate-placements";
import {
  RealBuildPrefix50SelectedPathBlockerError,
  type RealBuildPrefix50SearchBudget,
  type RealBuildPrefix50SearchState,
  type RealBuildPrefix50TargetOccurrence,
} from "./real-build-prefix50-exact-compiler-contract";
import { searchStep } from "./real-build-prefix50-exact-compiler-search";

export function searchRealBuildPrefix50StepOrBlock(input: {
  readonly searchDocument: BrickDocumentV1;
  readonly reportedDocument: BrickDocumentV1;
  readonly targets: readonly RealBuildPrefix50TargetOccurrence[];
  readonly printedStepNumber: number;
  readonly allowDetachedBuildPlate: boolean;
  readonly budget: RealBuildPrefix50SearchBudget;
  readonly initialState?: RealBuildPrefix50SearchState;
  readonly basePartIds?: ReadonlySet<string>;
}): RealBuildPrefix50SearchState {
  const basePartIds = input.basePartIds ?? new Set(input.searchDocument.parts.map(({ id }) => id));
  const searched = searchStep(
    input.initialState ?? {
      document: input.searchDocument,
      remaining: input.targets,
      witnesses: [],
      ordinals: [],
      witnessIndexByTempId: new Map(),
    },
    basePartIds,
    input.allowDetachedBuildPlate,
    input.budget,
    new Set(),
  );
  if (searched !== null) return searched;

  const firstNeverMatched = input.targets.find(
    ({ ordinal }) => input.budget.targetAttempts.get(ordinal)?.matches === 0,
  );
  const attempt =
    firstNeverMatched === undefined
      ? undefined
      : input.budget.targetAttempts.get(firstNeverMatched.ordinal);
  const diagnosis =
    firstNeverMatched === undefined
      ? undefined
      : diagnosePlacementTransform(
          input.searchDocument,
          firstNeverMatched.partIdentity.reconciledCatalogPartId,
          firstNeverMatched.targetTransform,
        );
  const detail =
    firstNeverMatched === undefined || attempt === undefined
      ? " every target appeared individually, but no complete dependency ordering survived"
      : ` occurrence ${firstNeverMatched.ordinal} (${firstNeverMatched.partIdentity.reconciledCatalogPartId}) source ${firstNeverMatched.sourceWorldTransform.positionLdu.join(",")}/${firstNeverMatched.sourceWorldTransform.orientationId} target ${firstNeverMatched.targetTransform.positionLdu.join(",")}/${firstNeverMatched.targetTransform.orientationId} never appeared across ${attempt.attempts} complete enumerations; search component parts ${input.searchDocument.parts.length}; diagnosis ${JSON.stringify(diagnosis)}; last counts ${JSON.stringify(attempt.lastCounts)}`;
  const message = `Prefix-50 selected committed-prefix path has no bounded within-step ordering at printed step ${input.printedStepNumber} in which every exact target is present in complete placement enumeration; earlier printed-step choices were not revisited;${detail}.`;
  throw new RealBuildPrefix50SelectedPathBlockerError(message, {
    message,
    printedStepNumber: input.printedStepNumber,
    occurrenceOrdinal: firstNeverMatched?.ordinal ?? null,
    catalogPartId: firstNeverMatched?.partIdentity.reconciledCatalogPartId ?? null,
    sourceWorldTransform: firstNeverMatched?.sourceWorldTransform ?? null,
    targetTransform: firstNeverMatched?.targetTransform ?? null,
    diagnosis: diagnosis ?? null,
    lastCounts: attempt?.lastCounts ?? null,
    basePartCount: input.reportedDocument.parts.length,
    baseStepCount: input.reportedDocument.steps.length,
    enumerationCount: input.budget.enumerations,
    searchNodeCount: input.budget.nodes,
  });
}
