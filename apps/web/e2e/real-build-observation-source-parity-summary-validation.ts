import {
  BOOTSTRAP_LOCK_COVERS_INSTRUCTION_PDF,
  BOOTSTRAP_MANIFEST_EVIDENCE_DIGEST,
  CANDIDATE_DERIVATION_BROWSER_COMMITMENT_DIGEST,
  CANDIDATE_POLICY_BROWSER_COMMITMENT_DIGEST,
  EXECUTION_MIRROR_COVERS_INSTRUCTION_PDF,
  SERVED_SOURCE_BUNDLE_MANIFEST_DIGEST,
  WORK_RGBA_BROWSER_COMMITMENT_DIGEST,
} from "./real-build-observation-source-parity-field-names.ts";
import {
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_STEPS,
  REAL_BUILD_SOURCE_PARITY_CLASSES,
  REAL_BUILD_SOURCE_PARITY_BROWSER_ASSERTED_DERIVATION_STAGES,
  type RealBuildSourceParityProbeResult,
} from "./real-build-observation-source-parity-types";
import {
  exactSourceParityKeys,
  sourceParityAggregate,
  sourceParityDigest,
  sourceParityInteger,
} from "./real-build-observation-source-parity-output-primitives";

const AGGREGATE_KEYS = [
  "sourceClass",
  "panels",
  "panelsDiffering",
  "totalPixels",
  "productionArea",
  "candidateArea",
  "intersectionPixels",
  "unionPixels",
  "mismatchPixels",
  "iou",
  "meanIou",
  "minimumIou",
] as const;

