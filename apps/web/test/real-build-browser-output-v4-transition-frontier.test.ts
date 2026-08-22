import { describe, expect, it } from "vitest";

import {
  applyBuildOperations,
  canonicalBrickDocument,
  canonicalStringify,
  createEmptyBrickDocument,
  createPartInstance,
  documentStructuralHash,
  sha256Hex,
  validateBrickDocument,
} from "@lego-studio/brick-kernel";

import {
  advanceRealBuildBrowserOutputV4TransitionFrontier,
  createRealBuildBrowserOutputV4TransitionEvidenceManifest,
  createRealBuildBrowserOutputV4TransitionEvidenceRow,
  createRealBuildBrowserOutputV4TransitionFrontier,
  readRealBuildBrowserOutputV4TransitionEvidenceManifest,
  requireRealBuildBrowserOutputV4TransitionFrontier,
  serializeRealBuildBrowserOutputV4TransitionEvidenceManifest,
} from "../e2e/real-build-browser-output-v4-transition-frontier";
import { createRealBuildCandidateDocumentSnapshot } from "../e2e/real-build-candidate-document-snapshot";
import {
  createRealBuildLineageIdentity,
  realBuildDocumentCandidateId,
} from "../e2e/real-build-candidate-lineage-identity";
import {
  bindRealBuildExactRootLineageIdentity,
  deriveRealBuildExactLineageIdentity,
} from "../e2e/real-build-exact-lineage-identity";
import {
  inspectRealBuildPreparedPanelFromRunInput,
  inspectRealBuildPreparedRunInput,
} from "../e2e/real-build-prepared-step-authority";
import { stepPanelEvidenceDigest } from "../e2e/real-build-ledger-contract";
import { preparedSearchOptions } from "./real-build-prepared-search.fixture";

const OTHER_DIGEST = `sha256:${"c".repeat(64)}` as const;
function preparedTransition(
  prerequisitePatch: Readonly<{
    unresolvedCallouts?: readonly string[];
    missingDesigns?: readonly string[];
  }> = {},
) {
  const options = preparedSearchOptions();
  const panels = [...options.panels];
  const panel = panels[2]!;
  if (panel.action.kind !== "transition") throw new Error("Fixture step 3 is not a transition.");
  const panelEvidenceDigest = stepPanelEvidenceDigest({
    pdfDigest: options.inputDigests.pdf,
    stepNumber: panel.stepNumber,
    pageNumber: panel.pageNumber,
    bounds: {
      minXPt: panel.minXPt,
      maxXPt: panel.maxXPt,
      minYPt: panel.minYPt,
      maxYPt: panel.maxYPt,
    },
    calloutBoxes: panel.calloutBoxes,
  });
  panels[2] = {
    ...panel,
    ...prerequisitePatch,
    action: { ...panel.action, panelEvidenceDigest },
  };
  const run = inspectRealBuildPreparedRunInput(
    new TextEncoder().encode(JSON.stringify({ ...options, panels })),
  );
  return inspectRealBuildPreparedPanelFromRunInput(run, 3);
}
function snapshot(document: ReturnType<typeof createEmptyBrickDocument>) {
  const documentHash = documentStructuralHash(document);
  return createRealBuildCandidateDocumentSnapshot({
    canonicalDocument: canonicalBrickDocument(document),
    expectedDocumentHash: documentHash,
  });
}
function exactSourceIdentities(sourceSnapshot: ReturnType<typeof snapshot>, count: number) {
  const root = createEmptyBrickDocument({
    id: "real-build",
    name: "Real booklet rebuild",
    maxParts: 1_464,
  });
  const rootSnapshot = snapshot(root);
  return Array.from({ length: count }, (_, index) => {
    const rootIdentity = bindRealBuildExactRootLineageIdentity({
      documentSnapshot: rootSnapshot,
      identity: createRealBuildLineageIdentity({
        candidateId: realBuildDocumentCandidateId(rootSnapshot.documentHash),
        documentHash: rootSnapshot.documentHash,
        parent: null,
        throughStepNumber: 0,
        localIdentity: { kind: "evidence", id: `transition-root-${index}` },
      }),
    });
    return deriveRealBuildExactLineageIdentity({
      candidateId: realBuildDocumentCandidateId(sourceSnapshot.documentHash),
      documentHash: sourceSnapshot.documentHash,
      documentSnapshot: sourceSnapshot,
      parent: rootIdentity,
      throughStepNumber: 2,
      localIdentity: { kind: "evidence", id: `transition-source-${index}` },
    });
  });
}

