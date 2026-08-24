import { expect } from "@playwright/test";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { decodeRealBuildPngCapture } from "./real-build-browser-output";
import {
  REAL_BUILD_PRODUCTION_DEFERRED_CANDIDATE_BUDGET,
  REAL_BUILD_PRODUCTION_DEFERRED_NARROWING_RENDER_BUDGET,
} from "./real-build-production-policy";
import {
  STEP7_GATE3_CANDIDATE_LIMIT,
  STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT,
  STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
  type Step7Gate3BrowserResult,
} from "./real-build-step7-gate3-diagnostic-browser";
import { analyzeDepthCompositionEstimate } from "./real-build-step7-gate3-diagnostic-analysis";
import {
  canonicalTraceDigest,
  EXPECTED,
  sha256,
} from "./real-build-step7-gate3-diagnostic-fixture";
import { replayStep7Gate3InNode } from "./real-build-step7-gate3-diagnostic-node-replay";
import type { ExecutedStep7Gate3HostRun } from "./real-build-step7-gate3-host-execution";
import type { PreparedStep7Gate3HostRun } from "./real-build-step7-gate3-host-preparation";

export function verifyStep7Gate3HostRun(
  prepared: PreparedStep7Gate3HostRun,
  execution: ExecutedStep7Gate3HostRun,
) {
  const { baseDocument, origins, exactBrowserInput, historicalControl } = prepared;
  const { result } = execution;
  const nodeReplayInput = {
    baseDocument: baseDocument as BrickDocumentV1,
    origins,
    pieces: exactBrowserInput.panel.pieces,
    minimumScoreMargin: exactBrowserInput.options.minimumScoreMargin,
    browser: result,
  } as const;
  const nodeReplay = replayStep7Gate3InNode(nodeReplayInput);
  expect(nodeReplay.sourceParentsVerified).toBe(true);
  expect(nodeReplay.selectionReplayVerified).toBe(true);
  expect(nodeReplay.batchesVerified).toBe(result.batches.length);
  expect(nodeReplay.childrenVerified).toBe(17);
  const tamperOutcome = result.batchOutcomes.find(
    ({ offeredCount, carriedRowIndices }) => carriedRowIndices.length < offeredCount,
  );
  if (tamperOutcome === undefined) {
    throw new TypeError("Gate-3 Node replay control found no uncarried observed row to tamper.");
  }
  const carriedRows = new Set(tamperOutcome.carriedRowIndices);
  const tamperRow = result.renders.find(
    ({ parentCandidateId, batchIndex, rowIndex }) =>
      parentCandidateId === tamperOutcome.parentCandidateId &&
      batchIndex === tamperOutcome.batchIndex &&
      !carriedRows.has(rowIndex),
  );
  const batchRows = result.renders.filter(
    ({ parentCandidateId, batchIndex }) =>
      parentCandidateId === tamperOutcome.parentCandidateId &&
      batchIndex === tamperOutcome.batchIndex,
  );
  if (tamperRow === undefined || batchRows.length !== tamperOutcome.offeredCount) {
    throw new TypeError("Gate-3 Node replay control could not bind its tampered row batch.");
  }
  const tamperedScore =
    Math.max(...batchRows.map(({ score }) => score)) +
    exactBrowserInput.options.minimumScoreMargin +
    1;
  const tamperedBrowser = {
    ...result,
    renders: result.renders.map((row) =>
      row === tamperRow
        ? {
            ...row,
            score: tamperedScore,
            scoreComponents:
              row.scoreComponents.basis === "stroke"
                ? { ...row.scoreComponents, strokeRecall: tamperedScore }
                : { ...row.scoreComponents, score: tamperedScore },
          }
        : row,
    ),
  } satisfies Step7Gate3BrowserResult;
  expect(() => replayStep7Gate3InNode({ ...nodeReplayInput, browser: tamperedBrowser })).toThrow(
    /score-margin policy/u,
  );
  const batchesByParent = Object.fromEntries(
    result.orderedParentIds.map((parentCandidateId) => {
      const batches = result.batches.filter(
        (batch) => batch.parentCandidateId === parentCandidateId,
      );
      return [
        parentCandidateId,
        {
          count: batches.length,
          digest: canonicalTraceDigest(batches),
          renders: batches.reduce((total, batch) => total + batch.offeredCount, 0),
        },
      ];
    }),
  );
  for (const batch of result.batches) {
    const rows = result.renders.filter(
      (row) =>
        row.parentCandidateId === batch.parentCandidateId && row.batchIndex === batch.batchIndex,
    );
    expect(rows).toHaveLength(batch.offeredCount);
    expect(rows.map(({ rowIndex }) => rowIndex)).toEqual(
      Array.from({ length: batch.offeredCount }, (_value, index) => index),
    );
    for (const row of rows) {
      expect(row.score).toBe(
        row.scoreComponents.basis === "stroke"
          ? row.scoreComponents.strokeRecall
          : row.scoreComponents.score,
      );
    }
    const outcomes = result.batchOutcomes.filter(
      (outcome) =>
        outcome.parentCandidateId === batch.parentCandidateId &&
        outcome.batchIndex === batch.batchIndex,
    );
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]).toMatchObject({
      parentCandidateId: batch.parentCandidateId,
      batchIndex: batch.batchIndex,
      prefixDocumentHash: batch.prefixDocumentHash,
      catalogPartId: batch.catalogPartId,
      colorId: batch.colorId,
      offeredCount: batch.offeredCount,
    });
    expect(new Set(outcomes[0]!.carriedRowIndices).size).toBe(
      outcomes[0]!.carriedRowIndices.length,
    );
    expect(
      outcomes[0]!.carriedRowIndices.every(
        (rowIndex) => Number.isSafeInteger(rowIndex) && rowIndex >= 0 && rowIndex < rows.length,
      ),
    ).toBe(true);
  }
  expect(result.batchOutcomes).toHaveLength(result.batches.length);
  expect(result.reservations.map(({ requested }) => requested)).toEqual(
    result.batches.map(({ offeredCount }) => offeredCount),
  );
  expect(result.orderedSourceParentIds).toEqual(EXPECTED.orderedParentIds);
  expect(result.orderedParentIds).toHaveLength(EXPECTED.orderedParentIds.length);
  expect(new Set(result.orderedParentIds).size).toBe(EXPECTED.orderedParentIds.length);
  expect(result.parentStarts).toEqual(
    EXPECTED.orderedParentIds.map((sourceParentCandidateId, index) => ({
      sourceParentCandidateId,
      parentCandidateId: result.orderedParentIds[index],
    })),
  );
  expect(result.parentTerminals).toEqual(result.parentStarts);
  expect(result.observationMode).toBe("current-migrated");
  expect(result.sourceBaseDocumentHash).toBe(EXPECTED.baseDocumentHash);
  expect(result.migrationPartsPreserved).toBe(true);
  expect(result.parentMigrations).toEqual(
    EXPECTED.orderedParentIds.map((sourceParentCandidateId, index) => ({
      sourceParentCandidateId,
      sourceDocumentHash: sourceParentCandidateId.slice("step-006:".length),
      sourceHashVerified: true,
      parentCandidateId: result.orderedParentIds[index],
      currentDocumentHash: result.orderedParentIds[index]!.slice("step-006:".length),
      partsPreserved: true,
    })),
  );
  expect(result.migrationReport).toEqual({
    schemaVersion: "lego.truth-migration/2",
    fromCatalogVersion: "builtin.basic-parts/13",
    toCatalogVersion: "builtin.basic-parts/17",
    fromTruthHash: "sha256:de62fae6dbc8095dfd460983e5e845ddfac4bf9ec2ea1f99572bc46026941cb5",
    toTruthHash: "sha256:d21bdecc6a269b1b92e0915664cae9a147168fe8d7576ee17213e8e9446c7926",
    addedColorIds: [],
    addedCatalogPartIds: [
      "builtin:tile-1x1-quarter-round",
      "builtin:bracket-1x2-1x4-rounded-bottom",
      "builtin:tile-2x2-triangular",
      "builtin:roller-skate",
    ],
    catalogInterpretationChanges: [],
    truthComponentChanges: [
      {
        component: "catalog",
        fromVersion: "builtin.basic-parts/13",
        toVersion: "builtin.basic-parts/17",
      },
      {
        component: "collision-model",
        fromVersion: "rectilinear-stud-clearance/2",
        toVersion: "rectilinear-stud-clearance/3",
      },
      {
        component: "validator-set",
        fromVersion: "lego.kernel-validators/2",
        toVersion: "lego.kernel-validators/3",
      },
    ],
    migrated: true,
    blockingReasons: [],
  });
  expect(result.reservations.reduce((total, row) => total + row.requested, 0)).toBe(
    result.sharedRenderDemand,
  );
  expect(result.parents.reduce((total, parent) => total + parent.narrowingRenders, 0)).toBe(
    result.sharedRenderDemand,
  );
  expect(result.parents.reduce((total, parent) => total + parent.candidateLedgerDelta, 0)).toBe(
    result.candidateDemand,
  );
  expect(result.parents.reduce((total, parent) => total + parent.completeLeaves.length, 0)).toBe(
    result.candidateDemand,
  );
  for (const parent of result.parents) {
    expect(parent.sourceDocumentHash).toBe(
      parent.sourceParentCandidateId.slice("step-006:".length),
    );
    expect(parent.renderer).toEqual({
      created: 1,
      renderCalls: parent.narrowingRenders + 4,
      disposeCalls: 1,
    });
  }
  expect(result.productionNarrowingLimit).toBe(STEP7_GATE3_PRODUCTION_NARROWING_LIMIT);
  expect(STEP7_GATE3_PRODUCTION_NARROWING_LIMIT).toBe(
    REAL_BUILD_PRODUCTION_DEFERRED_NARROWING_RENDER_BUDGET,
  );
  expect(result.diagnosticNarrowingLimit).toBe(STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT);
  expect(result.candidateLimit).toBe(STEP7_GATE3_CANDIDATE_LIMIT);
  expect(STEP7_GATE3_CANDIDATE_LIMIT).toBe(REAL_BUILD_PRODUCTION_DEFERRED_CANDIDATE_BUDGET);
  expect(result.candidateDemand).toBeLessThanOrEqual(
    REAL_BUILD_PRODUCTION_DEFERRED_CANDIDATE_BUDGET,
  );

  const { panelPng, ...browserTrace } = result;
  const depthCompositionEstimate = analyzeDepthCompositionEstimate(result);
  expect(depthCompositionEstimate).toMatchObject({
    renderRows: 14_172,
    exactSceneKeys: 14_172,
    exactSceneRepeats: 0,
    prefixLayers: 30,
    parentScopedCandidateLayers: 6_414,
    candidateLayerRepeats: 7_758,
    uniqueMasks: 5_599,
    maskRepeats: 8_573,
    candidateKeysWithContextDependentMasks: 516,
    contextDependentCandidateKeysDigest:
      "sha256:b06d73e587e6180d916c1accda24ca0270d776bc4326d6c44b00bc34b6c2fdc9",
    maskKeysWithScoreDisagreement: 0,
    estimatedPhysicalDepthLayerRenders: 6_444,
    estimatedSavings: 7_728,
    estimateWithinProductionLimit: true,
  });
  expect(
    depthCompositionEstimate.perParent.map(
      ({
        renderRows,
        prefixLayers,
        candidateLayers,
        contextDependentCandidateLayers,
        estimatedPhysicalDepthLayerRenders,
      }) => ({
        renderRows,
        prefixLayers,
        candidateLayers,
        contextDependentCandidateLayers,
        estimatedPhysicalDepthLayerRenders,
      }),
    ),
  ).toEqual([
    {
      renderRows: 2_218,
      prefixLayers: 5,
      candidateLayers: 1_577,
      contextDependentCandidateLayers: 65,
      estimatedPhysicalDepthLayerRenders: 1_582,
    },
    {
      renderRows: 2_169,
      prefixLayers: 5,
      candidateLayers: 1_542,
      contextDependentCandidateLayers: 64,
      estimatedPhysicalDepthLayerRenders: 1_547,
    },
    {
      renderRows: 8_271,
      prefixLayers: 16,
      candidateLayers: 1_781,
      contextDependentCandidateLayers: 387,
      estimatedPhysicalDepthLayerRenders: 1_797,
    },
    {
      renderRows: 1_514,
      prefixLayers: 4,
      candidateLayers: 1_514,
      contextDependentCandidateLayers: 0,
      estimatedPhysicalDepthLayerRenders: 1_518,
    },
  ]);
  const expectedShadowRefusal = {
    sourceParentCandidateId: EXPECTED.orderedParentIds[2],
    parentCandidateId: result.orderedParentIds[2],
    reservedBefore: 8_037,
    requested: 599,
    budget: STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
  };
  expect(result.production8192ShadowRefusal).toEqual(expectedShadowRefusal);
  expect(result.parents[0]!.narrowingRenders + result.parents[1]!.narrowingRenders).toBe(4_387);
  expect(
    expectedShadowRefusal.reservedBefore -
      result.parents[0]!.narrowingRenders -
      result.parents[1]!.narrowingRenders,
  ).toBe(3_650);
  expect(
    result.reservations.find(
      ({ reservedBefore, requested }) => reservedBefore === 8_037 && requested === 599,
    ),
  ).toEqual({
    sourceParentCandidateId: EXPECTED.orderedParentIds[2],
    parentCandidateId: result.orderedParentIds[2],
    reservedBefore: 8_037,
    requested: 599,
    reservedAfter: 8_636,
    accepted: true,
  });
  const controlComparison = {
    historicalRetainedControl: historicalControl,
    currentShadowRefusal: result.production8192ShadowRefusal,
    reproduced:
      result.production8192ShadowRefusal?.sourceParentCandidateId ===
        historicalControl.refusedParentCandidateId &&
      result.production8192ShadowRefusal.reservedBefore ===
        historicalControl.reservedBeforeRefusal &&
      result.production8192ShadowRefusal.requested === historicalControl.refusedRequest &&
      result.production8192ShadowRefusal.budget === historicalControl.narrowingBudget,
  };
  expect(controlComparison.reproduced).toBe(true);
  if (panelPng === null) {
    throw new TypeError("Completed Gate-3 diagnostic produced no retained step-7 panel PNG.");
  }
  const panelPngBytes = decodeRealBuildPngCapture(panelPng);
  const outputPanel = Object.freeze({
    file: "step-007-panel.png" as const,
    bytes: panelPngBytes.length,
    digest: sha256(panelPngBytes),
  });
  return Object.freeze({
    nodeReplay,
    batchesByParent,
    browserTrace,
    depthCompositionEstimate,
    controlComparison,
    panelPngBytes,
    outputPanel,
  });
}

export type VerifiedStep7Gate3HostRun = ReturnType<typeof verifyStep7Gate3HostRun>;
