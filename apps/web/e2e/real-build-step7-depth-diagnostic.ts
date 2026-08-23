import { expect } from "@playwright/test";
import type { BrickDocumentV1 } from "@lego-studio/protocol";

import { decodeRealBuildPngCapture } from "./real-build-browser-output";
import type { DepthNarrowingStatistics } from "./real-build-farther-depth-narrowing";
import {
  STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
  type Step7Gate3BrowserResult,
} from "./real-build-step7-gate3-diagnostic-browser";
import { canonicalTraceDigest, sha256 } from "./real-build-step7-gate3-diagnostic-fixture";
import { replayStep7Gate3InNode } from "./real-build-step7-gate3-diagnostic-node-replay";
import { retainStep7Gate3DiagnosticOutput } from "./real-build-step7-gate3-diagnostic-output";
import type { ExecutedStep7Gate3HostRun } from "./real-build-step7-gate3-host-execution";
import type { PreparedStep7Gate3HostRun } from "./real-build-step7-gate3-host-preparation";

export const STEP7_DEPTH_RENDER_ROWS_DIGEST =
  "sha256:4c62a705e7965b6d250f389d8d6e116b94902b6fcc29ccb8b5d08f69bc270c13";
export const STEP7_DEPTH_CANDIDATE_RECORDS_DIGEST =
  "sha256:35d429a206913570bf343aaadf276e5fe013f26877142c5785d7086425e82eab";
const EXPECTED_BATCH_DIGESTS = Object.freeze([
  "sha256:7c45d788c775be833e27e96f88ae8a5e0b643ba30acc3c62aeed5d9ca627d425",
  "sha256:401593a361d79ea0b1bba6f09545b4541a53d0c604681ba4f6b1f339aa7e6dde",
  "sha256:ec5c31208a17312d08e119e3d52973fb5cec40d701a70d97a250337609adead0",
  "sha256:19f6999663944843fc3d258a95516d6a00008a6612d3f1a6bfb4e618aa9a7be3",
]);
const EXPECTED_BATCHES_DIGEST =
  "sha256:539e6d0fc82f372329ddcede810b1f010ff7ec1c371b9e130ec6e74c8da39f49";
const EXPECTED_BATCH_OUTCOMES_DIGEST =
  "sha256:11868c7f8bcc7bc18960cdc0f0145d3b8ecbe440faea38b6fc50851885fff0c8";
const EXPECTED_LOGICAL_RESERVATIONS_DIGEST =
  "sha256:4c577b4288b711689ed7ce4946e0b3a22f668c652330a8dd05f3c2d30edf8f2a";

function sumStatistics(values: readonly DepthNarrowingStatistics[]): DepthNarrowingStatistics {
  const sum = (key: keyof DepthNarrowingStatistics) =>
    values.reduce((total, value) => total + value[key], 0);
  const max = (key: keyof DepthNarrowingStatistics) =>
    Math.max(0, ...values.map((value) => value[key]));
  return Object.freeze({
    logicalRows: sum("logicalRows"),
    prefixCaptures: sum("prefixCaptures"),
    probeCaptures: sum("probeCaptures"),
    fallbackCaptures: sum("fallbackCaptures"),
    equalDepthFallbacks: sum("equalDepthFallbacks"),
    subjectRenders: sum("subjectRenders"),
    depthPackPasses: sum("depthPackPasses"),
    depthPackPixels: sum("depthPackPixels"),
    cacheHits: sum("cacheHits"),
    cacheMisses: sum("cacheMisses"),
    cacheEvictions: sum("cacheEvictions"),
    cacheEntries: sum("cacheEntries"),
    cacheFragments: sum("cacheFragments"),
    cachePayloadBytes: sum("cachePayloadBytes"),
    peakCacheEntries: max("peakCacheEntries"),
    peakCacheFragments: max("peakCacheFragments"),
    peakCachePayloadBytes: max("peakCachePayloadBytes"),
  });
}