export function validatedRealBuildSourceParitySummaryCore(
  result: RealBuildSourceParityProbeResult,
  pdfDigest: string,
): Readonly<Record<string, unknown>> {
  for (let index = 0; index < REAL_BUILD_SOURCE_PARITY_CLASSES.length; index += 1) {
    const actual = result.aggregate[index]!;
    const expected = sourceParityAggregate(REAL_BUILD_SOURCE_PARITY_CLASSES[index]!, result);
    exactSourceParityKeys(actual, AGGREGATE_KEYS, `Source-parity aggregate row ${index}`);
    if (AGGREGATE_KEYS.some((key) => actual[key] !== expected[key])) {
      throw new TypeError("Source-parity aggregate does not reproduce the exact step comparisons.");
    }
  }
  exactSourceParityKeys(
    result.sourceSnapshot,
    [
      "state",
      "bootstrapManifestDigest",
      BOOTSTRAP_MANIFEST_EVIDENCE_DIGEST,
      "sourceRootsPolicyDigest",
      "bootstrapLockManifestDigest",
      "bootstrapLockedFiles",
      "bootstrapLockedBytes",
      BOOTSTRAP_LOCK_COVERS_INSTRUCTION_PDF,
      "executionMirrorManifestDigest",
      "executionMirrorFiles",
      "executionMirrorBytes",
      EXECUTION_MIRROR_COVERS_INSTRUCTION_PDF,
      "servedResponseManifestDigest",
      "servedResponseFiles",
      "servedResponseBytes",
      SERVED_SOURCE_BUNDLE_MANIFEST_DIGEST,
      "servedSourceBundleDigest",
      "servedSourceFiles",
      "servedSourceUniqueBytes",
      "browserResultDigest",
      "browserResultBytes",
      "preparedPanelsDigest",
      "environmentDigest",
    ],
    "Source-parity source snapshot",
  );
  if (
    result.sourceSnapshot.state !==
      "authenticated-bootstrap-and-execution-mirror-locks-held-before-and-after-measurement" ||
    result.sourceSnapshot.bootstrapLockCoversInstructionPdf !== false ||
    result.sourceSnapshot.executionMirrorCoversInstructionPdf !== true
  ) {
    throw new TypeError(
      "Source-parity source snapshot must state its exact lock and PDF boundary.",
    );
  }
  sourceParityDigest(result.sourceSnapshot.bootstrapManifestDigest, "Bootstrap manifest digest");
  sourceParityDigest(
    result.sourceSnapshot.bootstrapManifestEvidenceDigest,
    "Bootstrap manifest evidence digest",
  );
  sourceParityDigest(result.sourceSnapshot.sourceRootsPolicyDigest, "Source-roots policy digest");
  sourceParityDigest(result.sourceSnapshot.bootstrapLockManifestDigest, "Lock manifest digest");
  sourceParityDigest(
    result.sourceSnapshot.executionMirrorManifestDigest,
    "Execution mirror manifest digest",
  );
  sourceParityDigest(
    result.sourceSnapshot.servedResponseManifestDigest,
    "Served-response manifest digest",
  );
  sourceParityDigest(
    result.sourceSnapshot.servedSourceBundleManifestDigest,
    "Served source-bundle manifest digest",
  );
  sourceParityDigest(result.sourceSnapshot.servedSourceBundleDigest, "Served source-bundle digest");
  sourceParityDigest(result.sourceSnapshot.environmentDigest, "Execution environment digest");
  sourceParityDigest(result.sourceSnapshot.browserResultDigest, "Browser-result digest");
  sourceParityDigest(result.sourceSnapshot.preparedPanelsDigest, "Snapshot panels digest");
  if (result.sourceSnapshot.preparedPanelsDigest !== result.preparedPanelsDigest) {
    throw new TypeError(
      "Source snapshot prepared-panels digest does not match the browser result.",
    );
  }
  sourceParityInteger(
    result.sourceSnapshot.browserResultBytes,
    2,
    384 * 1024 * 1024,
    "Browser-result bytes",
  );
  sourceParityInteger(result.sourceSnapshot.bootstrapLockedFiles, 1, 10_000, "Locked source files");
  sourceParityInteger(
    result.sourceSnapshot.bootstrapLockedBytes,
    1,
    512 * 1024 * 1024,
    "Locked source bytes",
  );
  sourceParityInteger(
    result.sourceSnapshot.executionMirrorFiles,
    2,
    10_020,
    "Execution mirror files",
  );
  sourceParityInteger(
    result.sourceSnapshot.executionMirrorBytes,
    1,
    512 * 1024 * 1024,
    "Execution mirror bytes",
  );
  sourceParityInteger(result.sourceSnapshot.servedResponseFiles, 1, 5, "Served-response files");
  sourceParityInteger(
    result.sourceSnapshot.servedResponseBytes,
    1,
    144 * 1024 * 1024,
    "Served-response bytes",
  );
  sourceParityInteger(result.sourceSnapshot.servedSourceFiles, 1, 10_000, "Served source files");
  sourceParityInteger(
    result.sourceSnapshot.servedSourceUniqueBytes,
    1,
    192 * 1024 * 1024,
    "Served source unique bytes",
  );
  const summary = {
    schemaVersion: "lego.real-build-observation-source-parity/4",
    authority: "absent",
    evidencePurpose: "calibration-only-no-source-truth-authority/1",
    pdfDigest,
    preparedPanelsDigest: result.preparedPanelsDigest,
    sourceSnapshot: result.sourceSnapshot,
    browserCommitments: {
      schemaVersion: "lego.real-build-observation-source-parity-browser-commitments/1",
      status: "opaque-browser-assertions-not-independently-reproduced",
      fields: [
        "steps[]." + WORK_RGBA_BROWSER_COMMITMENT_DIGEST,
        "steps[]." + CANDIDATE_POLICY_BROWSER_COMMITMENT_DIGEST,
        "steps[]." + CANDIDATE_DERIVATION_BROWSER_COMMITMENT_DIGEST,
      ],
    },
    browserAssertedDerivationStages: REAL_BUILD_SOURCE_PARITY_BROWSER_ASSERTED_DERIVATION_STAGES,
    panelCount: result.steps.length,
    displayColumns: [
      "opaque point-sampled work RGBA (visualization-only; source pixels are not retained or independently reproduced)",
      "production mask occupancy",
      "candidate mask occupancy",
      "XOR any-mismatch",
    ],
    calibrationSteps: REAL_BUILD_SOURCE_PARITY_CALIBRATION_STEPS,
    steps: result.steps,
    aggregate: result.aggregate,
  };
  return JSON.parse(canonicalStringify(summary)) as Readonly<Record<string, unknown>>;
}
import { canonicalStringify } from "@lego-studio/brick-kernel";
