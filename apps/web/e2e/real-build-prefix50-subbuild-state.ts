import {
  canonicalDigest,
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

const CROSS_COMPONENT_COLLISION_CODES = new Set([
  "PART_BODY_COLLISION",
  "PART_STUD_BODY_COLLISION",
  "PART_STUD_COLLISION",
]);

export interface RealBuildPrefix50DetachedSubBuildState {
  readonly schemaVersion: "lego.real-build-prefix50-detached-subbuild-state/2";
  readonly authority: "none";
  readonly completedPrintedStep: number;
  readonly parentPartCount: number;
  readonly childPartCount: number;
  readonly combinedDocumentHash: `sha256:${string}`;
  readonly parentDocumentHash: `sha256:${string}`;
  readonly childDocumentHash: `sha256:${string}`;
  readonly childPartIds: readonly string[];
  readonly combinedBlockingCodes: readonly string[];
  readonly crossComponentCollisionFindings: readonly {
    readonly code: string;
    readonly partIds: readonly [string, string];
  }[];
  readonly commitment: `sha256:${string}`;
  readonly parentDocument: BrickDocumentV1;
  readonly childDocument: BrickDocumentV1;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactPartIdSet(
  document: BrickDocumentV1,
  unsafeChildPartIds: readonly string[],
): ReadonlySet<string> {
  if (
    !Array.isArray(unsafeChildPartIds) ||
    unsafeChildPartIds.length < 2 ||
    unsafeChildPartIds.length >= document.parts.length ||
    new Set(unsafeChildPartIds).size !== unsafeChildPartIds.length
  ) {
    throw new TypeError(
      "Detached prefix-50 child membership must be a unique nonempty proper subset with at least two parts.",
    );
  }
  const available = new Set(document.parts.map(({ id }) => id));
  for (const partId of unsafeChildPartIds) {
    if (typeof partId !== "string" || !available.has(partId)) {
      throw new TypeError(
        `Detached prefix-50 child membership names absent part ${JSON.stringify(partId)}.`,
      );
    }
  }
  return new Set(unsafeChildPartIds);
}

function restrictDocument(
  document: BrickDocumentV1,
  includedPartIds: ReadonlySet<string>,
): BrickDocumentV1 {
  const restrict = <T extends { readonly partIds: readonly string[] }>(entry: T): T => ({
    ...entry,
    partIds: entry.partIds.filter((partId) => includedPartIds.has(partId)),
  });
  return deepFreeze({
    ...document,
    parts: document.parts.filter(({ id }) => includedPartIds.has(id)),
    connections: document.connections.filter(
      ({ a, b }) => includedPartIds.has(a.partId) && includedPartIds.has(b.partId),
    ),
    submodels: document.submodels.map(restrict),
    steps: document.steps.map(restrict),
    semanticRegions: document.semanticRegions.map(restrict),
  });
}

function connectedPartIds(document: BrickDocumentV1): ReadonlySet<string> {
  const first = document.parts[0];
  if (first === undefined) return new Set();
  const adjacent = new Map(document.parts.map(({ id }) => [id, new Set<string>()]));
  for (const { a, b } of document.connections) {
    adjacent.get(a.partId)?.add(b.partId);
    adjacent.get(b.partId)?.add(a.partId);
  }
  const visited = new Set([first.id]);
  const pending = [first.id];
  while (pending.length > 0) {
    const partId = pending.pop()!;
    for (const neighbor of adjacent.get(partId) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      pending.push(neighbor);
    }
  }
  return visited;
}

function blockingCodes(document: BrickDocumentV1): readonly string[] {
  return [
    ...new Set(
      validateBrickDocument(document)
        .issues.filter(({ severity }) => severity === "blocking")
        .map(({ code }) => code),
    ),
  ].sort(compareStrings);
}

/**
 * Splits an authenticated detached-subbuild draft into two enumeration worlds.
 * The returned child view is authority-free and cannot be mistaken for a user
 * document or an acceptance patch.
 */
export function isolateRealBuildPrefix50DetachedSubBuild(input: {
  readonly document: BrickDocumentV1;
  readonly childPartIds: readonly string[];
  readonly completedPrintedStep: number;
}): RealBuildPrefix50DetachedSubBuildState {
  if (
    !Number.isSafeInteger(input.completedPrintedStep) ||
    input.completedPrintedStep < 38 ||
    input.completedPrintedStep > 43
  ) {
    throw new TypeError(
      "Detached prefix-50 child isolation is reserved for completed printed steps 38 through 43.",
    );
  }
  const childIds = exactPartIdSet(input.document, input.childPartIds);
  const parentIds = new Set(
    input.document.parts.filter(({ id }) => !childIds.has(id)).map(({ id }) => id),
  );
  const crossConnections = input.document.connections.filter(
    ({ a, b }) => childIds.has(a.partId) !== childIds.has(b.partId),
  );
  if (crossConnections.length !== 0) {
    throw new TypeError(
      `Detached prefix-50 child isolation found ${crossConnections.length} premature parent-child connection(s).`,
    );
  }
  const parentDocument = restrictDocument(input.document, parentIds);
  const childDocument = restrictDocument(input.document, childIds);
  const combinedBlockingIssues = validateBrickDocument(input.document).issues.filter(
    ({ severity }) => severity === "blocking",
  );
  const combinedCodes = [...new Set(combinedBlockingIssues.map(({ code }) => code))].sort(
    compareStrings,
  );
  const parentCodes = blockingCodes(parentDocument);
  const childCodes = blockingCodes(childDocument);
  const crossComponentCollisionFindings = combinedBlockingIssues
    .filter(({ code }) => CROSS_COMPONENT_COLLISION_CODES.has(code))
    .map(({ code, partIds }) => ({
      code,
      partIds: [...partIds].sort(compareStrings),
    }));
  const combinedIssuesAreOnlyDetachedSeparation = combinedBlockingIssues.every(
    ({ code, partIds }) =>
      code === "DISCONNECTED_ASSEMBLY" ||
      (CROSS_COMPONENT_COLLISION_CODES.has(code) &&
        partIds.length === 2 &&
        childIds.has(partIds[0]!) !== childIds.has(partIds[1]!)),
  );
  if (
    !combinedCodes.includes("DISCONNECTED_ASSEMBLY") ||
    !combinedIssuesAreOnlyDetachedSeparation ||
    parentCodes.length !== 0 ||
    childCodes.length !== 0 ||
    connectedPartIds(parentDocument).size !== parentDocument.parts.length ||
    connectedPartIds(childDocument).size !== childDocument.parts.length
  ) {
    throw new TypeError(
      `Detached prefix-50 child isolation requires exactly two internally hard-valid connected components; combined/parent/child blockers=${combinedCodes.join("+") || "none"}/${parentCodes.join("+") || "none"}/${childCodes.join("+") || "none"}.`,
    );
  }
  const childPartIds = deepFreeze([...childIds].sort(compareStrings));
  const frozenCombinedBlockingCodes = deepFreeze(combinedCodes);
  const frozenCrossComponentCollisionFindings = deepFreeze(
    crossComponentCollisionFindings.map(({ code, partIds }) => ({
      code,
      partIds: partIds as unknown as readonly [string, string],
    })),
  );
  const value = {
    schemaVersion: "lego.real-build-prefix50-detached-subbuild-state/2" as const,
    authority: "none" as const,
    completedPrintedStep: input.completedPrintedStep,
    parentPartCount: parentDocument.parts.length,
    childPartCount: childDocument.parts.length,
    combinedDocumentHash: documentStructuralHash(input.document),
    parentDocumentHash: documentStructuralHash(parentDocument),
    childDocumentHash: documentStructuralHash(childDocument),
    childPartIds,
    combinedBlockingCodes: frozenCombinedBlockingCodes,
    crossComponentCollisionFindings: frozenCrossComponentCollisionFindings,
    parentDocument,
    childDocument,
  };
  return deepFreeze({
    ...value,
    commitment: canonicalDigest({
      schemaVersion: value.schemaVersion,
      authority: value.authority,
      completedPrintedStep: value.completedPrintedStep,
      parentPartCount: value.parentPartCount,
      childPartCount: value.childPartCount,
      combinedDocumentHash: value.combinedDocumentHash,
      parentDocumentHash: value.parentDocumentHash,
      childDocumentHash: value.childDocumentHash,
      childPartIds: value.childPartIds,
      combinedBlockingCodes: value.combinedBlockingCodes,
      crossComponentCollisionFindings: value.crossComponentCollisionFindings,
    }),
  });
}