export function verifyStep7DepthHostRun(
  prepared: PreparedStep7Gate3HostRun,
  execution: ExecutedStep7Gate3HostRun,
) {
  const { result } = execution;
  expect(result).toMatchObject({
    status: "complete",
    fullWorkloadComplete: true,
    narrowingExecutionMode: "depth-composed",
    productionFrontierAdmitted: false,
    documentsPublished: false,
    narrowingRefused: false,
    subjectRenderRefused: false,
    candidateRefused: false,
    failure: null,
    cleanupFailures: [],
  });
  expect(result.renders).toHaveLength(14_172);
  expect(result.batches).toHaveLength(30);
  expect(result.batchOutcomes).toHaveLength(30);
  expect(result.parents).toHaveLength(4);
  expect(result.parents.flatMap(({ completeLeaves }) => completeLeaves)).toHaveLength(17);
  expect(result.sharedRenderDemand).toBe(14_172);
  expect(result.parents.reduce((total, parent) => total + parent.narrowingRenders, 0)).toBe(
    result.sharedRenderDemand,
  );
  expect(result.reservations.map(({ requested }) => requested)).toEqual(
    result.batches.map(({ offeredCount }) => offeredCount),
  );
  expect(canonicalTraceDigest(result.batches)).toBe(EXPECTED_BATCHES_DIGEST);
  expect(canonicalTraceDigest(result.batchOutcomes)).toBe(EXPECTED_BATCH_OUTCOMES_DIGEST);
  expect(canonicalTraceDigest(result.reservations)).toBe(EXPECTED_LOGICAL_RESERVATIONS_DIGEST);

  const subjectLeases = result.subjectRenderLeases ?? [];
  expect(subjectLeases).toHaveLength(result.batches.length);
  let committed = 0;
  for (const [index, lease] of subjectLeases.entries()) {
    const batch = result.batches[index]!;
    expect(lease).toMatchObject({
      sourceParentCandidateId: result.parentStarts.find(
        ({ parentCandidateId }) => parentCandidateId === batch.parentCandidateId,
      )?.sourceParentCandidateId,
      parentCandidateId: batch.parentCandidateId,
      committedBefore: committed,
      maximumRequested: 1 + batch.offeredCount * 2,
      admitted: true,
    });
    expect(lease.committedBefore + lease.maximumRequested).toBeLessThanOrEqual(
      STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
    );
    expect(lease.charged + lease.released).toBe(lease.maximumRequested);
    expect(lease.committedAfter).toBe(lease.committedBefore + lease.charged);
    committed = lease.committedAfter;
  }
  expect(result.subjectRenderDemand).toBe(committed);
  expect(committed).toBeLessThanOrEqual(STEP7_GATE3_PRODUCTION_NARROWING_LIMIT);

  const depthStatistics = result.parents.map((parent) => {
    if (parent.depthNarrowing === undefined) {
      throw new TypeError(
        `Depth diagnostic parent ${parent.parentCandidateId} has no depth stats.`,
      );
    }
    expect(parent.renderer).toEqual({
      created: 1,
      renderCalls: parent.depthNarrowing.fallbackCaptures + 4,
      depthSurfaceCalls: parent.depthNarrowing.prefixCaptures,
      sparseDepthSurfaceCalls: parent.depthNarrowing.probeCaptures,
      disposeCalls: 1,
    });
    expect(parent.depthNarrowing.logicalRows).toBe(parent.narrowingRenders);
    expect(parent.depthNarrowing.subjectRenders).toBe(
      parent.depthNarrowing.prefixCaptures +
        parent.depthNarrowing.probeCaptures +
        parent.depthNarrowing.fallbackCaptures,
    );
    expect(parent.depthNarrowing.depthPackPasses).toBe(
      parent.depthNarrowing.prefixCaptures + parent.depthNarrowing.probeCaptures,
    );
    return parent.depthNarrowing;
  });
  const totals = sumStatistics(depthStatistics);
  expect(totals.logicalRows).toBe(14_172);
  expect(totals.prefixCaptures).toBe(30);
  expect(totals.subjectRenders).toBe(result.subjectRenderDemand);
  expect(totals.depthPackPixels).toBe(
    totals.depthPackPasses * result.panel!.width * result.panel!.height,
  );

  expect(canonicalTraceDigest(result.renders)).toBe(STEP7_DEPTH_RENDER_ROWS_DIGEST);
  expect(canonicalTraceDigest(result.parents.flatMap(({ completeLeaves }) => completeLeaves))).toBe(
    STEP7_DEPTH_CANDIDATE_RECORDS_DIGEST,
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
  expect(Object.values(batchesByParent).map(({ digest }) => digest)).toEqual(
    EXPECTED_BATCH_DIGESTS,
  );

  const nodeReplay = replayStep7Gate3InNode({
    baseDocument: prepared.baseDocument as BrickDocumentV1,
    origins: prepared.origins,
    pieces: prepared.exactBrowserInput.panel.pieces,
    minimumScoreMargin: prepared.exactBrowserInput.options.minimumScoreMargin,
    browser: result,
  });
  expect(nodeReplay).toMatchObject({
    sourceParentsVerified: true,
    selectionReplayVerified: true,
    batchesVerified: 30,
    childrenVerified: 17,
  });

  const mutatedRows = result.renders.map((row, index) =>
    index === 0 ? { ...row, probeMaskDigest: `sha256:${"0".repeat(64)}` } : row,
  );
  expect(canonicalTraceDigest(mutatedRows)).not.toBe(STEP7_DEPTH_RENDER_ROWS_DIGEST);
  const outcome = result.batchOutcomes.find(
    ({ offeredCount, carriedRowIndices }) => carriedRowIndices.length < offeredCount,
  );
  if (outcome === undefined) throw new TypeError("Depth replay control found no uncarried row.");
  const carried = new Set(outcome.carriedRowIndices);
  const rowIndex = result.renders.findIndex(
    (row) =>
      row.parentCandidateId === outcome.parentCandidateId &&
      row.batchIndex === outcome.batchIndex &&
      !carried.has(row.rowIndex),
  );
  const batchRows = result.renders.filter(
    (row) =>
      row.parentCandidateId === outcome.parentCandidateId && row.batchIndex === outcome.batchIndex,
  );
  if (rowIndex < 0 || batchRows.length === 0) {
    throw new TypeError("Depth replay control could not bind its score row.");
  }
  const tamperedScore =
    Math.max(...batchRows.map(({ score }) => score)) +
    prepared.exactBrowserInput.options.minimumScoreMargin +
    1;
  const tamperedResult: Step7Gate3BrowserResult = {
    ...result,
    renders: result.renders.map((row, index) =>
      index === rowIndex
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
  };
  expect(() =>
    replayStep7Gate3InNode({
      baseDocument: prepared.baseDocument as BrickDocumentV1,
      origins: prepared.origins,
      pieces: prepared.exactBrowserInput.panel.pieces,
      minimumScoreMargin: prepared.exactBrowserInput.options.minimumScoreMargin,
      browser: tamperedResult,
    }),
  ).toThrow(/score-margin policy/u);

  if (result.panelPng === null || result.panel === null) {
    throw new TypeError("Completed depth diagnostic produced no step-7 panel PNG.");
  }
  const panelPngBytes = decodeRealBuildPngCapture(result.panelPng);
  const outputPanel = Object.freeze({
    file: "step-007-panel.png" as const,
    bytes: panelPngBytes.length,
    digest: sha256(panelPngBytes),
  });
  const { panelPng: _panelPng, ...browserTrace } = result;
  void _panelPng;
  return Object.freeze({
    nodeReplay,
    totals,
    batchesByParent,
    panelPngBytes,
    outputPanel,
    browserTrace,
  });
}

export function retainVerifiedStep7DepthHostRun(input: {
  readonly prepared: PreparedStep7Gate3HostRun;
  readonly execution: ExecutedStep7Gate3HostRun;
  readonly verification: ReturnType<typeof verifyStep7DepthHostRun>;
  readonly outputRoot: string;
}) {
  const { execution, verification } = input;
  const traceBase = {
    schemaVersion: "lego.step7-depth-diagnostic-trace/1" as const,
    authority: "local-diagnostic" as const,
    productionFrontierAdmitted: false as const,
    documentsPublished: false as const,
    browserInputDigest: input.prepared.browserInputDigest,
    renderRowsDigest: STEP7_DEPTH_RENDER_ROWS_DIGEST,
    candidateRecordsDigest: STEP7_DEPTH_CANDIDATE_RECORDS_DIGEST,
    totals: verification.totals,
    batchesByParent: verification.batchesByParent,
    nodeReplay: verification.nodeReplay,
    outputPanel: verification.outputPanel,
    sourceExecution: execution.sourceExecution,
    servedJavaScript: execution.servedJavaScript,
    executionPolicyControl: execution.executionPolicyControl,
    blankRunnerBefore: execution.blankRunnerBefore,
    blankRunnerAfter: execution.blankRunnerAfter,
    browser: verification.browserTrace,
  };
  const trace = Object.freeze({ ...traceBase, traceDigest: canonicalTraceDigest(traceBase) });
  return retainStep7Gate3DiagnosticOutput({
    outputRoot: input.outputRoot,
    trace,
    panelPngBytes: verification.panelPngBytes,
    summary: {
      schemaVersion: "lego.step7-depth-diagnostic-summary/1",
      status: "complete",
      authority: "local-diagnostic",
      renderRowsDigest: STEP7_DEPTH_RENDER_ROWS_DIGEST,
      candidateRecordsDigest: STEP7_DEPTH_CANDIDATE_RECORDS_DIGEST,
      logicalRows: verification.totals.logicalRows,
      subjectRenders: verification.totals.subjectRenders,
      productionSubjectRenderLimit: STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
      prefixCaptures: verification.totals.prefixCaptures,
      probeCaptures: verification.totals.probeCaptures,
      fallbackCaptures: verification.totals.fallbackCaptures,
      equalDepthFallbacks: verification.totals.equalDepthFallbacks,
      depthPackPasses: verification.totals.depthPackPasses,
      depthPackPixels: verification.totals.depthPackPixels,
      cacheHits: verification.totals.cacheHits,
      cacheMisses: verification.totals.cacheMisses,
      cacheEvictions: verification.totals.cacheEvictions,
      peakCacheEntries: verification.totals.peakCacheEntries,
      peakCacheFragments: verification.totals.peakCacheFragments,
      peakCachePayloadBytes: verification.totals.peakCachePayloadBytes,
      nodeReplay: verification.nodeReplay,
      outputPanel: verification.outputPanel,
    },
  });
}
