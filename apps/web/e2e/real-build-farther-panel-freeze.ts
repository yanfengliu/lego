import type { FartherLineageStep } from "./real-build-farther-panel-types";

export const freezeArray = <T>(values: readonly T[]): readonly T[] => Object.freeze([...values]);

export const freezeLineageStep = (step: FartherLineageStep): FartherLineageStep =>
  Object.freeze({
    ...step,
    pieces: freezeArray(
      step.pieces.map((piece) =>
        Object.freeze({
          ...piece,
          transform: Object.freeze({
            ...piece.transform,
            positionLdu: freezeArray(piece.transform.positionLdu) as readonly [
              number,
              number,
              number,
            ],
          }),
        }),
      ),
    ),
  });
