import type { PreparedRealBuildModules } from "./real-build-browser-preflight";
import { aggregateRealBuildSourceParitySteps } from "./real-build-observation-source-parity-aggregate";
import { fetchExactRealBuildSourceParityPdf } from "./real-build-observation-source-parity-browser-fetch";
import { assertRealBuildSourceParityBrowserInput } from "./real-build-observation-source-parity-browser-input";
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
  type RealBuildSourceParityProbePanel,
} from "./real-build-observation-source-parity-types";
import type * as CandidateRaster from "./real-build-observation-source-raster-candidate";
import type * as PanelRaster from "./real-build-panel-raster";

interface BrowserModules {
  readonly pdfjs: PreparedRealBuildModules["pdfjs"];
  readonly lattice: PreparedRealBuildModules["lattice"];
  readonly assembly: PreparedRealBuildModules["assembly"];
  readonly panelRaster: typeof PanelRaster;
  readonly candidateRaster: typeof CandidateRaster;
}

export interface RealBuildSourceParityBrowserInput {
  readonly urls: {
    readonly pdfjsUrl: string;
    readonly workerUrl: string;
    readonly pdfUrl: string;
    readonly latticeUrl: string;
    readonly assemblyUrl: string;
    readonly panelRasterUrl: string;
    readonly candidateUrl: string;
  };
  readonly expectedPdfDigest: string;
  readonly expectedPdfBytes: number;
  readonly preparedPanelsDigest: string;
  readonly panels: readonly RealBuildSourceParityProbePanel[];
}

const RENDER_SCALE = REAL_BUILD_SOURCE_PARITY_RENDER_SCALE;
const PANEL_WIDTH = REAL_BUILD_SOURCE_PARITY_PANEL_WIDTH;
const WORK_FACTOR = REAL_BUILD_SOURCE_PARITY_WORK_FACTOR;
const PROXIMITY_MARGIN_PX = 14;

async function importModules(input: RealBuildSourceParityBrowserInput): Promise<BrowserModules> {
  const [pdfjs, lattice, assembly, panelRaster, candidateRaster] = await Promise.all([
    import(/* @vite-ignore */ input.urls.pdfjsUrl),
    import(/* @vite-ignore */ input.urls.latticeUrl),
    import(/* @vite-ignore */ input.urls.assemblyUrl),
    import(/* @vite-ignore */ input.urls.panelRasterUrl),
    import(/* @vite-ignore */ input.urls.candidateUrl),
  ]);
  return { pdfjs, lattice, assembly, panelRaster, candidateRaster } as BrowserModules;
}

