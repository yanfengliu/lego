import { readContainedBoundedRegularFile } from "./bounded-file-read";
import {
  assertExactRealBuildArtifactPaths,
  verifyRealBuildRetainedArtifacts,
} from "./real-build-artifact-entry-verification";
import { verifyLegacyRealBuildArtifactScoreV4 } from "./real-build-artifact-legacy-score-verification";
import {
  LEGACY_REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA_V3,
  MAXIMUM_ARTIFACT_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_PRINTED_STEPS,
  sha256Digest,
} from "./real-build-artifact-policy";
import { REAL_BUILD_RUN_ID_PATTERN } from "./real-build-artifact-publication";
import { isLocalRealBuildAuthority } from "./real-build-authority";
import {
  isRealBuildDiagnosticPrefixSummary,
  REAL_BUILD_DIAGNOSTIC_PREFIX_FILE,
} from "./real-build-diagnostic-prefix";
import { assertRealBuildEnvironment, type RealBuildEnvironment } from "./real-build-environment";
import { verifyRealBuildReplayClosureData } from "./real-build-replay";
import { verifyLegacyRealBuildRunContractV2 } from "./real-build-run-contract-legacy-v2";
import {
  parseRealBuildRunContract,
  type LegacyRealBuildRunContractV2,
} from "./real-build-run-contract";
import { realBuildFartherCapturePath } from "./real-build-score";
import { verifyRealBuildServedResponseEvidence } from "./real-build-served-response-verification";
import { parseFatalUtf8Json } from "./strict-json";

export interface LegacyRealBuildArtifactInspectionV3 {
  readonly kind: "legacy-artifact-inspection";
  readonly authority: "inspection-only";
  readonly authenticated: false;
  readonly runId: string;
  readonly artifactManifestSchemaVersion: typeof LEGACY_REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA_V3;
  readonly runContractSchemaVersion: "lego.real-build-run-contract/2";
  readonly browserOutputSchemaVersion: "lego.real-build-browser-output/2";
  readonly scoreSchemaVersion: "lego.real-build-score/4";
  readonly verifiedDigests: {
    readonly replayClosure: string;
    readonly artifactManifest: string;
  };
}

interface ValidationSnapshot {
  readonly truthSnapshotHash: string | null;
  readonly validatorSetHash: string | null;
  readonly targetDocumentHash: string | null;
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}

const isNullableDigest = (value: unknown): value is string | null =>
  value === null || (typeof value === "string" && DIGEST_PATTERN.test(value));

/**
 * Verifies frozen manifest `/3` as inspection-only evidence.
 *
 * It intentionally returns no publication-verifier shape, finalization result, canonical document,
 * or pointer material. Current publication must call the `/4` verifier instead.
 */
