import type { PreparedRealBuildModules } from "./real-build-browser-preflight";
import { aggregateRealBuildSourceParitySteps } from "./real-build-observation-source-parity-aggregate";
import type { RealBuildSourceParityCalibrationPanelCaptureInput } from "./real-build-observation-source-parity-calibration-browser-panel";
import type { RealBuildSourceParityCalibrationBrowserCaptureWire } from "./real-build-observation-source-parity-calibration-capture-types";
import { fetchExactRealBuildSourceParityPdf } from "./real-build-observation-source-parity-browser-fetch";
import { compareAndRetainRealBuildSourceParityMasks } from "./real-build-observation-source-parity-browser-compare";
import {
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS,
  REAL_BUILD_SOURCE_PARITY_PANEL_WIDTH,
  REAL_BUILD_SOURCE_PARITY_RENDER_SCALE,
  REAL_BUILD_SOURCE_PARITY_WORK_FACTOR,
} from "./real-build-observation-source-parity-contract";
import {
  createRealBuildSourceParityBrowserEvidenceRegistry,
  sourceParityBrowserDigest,
} from "./real-build-observation-source-parity-browser-evidence";
import {
  REAL_BUILD_SOURCE_PARITY_CLASSES,
  type RealBuildSourceParityBrowserResult,
  type RealBuildSourceParityMaskComparison,
  type RealBuildSourceParityProbePanel,
} from "./real-build-observation-source-parity-types";
import type { RealBuildSourceParityMeasurementInput } from "./real-build-observation-source-parity-browser-types";
import type * as CandidateRaster from "./real-build-observation-source-raster-candidate";
import type * as PanelRaster from "./real-build-panel-raster";
import { requireValidatedRealBuildSourceParityBrowserInput } from "./real-build-observation-source-parity-browser-input";
import {
  requireValidatedRealBuildSourceParityCalibrationBrowserInput,
  type RealBuildSourceParityCalibrationBrowserInput,
} from "./real-build-observation-source-parity-calibration-browser-input";

interface BrowserModules {
  readonly pdfjs: PreparedRealBuildModules["pdfjs"];
  readonly lattice: PreparedRealBuildModules["lattice"];
  readonly assembly: PreparedRealBuildModules["assembly"];
  readonly panelRaster: typeof PanelRaster;
  readonly candidateRaster: typeof CandidateRaster;
}

interface RealBuildSourceParityMeasurementOptions {
  readonly retainCalibrationHighRgba: boolean;
  readonly retainDenseComparisons: boolean;
  readonly onCalibrationPanel?: (
    measurement: RealBuildSourceParityCalibrationPanelCaptureInput,
  ) => void | Promise<void>;
  readonly snapshotCalibrationPanel?: (
    measurement: RealBuildSourceParityCalibrationPanelCaptureInput,
  ) => RealBuildSourceParityCalibrationPanelCaptureInput;
}

const RENDER_SCALE = REAL_BUILD_SOURCE_PARITY_RENDER_SCALE;
const PANEL_WIDTH = REAL_BUILD_SOURCE_PARITY_PANEL_WIDTH;
const WORK_FACTOR = REAL_BUILD_SOURCE_PARITY_WORK_FACTOR;
const PROXIMITY_MARGIN_PX = 14;

async function importModules(
  input: RealBuildSourceParityMeasurementInput,
): Promise<BrowserModules> {
  const [pdfjs, lattice, assembly, panelRaster, candidateRaster] = await Promise.all([
    import(/* @vite-ignore */ input.urls.pdfjsUrl),
    import(/* @vite-ignore */ input.urls.latticeUrl),
    import(/* @vite-ignore */ input.urls.assemblyUrl),
    import(/* @vite-ignore */ input.urls.panelRasterUrl),
    import(/* @vite-ignore */ input.urls.candidateUrl),
  ]);
  return { pdfjs, lattice, assembly, panelRaster, candidateRaster } as BrowserModules;
}