export async function runRealBuildObservationSourceParityInBrowser(
  input: RealBuildSourceParityBrowserInput,
): Promise<RealBuildSourceParityBrowserResult> {
  assertRealBuildSourceParityBrowserInput(input);
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
        `Source-parity browser fetched ${pdfDigest}; Node prepared ${input.expectedPdfDigest}.`,
      );
    }
    loadingTask = modules.pdfjs.getDocument({ data: pdfBytes, isEvalSupported: false });
    pdf = await loadingTask.promise;
    const registry = createRealBuildSourceParityBrowserEvidenceRegistry();
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
            spec: {
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
            },
            options: {
              renderScale: RENDER_SCALE,
              panelWidth: PANEL_WIDTH,
              workFactor: WORK_FACTOR,
              proximityMarginPx: PROXIMITY_MARGIN_PX,
            },
            modules,
          });
          const pixels = production.width * production.height;
          if (
            !Number.isSafeInteger(pixels) ||
            pixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PIXELS ||
            production.assemblyMask === undefined
          ) {
            throw new RangeError(
              `Printed step ${panel.stepNumber} production raster is unbounded.`,
            );
          }
          totalPanelPixels += pixels;
          if (
            totalPanelPixels > REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_PANEL_PIXELS ||
            totalPanelPixels * REAL_BUILD_SOURCE_PARITY_CLASSES.length >
              REAL_BUILD_SOURCE_PARITY_MAXIMUM_TOTAL_COMPARISON_PIXELS
          ) {
            throw new RangeError(
              `Printed step ${panel.stepNumber} would exceed the bounded aggregate panel/comparison pixel work.`,
            );
          }
          const workRgba = Uint8ClampedArray.from(production.workPixels);
          const workRgbaDigest = await sourceParityBrowserDigest(Uint8Array.from(workRgba));
          const candidateInput = Uint8ClampedArray.from(workRgba);
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
          if (
            candidate.schemaVersion !== "lego.real-build-observation-source-raster-candidate/1" ||
            candidate.authority !== "absent" ||
            candidate.width !== production.width ||
            candidate.height !== production.height ||
            candidate.workFactor !== WORK_FACTOR ||
            candidate.workPixelsDigest !== workRgbaDigest ||
            (await sourceParityBrowserDigest(Uint8Array.from(candidateInput))) !== workRgbaDigest
          ) {
            throw new TypeError(
              `Printed step ${panel.stepNumber} candidate does not bind the exact snapshotted work RGBA input.`,
            );
          }
          const unpack =
            modules.candidateRaster.unpackRealBuildObservationSourceRasterCandidateMask;
          const productionAssembly = Uint8Array.from(production.assemblyMask);
          const productionBuilt = Uint8Array.from(production.builtMask);
          const productionExclusion = Uint8Array.from(
            modules.assembly.highlightExclusionMask(
              production.highlight.mask,
              production.highlight.strokeMask,
              production.width,
              production.height,
            ),
          );
          const zero = new Uint8Array(pixels);
          const pairs = [
            ["assembly", productionAssembly, unpack(candidate.assemblyMask)],
            ["own-panel-source", productionAssembly, unpack(candidate.ownPanel.builtMask)],
            ["own-panel-exclusion", zero, unpack(candidate.ownPanel.excludedMask)],
            ["built", productionBuilt, unpack(candidate.lookahead.builtMask)],
            ["exclusion", productionExclusion, unpack(candidate.lookahead.excludedMask)],
          ] as const;
          const comparisons = [];
          for (const [sourceClass, oldMask, newMask] of pairs) {
            comparisons.push(
              await compareAndRetainRealBuildSourceParityMasks({
                registry,
                stepNumber: panel.stepNumber,
                sourceClass,
                production: oldMask,
                candidate: newMask,
                rgba: workRgba,
                width: production.width,
                height: production.height,
              }),
            );
          }
          steps.push({
            ...panel,
            width: production.width,
            height: production.height,
            workRgbaBrowserCommitmentDigest: workRgbaDigest,
            candidatePolicyBrowserCommitmentDigest: candidate.policyDescriptorDigest,
            candidateDerivationBrowserCommitmentDigest: candidate.derivationDescriptorDigest,
            comparisons,
          });
          panelIndex += 1;
        }
      } finally {
        activePage.dispose();
        activePage = null;
      }
    }
    const aggregate = aggregateRealBuildSourceParitySteps(steps);
    completed = {
      pdfDigest: input.expectedPdfDigest,
      pdfBytes: input.expectedPdfBytes,
      preparedPanelsDigest: input.preparedPanelsDigest,
      steps,
      aggregate,
      ...registry.finish(),
    };
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
      new Error(`Source-parity cleanup removed ${leaked.length} leaked canvases.`),
    );
  }
  if (primaryFailure !== null && cleanupFailures.length === 0) throw primaryFailure;
  if (primaryFailure !== null || cleanupFailures.length > 0) {
    throw new AggregateError(
      [...(primaryFailure === null ? [] : [primaryFailure]), ...cleanupFailures],
      `Source-parity probe ${primaryFailure === null ? "cleanup" : "measurement and cleanup"} failed with ${cleanupFailures.length} cleanup failure(s).`,
    );
  }
  if (completed === null) throw new Error("Source-parity probe produced no result.");
  return completed;
}