function binding(documentSnapshot: ReturnType<typeof snapshot>) {
  return {
    documentHash: documentSnapshot.documentHash,
    canonicalBytesHash: documentSnapshot.canonicalBytesHash,
    canonicalByteLength: documentSnapshot.canonicalByteLength,
  };
}

function fixture(
  identityCount = 1,
  prerequisitePatch: Readonly<{
    unresolvedCallouts?: readonly string[];
    missingDesigns?: readonly string[];
  }> = {},
) {
  const preparedPanel = preparedTransition(prerequisitePatch);
  const action = JSON.parse(preparedPanel.actionCanonicalJson) as {
    readonly kind: "transition";
    readonly assembledPieces: 0;
    readonly transition: "rotation";
    readonly panelEvidenceDigest: `sha256:${string}`;
    readonly classificationEvidenceDigest: `sha256:${string}`;
    readonly evidenceDigest: `sha256:${string}`;
  };
  const root = createEmptyBrickDocument({
    id: "real-build",
    name: "Real booklet rebuild",
    maxParts: 1_464,
  });
  const sourceDocument = applyBuildOperations(root, [
    {
      kind: "addStep",
      operationId: "fixture-step-2",
      step: { id: "real-build-step-2", index: 1, name: "Step 2", partIds: [] },
    },
  ]);
  const sourceSnapshot = snapshot(sourceDocument);
  const identities = exactSourceIdentities(sourceSnapshot, identityCount);
  const frontier = createRealBuildBrowserOutputV4TransitionFrontier({
    throughStepNumber: 2,
    documentSnapshot: sourceSnapshot,
    identities,
  });
  const targetDocument = applyBuildOperations(sourceDocument, [
    {
      kind: "addStep",
      operationId: "real-build-transition-3",
      step: {
        id: "real-build-step-3",
        index: 2,
        name: `Step 3 [transition:${action.transition};panel=${action.panelEvidenceDigest}]`,
        partIds: [],
      },
    },
  ]);
  const targetSnapshot = snapshot(targetDocument);
  const validation = validateBrickDocument(targetDocument);
  const report = {
    stepNumber: 3,
    pageNumber: preparedPanel.pageNumber,
    calloutPieces: 0,
    expectedAssembledPieces: 0,
    attemptedPieces: 0,
    placedPieces: 0,
    action,
    actionEvidenceDigest: action.evidenceDigest,
    canonicalStepId: "real-build-step-3",
    outcome: { status: "complete", mechanism: "instruction-transition", failure: null },
    validation: {
      attempted: true,
      targetDocumentHash: validation.targetDocumentHash,
      truthSnapshotHash: validation.truthSnapshotHash,
      validatorSetHash: validation.validatorSetHash,
      documentGloballyValid: validation.documentGloballyValid,
      blockingIssues: validation.issues
        .filter(({ severity }) => severity === "blocking")
        .map(({ code, message, path, partIds }) => ({ code, message, path, partIds })),
      failure: null,
    },
    documentParts: targetDocument.parts.length,
  };
  const row = createRealBuildBrowserOutputV4TransitionEvidenceRow({
    preparedPanel,
    report,
    source: binding(sourceSnapshot),
    target: binding(targetSnapshot),
  });
  return {
    preparedPanel,
    action,
    sourceDocument,
    sourceSnapshot,
    targetDocument,
    targetSnapshot,
    identities,
    frontier,
    report,
    row,
  };
}

