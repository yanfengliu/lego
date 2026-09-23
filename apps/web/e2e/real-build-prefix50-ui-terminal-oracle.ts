import { documentStructuralHash, validateBrickDocument } from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import type { RealBuildPrefix50TerminalDetachedState } from "./real-build-prefix50-suffix-state";

export interface TerminalGraphOracle {
  readonly parentDocument: BrickDocumentV1;
  readonly childDocument: BrickDocumentV1;
  readonly parentPartIds: readonly string[];
  readonly childPartIds: readonly string[];
}

function blockingCodes(document: BrickDocumentV1): readonly string[] {
  return [
    ...new Set(
      validateBrickDocument(document)
        .issues.filter(({ severity }) => severity === "blocking")
        .map(({ code }) => code),
    ),
  ].sort();
}

function restrictDocument(
  document: BrickDocumentV1,
  includedPartIds: ReadonlySet<string>,
): BrickDocumentV1 {
  const restrict = <T extends { readonly partIds: readonly string[] }>(entry: T): T => ({
    ...entry,
    partIds: entry.partIds.filter((partId) => includedPartIds.has(partId)),
  });
  return {
    ...document,
    parts: document.parts.filter(({ id }) => includedPartIds.has(id)),
    connections: document.connections.filter(
      ({ a, b }) => includedPartIds.has(a.partId) && includedPartIds.has(b.partId),
    ),
    submodels: document.submodels.map(restrict),
    steps: document.steps.map(restrict),
    semanticRegions: document.semanticRegions.map(restrict),
  };
}

function connectedComponents(document: BrickDocumentV1): readonly (readonly string[])[] {
  const adjacency = new Map(document.parts.map(({ id }) => [id, new Set<string>()]));
  for (const { a, b } of document.connections) {
    if (!adjacency.has(a.partId) || !adjacency.has(b.partId)) {
      throw new Error(
        `Graph oracle found a connection with an absent endpoint: ${a.partId}/${b.partId}.`,
      );
    }
    adjacency.get(a.partId)!.add(b.partId);
    adjacency.get(b.partId)!.add(a.partId);
  }
  const remaining = new Set(adjacency.keys());
  const components: string[][] = [];
  while (remaining.size > 0) {
    const first = [...remaining].sort()[0]!;
    const pending = [first];
    const component = new Set<string>();
    remaining.delete(first);
    while (pending.length > 0) {
      const partId = pending.pop()!;
      component.add(partId);
      for (const neighbor of adjacency.get(partId) ?? []) {
        if (!remaining.delete(neighbor)) continue;
        pending.push(neighbor);
      }
    }
    components.push([...component].sort());
  }
  return components.sort(
    (left, right) => left.length - right.length || left[0]!.localeCompare(right[0]!),
  );
}

export function verifyTerminalGraphOracle(
  document: BrickDocumentV1,
  terminal: RealBuildPrefix50TerminalDetachedState,
): TerminalGraphOracle {
  const expectedChildPartIds = [...terminal.childPartIds].sort();
  const step50PartIds = [...(document.steps[49]?.partIds ?? [])].sort();
  const components = connectedComponents(document);
  if (
    components.length !== 2 ||
    components[0]?.length !== 9 ||
    components[1]?.length !== 311 ||
    step50PartIds.length !== expectedChildPartIds.length ||
    step50PartIds.some((partId, index) => partId !== expectedChildPartIds[index]) ||
    components[0]!.some((partId, index) => partId !== expectedChildPartIds[index])
  ) {
    throw new Error(
      `Independent terminal graph oracle requires exact connected components 9/311 and Step50 membership equal to the terminal child receipt; observed components ${components.map(({ length }) => length).join("/")}.`,
    );
  }
  const childIds = new Set(expectedChildPartIds);
  const parentPartIds = components[1]!;
  const parentIds = new Set(parentPartIds);
  const crossConnections = document.connections.filter(
    ({ a, b }) => childIds.has(a.partId) !== childIds.has(b.partId),
  );
  if (crossConnections.length !== 0) {
    throw new Error(
      `Independent terminal graph oracle found ${crossConnections.length} parent/child edge(s); expected zero.`,
    );
  }
  const parentDocument = restrictDocument(document, parentIds);
  const childDocument = restrictDocument(document, childIds);
  const parentReport = validateBrickDocument(parentDocument);
  const childReport = validateBrickDocument(childDocument);
  const unionReport = validateBrickDocument(document);
  if (
    !parentReport.documentGloballyValid ||
    !childReport.documentGloballyValid ||
    blockingCodes(parentDocument).length !== 0 ||
    blockingCodes(childDocument).length !== 0 ||
    unionReport.documentGloballyValid ||
    blockingCodes(document).join("|") !== "DISCONNECTED_ASSEMBLY" ||
    documentStructuralHash(parentDocument) !== terminal.parentDocumentHash ||
    documentStructuralHash(childDocument) !== terminal.childDocumentHash ||
    documentStructuralHash(document) !== terminal.combinedDocumentHash
  ) {
    throw new Error(
      "Independent terminal graph oracle requires two hard-valid components whose exact structural hashes bind the terminal receipt and whose union has sole DISCONNECTED_ASSEMBLY.",
    );
  }
  return {
    parentDocument,
    childDocument,
    parentPartIds,
    childPartIds: expectedChildPartIds,
  };
}
