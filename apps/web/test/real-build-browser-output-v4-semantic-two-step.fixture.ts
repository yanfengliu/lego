import type { RealBuildCompiledPlacementLineageEvidence } from "../e2e/real-build-compiled-placement-lineage-types";
import {
  decodeRealBuildAtomicCompiledBranchEvidenceWire,
  executeRealBuildAtomicCompiledBranchBatch,
  type RealBuildAtomicCompiledBranchBatchResult,
} from "../e2e/real-build-atomic-compiled-branch-batch";
import type { RealBuildLineageIdentity } from "../e2e/real-build-candidate-lineage-identity";
import {
  createRealBuildCandidateDocumentSnapshot,
  type RealBuildCandidateDocumentSnapshot,
} from "../e2e/real-build-candidate-document-snapshot";
import { parseRealBuildCompiledPlacementLineage } from "../e2e/real-build-compiled-placement-lineage";
import { snapshotRealBuildEnumeratedPlacementOffer } from "../e2e/real-build-enumerated-placement-witness";
import { createRealBuildPreparedSearchLedger } from "../e2e/real-build-prepared-search-ledger";
import { encodeRealBuildPreparedRunInput } from "../e2e/real-build-prepared-run-input-parser";
import {
  inspectRealBuildPreparedStepInput,
  type RealBuildPreparedStepInspection,
} from "../e2e/real-build-prepared-step-authority";
import type { Sha256Digest } from "@lego-studio/brick-kernel";

import { stepPanelEvidenceDigest } from "../e2e/real-build-panel-evidence-digest";
import type { RealBuildOptions, RealBuildPanelSpec } from "../e2e/real-build-safety";
import { preparedSearchEmptyParent } from "./real-build-prepared-search.fixture";
import { completeRealBuildTestOptions } from "./real-build-test-options";

const MAXIMUM_FIXTURE_PIECES_PER_STEP = 511;

export interface RealBuildBrowserOutputV4SemanticCompiledStepFixture {
  readonly stepNumber: 1 | 2;
  readonly pieceCount: number;
  readonly preparedStep: RealBuildPreparedStepInspection;
  readonly batchResult: RealBuildAtomicCompiledBranchBatchResult;
  readonly lineageBytes: Uint8Array;
  readonly lineage: RealBuildCompiledPlacementLineageEvidence;
}

export interface RealBuildBrowserOutputV4SemanticTwoStepFixture {
  readonly preparedRunInputBytes: Uint8Array;
  readonly step1: RealBuildBrowserOutputV4SemanticCompiledStepFixture;
  readonly step2: RealBuildBrowserOutputV4SemanticCompiledStepFixture;
  readonly steps: readonly [
    RealBuildBrowserOutputV4SemanticCompiledStepFixture,
    RealBuildBrowserOutputV4SemanticCompiledStepFixture,
  ];
}

function requirePieceCount(value: number, path: string): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAXIMUM_FIXTURE_PIECES_PER_STEP) {
    throw new RangeError(
      `${path} must be a safe integer from 1 through ${MAXIMUM_FIXTURE_PIECES_PER_STEP}.`,
    );
  }
  return value;
}

function directPlacementPanel(
  panel: RealBuildPanelSpec,
  pieces: RealBuildPanelSpec["pieces"],
  evidenceDigest: `sha256:${string}`,
): RealBuildPanelSpec {
  return {
    ...panel,
    action: {
      kind: "place-callouts",
      assembledPieces: pieces.length,
      evidenceDigest,
    },
    pieces,
    omittedPieces: [],
    mappedCalloutKeys: pieces.map(({ calloutKey }) => calloutKey),
    calloutPieces: pieces.length,
    classifiedPhysicalCalloutPieces: pieces.length,
    semanticMultiplierQuantity: 0,
    omittedPhysicalPieces: 0,
  };
}