describe("real-build browser-output /4 exact transition frontier", () => {
  it("refuses transition replay while prepared callout or design prerequisites remain unresolved", () => {
    for (const prerequisitePatch of [
      { unresolvedCallouts: ["callout:unresolved"] },
      { missingDesigns: ["design:missing"] },
    ]) {
      const source = fixture(1, prerequisitePatch);
      expect(() =>
        advanceRealBuildBrowserOutputV4TransitionFrontier({
          frontier: source.frontier,
          preparedPanel: source.preparedPanel,
          row: source.row,
        }),
      ).toThrow(/cannot erase or advance unresolved prepared prerequisites/iu);
    }
  });

  it("serializes compact commitments and replays the target byte-for-byte", () => {
    const source = fixture();
    const manifest = createRealBuildBrowserOutputV4TransitionEvidenceManifest([source.row]);
    const bytes = serializeRealBuildBrowserOutputV4TransitionEvidenceManifest(manifest);
    const parsed = readRealBuildBrowserOutputV4TransitionEvidenceManifest(bytes);
    const advanced = advanceRealBuildBrowserOutputV4TransitionFrontier({
      frontier: source.frontier,
      preparedPanel: source.preparedPanel,
      row: parsed.rows[0]!,
    });
    expect(advanced.documentSnapshot.canonicalBytes).toBe(
      canonicalBrickDocument(source.targetDocument),
    );
    expect(advanced.documentSnapshot.canonicalBytesHash).toBe(
      source.targetSnapshot.canonicalBytesHash,
    );
    expect(advanced.documentSnapshot.canonicalByteLength).toBe(
      source.targetSnapshot.canonicalByteLength,
    );
    expect(advanced.documentSnapshot.documentHash).toBe(source.targetSnapshot.documentHash);
    expect(advanced.identities[0]!.parentExactLineageId).toBe(source.identities[0]!.exactLineageId);
    expect(advanced.completionAuthority).toEqual({
      status: "absent",
      authorized: false,
      reason: "transition-frontier-cannot-authorize-completion",
    });
    expect(parsed.manifestDigest).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(parsed.canonicalBytesHash).toBe(`sha256:${sha256Hex(bytes)}`);
    expect(parsed.canonicalByteLength).toBe(bytes.byteLength);
    const artifact = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    expect(canonicalStringify(artifact)).not.toContain('canonicalBytes"');
    expect(canonicalStringify(artifact)).not.toContain("lego.brick-document");
    expect(Object.isFrozen(advanced)).toBe(true);
    expect(requireRealBuildBrowserOutputV4TransitionFrontier(advanced)).toBe(advanced);
  });

  it("derives one exact child per ordered parent without collapsing convergent lineages", () => {
    const source = fixture(4);
    const reordered = [
      source.identities[2]!,
      source.identities[0]!,
      source.identities[3]!,
      source.identities[1]!,
    ];
    const frontier = createRealBuildBrowserOutputV4TransitionFrontier({
      throughStepNumber: 2,
      documentSnapshot: source.sourceSnapshot,
      identities: reordered,
    });
    const advanced = advanceRealBuildBrowserOutputV4TransitionFrontier({
      frontier,
      preparedPanel: source.preparedPanel,
      row: source.row,
    });
    expect(advanced.identities).toHaveLength(4);
    expect(advanced.identities.map(({ parentExactLineageId }) => parentExactLineageId)).toEqual(
      reordered.map(({ exactLineageId }) => exactLineageId),
    );
    expect(advanced.lastTransition?.orderedParentExactLineageIds).toEqual(
      reordered.map(({ exactLineageId }) => exactLineageId),
    );
    expect(new Set(advanced.identities.map(({ exactLineageId }) => exactLineageId))).toHaveLength(
      4,
    );
    expect(
      new Set(advanced.identities.map(({ canonicalBytesHash }) => canonicalBytesHash)),
    ).toEqual(new Set([source.targetSnapshot.canonicalBytesHash]));
    expect(new Set(advanced.identities.map(({ localIdentity }) => localIdentity.id))).toEqual(
      new Set([`v4-transition:${source.row.rowDigest}`]),
    );
  });

  it("rejects report action, step, page, and source-bound panel drift", () => {
    const source = fixture();
    const mutations = [
      { ...source.report, stepNumber: 4 },
      { ...source.report, pageNumber: source.report.pageNumber + 1 },
      {
        ...source.report,
        action: { ...source.report.action, transition: "attachment" },
      },
      {
        ...source.report,
        action: { ...source.report.action, panelEvidenceDigest: OTHER_DIGEST },
      },
      {
        ...source.report,
        action: { ...source.report.action, classificationEvidenceDigest: OTHER_DIGEST },
      },
    ];
    for (const report of mutations) {
      expect(() =>
        createRealBuildBrowserOutputV4TransitionEvidenceRow({
          preparedPanel: source.preparedPanel,
          report,
          source: binding(source.sourceSnapshot),
          target: binding(source.targetSnapshot),
        }),
      ).toThrow(/action, step, page, or panel|canonicalStepId/u);
    }
  });

  it("rejects every source and target hash, byte-digest, and byte-length mismatch", () => {
    const source = fixture();
    const sourceBinding = binding(source.sourceSnapshot);
    const targetBinding = binding(source.targetSnapshot);
    const cases = [
      {
        source: { ...sourceBinding, documentHash: OTHER_DIGEST },
        target: targetBinding,
        report: source.report,
        error: /source hash/u,
      },
      {
        source: { ...sourceBinding, canonicalBytesHash: OTHER_DIGEST },
        target: targetBinding,
        report: source.report,
        error: /source hash/u,
      },
      {
        source: { ...sourceBinding, canonicalByteLength: sourceBinding.canonicalByteLength + 1 },
        target: targetBinding,
        report: source.report,
        error: /source hash/u,
      },
      {
        source: sourceBinding,
        target: { ...targetBinding, canonicalBytesHash: OTHER_DIGEST },
        report: source.report,
        error: /target hash/u,
      },
      {
        source: sourceBinding,
        target: { ...targetBinding, canonicalByteLength: targetBinding.canonicalByteLength + 1 },
        report: source.report,
        error: /target hash/u,
      },
      {
        source: sourceBinding,
        target: { ...targetBinding, documentHash: OTHER_DIGEST },
        report: {
          ...source.report,
          validation: { ...source.report.validation, targetDocumentHash: OTHER_DIGEST },
        },
        error: /target hash/u,
      },
    ];
    for (const entry of cases) {
      const row = createRealBuildBrowserOutputV4TransitionEvidenceRow({
        preparedPanel: source.preparedPanel,
        report: entry.report,
        source: entry.source,
        target: entry.target,
      });
      expect(() =>
        advanceRealBuildBrowserOutputV4TransitionFrontier({
          frontier: source.frontier,
          preparedPanel: source.preparedPanel,
          row,
        }),
      ).toThrow(entry.error);
    }
  });

  it("refuses non-empty transition reports and any pre-existing target step collision", () => {
    const source = fixture();
    expect(() =>
      createRealBuildBrowserOutputV4TransitionEvidenceRow({
        preparedPanel: source.preparedPanel,
        report: {
          ...source.report,
          expectedAssembledPieces: 1,
          action: { ...source.report.action, assembledPieces: 1 },
        },
        source: binding(source.sourceSnapshot),
        target: binding(source.targetSnapshot),
      }),
    ).toThrow(/zero-piece transition|must be zero/u);
    const collidingDocument = applyBuildOperations(source.sourceDocument, [
      {
        kind: "addStep",
        operationId: "fixture-collision-step",
        step: {
          id: "real-build-step-3",
          index: 2,
          name: "Occupied future transition",
          partIds: [],
        },
      },
      {
        kind: "addPart",
        operationId: "fixture-collision-part",
        part: createPartInstance({ id: "collision-part", stepId: "real-build-step-3" }),
        semanticRegionIds: [],
      },
    ]);
    const collidingSnapshot = snapshot(collidingDocument);
    const collidingIdentities = source.identities.map((parent, index) =>
      deriveRealBuildExactLineageIdentity({
        candidateId: realBuildDocumentCandidateId(collidingSnapshot.documentHash),
        documentHash: collidingSnapshot.documentHash,
        documentSnapshot: collidingSnapshot,
        parent,
        throughStepNumber: 2,
        localIdentity: { kind: "evidence", id: `fixture-collision-${index}` },
      }),
    );
    const collidingFrontier = createRealBuildBrowserOutputV4TransitionFrontier({
      throughStepNumber: 2,
      documentSnapshot: collidingSnapshot,
      identities: collidingIdentities,
    });
    const collidingRow = createRealBuildBrowserOutputV4TransitionEvidenceRow({
      preparedPanel: source.preparedPanel,
      report: { ...source.report, documentParts: 1 },
      source: binding(collidingSnapshot),
      target: binding(source.targetSnapshot),
    });
    expect(() =>
      advanceRealBuildBrowserOutputV4TransitionFrontier({
        frontier: collidingFrontier,
        preparedPanel: source.preparedPanel,
        row: collidingRow,
      }),
    ).toThrow(/collides.*exactly one new addStep/u);
  });

  it("rejects independently reproduced validation drift", () => {
    const source = fixture();
    for (const validation of [
      { ...source.report.validation, truthSnapshotHash: OTHER_DIGEST },
      { ...source.report.validation, validatorSetHash: OTHER_DIGEST },
    ]) {
      const row = createRealBuildBrowserOutputV4TransitionEvidenceRow({
        preparedPanel: source.preparedPanel,
        report: { ...source.report, validation },
        source: binding(source.sourceSnapshot),
        target: binding(source.targetSnapshot),
      });
      expect(() =>
        advanceRealBuildBrowserOutputV4TransitionFrontier({
          frontier: source.frontier,
          preparedPanel: source.preparedPanel,
          row,
        }),
      ).toThrow(/validation fields/u);
    }
    expect(() =>
      createRealBuildBrowserOutputV4TransitionEvidenceRow({
        preparedPanel: source.preparedPanel,
        report: {
          ...source.report,
          validation: { ...source.report.validation, documentGloballyValid: false },
        },
        source: binding(source.sourceSnapshot),
        target: binding(source.targetSnapshot),
      }),
    ).toThrow(/successful independent validation/u);
  });

  it("rejects unbranded state, identities, rows, and tampered manifests", () => {
    const source = fixture();
    expect(() =>
      advanceRealBuildBrowserOutputV4TransitionFrontier({
        frontier: { ...source.frontier },
        preparedPanel: source.preparedPanel,
        row: source.row,
      } as never),
    ).toThrow(/exact branded result/u);
    expect(() =>
      createRealBuildBrowserOutputV4TransitionFrontier({
        throughStepNumber: 2,
        documentSnapshot: source.sourceSnapshot,
        identities: [{ ...source.identities[0]! }],
      }),
    ).toThrow(/Exact lineage identity must be created or snapshotted/u);
    expect(() =>
      advanceRealBuildBrowserOutputV4TransitionFrontier({
        frontier: source.frontier,
        preparedPanel: source.preparedPanel,
        row: { ...source.row },
      } as never),
    ).toThrow(/created or read by this module/u);
    const manifest = createRealBuildBrowserOutputV4TransitionEvidenceManifest([source.row]);
    const artifact = JSON.parse(
      new TextDecoder().decode(
        serializeRealBuildBrowserOutputV4TransitionEvidenceManifest(manifest),
      ),
    ) as { manifestDigest: string };
    artifact.manifestDigest = OTHER_DIGEST;
    expect(() =>
      readRealBuildBrowserOutputV4TransitionEvidenceManifest(
        new TextEncoder().encode(canonicalStringify(artifact)),
      ),
    ).toThrow(/does not reproduce its digest/u);
    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(() => createRealBuildBrowserOutputV4TransitionEvidenceManifest(sparse)).toThrow(
      /enumerable own data property/u,
    );
  });
});
