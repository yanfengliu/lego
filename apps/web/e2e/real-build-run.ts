import type { Sha256Digest } from "@lego-studio/brick-kernel";

import {
  placementSignalFailure,
  settleAtomicStep,
  stepPrerequisiteFacts,
  stepPrerequisiteFailure,
  type StepFailure,
  type RealBuildOptions,
  type RealBuildPieceReport,
  type RealBuildStepReport,
  type StepOutcome,
  type SuccessfulStepMechanism,
  type WholeStepVisualEvidence,
} from "./real-build-safety";
import type { RealBuildBrowserOutput } from "./real-build-browser-output";
import {
  executeCanonicalTransition,
  preflightRealBuildOptions,
  validateRealBuildCandidate,
} from "./real-build-contract";
import {
  adaptFixedLedgerPlacement,
  canonicalPartsFromDocument,
  executeMultiBuildLedgerStep,
  rollbackPlacedPieceReports,
  type RuntimeBrickIdentity,
} from "./real-build-fixed-actions";
import { UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME } from "./real-build-panel-camera-resolver-boundary";
import { type DeferralEvidence, type DeferralTrigger } from "./real-build-deferral";
import { settleExplodedPrintedStep, type ExplodedGhostEvidence } from "./real-build-exploded-step";
import { composeExecutedStepReport } from "./real-build-step-report";
import { derivePanelRasterEvidence } from "./real-build-panel-raster";
import {
  assessRunWholeStepVisualEvidence,
  createRunDeferredPanelCoordinator,
  createRunOwnPanelScorer,
  prepareRunStepCamera,
  renderRunBuildPng,
} from "./real-build-run-visual";
import { executeRunDirectPlacements } from "./real-build-run-placement";
import { executeRunFixedActionWithPhysicalAuthority } from "./real-build-run-fixed-actions";
import { createRealBuildRunRootPanelCamera } from "./real-build-run-camera-root";
import {
  blockedRealBuildRunStepReport,
  failedRealBuildPageReport,
  failedRealBuildPanelEvidenceReport,
} from "./real-build-run-blocked-step";
import { createRealBuildRunPlacer } from "./real-build-run-placer";
import { createRealBuildRunPageCursor } from "./real-build-run-page-cursor";
import { retainedRealBuildRunOutput } from "./real-build-run-output";
import { createRealBuildRunProvisionalAuthority } from "./real-build-run-provisional-authority";
import { describeBrowserThrown } from "./real-build-browser-error-boundary";
import { realBuildCleanupFailure, retainRealBuildCleanupFailure } from "./real-build-run-cleanup";
import {
  BrowserPreparationError,
  browserPreparationFailure,
  failedBrowserOutput,
  prepareDigestBoundPdf,
  prepareRealBuildModules,
  rgbaPngDataUrl,
} from "./real-build-browser-preflight";
import {
  realBuildRunInputDriftFailure,
  snapshotRealBuildRunInput,
} from "./real-build-run-input-snapshot";

const STROKE_TOLERANCE_PX = 3;

