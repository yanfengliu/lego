import { isDeepStrictEqual } from "node:util";

import { sha256Digest } from "./part-identification-artifacts.mjs";
import { importRepositoryTypeScript } from "./part-identification-typescript-runtime.mjs";

const moduleUrl = (relativePath) => new URL(relativePath, import.meta.url).href;

export class ActionLedgerVerificationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function canonicalValidationFailureCode(failures) {
  const known = ["official-frame-calibration-missing", "action-ledger-incomplete"];
  const counts = new Map(known.map((code) => [code, 0]));
  for (const failure of failures) {
    if (counts.has(failure?.code)) counts.set(failure.code, counts.get(failure.code) + 1);
  }
  const categorized = [...counts.values()].reduce((total, count) => total + count, 0);
  const parts = known.flatMap((code) => (counts.get(code) ? [code, counts.get(code)] : []));
  if (categorized < failures.length) parts.push("other", failures.length - categorized);
  return `canonical-validation-${failures.length}-${parts.join("-")}`;
}

/** Reproduce and validate one action ledger exclusively from authenticated raw roles. */
export async function verifyCanonicalActionLedger(input) {
  const [actionModule, bookletModule, ledgerModule, officialModule, panelModule, transitionModule] =
    await Promise.all([
      importRepositoryTypeScript(moduleUrl("../apps/web/e2e/real-build-action-ledger.ts")),
      importRepositoryTypeScript(moduleUrl("../apps/web/e2e/booklet-fixture.ts")),
      importRepositoryTypeScript(moduleUrl("../apps/web/e2e/real-build-ledger.ts")),
      importRepositoryTypeScript(moduleUrl("../apps/web/e2e/real-build-official.ts")),
      importRepositoryTypeScript(moduleUrl("../apps/web/e2e/real-build-panel-evidence.ts")),
      importRepositoryTypeScript(
        moduleUrl("../apps/web/e2e/real-build-transition-classification.ts"),
      ),
    ]);
  const pdfDigest = sha256Digest(input.bookletPdf.bytes);
  const geometryDigest = sha256Digest(input.builderGeometry.bytes);
  const bindings = {
    pdfDigest,
    coverageDigest: input.coverage.digest,
    calloutManifestDigest: input.calloutManifest.digest,
    builderCalibrationDigest: input.builderCalibration.digest,
    transitionClassificationsDigest: input.transitionClassifications.digest,
  };
  if (
    input.features.value?.inputDigests?.pdf !== pdfDigest ||
    input.coverage.value?.inputDigests?.pdf !== pdfDigest ||
    input.coverage.value?.inputDigests?.calloutManifest !== input.calloutManifest.digest
  ) {
    throw new Error("Ledger source bindings do not reproduce the authenticated PDF and manifest.");
  }
  const coverageByCallout = input.coverage.value?.byCallout;
  if (
    typeof coverageByCallout !== "object" ||
    coverageByCallout === null ||
    Array.isArray(coverageByCallout)
  ) {
    throw new Error("Authenticated coverage has no byCallout object.");
  }
  const official = officialModule.applyBuilderCanonicalCalibration(
    officialModule.parseOfficialModelIndex(input.officialModel.bytes),
    input.builderCalibration.bytes,
    input.builderCalibration.digest,
    input.builderGeometry.bytes,
    geometryDigest,
  );
  const accountingFailures = officialModule.validateOfficialModelAccounting(official);
  if (accountingFailures.length > 0)
    throw new Error("Official-model accounting rejected the ledger.");
  const transitions = transitionModule.readTransitionClassificationBundle(
    input.transitionClassifications.value,
    pdfDigest,
  );
  if (transitions.rejections.length > 0) {
    throw new Error("Transition-classification reproduction rejected the ledger.");
  }
  const source = await bookletModule.ingestSampleBookletBytes(input.bookletPdf.bytes);
  const { panelEvidenceByStep } = await panelModule.deriveRealBuildPanelEvidence({
    pdfBytes: input.bookletPdf.bytes,
    source,
    pdfDigest,
  });
  const assembled = actionModule.assembleRealBuildActionLedger({
    official,
    bindings,
    coverageByCallout,
    panelEvidenceByStep,
    transitionClassificationsByStep: transitions.byStep,
    expectedPrintedSteps: 359,
  });
  const emitted = actionModule.emittedRealBuildActionLedger(assembled, 359);
  const encoded = actionModule.encodeRealBuildActionLedger(emitted);
  if (
    sha256Digest(encoded) !== input.ledger.digest ||
    !isDeepStrictEqual(Buffer.from(encoded), Buffer.from(input.ledger.bytes))
  ) {
    throw new ActionLedgerVerificationError("exact-bytes");
  }
  const validationFailures = ledgerModule.validateRealBuildActionLedger({
    ledger: input.ledger.value,
    ledgerDigest: input.ledger.digest,
    lastStep: Math.max(1, assembled.alignedThroughStep),
    official,
    pdfDigest,
    coverageDigest: bindings.coverageDigest,
    calloutManifestDigest: bindings.calloutManifestDigest,
    builderCalibrationDigest: bindings.builderCalibrationDigest,
    transitionClassificationsDigest: bindings.transitionClassificationsDigest,
    coverageByCallout,
    panelEvidenceByStep,
    transitionClassificationsByStep: transitions.byStep,
  });
  if (validationFailures.length > 0) {
    throw new ActionLedgerVerificationError(canonicalValidationFailureCode(validationFailures));
  }
}
