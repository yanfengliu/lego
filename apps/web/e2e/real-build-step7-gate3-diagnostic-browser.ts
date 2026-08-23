import {
  createNarrowingRenderBudgetLedger,
  createWholeStepCandidateBudgetLedger,
  type NarrowingRenderBudgetLedger,
} from "./real-build-deferral";
import {
  expandFartherPrintedStep,
  type FartherNarrowingBatchObservation,
  type FartherNarrowingBatchOutcomeObservation,
  type FartherNarrowingRenderObservation,
} from "./real-build-farther-step";
import {
  prepareDigestBoundPdf,
  prepareRealBuildModules,
  rgbaPngDataUrl,
} from "./real-build-browser-preflight";
import { derivePanelRasterEvidence, renderRealBuildPageCanvas } from "./real-build-panel-raster";
import {
  assertInputProjection,
  describeBrowserThrown,
  freezeDataOnlyGraph,
  sha256Utf8,
  STEP7_GATE3_CANDIDATE_LIMIT,
  STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT,
  STEP7_GATE3_MAXIMUM_BATCHES,
  STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
  type ParentObservation,
  type RendererObservation,
  type ReservationObservation,
  type Step7Gate3BrowserInput,
  type Step7Gate3BrowserResult,
} from "./real-build-step7-gate3-diagnostic-browser-contract";
import {
  instrumentRendering,
  productionShadowRefusal,
  reconstructParentsWithCurrentModules,
} from "./real-build-step7-gate3-diagnostic-browser-support";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";

export {
  STEP7_GATE3_CANDIDATE_LIMIT,
  STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT,
  STEP7_GATE3_MODULE_INITIALIZATION_EVAL_BLOCKED,
  STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
  type Step7Gate3BrowserInput,
  type Step7Gate3BrowserResult,
  type Step7Gate3Origin,
  type Step7Gate3Panel,
  type Step7Gate3RuntimeOptions,
} from "./real-build-step7-gate3-diagnostic-browser-contract";

export async function reconstructStep7Gate3ParentsOnly(
  input: Step7Gate3BrowserInput,
  expectedBrowserInputDigest: string,
) {
  assertInputProjection(input);
  const inputBytesBefore = JSON.stringify(input);
  freezeDataOnlyGraph(input);
  const inputFrozen = Object.isFrozen(input);
  const browserInputDigestBefore = await sha256Utf8(inputBytesBefore);
  if (browserInputDigestBefore !== expectedBrowserInputDigest) {
    throw new TypeError(
      `Parent-only browser input digest ${browserInputDigestBefore} did not match host digest ${expectedBrowserInputDigest}.`,
    );
  }
  const modules = await prepareRealBuildModules(input.options as unknown as RealBuildOptions);
  if (modules.kernel.documentStructuralHash(input.baseDocument) !== input.baseDocumentHash) {
    throw new TypeError("Parent-only Gate-3 input did not reproduce its base structural hash.");
  }
  const { reconstruction } = reconstructParentsWithCurrentModules(input, modules);
  const inputBytesAfter = JSON.stringify(input);
  const browserInputDigestAfter = await sha256Utf8(inputBytesAfter);
  if (
    inputBytesAfter !== inputBytesBefore ||
    browserInputDigestAfter !== browserInputDigestBefore
  ) {
    throw new TypeError("Parent-only frozen browser input changed during reconstruction.");
  }
  return Object.freeze({
    schemaVersion: "lego.step7-gate3-parent-only-browser/1" as const,
    sourceParentIds: Object.freeze(reconstruction.parents.map(({ origin }) => origin.candidateId)),
    currentParentIds: Object.freeze(reconstruction.parents.map(({ candidateId }) => candidateId)),
    migrationReport: reconstruction.migrationReport,
    inputFrozen,
    browserInputDigestBefore,
    browserInputDigestAfter,
  });
}