export async function runRealBuild(
  suppliedOptions: RealBuildOptions,
): Promise<RealBuildBrowserOutput> {
  const runStarted = performance.now();
  let inputSnapshot;
  try {
    inputSnapshot = snapshotRealBuildRunInput(suppliedOptions);
  } catch (error) {
    return failedBrowserOutput(
      {
        code: "printed-step-sequence-invalid",
        stage: "input",
        inputKey: "panels",
        message:
          `The complete real-build panel input could not be detached as bounded plain data before ` +
          `asynchronous preparation: ${describeBrowserThrown(error)}. No module, PDF page, candidate ` +
          `search, or placement was started.`,
      },
      runStarted,
    );
  }
  const { options } = inputSnapshot;
  const inputFailures = preflightRealBuildOptions(options);
  if (inputFailures.length > 0) return failedBrowserOutput(inputFailures[0]!, runStarted);
  let modules;
  try {
    modules = await prepareRealBuildModules(options);
  } catch (error) {
    const preparationFailure = browserPreparationFailure(error);
    return failedBrowserOutput(
      preparationFailure ??
        ({
          code: "dynamic-import-failed",
          stage: "loading",
          message: `Real-build module loading failed unexpectedly: ${describeBrowserThrown(error)}.`,
        } satisfies StepFailure),
      runStarted,
    );
  }
  const { pdfjs, lattice, rendering, kernel, commands, assembly } = modules;
  let preparedPdf;
  try {
    preparedPdf = await prepareDigestBoundPdf(pdfjs, options);
  } catch (error) {
    const preparationFailure = browserPreparationFailure(error);
    return failedBrowserOutput(
      preparationFailure ??
        ({
          code: "pdf-load-failed",
          stage: "loading",
          inputKey: "pdf",
          message: `Real-build PDF preparation failed unexpectedly: ${describeBrowserThrown(error)}.`,
        } satisfies StepFailure),
      runStarted,
    );
  }
  const { pdf, loadingTask, fetchedPdfDigest } = preparedPdf;
  let retainedOutput: RealBuildBrowserOutput | null = null;
  let pdfCleanupFailure: StepFailure | null = null;
  try {
    try {
      const driftFailure = realBuildRunInputDriftFailure(inputSnapshot);
      if (driftFailure !== null) throw new BrowserPreparationError(driftFailure);
      const provisionalPreparation = createRealBuildRunProvisionalAuthority({
        options,
        canonicalRunInput: inputSnapshot.canonical,
        fetchedPdfDigest,
        moduleObjects: [pdfjs, lattice, rendering, kernel, commands, assembly],
        pdf,
        loadingTask,
      });

      const reports: RealBuildStepReport[] = [];
      let document_ = kernel.createEmptyBrickDocument({
        id: "real-build",
        name: "Real booklet rebuild",
        maxParts: options.maxParts,
      });
      let blockingStep: number | null = null;
      const partIdByIdentity = new Map<string, RuntimeBrickIdentity>();
      const rootDocumentHash = kernel.documentStructuralHash(document_) as Sha256Digest;
      const rootPanelCamera = createRealBuildRunRootPanelCamera({
        document: document_ as { readonly parts: readonly unknown[] },
        documentHash: rootDocumentHash,
        branchBudget: options.panelCameraBranchBudget,
        hashDocument: (document) => kernel.documentStructuralHash(document) as Sha256Digest,
      });

      const place = createRealBuildRunPlacer(commands, kernel);
      const executionPanels = [...options.panels].sort(
        (left, right) => left.stepNumber - right.stepNumber,
      );
      const observationPanels = [...executionPanels, ...options.passivePanels].sort(
        (left, right) => left.stepNumber - right.stepNumber,
      );

      document.querySelectorAll("canvas.page-probe").forEach((node) => node.remove());
      const pageCursor = createRealBuildRunPageCursor(pdf, options.renderScale);
      let pageCleanupFailure: StepFailure | null = null;
      try {
        for (const spec of executionPanels) {
          const expectedStepNumber = reports.length + 1;
          if (spec.stepNumber !== expectedStepNumber) {
            throw new BrowserPreparationError({
              code: "printed-step-sequence-invalid",
              stage: "input",
              stepNumber: spec.stepNumber,
              inputKey: "panels",
              message:
                `The next executable panel is printed step ${spec.stepNumber}, but ${reports.length} ` +
                `scoreboard row(s) exist, so step ${expectedStepNumber} is required. Execution order is ` +
                `asserted before page rasterization, candidate search, or placement.`,
            });
          }

          if (blockingStep !== null) {
            reports.push(
              blockedRealBuildRunStepReport({
                panel: spec,
                blockingStep,
                documentParts: (document_ as { parts: unknown[] }).parts.length,
              }),
            );
            continue;
          }

          const { page, failure: pageFailure } = await pageCursor.select(spec.pageNumber);

          if (page === null) {
            reports.push(
              failedRealBuildPageReport({
                panel: spec,
                pageNumber: spec.pageNumber,
                pageFailure,
                blockingStep,
                documentParts: (document_ as { parts: unknown[] }).parts.length,
                panelCamera: spec.stepNumber === 1 ? rootPanelCamera : null,
              }),
            );
            if (blockingStep === null) blockingStep = spec.stepNumber;
            continue;
          }

          const pageCanvas = page.canvas;
          const stepStarted = performance.now();
          const stepBaseDocument = document_;
          try {
            const evidence = derivePanelRasterEvidence({
              pageCanvas,
              spec,
              options,
              modules: { lattice, assembly },
            });
            try {
              provisionalPreparation?.(spec, page, pageCanvas, evidence);
            } catch {
              // Shadow-only until the next browser-output generation.
            }
            const {
              width,
              height,
              highlight,
              highlightBox,
              builtMask: built,
              arrows,
              arrowFamily,
            } = evidence;
            const fit = {
              solution: evidence.fitSolution,
              failure: evidence.fitFailure,
              coherence: evidence.fitCoherence,
            };
            const factor = options.workFactor;

            const pieceReports: RealBuildPieceReport[] = [];
            let candidateDocument = stepBaseDocument;
            let attemptedMechanism: SuccessfulStepMechanism | null = null;
            let failedMechanism: "deferred" | "blocked" = "deferred";
            let failure: StepFailure | null = null;
            let outcome: StepOutcome | null = null;
            let cameraReport: RealBuildStepReport["camera"] = null;
            const panelCamera: RealBuildStepReport["panelCamera"] =
              spec.stepNumber === 1 ? rootPanelCamera : null;
            let panelPng: string | null = null;
            let buildPng: string | null = null;
            panelPng = rgbaPngDataUrl(evidence.workPixels, width, height);
            let jointVisual: WholeStepVisualEvidence | null = null;
            let candidatePlaced = 0;
            const candidatePartIds: string[] = [];
            const pendingRegistrations: RuntimeBrickIdentity[] = [];
            let placed = 0;
            let printedStepId: string | null = null;
            let validation: RealBuildStepReport["validation"] = {
              attempted: false,
              targetDocumentHash: null,
              truthSnapshotHash: null,
              validatorSetHash: null,
              documentGloballyValid: null,
              blockingIssues: [],
              failure: null,
            };

            const parts = (stepBaseDocument as { parts: unknown[] }).parts;
            const anchorStep = parts.length === 0;

            const noSignal = placementSignalFailure({
              stepNumber: spec.stepNumber,
              hasHighlight: highlightBox !== null,
              detectedArrowCount: (arrows.arrows as unknown[]).length,
              usableArrowPlacementCount: arrowFamily.length,
              independentPlacementSignalCount: 0,
            });

            const localScoringSignal =
              highlight.regions.length > 0 && (highlight.keyedPx as number) > 0;
            const placesCallouts = spec.action.kind === "place-callouts" && spec.pieces.length > 0;
            let deferring = !localScoringSignal && placesCallouts;
            let deferralTrigger: DeferralTrigger = "no-local-signal";
            const exploded =
              !deferring &&
              !anchorStep &&
              placesCallouts &&
              (arrows.arrows as unknown[]).length > 0;
            // The panel a deferral would look at, resolved for every step that
            // places pieces rather than only for the ones already known to
            // need it: whether this step's own art can separate its candidates
            // is not known until they have been scored. Resolving it is a
            // lookup; *rasterising* it is not, so that stays on demand below.
            const deferralTarget = placesCallouts
              ? (observationPanels.find((panel) => panel.stepNumber > spec.stepNumber) ?? null)
              : null;
            let deferral: DeferralEvidence | null = null;
            let farther: RealBuildStepReport["farther"] = null;
            let fartherCaptures: RealBuildStepReport["fartherCaptures"] = [];
            let explodedGhost: ExplodedGhostEvidence | null = null;
            const prerequisiteInput = {
              stepNumber: spec.stepNumber,
              actionKind: spec.action.kind,
              blockingStep,
              coverageFailures: spec.coverageFailures,
              unresolvedCallouts: spec.unresolvedCallouts,
              missingDesigns: spec.missingDesigns,
              calloutPieces: spec.calloutPieces,
              expectedAssembledPieces: spec.action.assembledPieces,
              resolvedPieces:
                spec.action.kind === "multi-build-copy"
                  ? spec.action.copies.length
                  : spec.pieces.length + spec.omittedPieces.length,
            };
            const prerequisites = stepPrerequisiteFacts(prerequisiteInput);
            const prerequisite = stepPrerequisiteFailure(prerequisiteInput);

            if (spec.stepNumber === 1) {
              failure = {
                code: "camera-handedness-unresolved",
                stage: "camera-registration",
                stepNumber: spec.stepNumber,
                message:
                  `Step 1 retained all eight unregistered D4 camera roots under the run's cumulative ` +
                  `panel-camera ledger, but placement scoring is not yet carried through those immutable ` +
                  `lineages. No scalar hand or quarter turn may stand in for that missing integration, so ` +
                  `the canonical document remains empty and later steps are blocked.`,
              };
            } else if (prerequisite !== null) {
              failedMechanism = prerequisite.mechanism;
              failure = prerequisite.failure;
            } else if (spec.action.kind === "place-callouts" && spec.omittedPieces.length > 0) {
              attemptedMechanism = "official-ledger";
              const guarded = executeRunFixedActionWithPhysicalAuthority({
                stepNumber: spec.stepNumber,
                actionKind: "omitted-ledger-pieces",
                sourceDocumentHash: options.inputDigests.officialModel,
                frameDecision: UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME,
                rollbackDocument: stepBaseDocument,
                execute: () => {
                  throw new TypeError(
                    `Printed step ${spec.stepNumber} cannot execute omitted ledger pieces before its direct ` +
                      `placements; physical-frame authority admission requires a new atomic mixed-step executor.`,
                  );
                },
              });
              document_ = guarded.document;
              printedStepId = guarded.stepId;
              candidatePlaced = guarded.placed;
              placed = guarded.placed;
              failure = guarded.failure;
              outcome = {
                status: "failed",
                mechanism: "deferred",
                attemptedMechanism,
                failure,
              };
            } else if (spec.action.kind === "transition") {
              if (spec.action.transition === "unclassified") {
                failure = {
                  code: "unsupported-instruction-action",
                  stage: "input",
                  message:
                    `Step ${spec.stepNumber} has no physical-piece callout but its transition is unclassified. ` +
                    `Classify the printed panel as rotation, attachment, or final view before treating zero pieces as intentional.`,
                };
              } else {
                attemptedMechanism = "instruction-transition";
                const transitioned = executeCanonicalTransition({
                  baseDocument: stepBaseDocument,
                  printedStepNumber: spec.stepNumber,
                  transition: spec.action.transition,
                  panelEvidenceDigest: spec.action.panelEvidenceDigest!,
                  steps: (
                    stepBaseDocument as {
                      steps: readonly {
                        id: string;
                        index: number;
                        name: string;
                        partIds: readonly string[];
                      }[];
                    }
                  ).steps,
                  applyOperations: (base, operations) =>
                    kernel.applyBuildOperations(base, operations),
                  validate: (document) => kernel.validateBrickDocument(document),
                });
                validation = transitioned.validation;
                failure = transitioned.failure;
                if (failure === null) {
                  document_ = transitioned.document;
                  printedStepId = transitioned.stepId;
                  outcome = {
                    status: "complete",
                    mechanism: "instruction-transition",
                    failure: null,
                  };
                }
              }
            } else if (spec.action.kind === "multi-build-copy") {
              attemptedMechanism = "official-ledger";
              const multiBuildAction = spec.action;
              const guarded = executeRunFixedActionWithPhysicalAuthority({
                stepNumber: spec.stepNumber,
                actionKind: "multi-build-copy",
                sourceDocumentHash: options.inputDigests.officialModel,
                frameDecision: UNRESOLVED_PANEL_CAMERA_PHYSICAL_FRAME,
                rollbackDocument: stepBaseDocument,
                execute: () =>
                  executeMultiBuildLedgerStep({
                    stepNumber: spec.stepNumber,
                    baseDocument: stepBaseDocument,
                    expectedPieces: multiBuildAction.assembledPieces,
                    pieces: multiBuildAction.copies,
                    priorIdentities: partIdByIdentity,
                    getParts: canonicalPartsFromDocument,
                    structuralHash: (subject) => kernel.documentStructuralHash(subject) as string,
                    place: adaptFixedLedgerPlacement(place, spec.stepNumber),
                    assess: (subject) =>
                      validateRealBuildCandidate({
                        stepNumber: spec.stepNumber,
                        document: subject,
                        validate: (document) => kernel.validateBrickDocument(document),
                      }),
                  }),
              });
              document_ = guarded.document;
              printedStepId = guarded.stepId;
              candidatePlaced = guarded.placed;
              placed = guarded.placed;
              failure = guarded.failure;
              outcome = {
                status: "failed",
                mechanism: "deferred",
                attemptedMechanism,
                failure,
              };
            } else if (fit.failure !== null) {
              failure = {
                code: "camera-fit-failed",
                stage: "camera-fit",
                message: `Step ${spec.stepNumber} has no usable camera fit: ${fit.failure}`,
              };
            } else if (spec.panelFace === null) {
              failure = {
                code: "panel-face-unknown",
                stage: "camera-fit",
                message:
                  `Step ${spec.stepNumber} has no derived panel face, so which side of the model the panel ` +
                  `is drawn from is unknown. This booklet turns the model over mid-build and the face is a ` +
                  `running parity from printed step 1, so it is derivable only over a contiguous prefix of ` +
                  `steps whose rotate-the-model icons have all been read. Rendering the candidate anyway ` +
                  `would score it against the opposite face of the drawing, which no later check reports.`,
                stepNumber: spec.stepNumber,
              };
            } else if (noSignal !== null) {
              failure = noSignal;
            } else {
              const solution = fit.solution as {
                azimuthDegrees: number;
                elevationDegrees: number;
                pixelsPerUnit: number;
                residualPx: number;
              };
              // Derive this from the guarded fit and panel face directly.
              const corrected = assembly.viewForPanelFace(solution, spec.panelFace) as {
                azimuthDegrees: number;
                elevationDegrees: number;
                pixelsPerUnit: number;
                upSign?: 1 | -1;
              };
              // The step-visual coordinator resolves the remaining quarter-turn.
              const fittedView = {
                azimuthDegrees: corrected.azimuthDegrees,
                elevationDegrees: corrected.elevationDegrees,
                pixelsPerUnit: corrected.pixelsPerUnit / factor,
                upSign: corrected.upSign ?? (1 as const),
              };
              const frame = {
                widthPx: width,
                heightPx: height,
                target: [0, 0, 0] as [number, number, number],
                sceneRadius: 60,
              };

              const deferredPanels = createRunDeferredPanelCoordinator({
                spec,
                deferralTarget,
                executionPanels,
                observationPanels,
                currentPageNumber: spec.pageNumber,
                currentPageCanvas: pageCanvas,
                pdf,
                options,
                modules: { lattice, rendering, kernel, assembly },
                baseDocument: stepBaseDocument,
                place,
              });
              if (deferring) await deferredPanels.readLookaheadPanel();
              try {
                const renderer = rendering.createInstructionRenderer({ width, height });
                try {
                  const camera = prepareRunStepCamera({
                    stepNumber: spec.stepNumber,
                    anchorStep,
                    candidateDocument,
                    fittedView,
                    frame,
                    width,
                    height,
                    builtMask: built,
                    highlight,
                    rendering,
                    assembly,
                    renderer,
                  });
                  failure = camera.failure;
                  let { centre } = camera;
                  const { anchorIou, anchorShift, anchorTurn, view, silhouette } = camera;

                  if (failure === null) {
                    let placementMechanism: SuccessfulStepMechanism = deferring
                      ? "deferred-lookahead"
                      : exploded
                        ? "exploded-ghost"
                        : anchorStep
                          ? "anchor-orientation"
                          : "highlight";
                    attemptedMechanism = placementMechanism;
                    const renderAndScore = createRunOwnPanelScorer({
                      stepNumber: spec.stepNumber,
                      anchorStep,
                      getCentre: () => centre,
                      width,
                      height,
                      highlight,
                      tolerancePx: STROKE_TOLERANCE_PX,
                      assembly,
                      silhouette,
                      place,
                    });
                    const deferToLookaheadPanel = async (
                      ownPanelMargin: number | null,
                    ): Promise<void> => {
                      const settledDeferral = await deferredPanels.settle({
                        trigger: deferralTrigger,
                        ownPanelMargin,
                        stepId: printedStepId,
                        scoreOwnPanel: (document, stepId, catalogPartId, transform) =>
                          renderAndScore(document, { catalogPartId, transform }, stepId).score,
                      });
                      deferral = settledDeferral.deferral;
                      farther = settledDeferral.farther;
                      fartherCaptures = settledDeferral.fartherCaptures;
                      failure = settledDeferral.failure;
                      pieceReports.push(...settledDeferral.pieceReports);
                      if (settledDeferral.placement !== null) {
                        candidateDocument = settledDeferral.placement.document;
                        candidatePartIds.push(...settledDeferral.placement.partIds);
                        printedStepId = settledDeferral.placement.stepId;
                        pendingRegistrations.push(...settledDeferral.placement.registrations);
                        candidatePlaced += settledDeferral.placement.partIds.length;
                      }
                    };
                    if (exploded) {
                      const settledExploded = settleExplodedPrintedStep({
                        spec,
                        baseDocument: stepBaseDocument,
                        stepId: printedStepId,
                        evidence,
                        options,
                        view,
                        centrePx: centre,
                        rendering,
                        kernel,
                        assembly,
                        place,
                      });
                      explodedGhost = settledExploded.evidence;
                      failure = settledExploded.failure;
                      pieceReports.push(...settledExploded.pieceReports);
                      if (settledExploded.placement !== null) {
                        candidateDocument = settledExploded.placement.document;
                        candidatePartIds.push(...settledExploded.placement.partIds);
                        printedStepId = settledExploded.placement.stepId;
                        pendingRegistrations.push(...settledExploded.placement.registrations);
                        candidatePlaced += settledExploded.placement.partIds.length;
                      }
                    }
                    if (deferring) await deferToLookaheadPanel(null);
                    // What this step's own panel managed to separate its best
                    // two candidates by is returned with the provisional child
                    // so a deferral can retain the evidence that sent it onward.
                    const directPlacement = executeRunDirectPlacements({
                      stepNumber: spec.stepNumber,
                      pieces: spec.pieces,
                      skip: deferring || exploded,
                      initialDocument: candidateDocument,
                      initialStepId: printedStepId,
                      initialCentre: centre,
                      updateCentre: (nextCentre) => {
                        centre = nextCentre;
                      },
                      initialCandidatePlaced: candidatePlaced,
                      initialFailure: failure,
                      candidatePartIds,
                      pendingRegistrations,
                      pieceReports,
                      anchorStep,
                      highlightBox,
                      width,
                      height,
                      view,
                      frame,
                      options,
                      assembly,
                      rendering,
                      kernel,
                      renderAndScore,
                      place,
                    });
                    candidateDocument = directPlacement.document;
                    printedStepId = directPlacement.printedStepId;
                    centre = directPlacement.centre;
                    candidatePlaced = directPlacement.candidatePlaced;
                    failure = directPlacement.failure;
                    const ownPanelMargin = directPlacement.ownPanelMargin;

                    // The step's own panel drew a highlight, every eligible
                    // placement was scored against it, and the drawing did not
                    // tell the best two apart. That is the second way a panel
                    // fails to answer, and the booklet answers it the same way
                    // as the first: panel N+1 draws what this step built,
                    // seated and unhighlighted, so the whole step is proposed
                    // again there.
                    //
                    // The whole step, not the piece that could not be chosen:
                    // the second piece is enumerated on top of the first, so a
                    // step settled piece by piece against a later panel would
                    // be carrying forward a set built on an unsettled seat.
                    // Everything the local attempt placed is therefore
                    // discarded first, back to the exact printed-step base.
                    if (ownPanelMargin !== null) {
                      await deferredPanels.readLookaheadPanel();
                      deferring = true;
                      deferralTrigger = "unseparated-by-own-panel";
                      placementMechanism = "deferred-lookahead";
                      attemptedMechanism = placementMechanism;
                      candidateDocument = stepBaseDocument;
                      candidatePartIds.length = 0;
                      pendingRegistrations.length = 0;
                      pieceReports.length = 0;
                      candidatePlaced = 0;
                      printedStepId = null;
                      failure = null;
                      await deferToLookaheadPanel(ownPanelMargin);
                    }

                    // No-signal and exploded steps use their own gates; other
                    // complete seated steps must explain their printed highlight.
                    if (
                      failure === null &&
                      !exploded &&
                      !(deferring && deferralTrigger === "no-local-signal") &&
                      candidatePlaced === spec.action.assembledPieces
                    ) {
                      jointVisual = assessRunWholeStepVisualEvidence({
                        stepNumber: spec.stepNumber,
                        document: candidateDocument,
                        partIds: candidatePartIds,
                        centre,
                        width,
                        height,
                        highlight,
                        tolerancePx: STROKE_TOLERANCE_PX,
                        options,
                        rendering,
                        assembly,
                        silhouette,
                      });
                      if (jointVisual.failure !== null) failure = jointVisual.failure;
                    }

                    let hardValidationPassed = false;
                    if (failure === null && candidatePlaced === spec.action.assembledPieces) {
                      const assessed = validateRealBuildCandidate({
                        stepNumber: spec.stepNumber,
                        document: candidateDocument,
                        validate: (document) => kernel.validateBrickDocument(document),
                      });
                      hardValidationPassed = assessed.passed;
                      validation = assessed.validation;
                      failure = assessed.failure;
                    }

                    const settled = settleAtomicStep({
                      stepNumber: spec.stepNumber,
                      baseDocument: stepBaseDocument,
                      candidateDocument,
                      expectedPieces: spec.action.assembledPieces,
                      candidatePieces: candidatePlaced,
                      attemptedMechanism: placementMechanism,
                      firstPieceFailure: failure,
                      hardValidationPassed,
                    });
                    document_ = settled.document;
                    placed = settled.acceptedPieces;
                    outcome = settled.outcome;
                    if (settled.outcome.status === "failed") {
                      rollbackPlacedPieceReports(pieceReports, {
                        stepNumber: spec.stepNumber,
                        reason:
                          `${settled.outcome.failure.code}: ${settled.outcome.failure.message} ` +
                          `The canonical document remains at the step base.`,
                      });
                    }

                    buildPng = renderRunBuildPng({
                      document: document_,
                      view,
                      centre,
                      frame,
                      width,
                      height,
                      rendering,
                      renderer,
                    });
                    panelPng = rgbaPngDataUrl(evidence.workPixels, width, height);
                  }

                  cameraReport = {
                    azimuthDegrees: solution.azimuthDegrees,
                    elevationDegrees: solution.elevationDegrees,
                    pixelsPerUnit: solution.pixelsPerUnit,
                    residualPx: solution.residualPx,
                    coherence: fit.coherence as number,
                    centerXPx: centre[0],
                    centerYPx: centre[1],
                    anchorIou,
                    anchorShiftPx: anchorShift,
                    anchorTurnDegrees: anchorStep ? null : anchorTurn,
                  };
                } finally {
                  renderer.dispose();
                }
              } catch (error) {
                const message = describeBrowserThrown(error);
                failure = {
                  code: "rendering-error",
                  stage: "rendering",
                  message:
                    `Step ${spec.stepNumber} could not complete its render/placement evidence: ${message}. ` +
                    `The canonical document was restored to the printed-step base.`,
                };
                outcome = null;
                document_ = stepBaseDocument;
                placed = 0;
                rollbackPlacedPieceReports(pieceReports, {
                  stepNumber: spec.stepNumber,
                  reason: `rendering evidence failed: ${message}.`,
                });
              }
            }

            if (outcome === null) {
              const finalFailure = failure ?? {
                code: "piece-placement-failed" as const,
                stage: "placement" as const,
                message: `Step ${spec.stepNumber} ended without a complete placement result.`,
              };
              outcome = {
                status: "failed",
                mechanism: failedMechanism,
                attemptedMechanism,
                failure: finalFailure,
              };
              document_ = stepBaseDocument;
              placed = 0;
            }
            if (outcome.status === "complete") {
              for (const registration of pendingRegistrations) {
                partIdByIdentity.set(registration.identityKey, registration);
              }
            }
            if (outcome.status === "failed" && blockingStep === null) {
              blockingStep = spec.stepNumber;
            }

            reports.push(
              composeExecutedStepReport({
                spec,
                evidence,
                prerequisites,
                outcome,
                validation,
                camera: cameraReport,
                panelCamera,
                pieces: pieceReports,
                jointVisual,
                deferral,
                farther,
                fartherCaptures,
                explodedGhost,
                attemptedPieces: Math.max(pieceReports.length, candidatePlaced),
                placedPieces: placed,
                canonicalStepId: printedStepId,
                documentParts: (document_ as { parts: unknown[] }).parts.length,
                elapsedMs: Math.round(performance.now() - stepStarted),
                panelPng,
                buildPng,
              }),
            );
          } catch (error) {
            document_ = stepBaseDocument;
            const message = describeBrowserThrown(error);
            reports.push(
              failedRealBuildPanelEvidenceReport({
                panel: spec,
                reason: message,
                blockingStep,
                documentParts: (document_ as { parts: unknown[] }).parts.length,
                elapsedMs: Math.round(performance.now() - stepStarted),
                panelCamera: spec.stepNumber === 1 ? rootPanelCamera : null,
              }),
            );
            if (blockingStep === null) blockingStep = spec.stepNumber;
          }
        }
      } finally {
        pageCleanupFailure = pageCursor.close();
      }

      retainedOutput = retainedRealBuildRunOutput({
        reports,
        document: document_,
        identityBindings: [...partIdByIdentity.values()],
        fetchedPdfDigest,
        cleanupFailure: pageCleanupFailure,
        elapsedMs: Math.round(performance.now() - runStarted),
      });
      return retainedOutput;
    } finally {
      try {
        await pdf.destroy();
      } catch (error) {
        pdfCleanupFailure = realBuildCleanupFailure("PDF document", error);
        if (retainedOutput !== null)
          retainRealBuildCleanupFailure(retainedOutput, pdfCleanupFailure);
      }
    }
  } catch (error) {
    const preparationFailure = browserPreparationFailure(error);
    retainedOutput = failedBrowserOutput(
      preparationFailure ??
        ({
          code: "pdf-load-failed",
          stage: "loading",
          inputKey: "pdf",
          message:
            `Real-build PDF preparation failed before a typed step result existed: ` +
            `${describeBrowserThrown(error)}.`,
        } satisfies StepFailure),
      runStarted,
    );
    if (pdfCleanupFailure !== null)
      retainRealBuildCleanupFailure(retainedOutput, pdfCleanupFailure);
    return retainedOutput;
  } finally {
    try {
      await loadingTask.destroy();
    } catch (error) {
      if (retainedOutput !== null) {
        retainRealBuildCleanupFailure(
          retainedOutput,
          realBuildCleanupFailure("PDF loading task", error),
        );
      }
    }
  }
}
