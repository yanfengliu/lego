import { requireRealBuildCandidateDocumentSnapshot } from "./real-build-candidate-document-snapshot";
import type {
  FartherLineageStep,
  FartherPlacementWitness,
  LineagedFartherNode,
} from "./real-build-farther-panel-types";

export const freezeArray = <T>(values: readonly T[]): readonly T[] => Object.freeze([...values]);

export const freezeLineageStep = (step: FartherLineageStep): FartherLineageStep =>
  Object.freeze({
    ...step,
    pieces: freezeFartherPlacementWitnesses(step.pieces),
  });

export const freezeFartherPlacementWitnesses = (
  pieces: readonly FartherPlacementWitness[],
): readonly FartherPlacementWitness[] =>
  freezeArray(
    pieces.map((piece) =>
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
  );

/** Freezes detached node structure without cloning its module-branded immutable snapshot. */
export const freezeLineagedFartherNode = (node: LineagedFartherNode): LineagedFartherNode => {
  const documentSnapshot = requireRealBuildCandidateDocumentSnapshot(
    node.documentSnapshot,
    node.identity,
  );
  return Object.freeze({
    identity: node.identity,
    documentSnapshot,
    pieces: node.pieces === null ? null : freezeFartherPlacementWitnesses(node.pieces),
  });
};
