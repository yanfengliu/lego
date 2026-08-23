import {
  applyBuildOperations,
  documentStructuralHash,
  migrateDocumentTruth,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { enumeratePlacements, placementOccupancyKey } from "../src/assembly";
import { createPlacePartTransaction } from "../src/manual-commands";
import {
  createNarrowingRenderBudgetLedger,
  createWholeStepCandidateBudgetLedger,
  enumerateWholeStepCandidates,
  placementsOwnPanelCannotSeparate,
  type WholeStepPlacementTransform,
} from "./real-build-deferral";
import { createCanonicalPrintedStepPlacer } from "./real-build-fixed-actions";
import type { FartherPlacementWitness } from "./real-build-farther-panel-types";
import { groupPlacementOperationsInPrintedStep } from "./real-build-safety";
import { reconstructStep7Gate3Parents } from "./real-build-step7-gate3-parent-reconstruction";
import type {
  Step7Gate3BrowserResult,
  Step7Gate3Origin,
  Step7Gate3Panel,
} from "./real-build-step7-gate3-diagnostic-browser";

const createPlace = (
  applyOperations: (base: BrickDocumentV1, operations: readonly unknown[]) => BrickDocumentV1,
) =>
  createCanonicalPrintedStepPlacer<BrickDocumentV1>({
    createTransaction: (base, piece) =>
      createPlacePartTransaction(base, piece as Parameters<typeof createPlacePartTransaction>[1]),
    groupOperations: (operations, step) =>
      groupPlacementOperationsInPrintedStep(
        operations as Parameters<typeof groupPlacementOperationsInPrintedStep>[0],
        step,
      ),
    applyOperations,
  });

const placeCurrent = createPlace((base, operations) =>
  applyBuildOperations(base, operations as Parameters<typeof applyBuildOperations>[1]),
);

const placePrintedWitnesses = (
  base: BrickDocumentV1,
  witnesses: readonly FartherPlacementWitness[],
  printedStepNumber: number,
  place: typeof placeCurrent,
): BrickDocumentV1 => {
  let document = structuredClone(base);
  let stepId: string | null = null;
  for (const witness of witnesses) {
    const placed = place(
      document,
      witness.catalogPartId,
      witness.transform,
      witness.colorId,
      printedStepNumber,
      stepId,
    );
    document = placed.document;
    stepId = placed.stepId;
  }
  return document;
};

const exactJson = (left: unknown, right: unknown): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

const snapshotWitnesses = (
  pieces: readonly Pick<Step7Gate3Panel["pieces"][number], "catalogPartId" | "colorId">[],
  transforms: readonly WholeStepPlacementTransform[],
): readonly FartherPlacementWitness[] =>
  Object.freeze(
    pieces.map((piece, index) => {
      const transform = transforms[index];
      if (transform === undefined) {
        throw new TypeError(`Node selection replay has no transform for piece ${index}.`);
      }
      return Object.freeze({
        catalogPartId: piece.catalogPartId,
        colorId: piece.colorId,
        transform: Object.freeze({
          positionLdu: Object.freeze([
            transform.positionLdu[0],
            transform.positionLdu[1],
            transform.positionLdu[2],
          ]) as readonly [number, number, number],
          orientationId: transform.orientationId,
        }),
      });
    }),
  );

export function replayStep7Gate3InNode(input: {
  readonly baseDocument: BrickDocumentV1;
  readonly origins: readonly Step7Gate3Origin[];
  readonly pieces: readonly Pick<Step7Gate3Panel["pieces"][number], "catalogPartId" | "colorId">[];
  readonly minimumScoreMargin: number;
  readonly browser: Step7Gate3BrowserResult;
}) {
  const reconstructed = reconstructStep7Gate3ParentsInNode({
    baseDocument: input.baseDocument,
    origins: input.origins,
  }).parents;
  if (
    input.pieces.length !== 4 ||
    !Number.isFinite(input.minimumScoreMargin) ||
    input.minimumScoreMargin < 0 ||
    input.browser.parents.length !== reconstructed.length ||
    input.browser.parentMigrations.length !== reconstructed.length ||
    !exactJson(
      input.browser.orderedSourceParentIds,
      reconstructed.map(({ origin }) => origin.candidateId),
    )
  ) {
    throw new TypeError("Node selection replay did not receive the exact four-parent workload.");
  }
  const narrowingLedger = createNarrowingRenderBudgetLedger(input.browser.diagnosticNarrowingLimit);
  const candidateLedger = createWholeStepCandidateBudgetLedger(input.browser.candidateLimit);
  let batchesVerified = 0;
  const parents = reconstructed.map((parent, index) => {
    const origin = parent.origin;
    const sourceDocumentHash = parent.sourceDocumentHash;
    const currentDocumentHash = parent.documentHash;
    const browserParent = input.browser.parents[index];
    const browserMigration = input.browser.parentMigrations[index];
    if (
      browserParent === undefined ||
      browserMigration === undefined ||
      browserMigration.sourceParentCandidateId !== origin.candidateId ||
      browserMigration.sourceDocumentHash !== sourceDocumentHash ||
      browserMigration.currentDocumentHash !== currentDocumentHash ||
      !browserMigration.sourceHashVerified ||
      !browserMigration.partsPreserved ||
      browserMigration.parentCandidateId !== `step-006:${currentDocumentHash}` ||
      browserParent.sourceParentCandidateId !== origin.candidateId ||
      browserParent.sourceDocumentHash !== sourceDocumentHash ||
      browserParent.parentCandidateId !== `step-006:${currentDocumentHash}` ||
      browserParent.reconstructedDocumentHash !== currentDocumentHash ||
      browserParent.hashAfterRasterPreparation !== currentDocumentHash ||
      browserParent.hashAfterExpansion !== currentDocumentHash
    ) {
      throw new TypeError(
        `Node/browser parent migration ${origin.candidateId} did not match exactly.`,
      );
    }
    const parentBatches = input.browser.batches.filter(
      ({ parentCandidateId }) => parentCandidateId === browserParent.parentCandidateId,
    );
    const parentOutcomes = input.browser.batchOutcomes.filter(
      ({ parentCandidateId }) => parentCandidateId === browserParent.parentCandidateId,
    );
    const parentRows = input.browser.renders.filter(
      ({ parentCandidateId }) => parentCandidateId === browserParent.parentCandidateId,
    );
    let nextBatchIndex = 0;
    const candidateReservedBefore = candidateLedger.reserved;
    const enumeration = enumerateWholeStepCandidates<BrickDocumentV1>({
      baseDocument: parent.document,
      stepId: null,
      pieces: input.pieces,
      enumerateDistinct: (document, catalogPartId) => {
        const offered = enumeratePlacements(document, catalogPartId, {
          includeBuildPlate: document.parts.length === 0,
        }).candidates;
        const distinct = new Map<string, WholeStepPlacementTransform>();
        for (const candidate of offered) {
          const key = placementOccupancyKey(candidate.catalogPartId, candidate.transform);
          if (!distinct.has(key)) distinct.set(key, candidate.transform);
        }
        return [...distinct.values()];
      },
      narrow: ({ document, catalogPartId, colorId, offered }) => {
        const batch = parentBatches[nextBatchIndex];
        const outcome = parentOutcomes[nextBatchIndex];
        const prefixDocumentHash = documentStructuralHash(document);
        if (
          batch === undefined ||
          outcome === undefined ||
          batch.batchIndex !== nextBatchIndex ||
          outcome.batchIndex !== nextBatchIndex ||
          batch.parentCandidateId !== browserParent.parentCandidateId ||
          batch.prefixDocumentHash !== prefixDocumentHash ||
          batch.catalogPartId !== catalogPartId ||
          batch.colorId !== colorId ||
          batch.offeredCount !== offered.length ||
          outcome.parentCandidateId !== batch.parentCandidateId ||
          outcome.prefixDocumentHash !== batch.prefixDocumentHash ||
          outcome.catalogPartId !== batch.catalogPartId ||
          outcome.colorId !== batch.colorId ||
          outcome.offeredCount !== batch.offeredCount
        ) {
          throw new TypeError(
            `Node selection replay batch ${nextBatchIndex} for ${browserParent.parentCandidateId} did not bind its exact prefix and offer.`,
          );
        }
        const rows = parentRows.filter(({ batchIndex }) => batchIndex === nextBatchIndex);
        if (
          rows.length !== offered.length ||
          rows.some(
            (row, rowIndex) =>
              row.rowIndex !== rowIndex ||
              row.prefixDocumentHash !== prefixDocumentHash ||
              row.catalogPartId !== catalogPartId ||
              !Number.isFinite(row.score) ||
              (row.scoreComponents.basis !== "stroke" && row.scoreComponents.basis !== "region") ||
              row.score !==
                (row.scoreComponents.basis === "stroke"
                  ? row.scoreComponents.strokeRecall
                  : row.scoreComponents.score) ||
              !exactJson(row.transform, offered[rowIndex]),
          )
        ) {
          throw new TypeError(
            `Node selection replay batch ${nextBatchIndex} rows do not equal the exact enumerator order.`,
          );
        }
        if (
          new Set(outcome.carriedRowIndices).size !== outcome.carriedRowIndices.length ||
          outcome.carriedRowIndices.some(
            (rowIndex) =>
              !Number.isSafeInteger(rowIndex) || rowIndex < 0 || rowIndex >= offered.length,
          )
        ) {
          throw new TypeError(
            `Node selection replay batch ${nextBatchIndex} has invalid carried row indices.`,
          );
        }
        const derivedCarriedRowIndices = placementsOwnPanelCannotSeparate({
          scored: rows.map((row, rowIndex) => ({ candidate: rowIndex, score: row.score })),
          minimumMargin: input.minimumScoreMargin,
        });
        if (!exactJson(derivedCarriedRowIndices, outcome.carriedRowIndices)) {
          throw new TypeError(
            `Node selection replay batch ${nextBatchIndex} carried rows do not follow the exact score-margin policy.`,
          );
        }
        nextBatchIndex += 1;
        batchesVerified += 1;
        return outcome.carriedRowIndices.map((rowIndex) => offered[rowIndex]!);
      },
      narrowingRenderBudget: input.browser.diagnosticNarrowingLimit,
      narrowingRenderBudgetLedger: narrowingLedger,
      candidateBudgetLedger: candidateLedger,
      placementKey: placementOccupancyKey,
      place: (document, catalogPartId, transform, colorId, stepId) =>
        placeCurrent(document, catalogPartId, transform, colorId, 7, stepId),
      budget: input.browser.candidateLimit,
    });
    if (
      enumeration.overBudget ||
      enumeration.overNarrowingBudget ||
      nextBatchIndex !== parentBatches.length ||
      parentOutcomes.length !== parentBatches.length ||
      parentRows.length !== parentBatches.reduce((total, batch) => total + batch.offeredCount, 0) ||
      enumeration.narrowingRenders !== browserParent.narrowingRenders ||
      !exactJson(enumeration.perPiece, browserParent.offeredPerPiece) ||
      !exactJson(enumeration.perPieceCarried, browserParent.carriedPerPiece) ||
      candidateLedger.reserved - candidateReservedBefore !== browserParent.candidateLedgerDelta
    ) {
      throw new TypeError(
        `Node selection replay did not consume the complete observation DAG for ${browserParent.parentCandidateId}.`,
      );
    }
    const children = enumeration.candidates.map((candidate, childIndex) => {
      const documentHash = documentStructuralHash(candidate.document);
      const child = Object.freeze({
        candidateId: `step-007:${documentHash}`,
        documentHash,
        pieces: snapshotWitnesses(input.pieces, candidate.transforms),
      });
      const browserChild = browserParent.completeLeaves[childIndex];
      if (browserChild === undefined || !exactJson(child, browserChild)) {
        throw new TypeError(
          `Node selection replay child ${childIndex} for ${browserParent.parentCandidateId} did not equal the browser leaf.`,
        );
      }
      return child;
    });
    if (children.length !== browserParent.completeLeaves.length) {
      throw new TypeError(
        `Node selection replay derived ${children.length} leaves for ${browserParent.parentCandidateId}; browser reported ${browserParent.completeLeaves.length}.`,
      );
    }
    return Object.freeze({
      sourceParentCandidateId: origin.candidateId,
      sourceDocumentHash,
      parentCandidateId: browserParent.parentCandidateId,
      currentDocumentHash,
      children: Object.freeze(children),
    });
  });
  if (
    narrowingLedger.refusedReservation ||
    candidateLedger.refusedReservation ||
    narrowingLedger.reserved !== input.browser.sharedRenderDemand ||
    candidateLedger.reserved !== input.browser.candidateDemand ||
    batchesVerified !== input.browser.batches.length
  ) {
    throw new TypeError("Node selection replay ledger totals did not equal the browser workload.");
  }
  return Object.freeze({
    schemaVersion: "lego.step7-gate3-node-replay/2" as const,
    parents: Object.freeze(parents),
    sourceParentsVerified: parents.length === 4,
    selectionReplayVerified: true as const,
    batchesVerified,
    childrenVerified: parents.reduce((total, parent) => total + parent.children.length, 0),
  });
}

export function reconstructStep7Gate3ParentsInNode(input: {
  readonly baseDocument: BrickDocumentV1;
  readonly origins: readonly Step7Gate3Origin[];
}) {
  return reconstructStep7Gate3Parents(input);
}

export function reconstructStep7Gate3ParentsMigrateFirstForNegativeControl(input: {
  readonly baseDocument: BrickDocumentV1;
  readonly origins: readonly Step7Gate3Origin[];
}): readonly string[] {
  const migratedBase = migrateDocumentTruth(structuredClone(input.baseDocument));
  if (!migratedBase.report.migrated) {
    throw new TypeError("Migrate-first negative control did not begin with a /13 base.");
  }
  return Object.freeze(
    input.origins.map((origin) =>
      documentStructuralHash(
        placePrintedWitnesses(migratedBase.document, origin.pieces, 6, placeCurrent),
      ),
    ),
  );
}
