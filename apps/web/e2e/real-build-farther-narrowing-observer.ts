import type { WholeStepPlacementTransform } from "./real-build-deferral";
import type { PanelRasterEvidence } from "./real-build-panel-raster";

type PlacementTransform = WholeStepPlacementTransform;

export interface FartherNarrowingBatchObservation {
  readonly parentCandidateId: string;
  readonly batchIndex: number;
  readonly prefixDocumentHash: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly offeredCount: number;
}

export interface FartherNarrowingScoreComponents {
  readonly schemaVersion: "lego.step-delta-score/1";
  readonly regionIou: number | null;
  readonly strokeRecall: number;
  readonly boundaryPrecision: number;
  readonly strokeF1: number;
  readonly score: number;
  readonly basis: "region" | "stroke";
  readonly candidateAreaPx: number;
  readonly candidateBoundaryPx: number;
  readonly strokePx: number;
}

export interface FartherNarrowingRenderObservation {
  readonly parentCandidateId: string;
  readonly batchIndex: number;
  readonly rowIndex: number;
  readonly prefixDocumentHash: string;
  readonly catalogPartId: string;
  readonly transform: PlacementTransform;
  readonly score: number;
  readonly scoreComponents: FartherNarrowingScoreComponents;
  readonly probeMaskDigest: string;
}

export interface FartherNarrowingBatchOutcomeObservation {
  readonly parentCandidateId: string;
  readonly batchIndex: number;
  readonly prefixDocumentHash: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly offeredCount: number;
  readonly carriedRowIndices: readonly number[];
}

/** Detached observation-only seam; production callers omit it. */
export interface FartherNarrowingObserver {
  readonly beginBatch: (observation: FartherNarrowingBatchObservation) => void;
  readonly render: (observation: FartherNarrowingRenderObservation) => void;
  readonly endBatch: (observation: FartherNarrowingBatchOutcomeObservation) => void;
}

export interface FartherNarrowingObservationBatchToken {
  readonly batchIndex: number;
  readonly prefixDocumentHash: string;
  readonly catalogPartId: string;
  readonly colorId: string;
  readonly offeredCount: number;
}

/**
 * Keeps diagnostic callbacks detached from the live document, renderer, and
 * mask while leaving the ordinary score path byte-for-byte unobserved.
 */
export function createFartherNarrowingObservationCoordinator<D>(input: {
  readonly observer?: FartherNarrowingObserver;
  readonly parentCandidateId: string;
  readonly documentStructuralHash: (document: D) => string;
  readonly sha256Hex: (bytes: Uint8Array) => string;
}) {
  let nextBatchIndex = 0;
  return Object.freeze({
    beginBatch: (
      document: D,
      catalogPartId: string,
      colorId: string,
      offeredCount: number,
    ): FartherNarrowingObservationBatchToken | null => {
      if (input.observer === undefined) return null;
      const token = Object.freeze({
        batchIndex: nextBatchIndex,
        prefixDocumentHash: input.documentStructuralHash(document),
        catalogPartId,
        colorId,
        offeredCount,
      });
      nextBatchIndex += 1;
      input.observer.beginBatch(
        Object.freeze({
          parentCandidateId: input.parentCandidateId,
          ...token,
        }),
      );
      return token;
    },
    score: (scoreInput: {
      readonly token: FartherNarrowingObservationBatchToken | null;
      readonly rowIndex: number;
      readonly transform: PlacementTransform;
      readonly mask: Uint8Array;
      readonly highlight: PanelRasterEvidence["highlight"];
      readonly scoreStepDelta: (
        mask: Uint8Array,
        highlight: PanelRasterEvidence["highlight"],
      ) => FartherNarrowingScoreComponents;
      readonly rankStepDelta: (score: FartherNarrowingScoreComponents) => number;
    }): number => {
      const scoreComponents = scoreInput.scoreStepDelta(scoreInput.mask, scoreInput.highlight);
      const score = scoreInput.rankStepDelta(scoreComponents);
      if (input.observer !== undefined && scoreInput.token !== null) {
        input.observer.render(
          Object.freeze({
            parentCandidateId: input.parentCandidateId,
            batchIndex: scoreInput.token.batchIndex,
            rowIndex: scoreInput.rowIndex,
            prefixDocumentHash: scoreInput.token.prefixDocumentHash,
            catalogPartId: scoreInput.token.catalogPartId,
            transform: Object.freeze({
              positionLdu: Object.freeze([
                scoreInput.transform.positionLdu[0],
                scoreInput.transform.positionLdu[1],
                scoreInput.transform.positionLdu[2],
              ]) as readonly [number, number, number],
              orientationId: scoreInput.transform.orientationId,
            }),
            score,
            scoreComponents: Object.freeze({ ...scoreComponents }),
            probeMaskDigest: `sha256:${input.sha256Hex(scoreInput.mask)}`,
          }),
        );
      }
      return score;
    },
    endBatch: (
      token: FartherNarrowingObservationBatchToken | null,
      offered: readonly PlacementTransform[],
      carried: readonly PlacementTransform[],
    ): void => {
      if (input.observer === undefined || token === null) return;
      const carriedRowIndices = carried.map((candidate) => offered.indexOf(candidate));
      if (
        carriedRowIndices.some((rowIndex) => rowIndex < 0) ||
        new Set(carriedRowIndices).size !== carriedRowIndices.length
      ) {
        throw new TypeError(
          `Narrowing batch ${token.batchIndex} returned a carried placement outside its exact offered rows.`,
        );
      }
      input.observer.endBatch(
        Object.freeze({
          parentCandidateId: input.parentCandidateId,
          ...token,
          carriedRowIndices: Object.freeze(carriedRowIndices),
        }),
      );
    },
  });
}
