import {
  canonicalDigest,
  createBuildPlaybackTrace,
  deriveBuildSequenceFromTrace,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1, BuildOperation, RigidTransform } from "@lego-studio/protocol";

import type { RigidSubassemblyReturnEnumeration } from "../src/assembly/rigid-subassembly-return";
import {
  compileRealBuildPrefix50ZeroPieceStepCandidate,
  isRealBuildPrefix50ZeroPieceStepCandidate,
} from "./real-build-automatic-placement-candidate";
import { compileRealBuildPrefix50CandidateStep } from "./real-build-prefix50-exact-candidate-step";
import {
  REAL_BUILD_PREFIX50_LAST_STEP,
  REAL_BUILD_PREFIX50_TRANSITION_STEP,
  type RealBuildPrefix50VerifiedProjection,
} from "./real-build-prefix50-projection";
import {
  type RealBuildPrefix50Occurrence30SourceRepairProposal,
  type RealBuildPrefix50SearchBudget,
  type RealBuildPrefix50StateCommitment,
  type RealBuildPrefix50Step44SelectionEvidence,
  type RealBuildPrefix50Step45RelationalCompilationEvidence,
  type RealBuildPrefix50TargetOccurrence,
  type RealBuildPrefix50WorldGaugeSourceRepairProposal,
} from "./real-build-prefix50-exact-compiler-contract";
import {
  childPartIdsInSourceOrder,
  type RealBuildPrefix50ExactLoopResult,
} from "./real-build-prefix50-exact-loop-contract";
import { targetsFor, snapshot } from "./real-build-prefix50-exact-compiler-operations";
import { searchRealBuildPrefix50StepOrBlock } from "./real-build-prefix50-exact-loop-search";
import { compileRealBuildPrefix50Step44ReturnTransition } from "./real-build-prefix50-exact-loop-step44";
import {
  constructRealBuildPrefix50AtomicSubBuildRoot,
  type RealBuildPrefix50AtomicSubBuildRoot,
} from "./real-build-prefix50-subbuild-root";
import {
  isolateRealBuildPrefix50DetachedSubBuild,
  type RealBuildPrefix50DetachedSubBuildState,
} from "./real-build-prefix50-subbuild-state";
import {
  constructRealBuildPrefix50Step50AtomicRoot,
  type RealBuildPrefix50Step50AtomicRoot,
} from "./real-build-prefix50-suffix-root";
import { deriveRealBuildPrefix50SuffixSubBuildPlan } from "./real-build-prefix50-suffix-subbuild-plan";
import {
  realBuildPrefix50OrdinalPartRowsThrough,
  verifyRealBuildPrefix50SameStepReturnState,
  type RealBuildPrefix50SameStepReturnState,
  type RealBuildPrefix50SameStepReturnStates,
  type RealBuildPrefix50TerminalDetachedState,
} from "./real-build-prefix50-suffix-state";
import { compileRealBuildPrefix50TerminalDetachedStep } from "./real-build-prefix50-suffix-terminal-step";
import { prefix50TemporaryPartId } from "./real-build-prefix50-temporary-placement";
import type { RealBuildPrefix50Step42_43SourceRepairProof } from "./real-build-prefix50-step42-43-source-repair-contract";
import type { RealBuildPrefix50SourcePlacementRepairProposal } from "./real-build-prefix50-source-placement-repair";
import type { RealBuildPrefix50SelectedSubBuildReturn } from "./real-build-prefix50-subbuild-return";
import type { compileRealBuildPrefix50Step45RelationalTransition } from "./real-build-prefix50-step45-relational-compilation";

export {
  RealBuildPrefix50Step44ReviewRequiredError,
  type RealBuildPrefix50ExactLoopResult,
} from "./real-build-prefix50-exact-loop-contract";

export type RealBuildPrefix50Step45RelationalCompiler =
  typeof compileRealBuildPrefix50Step45RelationalTransition;

