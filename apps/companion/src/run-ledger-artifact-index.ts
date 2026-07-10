import type { ArtifactRefV1 } from "@lego-studio/protocol";

import type { MutableRunLedgerState } from "./run-ledger-state.ts";
import { RunLedgerError, type RunLedgerLimits } from "./run-ledger-types.ts";

export function assertEventArtifactLimits(
  references: readonly ArtifactRefV1[],
  limits: RunLedgerLimits,
): void {
  const bytes = references.reduce((sum, reference) => sum + reference.byteLength, 0);
  if (
    references.length > limits.maxArtifactRefsPerEvent ||
    !Number.isSafeInteger(bytes) ||
    bytes > limits.maxReferencedBytesPerEvent
  ) {
    throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Event artifact budget exceeded");
  }
}

function referencesEqual(left: ArtifactRefV1, right: ArtifactRefV1): boolean {
  return (
    left.artifactId === right.artifactId &&
    left.kind === right.kind &&
    left.mediaType === right.mediaType &&
    left.sha256 === right.sha256 &&
    left.byteLength === right.byteLength &&
    left.casKey === right.casKey
  );
}

export function assertRunArtifactAdmission(
  state: MutableRunLedgerState,
  references: readonly ArtifactRefV1[],
  limits: RunLedgerLimits,
): void {
  assertEventArtifactLimits(references, limits);
  let newIds = 0;
  let newBytes = 0;
  const newContent = new Set<string>();
  for (const reference of references) {
    const existing = state.artifactRefsById.get(reference.artifactId);
    if (existing && !referencesEqual(existing, reference)) {
      throw new RunLedgerError(
        "INVALID_RECORD",
        `Artifact ID is already bound to another reference: ${reference.artifactId}`,
      );
    }
    if (!existing) newIds += 1;
    if (!state.artifactRefsByCas.has(reference.casKey) && !newContent.has(reference.casKey)) {
      newContent.add(reference.casKey);
      newBytes += reference.byteLength;
    }
  }
  if (state.artifactRefsById.size + newIds > limits.maxArtifactRefsPerRun) {
    throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Run artifact-reference limit reached");
  }
  if (
    !Number.isSafeInteger(state.referencedArtifactBytes + newBytes) ||
    state.referencedArtifactBytes + newBytes > limits.maxReferencedBytesPerRun
  ) {
    throw new RunLedgerError("LEDGER_LIMIT_EXCEEDED", "Run artifact byte budget exceeded");
  }
}

export function indexRunArtifactRefs(
  state: MutableRunLedgerState,
  references: readonly ArtifactRefV1[],
  limits: RunLedgerLimits,
): void {
  assertRunArtifactAdmission(state, references, limits);
  for (const reference of references) {
    state.artifactRefsById.set(reference.artifactId, reference);
    if (!state.artifactRefsByCas.has(reference.casKey)) {
      state.artifactRefsByCas.set(reference.casKey, reference);
      state.referencedArtifactBytes += reference.byteLength;
    }
  }
}

export function recoveredArtifactRefs(state: MutableRunLedgerState): readonly ArtifactRefV1[] {
  return [...state.artifactRefsByCas.values()];
}