function preparedTwoStepRunInputBytes(
  step1PieceCount: number,
  step2PieceCount: number,
): Uint8Array {
  const options = completeRealBuildTestOptions(359);
  const bounds = { minXPt: 0, maxXPt: 100, minYPt: 0, maxYPt: 1 } as const;
  const pdfDigest = options.inputDigests.pdf as Sha256Digest;
  const panels = options.panels.map((panel): RealBuildPanelSpec => {
    const calloutBoxes: readonly [] = [];
    const panelEvidenceDigest = stepPanelEvidenceDigest({
      pdfDigest,
      stepNumber: panel.stepNumber,
      pageNumber: panel.pageNumber,
      bounds,
      calloutBoxes,
    });
    return {
      ...panel,
      ...bounds,
      calloutBoxes,
      action:
        panel.action.kind === "transition"
          ? { ...panel.action, panelEvidenceDigest }
          : panel.action,
    };
  });
  const source = panels[357]!;
  if (source.action.kind !== "place-callouts") {
    throw new TypeError("Two-step semantic fixture lost its direct-placement source panel.");
  }
  if (
    source.action.evidenceDigest === null ||
    !/^sha256:[0-9a-f]{64}$/u.test(source.action.evidenceDigest)
  ) {
    throw new TypeError("Two-step semantic fixture source panel lacks a SHA-256 evidence digest.");
  }
  const evidenceDigest = source.action.evidenceDigest as `sha256:${string}`;
  const total = step1PieceCount + step2PieceCount;
  if (total > source.pieces.length) {
    throw new RangeError(
      `Two-step semantic fixture requests ${total} pieces from ${source.pieces.length} available direct rows.`,
    );
  }

  const exactBrickRows = (
    pieces: RealBuildPanelSpec["pieces"],
    stepNumber: 1 | 2,
  ): RealBuildPanelSpec["pieces"] =>
    pieces.map((piece, index) => ({
      ...piece,
      identityKey: `semantic-two-step-${stepNumber}-piece-${index + 1}`,
      catalogPartId: "builtin:brick-1x1",
      colorId: stepNumber === 1 ? "builtin:red" : "builtin:blue",
    }));
  const movedPieces = source.pieces.slice(source.pieces.length - total);
  const step1Pieces = exactBrickRows(movedPieces.slice(0, step1PieceCount), 1);
  const step2Pieces = exactBrickRows(movedPieces.slice(step1PieceCount), 2);
  const retainedPieces = source.pieces.slice(0, source.pieces.length - total);
  panels[0] = directPlacementPanel(panels[0]!, step1Pieces, evidenceDigest);
  panels[1] = directPlacementPanel(panels[1]!, step2Pieces, evidenceDigest);
  panels[357] = directPlacementPanel(source, retainedPieces, evidenceDigest);

  const coverageByCallout: Record<string, RealBuildOptions["coverageByCallout"][string]> = {
    ...options.coverageByCallout,
  };
  for (const [stepNumber, pieces] of [
    [1, step1Pieces],
    [2, step2Pieces],
  ] as const) {
    const pageNumber = panels[stepNumber - 1]!.pageNumber;
    for (const piece of pieces) {
      const claim = coverageByCallout[piece.calloutKey];
      if (claim === undefined) {
        throw new TypeError(
          `Two-step semantic fixture lacks coverage for ${JSON.stringify(piece.calloutKey)}.`,
        );
      }
      coverageByCallout[piece.calloutKey] = { ...claim, pageNumber, stepNumber };
    }
  }

  return encodeRealBuildPreparedRunInput({ ...options, panels, coverageByCallout });
}

function requireExactPreparedRows(
  preparedStep: RealBuildPreparedStepInspection,
  lineage: RealBuildCompiledPlacementLineageEvidence,
): void {
  for (const proposal of lineage.searchRequest.proposals) {
    if (
      proposal.pieces.length !== preparedStep.expectedAtomicPieces.length ||
      proposal.pieces.some((piece, index) => {
        const expected = preparedStep.expectedAtomicPieces[index];
        return (
          expected === undefined ||
          piece.identityKey !== expected.identityKey ||
          piece.catalogPartId !== expected.catalogPartId ||
          piece.colorId !== expected.colorId
        );
      })
    ) {
      throw new TypeError(
        `Compiled semantic fixture step ${preparedStep.stepNumber} does not preserve its exact prepared piece rows.`,
      );
    }
  }
}