export function compileRealBuildPrefix50ExactLoop(input: {
  readonly initialDocument: BrickDocumentV1;
  readonly sourceProjection: RealBuildPrefix50VerifiedProjection;
  readonly projection: RealBuildPrefix50VerifiedProjection;
  readonly gauge: RigidTransform;
  readonly worldGaugeSourceRepair: RealBuildPrefix50WorldGaugeSourceRepairProposal | null;
  readonly occurrence30SourceRepair: RealBuildPrefix50Occurrence30SourceRepairProposal | null;
  readonly sourcePlacementRepairs: readonly RealBuildPrefix50SourcePlacementRepairProposal[];
  readonly step42_43SourceRepairProof: RealBuildPrefix50Step42_43SourceRepairProof | null;
  readonly selectedSubBuildReturn: RealBuildPrefix50SelectedSubBuildReturn | null;
  readonly step45RelationalCompiler: RealBuildPrefix50Step45RelationalCompiler | null;
  readonly budget: RealBuildPrefix50SearchBudget;
  readonly requireExactSuffix: boolean;
}): RealBuildPrefix50ExactLoopResult {
  let document = input.initialDocument;
  const placementOrdinals: number[] = [];
  const partIdByOccurrenceOrdinal = new Map<number, string>();
  const candidateStepCommitments: {
    printedStepNumber: number;
    commitment: `sha256:${string}`;
  }[] = [];
  const stateCommitments: RealBuildPrefix50StateCommitment[] = [
    {
      completedPrintedStep: 0,
      partCount: 0,
      documentHash: documentStructuralHash(document),
      canonicalDocumentDigest: canonicalDigest(document),
    },
  ];
  const playbackTransitionOperationGroups: (readonly (readonly BuildOperation[])[])[] = [];
  const detachedSubBuildStates: RealBuildPrefix50DetachedSubBuildState[] = [];
  const suffixSubBuildPlan = input.requireExactSuffix
    ? deriveRealBuildPrefix50SuffixSubBuildPlan(input.sourceProjection)
    : null;
  const sameStepReturnStates: RealBuildPrefix50SameStepReturnState[] = [];
  const genericSearchCallsByPrintedStep = new Map<number, number>();
  const runGenericSearch: typeof searchRealBuildPrefix50StepOrBlock = (searchInput) => {
    genericSearchCallsByPrintedStep.set(
      searchInput.printedStepNumber,
      (genericSearchCallsByPrintedStep.get(searchInput.printedStepNumber) ?? 0) + 1,
    );
    return searchRealBuildPrefix50StepOrBlock(searchInput);
  };
  let atomicSubBuildRoot: RealBuildPrefix50AtomicSubBuildRoot | null = null;
  let step50AtomicRoot: RealBuildPrefix50Step50AtomicRoot | null = null;
  let terminalDetachedState: RealBuildPrefix50TerminalDetachedState | null = null;
  let subBuildReturnEnumeration: RigidSubassemblyReturnEnumeration | null = null;
  let selectedSubBuildReturn: RealBuildPrefix50SelectedSubBuildReturn | null = null;
  let step44SelectionEvidence: RealBuildPrefix50Step44SelectionEvidence | null = null;
  let step45RelationalEvidence: RealBuildPrefix50Step45RelationalCompilationEvidence | null = null;
  const window = input.sourceProjection.childSubBuildWindow;

  for (
    let printedStepNumber = 1;
    printedStepNumber <= REAL_BUILD_PREFIX50_LAST_STEP;
    printedStepNumber += 1
  ) {
    let playbackOperationGroups: readonly (readonly BuildOperation[])[] | null = null;
    const metadata = input.projection.steps[printedStepNumber - 1]!;
    const targets = targetsFor(
      input.projection,
      input.gauge,
      printedStepNumber,
      input.worldGaugeSourceRepair,
      input.occurrence30SourceRepair,
    );
    if (window !== null && printedStepNumber === window.entryPrintedStepNumber) {
      if (targets.length !== 2) {
        throw new TypeError(
          "Prefix-50 child SubBuild entry step must contain only root ordinals 258 and 259.",
        );
      }
      atomicSubBuildRoot = constructRealBuildPrefix50AtomicSubBuildRoot({
        projection: input.sourceProjection,
        window,
        parentDraft: document,
        rootRows: targets as readonly [
          RealBuildPrefix50TargetOccurrence,
          RealBuildPrefix50TargetOccurrence,
        ],
        budget: input.budget,
      });
      const compiled = compileRealBuildPrefix50CandidateStep({
        document,
        printedStepNumber,
        printedStep: metadata,
        targets,
        placementOrdinals: atomicSubBuildRoot.ordinals,
        witnesses: atomicSubBuildRoot.witnesses,
        mode: "intentionalDetachedSubassembly",
        detachedChildPartIdsBeforeStep: [],
      });
      document = compiled.document;
      playbackOperationGroups = [compiled.candidate.operations];
      placementOrdinals.push(...atomicSubBuildRoot.ordinals);
      for (const [ordinal, partId] of compiled.assignments)
        partIdByOccurrenceOrdinal.set(ordinal, partId);
      candidateStepCommitments.push({
        printedStepNumber,
        commitment: compiled.candidateCommitment,
      });
      if (compiled.detachedState === null) {
        throw new TypeError("Prefix-50 child SubBuild root lost its detached-state receipt.");
      }
      detachedSubBuildStates.push(compiled.detachedState);
    } else if (
      window !== null &&
      printedStepNumber > window.entryPrintedStepNumber &&
      printedStepNumber <= window.lastPhysicalPrintedStepNumber
    ) {
      const childPartIds = childPartIdsInSourceOrder(
        partIdByOccurrenceOrdinal,
        window.sourceBuilderIdentityOrdinals.filter(
          (ordinal) =>
            input.projection.occurrences[ordinal - 1]!.printedStepNumber < printedStepNumber,
        ),
      );
      const detached = isolateRealBuildPrefix50DetachedSubBuild({
        document,
        childPartIds,
        completedPrintedStep: printedStepNumber - 1,
      });
      const searched = runGenericSearch({
        searchDocument: detached.childDocument,
        reportedDocument: document,
        targets,
        printedStepNumber,
        allowDetachedBuildPlate: false,
        budget: input.budget,
      });
      const compiled = compileRealBuildPrefix50CandidateStep({
        document,
        printedStepNumber,
        printedStep: metadata,
        targets,
        placementOrdinals: searched.ordinals,
        witnesses: searched.witnesses,
        mode: "ordinary",
        detachedChildPartIdsBeforeStep: childPartIds,
      });
      document = compiled.document;
      playbackOperationGroups = [compiled.candidate.operations];
      placementOrdinals.push(...searched.ordinals);
      for (const [ordinal, partId] of compiled.assignments)
        partIdByOccurrenceOrdinal.set(ordinal, partId);
      candidateStepCommitments.push({
        printedStepNumber,
        commitment: compiled.candidateCommitment,
      });
      if (compiled.detachedState === null) {
        throw new TypeError(
          `Prefix-50 detached printed step ${printedStepNumber} lost its component-isolation receipt.`,
        );
      }
      detachedSubBuildStates.push(compiled.detachedState);
    } else if (printedStepNumber === REAL_BUILD_PREFIX50_TRANSITION_STEP) {
      if (window !== null) {
        const childPartIds = childPartIdsInSourceOrder(
          partIdByOccurrenceOrdinal,
          window.sourceBuilderIdentityOrdinals,
        );
        const detachedState = detachedSubBuildStates.at(-1);
        if (
          detachedState === undefined ||
          detachedState.completedPrintedStep !== window.lastPhysicalPrintedStepNumber
        ) {
          throw new TypeError(
            "Prefix-50 Step-44 return lost the exact detached Step-43 state commitment.",
          );
        }
        if (input.step42_43SourceRepairProof === null) {
          throw new TypeError(
            "Prefix-50 Step-44 return requires the exact opaque Step-41/42/43 source-repair proof chain.",
          );
        }
        const returned = compileRealBuildPrefix50Step44ReturnTransition({
          sourceProjection: input.sourceProjection,
          window,
          document,
          childPartIds,
          detachedState,
          step42_43SourceRepairProof: input.step42_43SourceRepairProof,
          selectedReturn: input.selectedSubBuildReturn,
        });
        document = returned.document;
        playbackOperationGroups = [returned.operations];
        subBuildReturnEnumeration = returned.enumeration;
        selectedSubBuildReturn = returned.selectedReturn;
        step44SelectionEvidence = returned.selectionEvidence;
      }
      const zeroStep = compileRealBuildPrefix50ZeroPieceStepCandidate({
        documentSnapshot: snapshot(document),
        printedStepNumber,
        printedStep: metadata,
      });
      if (!isRealBuildPrefix50ZeroPieceStepCandidate(zeroStep)) {
        throw new TypeError(
          "Prefix-50 zero-piece candidate lost its authority-free compiler brand.",
        );
      }
      document = zeroStep.document;
      playbackOperationGroups = [...(playbackOperationGroups ?? []), zeroStep.operations];
      candidateStepCommitments.push({
        printedStepNumber,
        commitment: zeroStep.lineage.programHash,
      });
    } else if (printedStepNumber === 45 && suffixSubBuildPlan !== null) {
      if (selectedSubBuildReturn === null || step44SelectionEvidence === null) {
        throw new TypeError(
          "Prefix-50 Step-45 relational compilation requires its exact branded Step-44 selection.",
        );
      }
      if (input.step45RelationalCompiler === null)
        throw new TypeError(
          "Prefix-50 exact suffix compilation requires its explicit post-Step-44 relational compiler dependency.",
        );
      const relational = input.step45RelationalCompiler({
        document,
        printedStep: metadata,
        targets,
        ordinalPartRows: realBuildPrefix50OrdinalPartRowsThrough(partIdByOccurrenceOrdinal, 280),
        sourceRepairs: input.sourcePlacementRepairs,
        selectedReturn: selectedSubBuildReturn,
        selectionEvidence: step44SelectionEvidence,
        genericSearchCallCount: genericSearchCallsByPrintedStep.get(45) ?? 0,
        budget: input.budget,
      });
      document = relational.document;
      playbackOperationGroups = [relational.operations];
      placementOrdinals.push(...relational.assignments.map(([ordinal]) => ordinal));
      for (const [ordinal, partId] of relational.assignments)
        partIdByOccurrenceOrdinal.set(ordinal, partId);
      candidateStepCommitments.push({
        printedStepNumber,
        commitment: relational.candidateStepCommitment,
      });
      step45RelationalEvidence = relational.evidence;
    } else if (printedStepNumber === 50 && suffixSubBuildPlan !== null) {
      if (targets.length !== 9 || targets.some(({ ordinal }, index) => ordinal !== index + 312)) {
        throw new TypeError(
          "Prefix-50 terminal detached step must contain exactly source ordinals 312 through 320 and no Step-51 suffix.",
        );
      }
      step50AtomicRoot = constructRealBuildPrefix50Step50AtomicRoot({
        projection: input.sourceProjection,
        plan: suffixSubBuildPlan,
        parentDocument: document,
        gauge: input.gauge,
        rootRows: targets.slice(0, 2) as unknown as readonly [
          RealBuildPrefix50TargetOccurrence,
          RealBuildPrefix50TargetOccurrence,
        ],
        budget: input.budget,
      });
      const remaining = targets.slice(2);
      const searched = runGenericSearch({
        searchDocument: step50AtomicRoot.childSearchDocument,
        reportedDocument: document,
        targets: remaining,
        printedStepNumber,
        allowDetachedBuildPlate: false,
        budget: input.budget,
        initialState: {
          document: step50AtomicRoot.childSearchDocument,
          remaining,
          witnesses: step50AtomicRoot.witnesses,
          ordinals: step50AtomicRoot.ordinals,
          witnessIndexByTempId: new Map([
            [prefix50TemporaryPartId(312), 0],
            [prefix50TemporaryPartId(313), 1],
          ]),
        },
        basePartIds: new Set(),
      });
      const compiled = compileRealBuildPrefix50TerminalDetachedStep({
        document,
        printedStepNumber: 50,
        printedStep: metadata,
        targets,
        placementOrdinals: searched.ordinals,
        witnesses: searched.witnesses,
        ordinalPartRowsBeforeStep: realBuildPrefix50OrdinalPartRowsThrough(
          partIdByOccurrenceOrdinal,
          311,
        ),
        plan: suffixSubBuildPlan,
      });
      document = compiled.document;
      playbackOperationGroups = [compiled.candidate.operations];
      placementOrdinals.push(...searched.ordinals);
      for (const [ordinal, partId] of compiled.assignments)
        partIdByOccurrenceOrdinal.set(ordinal, partId);
      candidateStepCommitments.push({
        printedStepNumber,
        commitment: compiled.candidateCommitment,
      });
      terminalDetachedState = compiled.terminalState;
    } else {
      const searched = runGenericSearch({
        searchDocument: document,
        reportedDocument: document,
        targets,
        printedStepNumber,
        allowDetachedBuildPlate: printedStepNumber === 1,
        budget: input.budget,
      });
      const compiled = compileRealBuildPrefix50CandidateStep({
        document,
        printedStepNumber,
        printedStep: metadata,
        targets,
        placementOrdinals: searched.ordinals,
        witnesses: searched.witnesses,
        mode: "ordinary",
        expectedBlockingCodes: [],
      });
      document = compiled.document;
      playbackOperationGroups = [compiled.candidate.operations];
      placementOrdinals.push(...searched.ordinals);
      for (const [ordinal, partId] of compiled.assignments)
        partIdByOccurrenceOrdinal.set(ordinal, partId);
      candidateStepCommitments.push({
        printedStepNumber,
        commitment: compiled.candidateCommitment,
      });
    }
    if (
      suffixSubBuildPlan !== null &&
      (printedStepNumber === 46 ||
        printedStepNumber === 47 ||
        printedStepNumber === 48 ||
        printedStepNumber === 49)
    ) {
      sameStepReturnStates.push(
        verifyRealBuildPrefix50SameStepReturnState({
          completedPrintedStep: printedStepNumber,
          document,
          ordinalPartRows: realBuildPrefix50OrdinalPartRowsThrough(
            partIdByOccurrenceOrdinal,
            document.parts.length,
          ),
          plan: suffixSubBuildPlan,
        }),
      );
    }
    if (
      playbackOperationGroups === null ||
      playbackOperationGroups.length === 0 ||
      playbackOperationGroups.some((operations) => operations.length === 0)
    ) {
      throw new TypeError(
        `Prefix-50 printed step ${printedStepNumber} did not retain its exact replay operations.`,
      );
    }
    playbackTransitionOperationGroups.push(playbackOperationGroups);
    stateCommitments.push({
      completedPrintedStep: printedStepNumber,
      partCount: document.parts.length,
      documentHash: documentStructuralHash(document),
      canonicalDocumentDigest: canonicalDigest(document),
    });
  }
  if (
    input.requireExactSuffix &&
    (suffixSubBuildPlan === null ||
      sameStepReturnStates.length !== 4 ||
      step50AtomicRoot === null ||
      terminalDetachedState === null)
  ) {
    throw new TypeError(
      "Prefix-50 exact loop must retain four same-step return receipts and the exact Step-50 atomic-root and terminal-detached receipts.",
    );
  }
  if (
    step45RelationalEvidence !== null &&
    step45RelationalEvidence.accounting.genericSearchCallCount !==
      (genericSearchCallsByPrintedStep.get(45) ?? 0)
  ) {
    throw new TypeError("Prefix-50 Step-45 routing accounting drifted after exact-loop replay.");
  }
  const playbackTrace = createBuildPlaybackTrace(
    input.initialDocument,
    playbackTransitionOperationGroups,
  );
  const replayed = deriveBuildSequenceFromTrace(document, playbackTrace);
  if (
    replayed.states.length !== stateCommitments.length ||
    replayed.states.some(
      (state, index) =>
        documentStructuralHash(state.document) !== stateCommitments[index]?.documentHash ||
        state.cumulativePartCount !== stateCommitments[index]?.partCount ||
        canonicalDigest(state.document) !== stateCommitments[index]?.canonicalDocumentDigest,
    )
  ) {
    throw new TypeError(
      "Prefix-50 playback trace does not reproduce every exact compiler state commitment.",
    );
  }
  return {
    document,
    placementOrdinals,
    partIdByOccurrenceOrdinal,
    stateCommitments,
    playbackTrace,
    candidateStepCommitments,
    atomicSubBuildRoot,
    detachedSubBuildStates,
    subBuildReturnEnumeration,
    selectedSubBuildReturn,
    step44SelectionEvidence,
    step45RelationalEvidence,
    suffixSubBuildPlan,
    sameStepReturnStates:
      suffixSubBuildPlan === null
        ? null
        : (sameStepReturnStates as unknown as RealBuildPrefix50SameStepReturnStates),
    step50AtomicRoot,
    terminalDetachedState,
  };
}
