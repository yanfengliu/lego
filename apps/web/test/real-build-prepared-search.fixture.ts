import {
  applyBuildOperations,
  canonicalBrickDocument,
  createEmptyBrickDocument,
  createPartInstance,
  documentStructuralHash,
} from "@lego-studio/brick-kernel";

import {
  createRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
} from "../e2e/real-build-candidate-lineage-identity";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import type { RealBuildOptions, RealBuildPanelSpec } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

export function preparedSearchOptions(pieceCount = 1, stepNumber = 2): RealBuildOptions {
  if (!Number.isSafeInteger(pieceCount) || pieceCount < 1 || pieceCount > 1_024) {
    throw new RangeError("Fixture pieceCount must be a safe integer from 1 through 1024.");
  }
  if (!Number.isSafeInteger(stepNumber) || stepNumber < 1 || stepNumber > 357) {
    throw new RangeError("Fixture stepNumber must be a safe integer from 1 through 357.");
  }
  const base = completeRealBuildTestOptions(358);
  const panels = [...base.panels];
  const source = panels[357]!;
  if (source.action.kind !== "place-callouts" || source.pieces.length < pieceCount) {
    throw new TypeError("Complete real-build fixture lost its direct placement panel.");
  }
  const moved = source.pieces.slice(0, pieceCount);
  const retained = source.pieces.slice(pieceCount);
  const directPanel = (
    panel: RealBuildPanelSpec,
    pieces: RealBuildPanelSpec["pieces"],
  ): RealBuildPanelSpec => ({
    ...panel,
    action: {
      kind: "place-callouts",
      assembledPieces: pieces.length,
      evidenceDigest: source.action.evidenceDigest,
    },
    pieces,
    omittedPieces: [],
    mappedCalloutKeys: pieces.map(({ calloutKey }) => calloutKey),
    calloutPieces: pieces.length,
    classifiedPhysicalCalloutPieces: pieces.length,
    semanticMultiplierQuantity: 0,
    omittedPhysicalPieces: 0,
  });
  panels[stepNumber - 1] = directPanel(panels[stepNumber - 1]!, moved);
  panels[357] = directPanel(source, retained);
  const coverageByCallout = Object.fromEntries(
    Object.entries(base.coverageByCallout).map(([key, claim]) => [
      key,
      moved.some(({ calloutKey }) => calloutKey === key)
        ? { ...claim, pageNumber: stepNumber, stepNumber }
        : claim,
    ]),
  );
  return { ...base, panels, coverageByCallout };
}

export function preparedSearchOptionsBytes(pieceCount = 1, stepNumber = 2): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(preparedSearchOptions(pieceCount, stepNumber)));
}

export function preparedSearchEmptyParent() {
  const document = createEmptyBrickDocument({
    id: "prepared-search-empty-parent",
    name: "Prepared search empty parent",
    maxParts: 1_464,
  });
  const documentHash = documentStructuralHash(document);
  const identity = createRealBuildLineageIdentity({
    candidateId: realBuildDocumentCandidateId(documentHash),
    documentHash,
    parent: null,
    throughStepNumber: 0,
    localIdentity: { kind: "decision", id: "prepared-search-empty-root" },
  });
  return Object.freeze({
    identity,
    documentSnapshot: createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: canonicalBrickDocument(document),
      expectedDocumentHash: documentHash,
    }),
  });
}

export function preparedSearchParent() {
  const empty = createEmptyBrickDocument({
    id: "prepared-search-parent",
    name: "Prepared search parent",
    maxParts: 1_464,
  });
  const rootHash = documentStructuralHash(empty);
  const rootIdentity = createRealBuildLineageIdentity({
    candidateId: realBuildDocumentCandidateId(rootHash),
    documentHash: rootHash,
    parent: null,
    throughStepNumber: 0,
    localIdentity: { kind: "decision", id: "prepared-search-empty-root" },
  });
  const document = applyBuildOperations(empty, [
    {
      kind: "addPart",
      operationId: "add-prepared-search-base",
      part: createPartInstance({ id: "base-part" }),
      semanticRegionIds: [],
    },
  ]);
  const documentHash = documentStructuralHash(document);
  const identity = createRealBuildLineageIdentity({
    candidateId: realBuildDocumentCandidateId(documentHash),
    documentHash,
    parent: rootIdentity,
    throughStepNumber: 1,
    localIdentity: { kind: "decision", id: "prepared-search-root" },
  });
  return Object.freeze({
    rootIdentity,
    identity,
    documentSnapshot: createRealBuildCandidateDocumentSnapshot({
      canonicalDocument: canonicalBrickDocument(document),
      expectedDocumentHash: documentHash,
    }),
  });
}

export function preparedWitnesses(pieceCount = 1, stepNumber = 2) {
  const pieces = preparedSearchOptions(pieceCount, stepNumber).panels[stepNumber - 1]!.pieces;
  return pieces.map(({ identityKey, catalogPartId, colorId }, index) => ({
    identityKey,
    catalogPartId,
    colorId,
    transform: {
      positionLdu: [index * 20, 0, 0] as const,
      orientationId: "upright-yaw-0",
    },
    connections: [
      index === 0
        ? {
            target: { kind: "base" as const, partId: "base-part" },
            targetPortId: "stud:0:0",
            candidatePortId: "undersideClutch:0:0",
            connectionKind: "stud-tube" as const,
          }
        : {
            target: { kind: "witness" as const, witnessIndex: index - 1 },
            targetPortId: "stud:0:0",
            candidatePortId: "undersideClutch:0:0",
            connectionKind: "stud-tube" as const,
          },
    ],
  }));
}
