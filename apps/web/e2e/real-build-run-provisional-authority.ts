import { canonicalDigest, sha256Hex } from "@lego-studio/brick-kernel";

import { MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION } from "./real-build-farther-origin-source-manifest";
import { derivePanelRasterEvidence } from "./real-build-panel-raster";
import { MAXIMUM_REAL_BUILD_PREPARED_STEP_PIECES } from "./real-build-prepared-step-authority";
import {
  deriveRealBuildProvisionalRunPreparationFacts,
  deriveRealBuildProvisionalStepPreparationFacts,
  snapshotRealBuildProvisionalFitScalars,
} from "./real-build-run-provisional-preparation";
import type { RealBuildOptions, RealBuildPanelSpec } from "./real-build-safety";

interface RealBuildRunProvisionalAuthorityInput {
  readonly options: RealBuildOptions;
  readonly canonicalRunInput: unknown;
  readonly fetchedPdfDigest: unknown;
  readonly moduleObjects: readonly unknown[];
  readonly pdf: unknown;
  readonly loadingTask: unknown;
}

/** Creates a one-use browser-local witness for a prepared executable step. */
export function createRealBuildRunProvisionalAuthority(
  input: RealBuildRunProvisionalAuthorityInput,
) {
  const { options } = input;
  return options.measuredFartherOriginSourceAttestation?.schemaVersion !==
    MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION.schemaVersion ||
    options.measuredFartherOriginSourceAttestation.fileCount !==
      MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION.fileCount ||
    options.measuredFartherOriginSourceAttestation.digest !==
      MEASURED_FARTHER_ORIGIN_SOURCE_ATTESTATION.digest
    ? null
    : (() => {
        const moduleRequests = Object.freeze({
          pdfjs: options.pdfjsUrl,
          worker: options.workerUrl,
          lattice: options.latticeUrl,
          rendering: options.renderingUrl,
          kernel: options.kernelUrl,
          commands: options.commandsUrl,
          assembly: options.assemblyUrl,
        });
        const moduleRequestDigest = canonicalDigest({ moduleRequests });
        const runFacts = deriveRealBuildProvisionalRunPreparationFacts(
          input.canonicalRunInput,
          canonicalDigest(options.measuredFartherOriginSourceAttestation),
          moduleRequestDigest,
          options.inputDigests.pdf,
          input.fetchedPdfDigest,
        );
        const states = new WeakMap<object, readonly unknown[]>();
        const consumed = new WeakSet<object>();
        const run = Object.freeze(Object.create(null)) as object;
        const moduleObjects = Object.freeze([...input.moduleObjects]);
        const runState = Object.freeze([
          options,
          moduleObjects,
          input.pdf,
          input.loadingTask,
          runFacts,
        ]);
        states.set(run, runState);
        return (
          panel: RealBuildPanelSpec,
          page: object & { readonly canvas: unknown },
          pageCanvas: unknown,
          raster: ReturnType<typeof derivePanelRasterEvidence>,
        ) => {
          if (
            panel.action.kind !== "place-callouts" ||
            panel.action.evidenceDigest === null ||
            panel.panelFace === null ||
            panel.pieces.length < 1 ||
            panel.pieces.length > MAXIMUM_REAL_BUILD_PREPARED_STEP_PIECES ||
            panel.omittedPieces.length !== 0 ||
            panel.omittedPhysicalPieces !== 0 ||
            panel.coverageFailures.length !== 0 ||
            panel.missingDesigns.length !== 0 ||
            panel.unresolvedCallouts.length !== 0
          ) {
            return;
          }
          const deriveFacts = () => {
            const fit = snapshotRealBuildProvisionalFitScalars(raster.fitSolution);
            return deriveRealBuildProvisionalStepPreparationFacts(
              runFacts.preparationIdentity,
              runFacts.preparedRunInputDigest,
              runFacts.fetchedPdfDigest,
              canonicalDigest(panel),
              canonicalDigest(panel.action),
              canonicalDigest({ pieces: panel.pieces, omittedPieces: panel.omittedPieces }),
              panel.stepNumber,
              panel.pageNumber,
              panel.panelFace,
              panel.action.kind,
              panel.action.evidenceDigest,
              panel.minXPt,
              panel.maxXPt,
              panel.minYPt,
              panel.maxYPt,
              raster.width,
              raster.height,
              raster.workPixels.length,
              raster.builtMask.length,
              `sha256:${sha256Hex(Uint8Array.from(raster.workPixels))}`,
              `sha256:${sha256Hex(raster.builtMask)}`,
              fit.azimuthDegrees,
              fit.elevationDegrees,
              fit.pixelsPerUnit,
              fit.residualPx,
              fit.upSign,
              raster.fitFailure,
              raster.fitCoherence,
            );
          };
          const facts = deriveFacts();
          const authority = Object.freeze(Object.create(null)) as object;
          const stepState = Object.freeze([
            run,
            panel,
            panel.action,
            page,
            pageCanvas,
            raster,
            facts,
          ]);
          states.set(authority, stepState);
          const reproduced = deriveFacts();
          if (
            states.get(run) !== runState ||
            states.get(authority) !== stepState ||
            consumed.has(authority) ||
            reproduced.printedStepIdentity !== facts.printedStepIdentity
          ) {
            throw new TypeError(
              `Printed step ${panel.stepNumber} provisional preparation did not preserve its exact browser-local run, module, PDF, panel, page, crop, face, action, and raster binding.`,
            );
          }
          consumed.add(authority);
        };
      })();
}