export async function runStep7Gate3Diagnostic(
  input: Step7Gate3BrowserInput,
  expectedBrowserInputDigest: string,
): Promise<Step7Gate3BrowserResult> {
  const batches: FartherNarrowingBatchObservation[] = [];
  const batchOutcomes: FartherNarrowingBatchOutcomeObservation[] = [];
  const renders: FartherNarrowingRenderObservation[] = [];
  const reservations: ReservationObservation[] = [];
  const parents: ParentObservation[] = [];
  const parentStarts: { sourceParentCandidateId: string; parentCandidateId: string }[] = [];
  const parentTerminals: { sourceParentCandidateId: string; parentCandidateId: string }[] = [];
  const cleanupFailures: string[] = [];
  let panel: Step7Gate3BrowserResult["panel"] = null;
  let panelPng: string | null = null;
  let migrationReport: Step7Gate3BrowserResult["migrationReport"] = null;
  let migrationPartsPreserved = false;
  let parentMigrations: Step7Gate3BrowserResult["parentMigrations"] = [];
  let activeSourceParentId = "unstarted";
  let activeParentId = "unstarted";
  let modules: Awaited<ReturnType<typeof prepareRealBuildModules>> | null = null;
  let loadingTask: ReturnType<typeof JSON.parse> | null = null;
  let renderedPage: Awaited<ReturnType<typeof renderRealBuildPageCanvas>> | null = null;
  let rawLedger: ReturnType<typeof createNarrowingRenderBudgetLedger> | null = null;
  let candidateLedger: ReturnType<typeof createWholeStepCandidateBudgetLedger> | null = null;
  let failure: string | null = null;
  let inputBytesBefore: string | null = null;
  let browserInputDigestBefore: string | null = null;
  let browserInputDigestAfter: string | null = null;
  let inputFrozen = false;
  let inputMutation: boolean;
  let inputDocumentBytesBefore: string | null = null;
  let inputDocumentHashBefore: string | null = null;
  let inputDocumentFrozen = false;
  let inputDocumentMutation: boolean;

  try {
    assertInputProjection(input);
    inputBytesBefore = JSON.stringify(input);
    inputDocumentBytesBefore = JSON.stringify(input.baseDocument);
    freezeDataOnlyGraph(input);
    inputFrozen = Object.isFrozen(input);
    inputDocumentFrozen = Object.isFrozen(input.baseDocument);
    browserInputDigestBefore = await sha256Utf8(inputBytesBefore);
    if (browserInputDigestBefore !== expectedBrowserInputDigest) {
      throw new TypeError(
        `Browser Gate-3 input digest ${browserInputDigestBefore} did not match host digest ${expectedBrowserInputDigest}.`,
      );
    }
    modules = await prepareRealBuildModules(input.options as unknown as RealBuildOptions);
    const preparedPdf = await prepareDigestBoundPdf(
      modules.pdfjs,
      input.options as unknown as RealBuildOptions,
    );
    loadingTask = preparedPdf.loadingTask;
    renderedPage = await renderRealBuildPageCanvas(
      preparedPdf.pdf,
      input.panel.pageNumber,
      input.options.renderScale,
    );
    const evidence = derivePanelRasterEvidence({
      pageCanvas: renderedPage.canvas,
      spec: input.panel as unknown as RealBuildPanelSpec,
      options: input.options,
      modules: { lattice: modules.lattice, assembly: modules.assembly },
    });
    const hashBytes = (value: Uint8Array | Uint8ClampedArray): string =>
      `sha256:${modules!.kernel.sha256Hex(Uint8Array.from(value)) as string}`;
    panel = {
      stepNumber: 7,
      pageNumber: 13,
      width: evidence.width,
      height: evidence.height,
      workPixelsDigest: hashBytes(evidence.workPixels),
      builtMaskDigest: hashBytes(evidence.builtMask),
      highlightMaskDigest: hashBytes(evidence.highlight.mask),
      highlightStrokeMaskDigest: hashBytes(evidence.highlight.strokeMask),
      fit: evidence.faceCorrectedFit,
    };
    panelPng = rgbaPngDataUrl(evidence.workPixels, evidence.width, evidence.height);

    inputDocumentHashBefore = modules.kernel.documentStructuralHash(input.baseDocument) as string;
    if (inputDocumentHashBefore !== input.baseDocumentHash) {
      throw new TypeError(
        "The retained step-5 diagnostic prefix did not reproduce its declared hash.",
      );
    }
    const { reconstruction, currentPlace } = reconstructParentsWithCurrentModules(input, modules);
    const reconstructed = reconstruction.parents;
    migrationReport = reconstruction.migrationReport;
    parentMigrations = Object.freeze(
      reconstructed.map((parent) =>
        Object.freeze({
          sourceParentCandidateId: parent.origin.candidateId,
          sourceDocumentHash: parent.sourceDocumentHash,
          sourceHashVerified: parent.sourceDocumentHash === parent.origin.documentHash,
          parentCandidateId: parent.candidateId,
          currentDocumentHash: parent.documentHash,
          partsPreserved: parent.partsPreserved,
        }),
      ),
    );
    migrationPartsPreserved = parentMigrations.every(
      ({ sourceHashVerified, partsPreserved }) => sourceHashVerified && partsPreserved,
    );

    rawLedger = createNarrowingRenderBudgetLedger(STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT);
    const ledger: NarrowingRenderBudgetLedger = Object.freeze({
      get budget() {
        return rawLedger!.budget;
      },
      get reserved() {
        return rawLedger!.reserved;
      },
      get refusedReservation() {
        return rawLedger!.refusedReservation;
      },
      get failedReservation() {
        return rawLedger!.failedReservation;
      },
      tryReserve(requested: number) {
        const reservedBefore = rawLedger!.reserved;
        const accepted = rawLedger!.tryReserve(requested);
        reservations.push(
          Object.freeze({
            sourceParentCandidateId: activeSourceParentId,
            parentCandidateId: activeParentId,
            reservedBefore,
            requested,
            reservedAfter: rawLedger!.reserved,
            accepted,
          }),
        );
        return accepted;
      },
    });
    candidateLedger = createWholeStepCandidateBudgetLedger(STEP7_GATE3_CANDIDATE_LIMIT);
    const currentRenderer: { value: RendererObservation | null } = { value: null };
    const rendering = instrumentRendering(modules.rendering, currentRenderer);

    for (const parent of reconstructed) {
      activeSourceParentId = parent.origin.candidateId;
      activeParentId = parent.candidateId;
      const marker = Object.freeze({
        sourceParentCandidateId: parent.origin.candidateId,
        parentCandidateId: parent.candidateId,
      });
      parentStarts.push(marker);
      const renderer = { created: 0, renderCalls: 0, disposeCalls: 0 };
      currentRenderer.value = renderer;
      const candidateBefore = candidateLedger.reserved;
      const beforeRasterHash = modules.kernel.documentStructuralHash(parent.document) as string;
      if (beforeRasterHash !== parent.documentHash) {
        throw new TypeError(`Parent ${activeParentId} changed before expansion.`);
      }
      const result = expandFartherPrintedStep({
        parentCandidateId: activeParentId,
        parentDocument: parent.document,
        parentStepId: null,
        spec: input.panel as unknown as RealBuildPanelSpec,
        evidence,
        options: input.options as unknown as RealBuildOptions,
        modules: { rendering, kernel: modules.kernel, assembly: modules.assembly },
        ledger,
        candidateLedger,
        narrowingObserver: {
          beginBatch(observation: FartherNarrowingBatchObservation) {
            if (batches.length >= STEP7_GATE3_MAXIMUM_BATCHES) {
              throw new RangeError(
                `Step-7 diagnostic exceeded ${STEP7_GATE3_MAXIMUM_BATCHES} narrowing batches.`,
              );
            }
            batches.push(observation);
          },
          render(observation: FartherNarrowingRenderObservation) {
            if (!Number.isFinite(observation.score)) {
              throw new TypeError(
                `Parent ${activeParentId} batch ${observation.batchIndex} produced a non-finite score.`,
              );
            }
            if (renders.length >= STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT) {
              throw new RangeError(
                `Step-7 diagnostic exceeded ${STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT} observed score rows.`,
              );
            }
            renders.push(observation);
          },
          endBatch(observation: FartherNarrowingBatchOutcomeObservation) {
            if (batchOutcomes.length >= STEP7_GATE3_MAXIMUM_BATCHES) {
              throw new RangeError(
                `Step-7 diagnostic exceeded ${STEP7_GATE3_MAXIMUM_BATCHES} narrowing batch outcomes.`,
              );
            }
            batchOutcomes.push(observation);
          },
        },
        place: currentPlace,
      });
      currentRenderer.value = null;
      const afterExpansionHash = modules.kernel.documentStructuralHash(parent.document) as string;
      if (
        result.failure !== null ||
        result.narrowingBudgetExhausted ||
        result.candidateBudgetExhausted ||
        afterExpansionHash !== parent.documentHash
      ) {
        throw new TypeError(
          `Parent ${activeParentId} did not complete: ${result.failure?.message ?? "a diagnostic ledger refused"}.`,
        );
      }
      const completeLeaves = result.children.map((child) => {
        const recomputed = modules!.kernel.documentStructuralHash(child.document) as string;
        if (recomputed !== child.documentHash || child.candidateId !== `step-007:${recomputed}`) {
          throw new TypeError(`Child ${child.candidateId} did not reproduce its document hash.`);
        }
        return Object.freeze({
          candidateId: child.candidateId,
          documentHash: child.documentHash,
          pieces: child.pieces,
        });
      });
      const parentRenderRows = renders.filter(
        ({ parentCandidateId }) => parentCandidateId === activeParentId,
      ).length;
      if (
        renderer.created !== 1 ||
        renderer.disposeCalls !== 1 ||
        renderer.renderCalls !== result.expansion.narrowingRenders + 4 ||
        result.expansion.narrowingRenders !== parentRenderRows
      ) {
        throw new TypeError(
          `Parent ${activeParentId} renderer accounting was ${JSON.stringify(renderer)} for ${parentRenderRows} narrowing rows.`,
        );
      }
      parents.push(
        Object.freeze({
          sourceParentCandidateId: parent.origin.candidateId,
          parentCandidateId: activeParentId,
          sourceDocumentHash: parent.sourceDocumentHash,
          reconstructedDocumentHash: parent.documentHash,
          hashAfterRasterPreparation: beforeRasterHash,
          hashAfterExpansion: afterExpansionHash,
          narrowingRenders: result.expansion.narrowingRenders,
          offeredPerPiece: result.expansion.offeredPerPiece,
          carriedPerPiece: result.expansion.carriedPerPiece,
          completeLeaves: Object.freeze(completeLeaves),
          renderer: Object.freeze({ ...renderer }),
          candidateLedgerDelta: candidateLedger.reserved - candidateBefore,
        }),
      );
      parentTerminals.push(marker);
    }
  } catch (error) {
    failure = describeBrowserThrown(error);
  } finally {
    if (renderedPage !== null) {
      try {
        renderedPage.dispose();
      } catch (error) {
        cleanupFailures.push(`Booklet page cleanup failed: ${describeBrowserThrown(error)}.`);
      }
    }
    if (loadingTask !== null) {
      try {
        await loadingTask.destroy();
      } catch (error) {
        cleanupFailures.push(`PDF loading-task cleanup failed: ${describeBrowserThrown(error)}.`);
      }
    }
    try {
      const inputBytesAfter = JSON.stringify(input);
      browserInputDigestAfter = await sha256Utf8(inputBytesAfter);
      inputMutation =
        inputBytesBefore === null ||
        inputBytesAfter !== inputBytesBefore ||
        browserInputDigestBefore === null ||
        browserInputDigestAfter !== browserInputDigestBefore;
      const inputDocumentBytesAfter = JSON.stringify(input.baseDocument);
      const inputDocumentHashAfter =
        modules === null
          ? null
          : (modules.kernel.documentStructuralHash(input.baseDocument) as string);
      inputDocumentMutation =
        inputDocumentBytesBefore === null ||
        inputDocumentBytesAfter !== inputDocumentBytesBefore ||
        (inputDocumentHashBefore !== null && inputDocumentHashAfter !== inputDocumentHashBefore);
    } catch (error) {
      inputMutation = true;
      inputDocumentMutation = true;
      cleanupFailures.push(`Input closure check failed: ${describeBrowserThrown(error)}.`);
    }
    if (inputMutation) {
      const mutationFailure =
        "The supplied Gate-3 browser input changed after its frozen pre-work snapshot.";
      failure = failure === null ? mutationFailure : `${failure} ${mutationFailure}`;
    }
    if (inputDocumentMutation) {
      const mutationFailure =
        "The supplied Gate-3 input document changed after its frozen pre-work snapshot.";
      failure = failure === null ? mutationFailure : `${failure} ${mutationFailure}`;
    }
  }

  const fullWorkloadComplete =
    failure === null &&
    cleanupFailures.length === 0 &&
    parents.length === 4 &&
    batchOutcomes.length === batches.length &&
    parentStarts.length === 4 &&
    parentTerminals.length === 4 &&
    JSON.stringify(parentStarts) === JSON.stringify(parentTerminals) &&
    parentMigrations.length === 4 &&
    migrationPartsPreserved &&
    inputFrozen &&
    !inputMutation &&
    browserInputDigestBefore !== null &&
    browserInputDigestBefore === expectedBrowserInputDigest &&
    browserInputDigestAfter === browserInputDigestBefore &&
    inputDocumentFrozen &&
    !inputDocumentMutation &&
    rawLedger !== null &&
    candidateLedger !== null &&
    !rawLedger.refusedReservation &&
    !candidateLedger.refusedReservation;
  return {
    schemaVersion: "lego.step7-gate3-diagnostic-browser-result/1",
    status: fullWorkloadComplete ? "complete" : "failed",
    fullWorkloadComplete,
    productionFrontierAdmitted: false,
    documentsPublished: false,
    inputFrozen,
    inputMutation,
    browserInputDigestBefore,
    browserInputDigestAfter,
    inputDocumentFrozen,
    inputDocumentMutation,
    observationMode: input.observationMode,
    sourceBaseDocumentHash: input.baseDocumentHash,
    migrationReport,
    migrationPartsPreserved,
    parentMigrations,
    productionNarrowingLimit: STEP7_GATE3_PRODUCTION_NARROWING_LIMIT,
    diagnosticNarrowingLimit: STEP7_GATE3_DIAGNOSTIC_NARROWING_LIMIT,
    candidateLimit: STEP7_GATE3_CANDIDATE_LIMIT,
    orderedSourceParentIds: input.origins.map(({ candidateId }) => candidateId),
    orderedParentIds: parents.map(({ parentCandidateId }) => parentCandidateId),
    parentStarts: Object.freeze(parentStarts),
    parentTerminals: Object.freeze(parentTerminals),
    parentAttempts: parents.length,
    panel,
    panelPng,
    parents: Object.freeze(parents),
    batches: Object.freeze(batches),
    batchOutcomes: Object.freeze(batchOutcomes),
    renders: Object.freeze(renders),
    reservations: Object.freeze(reservations),
    sharedRenderDemand: rawLedger?.reserved ?? 0,
    candidateDemand: candidateLedger?.reserved ?? 0,
    narrowingRefused: rawLedger?.refusedReservation ?? false,
    candidateRefused: candidateLedger?.refusedReservation ?? false,
    production8192ShadowRefusal: productionShadowRefusal(reservations),
    cleanupFailures: Object.freeze(cleanupFailures),
    failure,
  };
}