function panelSpec(panel: RealBuildSourceParityProbePanel): Record<string, unknown> {
  return {
    ...panel,
    panelFace: "studs-up",
    mappedCalloutKeys: [],
    action: {
      kind: "transition",
      assembledPieces: 0,
      transition: "unclassified",
      panelEvidenceDigest: null,
      classificationEvidenceDigest: null,
      evidenceDigest: null,
    },
    pieces: [],
    omittedPieces: [],
    calloutPieces: 0,
    classifiedPhysicalCalloutPieces: 0,
    semanticMultiplierQuantity: 0,
    omittedPhysicalPieces: 0,
    coverageFailures: [],
    missingDesigns: [],
    unresolvedCallouts: [],
  };
}

async function measureRealBuildObservationSourceParityInBrowser(
  input: RealBuildSourceParityMeasurementInput,
  options: RealBuildSourceParityMeasurementOptions,
): Promise<RealBuildSourceParityBrowserResult | null> {
  const modules = await importModules(input);
  let loadingTask: ReturnType<PreparedRealBuildModules["pdfjs"]["getDocument"]> | null = null;
  let pdf: Awaited<ReturnType<PreparedRealBuildModules["pdfjs"]["getDocument"]>["promise"]> | null =
    null;
  let activePage: Awaited<ReturnType<typeof modules.panelRaster.renderRealBuildPageCanvas>> | null =
    null;
  let primaryFailure: unknown = null;
  let completed: RealBuildSourceParityBrowserResult | null = null;
  try {
    modules.pdfjs.GlobalWorkerOptions.workerSrc = input.urls.workerUrl;
    const pdfBytes = await fetchExactRealBuildSourceParityPdf({
      url: input.urls.pdfUrl,
      expectedBytes: input.expectedPdfBytes,
    });
    const pdfDigest = await sourceParityBrowserDigest(pdfBytes);
    if (pdfDigest !== input.expectedPdfDigest) {
      throw new TypeError(
        `Source-parity browser fetched ${pdfDigest}; expected Node-prepared ${input.expectedPdfDigest}.`,
      );
    }
    loadingTask = modules.pdfjs.getDocument({ data: pdfBytes, isEvalSupported: false });
    pdf = await loadingTask.promise;
    const registry = options.retainDenseComparisons
      ? createRealBuildSourceParityBrowserEvidenceRegistry()
      : null;
    const steps: RealBuildSourceParityBrowserResult["steps"][number][] = [];
    let totalPanelPixels = 0;
    let panelIndex = 0;
    while (panelIndex < input.panels.length) {
      const pageNumber = input.panels[panelIndex]!.pageNumber;
      activePage = await modules.panelRaster.renderRealBuildPageCanvas(
        pdf,
        pageNumber,
        RENDER_SCALE,
      );
      try {
        while (
          panelIndex < input.panels.length &&
          input.panels[panelIndex]!.pageNumber === pageNumber
        ) {
          const panel = input.panels[panelIndex]!;
          const production = modules.panelRaster.derivePanelRasterEvidence({
            pageCanvas: activePage.canvas,
            spec: panelSpec(panel) as never,
            options: {
              renderScale: RENDER_SCALE,
              panelWidth: PANEL_WIDTH,
              workFactor: WORK_FACTOR,
              proximityMarginPx: PROXIMITY_MARGIN_PX,
            },
            modules,
            retainCalibrationHighRgba: options.retainCalibrationHighRgba,
          });
          const pixels = production.width * production.height;
          if (!Number.isSafeInteger(pixels) || pixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS) {
            throw new RangeError(
              `Printed step ${panel.stepNumber} work raster has ${String(pixels)} pixels; expected at most ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS}.`,
            );
          }
          if (production.assemblyMask === undefined) {
            throw new TypeError(
              `Printed step ${panel.stepNumber} production raster omitted assemblyMask; expected exact production P bytes.`,
            );
          }
          totalPanelPixels += pixels;
          if (totalPanelPixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS) {
            throw new RangeError(
              `Printed step ${panel.stepNumber} raises aggregate panel work to ${totalPanelPixels} pixels; expected at most ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS}.`,
            );
          }
          const comparisonPixels = totalPanelPixels * REAL_BUILD_SOURCE_PARITY_CLASSES.length;
          if (comparisonPixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS) {
            throw new RangeError(
              `Printed step ${panel.stepNumber} raises aggregate comparison work to ${comparisonPixels} pixel visits; expected at most ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS}.`,
            );
          }
          const workRgba = new Uint8ClampedArray(production.workPixels);
          const workRgbaDigest = await sourceParityBrowserDigest(
            new Uint8Array(workRgba.buffer, workRgba.byteOffset, workRgba.byteLength),
          );
          const candidateInput = new Uint8ClampedArray(workRgba);
          const candidate = modules.candidateRaster.deriveRealBuildObservationSourceRasterCandidate(
            production.width,
            production.height,
            WORK_FACTOR,
            candidateInput,
            panel.minXPt,
            panel.maxXPt,
            panel.minYPt,
            panel.maxYPt,
            new Float64Array(
              panel.calloutBoxes.flatMap((box) => [box.minXPt, box.maxXPt, box.minYPt, box.maxYPt]),
            ),
          );
          const retainedCandidateInputDigest = await sourceParityBrowserDigest(
            new Uint8Array(
              candidateInput.buffer,
              candidateInput.byteOffset,
              candidateInput.byteLength,
            ),
          );
          if (candidate.schemaVersion !== "lego.real-build-observation-source-raster-candidate/1") {
            throw new TypeError(
              `Printed step ${panel.stepNumber} candidate schema observed ${candidate.schemaVersion}; expected lego.real-build-observation-source-raster-candidate/1.`,
            );
          }
          if (candidate.authority !== "absent") {
            throw new TypeError(
              `Printed step ${panel.stepNumber} candidate authority observed ${candidate.authority}; expected absent.`,
            );
          }
          if (candidate.width !== production.width || candidate.height !== production.height) {
            throw new RangeError(
              `Printed step ${panel.stepNumber} candidate is ${candidate.width}x${candidate.height}; expected production ${production.width}x${production.height}.`,
            );
          }
          if (candidate.workFactor !== WORK_FACTOR) {
            throw new RangeError(
              `Printed step ${panel.stepNumber} candidate workFactor observed ${candidate.workFactor}; expected ${WORK_FACTOR}.`,
            );
          }
          if (candidate.workPixelsDigest !== workRgbaDigest) {
            throw new TypeError(
              `Printed step ${panel.stepNumber} candidate workPixelsDigest observed ${candidate.workPixelsDigest}; expected exact work RGBA ${workRgbaDigest}.`,
            );
          }
          if (retainedCandidateInputDigest !== workRgbaDigest) {
            throw new TypeError(
              `Printed step ${panel.stepNumber} candidate mutated its RGBA input to ${retainedCandidateInputDigest}; expected retained ${workRgbaDigest}.`,
            );
          }
          const unpack =
            modules.candidateRaster.unpackRealBuildObservationSourceRasterCandidateMask;
          const candidateAssembly = unpack(candidate.assemblyMask);
          const comparisons: RealBuildSourceParityMaskComparison[] = [];
          if (options.retainDenseComparisons) {
            if (registry === null) {
              throw new Error(
                `Printed step ${panel.stepNumber} requested dense comparisons without an evidence registry.`,
              );
            }
            const productionAssembly = new Uint8Array(production.assemblyMask);
            const productionBuilt = new Uint8Array(production.builtMask);
            const productionExclusion = new Uint8Array(
              modules.assembly.highlightExclusionMask(
                production.highlight.mask,
                production.highlight.strokeMask,
                production.width,
                production.height,
              ),
            );
            const zero = new Uint8Array(pixels);
            const pairs = [
              ["assembly", productionAssembly, candidateAssembly],
              ["own-panel-source", productionAssembly, unpack(candidate.ownPanel.builtMask)],
              ["own-panel-exclusion", zero, unpack(candidate.ownPanel.excludedMask)],
              ["built", productionBuilt, unpack(candidate.lookahead.builtMask)],
              ["exclusion", productionExclusion, unpack(candidate.lookahead.excludedMask)],
            ] as const;
            for (const [sourceClass, productionMask, candidateMask] of pairs) {
              comparisons.push(
                await compareAndRetainRealBuildSourceParityMasks({
                  registry,
                  stepNumber: panel.stepNumber,
                  sourceClass,
                  production: productionMask,
                  candidate: candidateMask,
                  rgba: workRgba,
                  width: production.width,
                  height: production.height,
                }),
              );
            }
          }
          const calibrationSnapshot = production.calibrationHighRgba;
          const highRgba =
            calibrationSnapshot === undefined
              ? null
              : modules.panelRaster.copyRealBuildPanelCalibrationHighRgba(calibrationSnapshot);
          if (options.retainCalibrationHighRgba && highRgba === null) {
            throw new TypeError(
              `Printed step ${panel.stepNumber} calibration measurement requested high RGBA but panel derivation omitted its snapshot.`,
            );
          }
          if (
            calibrationSnapshot !== undefined &&
            highRgba !== null &&
            highRgba.length !== calibrationSnapshot.byteLength
          ) {
            throw new RangeError(
              `Printed step ${panel.stepNumber} high RGBA copy has ${highRgba.length} bytes; expected snapshot byteLength ${calibrationSnapshot.byteLength}.`,
            );
          }
          if (calibrationSnapshot !== undefined && highRgba !== null) {
            const retainedHighDigest = await sourceParityBrowserDigest(
              new Uint8Array(highRgba.buffer, highRgba.byteOffset, highRgba.byteLength),
            );
            if (retainedHighDigest !== calibrationSnapshot.rgbaDigest) {
              throw new TypeError(
                `Printed step ${panel.stepNumber} high RGBA copy reproduces ${retainedHighDigest}; expected snapshot ${calibrationSnapshot.rgbaDigest}.`,
              );
            }
          }
          if (options.onCalibrationPanel !== undefined) {
            if (
              highRgba === null ||
              production.sourceArtStages === undefined ||
              options.snapshotCalibrationPanel === undefined
            ) {
              throw new TypeError(
                `Printed step ${panel.stepNumber} calibration capture requires detached high RGBA, H/P/D source-art stages, and its fixed snapshot boundary.`,
              );
            }
            await options.onCalibrationPanel(
              options.snapshotCalibrationPanel({
                panel,
                width: production.width,
                height: production.height,
                highRgba,
                workRgba,
                sourceArtStages: production.sourceArtStages,
                wMask: candidateAssembly,
                candidatePolicyDigest: candidate.policyDescriptorDigest,
                candidateDerivationDigest: candidate.derivationDescriptorDigest,
                candidateWorkPixelsDigest: candidate.workPixelsDigest,
              }),
            );
          }
          if (options.retainDenseComparisons) {
            steps.push({
              ...panel,
              width: production.width,
              height: production.height,
              workRgbaBrowserCommitmentDigest: workRgbaDigest,
              candidatePolicyBrowserCommitmentDigest: candidate.policyDescriptorDigest,
              candidateDerivationBrowserCommitmentDigest: candidate.derivationDescriptorDigest,
              comparisons,
            });
          }
          panelIndex += 1;
        }
      } finally {
        activePage.dispose();
        activePage = null;
      }
    }
    if (options.retainDenseComparisons) {
      if (registry === null) {
        throw new Error("Dense source-parity measurement completed without an evidence registry.");
      }
      completed = {
        pdfDigest: input.expectedPdfDigest,
        pdfBytes: input.expectedPdfBytes,
        preparedPanelsDigest: input.preparedPanelsDigest,
        steps,
        aggregate: aggregateRealBuildSourceParitySteps(steps),
        ...registry.finish(),
      };
    }
  } catch (error) {
    primaryFailure = error;
  }
  const cleanupFailures: unknown[] = [];
  if (activePage !== null) {
    try {
      activePage.dispose();
    } catch (error) {
      cleanupFailures.push(error);
    }
  }
  if (pdf !== null) {
    try {
      await pdf.destroy();
    } catch (error) {
      cleanupFailures.push(error);
    }
  }
  if (loadingTask !== null) {
    try {
      await loadingTask.destroy();
    } catch (error) {
      cleanupFailures.push(error);
    }
  }
  const leaked = document.querySelectorAll<HTMLCanvasElement>("canvas.page-probe");
  if (leaked.length > 0) {
    leaked.forEach((canvas) => {
      canvas.width = 0;
      canvas.height = 0;
      canvas.remove();
    });
    cleanupFailures.push(
      new Error(`Source-parity cleanup removed ${leaked.length} leaked page-probe canvases.`),
    );
  }
  if (primaryFailure !== null && cleanupFailures.length === 0) throw primaryFailure;
  if (primaryFailure !== null || cleanupFailures.length > 0) {
    throw new AggregateError(
      [...(primaryFailure === null ? [] : [primaryFailure]), ...cleanupFailures],
      `Source-parity probe ${primaryFailure === null ? "cleanup" : "measurement and cleanup"} failed with ${cleanupFailures.length} cleanup failure(s).`,
    );
  }
  if (options.retainDenseComparisons && completed === null) {
    throw new Error(
      `Source-parity measurement completed ${input.panels.length} requested panel rows but produced no result.`,
    );
  }
  return completed;
}

