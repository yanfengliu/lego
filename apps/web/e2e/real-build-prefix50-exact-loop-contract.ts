import type { BuildPlaybackTraceV1 } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { RigidSubassemblyReturnEnumeration } from "../src/assembly/rigid-subassembly-return";
import type {
  RealBuildPrefix50StateCommitment,
  RealBuildPrefix50Step44SelectionEvidence,
  RealBuildPrefix50Step45RelationalCompilationEvidence,
} from "./real-build-prefix50-exact-compiler-contract";
import type { RealBuildPrefix50AtomicSubBuildRoot } from "./real-build-prefix50-subbuild-root";
import type { RealBuildPrefix50DetachedSubBuildState } from "./real-build-prefix50-subbuild-state";
import type { RealBuildPrefix50Step50AtomicRoot } from "./real-build-prefix50-suffix-root";
import type { RealBuildPrefix50SuffixSubBuildPlan } from "./real-build-prefix50-suffix-subbuild-plan";
import type {
  RealBuildPrefix50SameStepReturnStates,
  RealBuildPrefix50TerminalDetachedState,
} from "./real-build-prefix50-suffix-state";
import {
  RealBuildPrefix50SubBuildReturnError,
  type RealBuildPrefix50SelectedSubBuildReturn,
  type RealBuildPrefix50SubBuildReturnResult,
} from "./real-build-prefix50-subbuild-return-contract";

export class RealBuildPrefix50Step44ReviewRequiredError extends TypeError {
  public constructor(
    message: string,
    public readonly result: RealBuildPrefix50SubBuildReturnResult,
    public readonly enumerationError: RealBuildPrefix50SubBuildReturnError | null = null,
  ) {
    super(message);
    this.name = "RealBuildPrefix50Step44ReviewRequiredError";
  }
}

export interface RealBuildPrefix50ExactLoopResult {
  readonly document: BrickDocumentV1;
  readonly placementOrdinals: readonly number[];
  readonly partIdByOccurrenceOrdinal: ReadonlyMap<number, string>;
  readonly stateCommitments: readonly RealBuildPrefix50StateCommitment[];
  readonly playbackTrace: BuildPlaybackTraceV1;
  readonly candidateStepCommitments: readonly {
    readonly printedStepNumber: number;
    readonly commitment: `sha256:${string}`;
  }[];
  readonly atomicSubBuildRoot: RealBuildPrefix50AtomicSubBuildRoot | null;
  readonly detachedSubBuildStates: readonly RealBuildPrefix50DetachedSubBuildState[];
  readonly subBuildReturnEnumeration: RigidSubassemblyReturnEnumeration | null;
  readonly selectedSubBuildReturn: RealBuildPrefix50SelectedSubBuildReturn | null;
  readonly step44SelectionEvidence: RealBuildPrefix50Step44SelectionEvidence | null;
  readonly step45RelationalEvidence: RealBuildPrefix50Step45RelationalCompilationEvidence | null;
  readonly suffixSubBuildPlan: RealBuildPrefix50SuffixSubBuildPlan | null;
  readonly sameStepReturnStates: RealBuildPrefix50SameStepReturnStates | null;
  readonly step50AtomicRoot: RealBuildPrefix50Step50AtomicRoot | null;
  readonly terminalDetachedState: RealBuildPrefix50TerminalDetachedState | null;
}

export function childPartIdsInSourceOrder(
  partIdByOccurrenceOrdinal: ReadonlyMap<number, string>,
  ordinals: readonly number[],
): readonly string[] {
  const ids: string[] = [];
  for (const ordinal of ordinals) {
    const partId = partIdByOccurrenceOrdinal.get(ordinal);
    if (partId === undefined) {
      throw new TypeError(`Prefix-50 child SubBuild lost occurrence ${ordinal} membership.`);
    }
    ids.push(partId);
  }
  return ids;
}
