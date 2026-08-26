import { isDeepStrictEqual } from "node:util";

import { sha256Digest } from "./part-identification-artifacts.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

export const TEST_BOOKLET_BYTES = Buffer.from("booklet");
export const TEST_BUILDER_GEOMETRY_BYTES = Buffer.alloc(1_091_772);
export const TEST_OFFICIAL_MODEL_BYTES = Buffer.from(
  '<LXFML><Bricks><Brick uuid="brick-1" designID="3005" itemNos="300501"><Part materials="0:0" /></Brick></Bricks></LXFML>\n',
);
export const TEST_BUILDER_CALIBRATION = Object.freeze({ fixture: "builder-calibration" });
export const TEST_TRANSITION_CLASSIFICATIONS = Object.freeze({
  fixture: "transition-classifications",
});

function syntheticRequestedLastStep(input) {
  const requestedLastStep =
    input.requestedLastStep ?? input.ledger?.value?.provenance?.requestedLastStep;
  if (
    !Number.isSafeInteger(requestedLastStep) ||
    requestedLastStep < 1 ||
    requestedLastStep > 359
  ) {
    throw new Error(
      "Synthetic action-ledger fixture requires an explicit prefix from 1 through 359.",
    );
  }
  return requestedLastStep;
}

const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;

function syntheticOfficial(input) {
  const brickRef = "brick-1";
  return {
    digest: input.officialModel.digest,
    calibrationDigest: input.builderCalibration.digest,
    builderGeometryDigest: input.builderGeometry.digest,
    bricks: {
      [brickRef]: {
        brickRef,
        designId: "3005",
        designRevision: "3005",
        itemNos: ["300501"],
        materialId: "0",
        parts: [],
        builderTransform: null,
        builderTransformFailure: null,
        canonicalTransform: { positionLdu: [0, 0, 0], orientationId: "upright-yaw-0" },
        canonicalTransformFailure: null,
        calibratedCatalogPartId: "builtin:brick-1x1",
        frameEvidenceDigest: sha256Digest("test-frame"),
      },
    },
    instructionBrickRefs: new Set([brickRef]),
    directBrickRefs: new Set([brickRef]),
    multiBuildByActualRef: new Map(),
    unmatchedInventoryBrickRefs: new Set(),
    builderOrder: { phases: [{ kind: "direct", brickRefs: [brickRef] }] },
  };
}

function exactTestInputs(input) {
  if (
    !isDeepStrictEqual(Buffer.from(input.bookletPdf.bytes), TEST_BOOKLET_BYTES) ||
    !isDeepStrictEqual(Buffer.from(input.builderGeometry.bytes), TEST_BUILDER_GEOMETRY_BYTES) ||
    !isDeepStrictEqual(Buffer.from(input.officialModel.bytes), TEST_OFFICIAL_MODEL_BYTES) ||
    !isDeepStrictEqual(input.builderCalibration.value, TEST_BUILDER_CALIBRATION) ||
    !isDeepStrictEqual(input.transitionClassifications.value, TEST_TRANSITION_CLASSIFICATIONS)
  ) {
    throw new Error("Synthetic action-ledger test inputs changed generation.");
  }
}

/** Canonical one-piece ledger used only by the explicit synthetic test verifier. */
export async function reproduceSyntheticActionLedger(input) {
  exactTestInputs(input);
  const requestedLastStep = syntheticRequestedLastStep(input);
  const [actionModule, ledgerModule] = await Promise.all([
    importRepositoryTypeScript(moduleUrl("../apps/web/e2e/real-build-action-ledger.ts")),
    importRepositoryTypeScript(moduleUrl("../apps/web/e2e/real-build-ledger.ts")),
  ]);
  const official = syntheticOfficial(input);
  const bindings = {
    pdfDigest: input.bookletPdf.digest,
    coverageDigest: input.coverage.digest,
    calloutManifestDigest: input.calloutManifest.digest,
    builderCalibrationDigest: input.builderCalibration.digest,
    transitionClassificationsDigest: input.transitionClassifications.digest,
  };
  const panelEvidenceByStep = {
    1: { pageNumber: 11, digest: sha256Digest("test-panel") },
  };
  const coverageByCallout = input.coverage.value.byCallout;
  const assembled = actionModule.assembleRealBuildActionLedger({
    official,
    bindings,
    coverageByCallout,
    panelEvidenceByStep,
    transitionClassificationsByStep: {},
    expectedPrintedSteps: 359,
    requestedLastStep,
  });
  const ledger = actionModule.emittedRealBuildActionLedger(assembled);
  const encoded = actionModule.encodeRealBuildActionLedger(ledger);
  const validationFailures = ledgerModule.validateRealBuildActionLedger({
    ledger,
    ledgerDigest: sha256Digest(encoded),
    requestedLastStep,
    lastStep: 1,
    official,
    pdfDigest: bindings.pdfDigest,
    coverageDigest: bindings.coverageDigest,
    calloutManifestDigest: bindings.calloutManifestDigest,
    builderCalibrationDigest: bindings.builderCalibrationDigest,
    transitionClassificationsDigest: bindings.transitionClassificationsDigest,
    coverageByCallout,
    panelEvidenceByStep,
    transitionClassificationsByStep: {},
  });
  if (validationFailures.length > 0) {
    throw new Error(
      `Synthetic canonical action-ledger fixture had ${validationFailures.length} validation ` +
        `failure(s): ${JSON.stringify(validationFailures.slice(0, 4))}`,
    );
  }
  return { encoded, ledger };
}

export async function verifySyntheticActionLedger(input) {
  const reproduced = await reproduceSyntheticActionLedger(input);
  if (
    sha256Digest(reproduced.encoded) !== input.ledger.digest ||
    !isDeepStrictEqual(Buffer.from(reproduced.encoded), Buffer.from(input.ledger.bytes))
  ) {
    throw new Error("Synthetic action ledger did not reproduce exact bytes.");
  }
}