export async function measureValidatedDenseRealBuildObservationSourceParityInBrowser(
  input: RealBuildSourceParityMeasurementInput,
): Promise<RealBuildSourceParityBrowserResult> {
  requireValidatedRealBuildSourceParityBrowserInput(input);
  const result = await measureRealBuildObservationSourceParityInBrowser(input, {
    retainCalibrationHighRgba: false,
    retainDenseComparisons: true,
  });
  if (result === null) {
    throw new Error("Dense source-parity measurement returned no browser result.");
  }
  return result;
}

export async function measureValidatedCalibrationRealBuildObservationSourceParityInBrowser(
  input: RealBuildSourceParityCalibrationBrowserInput,
): Promise<RealBuildSourceParityCalibrationBrowserCaptureWire> {
  requireValidatedRealBuildSourceParityCalibrationBrowserInput(input);
  const [panelCapture, capture] = await Promise.all([
    import("./real-build-observation-source-parity-calibration-browser-panel"),
    import("./real-build-observation-source-parity-calibration-browser-capture"),
  ]);
  const measurements: RealBuildSourceParityCalibrationPanelCaptureInput[] = [];
  await measureRealBuildObservationSourceParityInBrowser(
    {
      urls: input.urls,
      expectedPdfDigest: input.expectedPdfDigest,
      expectedPdfBytes: input.expectedPdfBytes,
      preparedPanelsDigest: input.calibrationPreparedPanelsDigest,
      panels: input.panels,
    },
    {
      retainCalibrationHighRgba: true,
      retainDenseComparisons: false,
      onCalibrationPanel: (measurement) => {
        measurements.push(measurement);
      },
      snapshotCalibrationPanel:
        panelCapture.snapshotRealBuildSourceParityCalibrationPanelCaptureInput,
    },
  );
  return capture.createRealBuildSourceParityCalibrationBrowserCapture({
    binding: input,
    measurements,
  });
}
