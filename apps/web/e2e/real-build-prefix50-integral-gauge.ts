import type { RigidTransform } from "@lego-studio/protocol";

import type { RealBuildPrefix50VerifiedProjection } from "./real-build-prefix50-projection";

function halfLduClass(positionLdu: RigidTransform["positionLdu"]): readonly number[] {
  return positionLdu.map((coordinate) => Math.abs(coordinate * 2) % 2);
}

/**
 * A proper orientation only permutes and signs axes, so it cannot change
 * whether two half-LDU points differ by an integral vector. A single
 * translation can put every source point on the protocol-v1 integer lattice
 * iff every source point has the same half-LDU class.
 */
export function requireIntegralProtocolGaugeCompatibility(
  projection: RealBuildPrefix50VerifiedProjection,
): void {
  const reference = projection.occurrences[0]!;
  const referenceClass = halfLduClass(reference.sourceWorldTransform.positionLdu);
  const incompatible = projection.occurrences.filter((occurrence) => {
    const occurrenceClass = halfLduClass(occurrence.sourceWorldTransform.positionLdu);
    return occurrenceClass.some((value, index) => value !== referenceClass[index]);
  });
  if (incompatible.length === 0) return;
  const rows = incompatible
    .slice(0, 12)
    .map(
      ({ ordinal, printedStepNumber, sourceWorldTransform }) =>
        `${ordinal}@step-${printedStepNumber}=[${sourceWorldTransform.positionLdu.join(",")}]`,
    )
    .join("; ");
  const remainder =
    incompatible.length > 12 ? `; plus ${incompatible.length - 12} more occurrence(s)` : "";
  throw new TypeError(
    `Prefix-50 verified source world cannot be embedded exactly in BrickDocumentV1's integral LDU lattice by any single proper rigid gauge: occurrence ${reference.ordinal} and ${incompatible.length} incompatible occurrence(s) have different half-LDU classes (${rows}${remainder}). Rounding is forbidden because it would change verified relative geometry; preserve the source transforms and introduce a versioned half-LDU protocol boundary or an explicit occurrence-scoped project-authored placement repair that retains the source counterevidence.`,
  );
}
