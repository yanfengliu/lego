import type { RealBuildFartherEvidence } from "./real-build-farther-report-types";

interface DecisionPieceRow {
  readonly catalogPartId: string;
  readonly placed: boolean;
  readonly positionLdu: readonly [number, number, number] | null;
  readonly orientationId: string | null;
  readonly failure: unknown | null;
}

interface PreparedPiece {
  readonly catalogPartId: string;
  readonly colorId: string;
}

/** Rebinds a successful farther decision to the exact piece rows it settled. */
export function isRealBuildFartherDecisionPieceCoherent(input: {
  readonly farther: RealBuildFartherEvidence;
  readonly reportPieces: readonly DecisionPieceRow[];
  readonly preparedPieces: readonly PreparedPiece[];
}): boolean {
  if (input.farther.decision === null) return true;
  const selected = input.farther.origin.candidates.find(
    ({ candidateId }) => candidateId === input.farther.decision!.originCandidateId,
  );
  if (
    selected === undefined ||
    selected.pieces.length !== input.preparedPieces.length ||
    input.reportPieces.length < input.preparedPieces.length ||
    selected.pieces.length !== input.preparedPieces.length ||
    selected.pieces.some(
      (witness, index) =>
        witness.catalogPartId !== input.preparedPieces[index]!.catalogPartId ||
        witness.colorId !== input.preparedPieces[index]!.colorId,
    )
  ) {
    return false;
  }
  return input.reportPieces.slice(0, input.preparedPieces.length).every((report, index) => {
    const witness = selected.pieces[index]!;
    return (
      report.catalogPartId === witness.catalogPartId &&
      report.placed === true &&
      report.failure === null &&
      report.orientationId === witness.transform.orientationId &&
      JSON.stringify(report.positionLdu) === JSON.stringify(witness.transform.positionLdu)
    );
  });
}
