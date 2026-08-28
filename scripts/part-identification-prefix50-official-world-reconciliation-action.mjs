export function prefix50ActionOccurrenceMap(action) {
  const rows = new Map();
  for (const step of action.steps) {
    for (const phase of step.phases) {
      if (phase.kind !== "direct" && phase.kind !== "multi-build-copy") {
        throw new TypeError(`Action phase ${phase.sequence} has unsupported kind ${phase.kind}.`);
      }
      for (const member of phase.members) {
        const row = Object.freeze({
          stepNumber: step.stepNumber,
          phaseSequence: phase.sequence,
          sourceBuilderIdentityOrdinal: member.sourceBuilderIdentityOrdinal,
          actionKind: phase.kind,
          builderBrickRef: member.builderBrickRef,
          sourceBuilderBrickRef:
            phase.kind === "multi-build-copy" ? member.sourceBuilderBrickRef : null,
          masterSubBuildRef: phase.kind === "multi-build-copy" ? phase.masterSubBuildRef : null,
        });
        if (
          rows.has(row.sourceBuilderIdentityOrdinal) ||
          (row.actionKind === "multi-build-copy" &&
            (typeof row.sourceBuilderBrickRef !== "string" ||
              typeof row.masterSubBuildRef !== "string" ||
              row.sourceBuilderBrickRef === row.builderBrickRef))
        ) {
          throw new TypeError(
            `Action occurrence ${row.sourceBuilderIdentityOrdinal} has invalid direct/MultiBuild provenance.`,
          );
        }
        rows.set(row.sourceBuilderIdentityOrdinal, row);
      }
    }
  }
  const copies = [...rows.values()].filter(({ actionKind }) => actionKind === "multi-build-copy");
  if (rows.size !== 320 || copies.length !== 11) {
    throw new TypeError(
      `Action occurrence authority requires 320 unique rows and eleven MultiBuild copies; received ${rows.size}/${copies.length}.`,
    );
  }
  return rows;
}
