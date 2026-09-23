import {
  deepFreeze,
  documentStructuralHash,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

function restrictToParent(document: BrickDocumentV1, childIds: ReadonlySet<string>) {
  const keep = ({ id }: { readonly id: string }) => !childIds.has(id);
  return deepFreeze({
    ...document,
    parts: document.parts.filter(keep),
    connections: document.connections.filter(
      ({ a, b }) => !childIds.has(a.partId) && !childIds.has(b.partId),
    ),
    submodels: document.submodels.map((row) => ({
      ...row,
      partIds: row.partIds.filter((id) => !childIds.has(id)),
    })),
    steps: document.steps.map((row) => ({
      ...row,
      partIds: row.partIds.filter((id) => !childIds.has(id)),
    })),
    semanticRegions: document.semanticRegions.map((row) => ({
      ...row,
      partIds: row.partIds.filter((id) => !childIds.has(id)),
    })),
  });
}

export function exactParent(input: {
  reviewReplayBaseDocument: BrickDocumentV1;
  childPartIds: readonly string[];
  sourceDocumentHash: `sha256:${string}`;
}) {
  const childIds = [...input.childPartIds];
  if (
    childIds.length !== 23 ||
    new Set(childIds).size !== childIds.length ||
    childIds.some((id, index) => index > 0 && childIds[index - 1]! >= id) ||
    input.reviewReplayBaseDocument.parts.length !== 280 ||
    input.reviewReplayBaseDocument.steps.length !== 43 ||
    documentStructuralHash(input.reviewReplayBaseDocument) !== input.sourceDocumentHash ||
    childIds.some((id) => !input.reviewReplayBaseDocument.parts.some((part) => part.id === id))
  )
    throw new TypeError(
      "Step-44 camera fitting requires the exact structural 280-part/43-step replay base and sorted 23-part child roster.",
    );
  const parentDocument = restrictToParent(input.reviewReplayBaseDocument, new Set(childIds));
  const parentHash = documentStructuralHash(parentDocument);
  const report = validateBrickDocument(parentDocument);
  if (
    parentDocument.parts.length !== 257 ||
    !report.documentGloballyValid ||
    report.targetDocumentHash !== parentHash
  )
    throw new TypeError(
      "Step-44 camera fitting requires the exact hard-valid connected shared 257-part parent.",
    );
  return { parentDocument, parentHash, childIds };
}
