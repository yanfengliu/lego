import type { DeferredUnresolvedCandidate } from "./real-build-deferred-step";
import type { RealBuildPieceReport } from "./real-build-safety";

/** Rewrites the original deferred refusal rows after a farther panel settles N. */
export function settleFartherOriginPieceReports<D>(
  reports: readonly RealBuildPieceReport[],
  selected: DeferredUnresolvedCandidate<D>,
): readonly RealBuildPieceReport[] {
  if (reports.length !== selected.pieces.length) {
    throw new RangeError(
      `Farther-selected origin ${JSON.stringify(selected.candidateId)} binds ${selected.pieces.length} ` +
        `placement witnesses for ${reports.length} deferred piece reports; required exactly one each.`,
    );
  }
  return reports.map((report, pieceIndex) => {
    const witness = selected.pieces[pieceIndex]!;
    if (report.catalogPartId !== witness.catalogPartId) {
      throw new TypeError(
        `Farther-selected origin ${JSON.stringify(selected.candidateId)} piece ${pieceIndex} is ` +
          `${JSON.stringify(witness.catalogPartId)}; deferred report requires ${JSON.stringify(report.catalogPartId)}.`,
      );
    }
    return Object.freeze({
      ...report,
      blind: Object.freeze({ ...report.blind, refusal: null }),
      placed: true,
      positionLdu: witness.transform.positionLdu,
      orientationId: witness.transform.orientationId,
      failure: null,
    });
  });
}