export function inspectLegacyRealBuildArtifactManifestV3(
  directory: string,
  expectedRunId?: string,
): LegacyRealBuildArtifactInspectionV3 {
  const manifestBytes = readContainedBoundedRegularFile(directory, "artifact-manifest.json", {
    label: "legacy artifact manifest",
    maximumBytes: MAXIMUM_ARTIFACT_MANIFEST_BYTES,
  });
  const manifest = parseFatalUtf8Json<Record<string, unknown>>(
    manifestBytes,
    "legacy artifact manifest",
  );
  if (
    !hasExactKeys(manifest, [
      "schemaVersion",
      "authority",
      "runId",
      "runContract",
      "truthSnapshots",
      "replayClosure",
      "artifacts",
    ]) ||
    manifest.schemaVersion !== LEGACY_REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA_V3 ||
    !isLocalRealBuildAuthority(manifest.authority) ||
    !isRecord(manifest.authority) ||
    !hasExactKeys(manifest.authority, ["kind", "authenticated", "trustSealDigest", "reason"]) ||
    typeof manifest.runId !== "string" ||
    !REAL_BUILD_RUN_ID_PATTERN.test(manifest.runId) ||
    (expectedRunId !== undefined && manifest.runId !== expectedRunId) ||
    !isRecord(manifest.runContract) ||
    manifest.runContract.schemaVersion !== "lego.real-build-run-contract/2" ||
    !isRecord(manifest.truthSnapshots) ||
    !hasExactKeys(manifest.truthSnapshots, [
      "availability",
      "validationSnapshots",
      "finalStructuralHash",
      "diagnosticPrefix",
    ]) ||
    !Array.isArray(manifest.truthSnapshots.validationSnapshots) ||
    manifest.truthSnapshots.validationSnapshots.length > MAXIMUM_REAL_BUILD_PRINTED_STEPS ||
    manifest.truthSnapshots.finalStructuralHash !== null ||
    !isRealBuildDiagnosticPrefixSummary(manifest.truthSnapshots.diagnosticPrefix) ||
    !isRecord(manifest.replayClosure) ||
    !hasExactKeys(manifest.replayClosure, [
      "manifestDigest",
      "replayLevel",
      "earliestBoundary",
      "sourceBundleDigest",
      "environmentDigest",
    ]) ||
    manifest.replayClosure.replayLevel !== "downstream-only" ||
    manifest.replayClosure.earliestBoundary !== "browser-output" ||
    !DIGEST_PATTERN.test(String(manifest.replayClosure.manifestDigest)) ||
    !DIGEST_PATTERN.test(String(manifest.replayClosure.sourceBundleDigest)) ||
    !DIGEST_PATTERN.test(String(manifest.replayClosure.environmentDigest))
  ) {
    throw new TypeError(
      "Legacy artifact inspection requires exact manifest /3, run-contract /2, downstream browser evidence, and a diagnostic-only truth tuple.",
    );
  }
  const snapshots = manifest.truthSnapshots.validationSnapshots as unknown[];
  if (
    snapshots.some(
      (snapshot) =>
        !isRecord(snapshot) ||
        !hasExactKeys(snapshot, ["truthSnapshotHash", "validatorSetHash", "targetDocumentHash"]) ||
        !isNullableDigest(snapshot.truthSnapshotHash) ||
        !isNullableDigest(snapshot.validatorSetHash) ||
        !isNullableDigest(snapshot.targetDocumentHash),
    ) ||
    manifest.truthSnapshots.availability !== (snapshots.length > 0 ? "captured" : "unavailable")
  ) {
    throw new TypeError(
      "Legacy artifact truthSnapshots must be the exact bounded captured validation digest set.",
    );
  }
  const replay = verifyRealBuildReplayClosureData(directory);
  const closure = replay.manifest;
  if (
    closure.replayLevel !== "downstream-only" ||
    closure.earliestBoundary !== "browser-output" ||
    closure.manifestDigest !== manifest.replayClosure.manifestDigest ||
    closure.sourceBundle.digest !== manifest.replayClosure.sourceBundleDigest ||
    closure.environmentDigest !== manifest.replayClosure.environmentDigest ||
    closure.authority !== (manifest.authority as { kind: string }).kind ||
    closure.authenticated !== (manifest.authority as { authenticated: boolean }).authenticated
  ) {
    throw new TypeError("Legacy artifact manifest does not bind its verified replay closure.");
  }
  const retainedContract = parseRealBuildRunContract(replay.roleBytes.get("run-contract")!);
  if (
    retainedContract.schemaVersion !== "lego.real-build-run-contract/2" ||
    JSON.stringify(retainedContract) !== JSON.stringify(manifest.runContract)
  ) {
    throw new TypeError(
      "Legacy artifact manifest must contain the exact retained run-contract /2 role.",
    );
  }
  const preparedOptions = parseFatalUtf8Json<unknown>(
    replay.roleBytes.get("prepared-options")!,
    "legacy artifact prepared-options role",
  );
  verifyLegacyRealBuildRunContractV2({
    contract: retainedContract,
    options: preparedOptions,
    roleDigests: Object.fromEntries(closure.roles.map(({ role, digest }) => [role, digest])),
    sourceFiles: closure.sourceBundle.files,
  });
  const browserOutput = parseFatalUtf8Json<Record<string, unknown>>(
    replay.roleBytes.get("browser-output")!,
    "legacy artifact browser-output role",
  );
  if (browserOutput.schemaVersion !== "lego.real-build-browser-output/2") {
    throw new TypeError("Legacy artifact-manifest /3 requires exact browser-output /2 bytes.");
  }
  const environment = parseFatalUtf8Json<RealBuildEnvironment>(
    replay.roleBytes.get("environment")!,
    "legacy artifact environment role",
  );
  assertRealBuildEnvironment(environment, retainedContract.contractDigest);
  const retained = verifyRealBuildRetainedArtifacts(directory, manifest.artifacts);
  if (retained.documentBytes !== null) {
    throw new TypeError(
      "Legacy artifact-manifest /3 may inspect its diagnostic prefix, never a current canonical document.",
    );
  }
  const score = parseFatalUtf8Json<Record<string, unknown>>(
    retained.scoreBytes,
    "legacy retained score artifact schema",
  );
  if (score.schemaVersion !== "lego.real-build-score/4") {
    throw new TypeError("Legacy artifact-manifest /3 requires exact score /4 bytes.");
  }
  verifyLegacyRealBuildArtifactScoreV4({
    scoreBytes: retained.scoreBytes,
    diagnosticPrefixBytes: retained.diagnosticPrefixBytes,
    artifactEntries: retained.artifactEntries,
    declaredValidationSnapshots: snapshots as ValidationSnapshot[],
    declaredFinalStructuralHash: null,
    declaredDiagnosticPrefix: manifest.truthSnapshots.diagnosticPrefix,
    runId: manifest.runId,
    authority: manifest.authority,
    retainedContract: retainedContract as LegacyRealBuildRunContractV2,
    preparedOptions,
    browserOutputBytes: replay.roleBytes.get("browser-output")!,
    maximumPrintedSteps: MAXIMUM_REAL_BUILD_PRINTED_STEPS,
    sha256Digest,
  });
  const servedResponseFiles = verifyRealBuildServedResponseEvidence({
    directory,
    expectedManifestDigest: environment.servedResponseManifestDigest,
    sourceFiles: closure.sourceBundle.files,
    requireRunner: true,
    frozenLegacyArtifactManifestV3RunId: manifest.runId,
  });
  for (const file of servedResponseFiles) {
    if (!retained.artifactPaths.has(file)) {
      throw new TypeError(`Legacy served-response evidence ${file} is undeclared.`);
    }
  }
  const expectedArtifactPaths = new Set<string>([
    "score.json",
    REAL_BUILD_DIAGNOSTIC_PREFIX_FILE,
    ...servedResponseFiles,
  ]);
  for (const report of browserOutput.reports as unknown[]) {
    if (!isRecord(report)) {
      throw new TypeError("Legacy browser-output /2 report disappeared after replay verification.");
    }
    const stepNumber = report.stepNumber as number;
    if (report.panelPng !== null) {
      expectedArtifactPaths.add(`step-${String(stepNumber).padStart(3, "0")}-panel.png`);
    }
    if (report.buildPng !== null) {
      expectedArtifactPaths.add(`step-${String(stepNumber).padStart(3, "0")}-build.png`);
    }
    for (const capture of report.fartherCaptures as readonly Record<string, unknown>[]) {
      expectedArtifactPaths.add(realBuildFartherCapturePath(stepNumber, capture as never));
    }
  }
  assertExactRealBuildArtifactPaths(retained.artifactPaths, expectedArtifactPaths, "legacy");
  return {
    kind: "legacy-artifact-inspection",
    authority: "inspection-only",
    authenticated: false,
    runId: manifest.runId,
    artifactManifestSchemaVersion: LEGACY_REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA_V3,
    runContractSchemaVersion: "lego.real-build-run-contract/2",
    browserOutputSchemaVersion: "lego.real-build-browser-output/2",
    scoreSchemaVersion: "lego.real-build-score/4",
    verifiedDigests: {
      replayClosure: closure.manifestDigest,
      artifactManifest: sha256Digest(manifestBytes),
    },
  };
}