function compileStep(input: {
  readonly preparedStep: RealBuildPreparedStepInspection;
  readonly rootDocumentSnapshot: RealBuildCandidateDocumentSnapshot;
  readonly rootIdentities: readonly RealBuildLineageIdentity[];
  readonly positionOffset: number;
}): RealBuildBrowserOutputV4SemanticCompiledStepFixture {
  const stepNumber = input.preparedStep.stepNumber;
  if (stepNumber !== 1 && stepNumber !== 2) {
    throw new RangeError("Two-step semantic fixture compiles only printed steps 1 and 2.");
  }
  const partIds = input.preparedStep.expectedAtomicPieces.map(
    (_, index) => `semantic-two-step-${stepNumber}-part-${index + 1}`,
  );
  const occupiedBaseStuds = new Set(
    input.rootDocumentSnapshot.document.connections.flatMap(({ a, b }) =>
      [a, b].filter(({ portId }) => portId === "stud:0:0").map(({ partId }) => partId),
    ),
  );
  const baseTopPartId = input.rootDocumentSnapshot.document.parts.find(
    ({ id }) => !occupiedBaseStuds.has(id),
  )?.id;
  const offeredCandidates = input.preparedStep.expectedAtomicPieces.map((piece, index) => {
    const targetPartId = index === 0 ? baseTopPartId : partIds[index - 1];
    return snapshotRealBuildEnumeratedPlacementOffer({
      catalogPartId: piece.catalogPartId,
      transform: {
        positionLdu: [0, -(input.positionOffset + index) * 24, 0] as const,
        orientationId: "upright-yaw-0",
      },
      connections:
        targetPartId === undefined
          ? []
          : [
              {
                targetPartId,
                targetPortId: "stud:0:0",
                candidatePortId: "undersideClutch:0:0",
              },
            ],
      restsOnBuildPlate: targetPartId === undefined,
    });
  });
  const enumeratedParents = input.rootIdentities.map((identity) => ({
    parentLineageId: identity.lineageId,
    candidates: [{ partIds, offeredCandidates }],
  }));
  const result = executeRealBuildAtomicCompiledBranchBatch({
    preparedStep: input.preparedStep,
    rootCandidates: [
      {
        documentSnapshot: input.rootDocumentSnapshot,
        identities: input.rootIdentities,
      },
    ],
    enumeratedParents,
    ledger: createRealBuildPreparedSearchLedger(input.rootIdentities.length),
  });
  if (result.status !== "compiled") {
    const reason =
      result.evidence.terminalFailure?.issue.reason ??
      result.evidence.searchReservation.refusal ??
      "unknown refusal";
    throw new Error(`Two-step semantic fixture step ${stepNumber} did not compile: ${reason}.`);
  }

  const lineageBytes = new Uint8Array(
    decodeRealBuildAtomicCompiledBranchEvidenceWire(result.evidenceWire),
  );
  const lineage = parseRealBuildCompiledPlacementLineage(lineageBytes);
  if (lineage.status !== "unresolved") {
    throw new TypeError(
      `Two-step semantic fixture step ${stepNumber} must retain an independently valid unresolved lineage.`,
    );
  }
  requireExactPreparedRows(input.preparedStep, lineage);
  return Object.freeze({
    stepNumber,
    pieceCount: input.preparedStep.expectedAtomicPieces.length,
    preparedStep: input.preparedStep,
    batchResult: result,
    lineageBytes,
    lineage,
  });
}

function requireExactStepAdvance(
  step1: RealBuildBrowserOutputV4SemanticCompiledStepFixture,
  step2: RealBuildBrowserOutputV4SemanticCompiledStepFixture,
): void {
  if (step1.lineage.childCandidates.length !== 1 || step2.lineage.rootCandidates.length !== 1) {
    throw new TypeError("Two-step semantic fixture requires one exact shared child/root document.");
  }
  const child = step1.lineage.childCandidates[0]!;
  const children = step1.lineage.lineageEdges.map(({ child: identity }) => identity);
  const root = step2.lineage.rootCandidates[0]!;
  if (
    root.candidateId !== child.candidateId ||
    root.documentHash !== child.documentHash ||
    root.canonicalBytes !== child.canonicalBytes ||
    root.canonicalBytesHash !== child.canonicalBytesHash ||
    root.canonicalByteLength !== child.canonicalByteLength ||
    JSON.stringify(root.identities) !== JSON.stringify(children)
  ) {
    throw new TypeError(
      "Two-step semantic fixture step-2 roots do not equal step-1 child identities and bytes.",
    );
  }
}

export function realBuildBrowserOutputV4SemanticTwoStepFixture(
  step1PieceCount = 1,
  step2PieceCount = 1,
): RealBuildBrowserOutputV4SemanticTwoStepFixture {
  const firstCount = requirePieceCount(step1PieceCount, "step1PieceCount");
  const secondCount = requirePieceCount(step2PieceCount, "step2PieceCount");
  const preparedRunInputBytes = preparedTwoStepRunInputBytes(firstCount, secondCount);
  const empty = preparedSearchEmptyParent();
  const step1 = compileStep({
    preparedStep: inspectRealBuildPreparedStepInput(preparedRunInputBytes, 1),
    rootDocumentSnapshot: empty.documentSnapshot,
    rootIdentities: [empty.identity],
    positionOffset: 0,
  });
  const child = step1.lineage.childCandidates[0];
  if (child === undefined) {
    throw new TypeError("Two-step semantic fixture step 1 retained no compiled child.");
  }
  const step2 = compileStep({
    preparedStep: inspectRealBuildPreparedStepInput(preparedRunInputBytes, 2),
    rootDocumentSnapshot: createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: child.canonicalBytes,
      expectedDocumentHash: child.documentHash,
    }),
    rootIdentities: step1.lineage.lineageEdges.map(({ child: identity }) => identity),
    positionOffset: firstCount,
  });
  requireExactStepAdvance(step1, step2);
  return Object.freeze({
    preparedRunInputBytes,
    step1,
    step2,
    steps: Object.freeze([step1, step2] as const),
  });
}
