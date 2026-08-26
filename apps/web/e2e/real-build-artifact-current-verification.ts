import { readContainedBoundedRegularFile } from "./bounded-file-read";
import { verifyRealBuildArtifactScore } from "./real-build-artifact-score-verification";
import { assertCurrentArtifactReplayBoundaryVerifiable } from "./real-build-artifact-input-rejection-policy";
import {
  assertExactRealBuildArtifactPaths,
  verifyRealBuildRetainedArtifacts,
} from "./real-build-artifact-entry-verification";
import {
  MAXIMUM_ARTIFACT_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_PRINTED_STEPS,
  REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA,
  sha256Digest,
} from "./real-build-artifact-policy";
import type { RealBuildPublicationVerification } from "./real-build-artifact-publication";
import { REAL_BUILD_RUN_ID_PATTERN } from "./real-build-artifact-publication";
import { isLocalRealBuildAuthority } from "./real-build-authority";
import {
  assertReadableRealBuildBrowserOutput,
  type RealBuildBrowserOutput,
} from "./real-build-browser-output";
import {
  isRealBuildDiagnosticPrefixSummary,
  REAL_BUILD_DIAGNOSTIC_PREFIX_FILE,
  type RealBuildDiagnosticPrefixSummary,
} from "./real-build-diagnostic-prefix";
import { assertRealBuildEnvironment, type RealBuildEnvironment } from "./real-build-environment";
import {
  prepareRealBuildReplayVerification,
  verifyPreparedRealBuildReplayClosureData,
  type PreparedRealBuildReplayVerification,
  type PreparedRealBuildReplayVerificationResult,
} from "./real-build-replay";
import type { VerifiedRealBuildReplayClosure } from "./real-build-replay-types";
import {
  parseRealBuildRunContract,
  verifyRealBuildRunContract,
  type CurrentRealBuildRunContract,
} from "./real-build-run-contract";
import { parseRealBuildPreparedRunInput } from "./real-build-prepared-run-input-parser";
import { realBuildFartherCapturePath } from "./real-build-score";
import type { RealBuildResult } from "./real-build-safety";
import { verifyRealBuildServedResponseEvidence } from "./real-build-served-response-verification";
import {
  assertCanonicalRealBuildJsonBytes,
  parseCanonicalRealBuildJson,
  parseDuplicateFreeRealBuildJson,
} from "./real-build-json-admission";

interface ValidationSnapshot {
  readonly truthSnapshotHash: string | null;
  readonly validatorSetHash: string | null;
  readonly targetDocumentHash: string | null;
}

interface CurrentArtifactManifest {
  readonly schemaVersion: typeof REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA;
  readonly authority: RealBuildResult["authority"];
  readonly runId: string;
  readonly runContract: CurrentRealBuildRunContract;
  readonly truthSnapshots: {
    readonly availability: "captured" | "unavailable";
    readonly validationSnapshots: readonly ValidationSnapshot[];
    readonly finalStructuralHash: string | null;
    readonly diagnosticPrefix: RealBuildDiagnosticPrefixSummary | null;
  };
  readonly replayClosure: {
    readonly manifestDigest: string;
    readonly replayLevel: "downstream-only" | "metadata-only";
    readonly earliestBoundary: "browser-output" | "input-rejection";
    readonly sourceBundleDigest: string;
    readonly environmentDigest: string;
  };
  readonly artifacts: unknown;
}

interface BoundCurrentArtifactManifest {
  readonly bytes: Buffer;
  readonly value: CurrentArtifactManifest;
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

function assertCurrentManifestShape(
  value: unknown,
  expectedRunId?: string,
): asserts value is CurrentArtifactManifest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schemaVersion",
      "authority",
      "runId",
      "runContract",
      "truthSnapshots",
      "replayClosure",
      "artifacts",
    ]) ||
    value.schemaVersion !== REAL_BUILD_ARTIFACT_MANIFEST_SCHEMA ||
    !isLocalRealBuildAuthority(value.authority) ||
    !isRecord(value.authority) ||
    !hasExactKeys(value.authority, ["kind", "authenticated", "trustSealDigest", "reason"]) ||
    typeof value.runId !== "string" ||
    !REAL_BUILD_RUN_ID_PATTERN.test(value.runId) ||
    (expectedRunId !== undefined && value.runId !== expectedRunId) ||
    !isRecord(value.runContract) ||
    value.runContract.schemaVersion !== "lego.real-build-run-contract/5" ||
    !isRecord(value.truthSnapshots) ||
    !hasExactKeys(value.truthSnapshots, [
      "availability",
      "validationSnapshots",
      "finalStructuralHash",
      "diagnosticPrefix",
    ]) ||
    !Array.isArray(value.truthSnapshots.validationSnapshots) ||
    value.truthSnapshots.validationSnapshots.length > MAXIMUM_REAL_BUILD_PRINTED_STEPS ||
    !isNullableDigest(value.truthSnapshots.finalStructuralHash) ||
    (value.truthSnapshots.diagnosticPrefix !== null &&
      !isRealBuildDiagnosticPrefixSummary(value.truthSnapshots.diagnosticPrefix)) ||
    !isRecord(value.replayClosure) ||
    !hasExactKeys(value.replayClosure, [
      "manifestDigest",
      "replayLevel",
      "earliestBoundary",
      "sourceBundleDigest",
      "environmentDigest",
    ]) ||
    !DIGEST_PATTERN.test(String(value.replayClosure.manifestDigest)) ||
    !["downstream-only", "metadata-only"].includes(String(value.replayClosure.replayLevel)) ||
    !["browser-output", "input-rejection"].includes(String(value.replayClosure.earliestBoundary)) ||
    !DIGEST_PATTERN.test(String(value.replayClosure.sourceBundleDigest)) ||
    !DIGEST_PATTERN.test(String(value.replayClosure.environmentDigest))
  ) {
    throw new TypeError(
      "Current real-build artifact manifest must be exact schema /4 over run-contract /5.",
    );
  }
  const snapshots = value.truthSnapshots.validationSnapshots;
  if (
    snapshots.some(
      (snapshot) =>
        !isRecord(snapshot) ||
        !hasExactKeys(snapshot, ["truthSnapshotHash", "validatorSetHash", "targetDocumentHash"]) ||
        !isNullableDigest(snapshot.truthSnapshotHash) ||
        !isNullableDigest(snapshot.validatorSetHash) ||
        !isNullableDigest(snapshot.targetDocumentHash),
    ) ||
    value.truthSnapshots.availability !== (snapshots.length > 0 ? "captured" : "unavailable")
  ) {
    throw new TypeError(
      "Artifact truthSnapshots must be an exact bounded set of captured validation digests with matching availability.",
    );
  }
}

function bindCurrentArtifactManifest(
  directory: string,
  expectedRunId?: string,
): BoundCurrentArtifactManifest {
  const bytes = readContainedBoundedRegularFile(directory, "artifact-manifest.json", {
    label: "artifact manifest",
    maximumBytes: MAXIMUM_ARTIFACT_MANIFEST_BYTES,
  });
  const value = parseDuplicateFreeRealBuildJson<unknown>(bytes, "current artifact manifest");
  assertCurrentManifestShape(value, expectedRunId);
  assertCanonicalRealBuildJsonBytes(
    bytes,
    value,
    "current artifact manifest",
    "pretty-one-space-line",
  );
  return { bytes, value };
}

function verifyRealBuildArtifactManifestWithReplay(
  directory: string,
  expectedRunId: string | undefined,
  verifiedClosure: VerifiedRealBuildReplayClosure,
): RealBuildPublicationVerification {
  const expectedCheckoutRoot = resolve(process.cwd()).replaceAll("\\", "/");
  const boundManifest = bindCurrentArtifactManifest(directory, expectedRunId);
  const artifactManifestBytes = boundManifest.bytes;
  const manifest = boundManifest.value;
  const closure = verifiedClosure.manifest;
  if (
    closure.manifestDigest !== manifest.replayClosure.manifestDigest ||
    closure.replayLevel !== manifest.replayClosure.replayLevel ||
    closure.earliestBoundary !== manifest.replayClosure.earliestBoundary ||
    closure.sourceBundle.digest !== manifest.replayClosure.sourceBundleDigest ||
    closure.environmentDigest !== manifest.replayClosure.environmentDigest ||
    closure.authority !== manifest.authority.kind ||
    closure.authenticated !== manifest.authority.authenticated
  ) {
    throw new TypeError("Artifact manifest does not bind the verified replay closure.");
  }
  assertCurrentArtifactReplayBoundaryVerifiable(closure, "verify");
  const retainedContract = parseRealBuildRunContract(
    verifiedClosure.roleBytes.get("run-contract")!,
  );
  if (
    retainedContract.schemaVersion !== "lego.real-build-run-contract/5" ||
    JSON.stringify(retainedContract) !== JSON.stringify(manifest.runContract)
  ) {
    throw new TypeError(
      "Current artifact manifest requires the exact retained run-contract /5 role.",
    );
  }
  const preparedOptions = parseRealBuildPreparedRunInput(
    verifiedClosure.roleBytes.get("prepared-options")!,
  ).options;
  const environment = parseCanonicalRealBuildJson<RealBuildEnvironment>(
    verifiedClosure.roleBytes.get("environment")!,
    "current artifact environment role",
  );
  assertRealBuildEnvironment(environment, retainedContract.contractDigest);
  verifyRealBuildRunContract({
    contract: retainedContract,
    options: preparedOptions,
    roleDigests: Object.fromEntries(closure.roles.map(({ role, digest }) => [role, digest])),
    sourceFiles: closure.sourceBundle.files,
  });
  const retained = verifyRealBuildRetainedArtifacts(directory, manifest.artifacts);
  verifyRealBuildArtifactScore({
    scoreBytes: retained.scoreBytes,
    documentBytes: retained.documentBytes,
    diagnosticPrefixBytes: retained.diagnosticPrefixBytes,
    artifactEntries: retained.artifactEntries,
    declaredValidationSnapshots: manifest.truthSnapshots.validationSnapshots,
    declaredFinalStructuralHash: manifest.truthSnapshots.finalStructuralHash,
    declaredDiagnosticPrefix: manifest.truthSnapshots.diagnosticPrefix,
    runId: manifest.runId,
    authority: manifest.authority,
    retainedContract,
    preparedOptions,
    replayLevel: closure.replayLevel,
    earliestBoundary: closure.earliestBoundary,
    browserOutputBytes: verifiedClosure.roleBytes.get("browser-output"),
    maximumPrintedSteps: MAXIMUM_REAL_BUILD_PRINTED_STEPS,
    sha256Digest,
  });
  const servedResponseFiles = verifyRealBuildServedResponseEvidence({
    directory,
    expectedManifestDigest: environment.servedResponseManifestDigest,
    sourceFiles: closure.sourceBundle.files,
    requireRunner: closure.replayLevel === "downstream-only",
    expectedCheckoutRoot,
  });
  for (const file of servedResponseFiles) {
    if (!retained.artifactPaths.has(file)) {
      throw new TypeError(`Served-response evidence ${file} is missing from retained artifacts.`);
    }
  }
  const expectedArtifactPaths = new Set<string>(["score.json", ...servedResponseFiles]);
  if (retained.documentBytes !== null) expectedArtifactPaths.add("document.json");
  if (retained.diagnosticPrefixBytes !== null) {
    expectedArtifactPaths.add(REAL_BUILD_DIAGNOSTIC_PREFIX_FILE);
  }
  if (closure.replayLevel === "downstream-only") {
    const browserOutput = parseCanonicalRealBuildJson<unknown>(
      verifiedClosure.roleBytes.get("browser-output")!,
      "current artifact browser-output path projection",
    );
    assertReadableRealBuildBrowserOutput(browserOutput, preparedOptions);
    for (const report of (browserOutput as RealBuildBrowserOutput).reports) {
      if (report.panelPng !== null) {
        expectedArtifactPaths.add(`step-${String(report.stepNumber).padStart(3, "0")}-panel.png`);
      }
      if (report.buildPng !== null) {
        expectedArtifactPaths.add(`step-${String(report.stepNumber).padStart(3, "0")}-build.png`);
      }
      for (const capture of report.fartherCaptures) {
        expectedArtifactPaths.add(realBuildFartherCapturePath(report.stepNumber, capture));
      }
    }
  }
  assertExactRealBuildArtifactPaths(retained.artifactPaths, expectedArtifactPaths, "current");
  return {
    runId: manifest.runId,
    replayClosureDigest: closure.manifestDigest,
    artifactManifestDigest: sha256Digest(artifactManifestBytes),
  };
}

declare const PREPARED_ARTIFACT_VERIFICATION_BRAND: unique symbol;

/** Opaque full-artifact proof carried across the asynchronous verification handoff. */
export interface PreparedRealBuildArtifactVerification {
  readonly [PREPARED_ARTIFACT_VERIFICATION_BRAND]: true;
}

interface PreparedArtifactVerificationState {
  readonly replayProof: PreparedRealBuildReplayVerification;
  readonly verification: RealBuildPublicationVerification;
}

const preparedArtifactVerificationStates = new WeakMap<
  PreparedRealBuildArtifactVerification,
  PreparedArtifactVerificationState
>();

function prepareArtifactManifestVerificationWithReplay(
  directory: string,
  expectedRunId: string | undefined,
  replay: PreparedRealBuildReplayVerificationResult,
): {
  readonly verification: RealBuildPublicationVerification;
  readonly proof: PreparedRealBuildArtifactVerification;
} {
  const verification = verifyRealBuildArtifactManifestWithReplay(
    directory,
    expectedRunId,
    replay.verified,
  );
  const proof = Object.freeze({}) as PreparedRealBuildArtifactVerification;
  preparedArtifactVerificationStates.set(proof, {
    replayProof: replay.proof,
    verification,
  });
  return { verification, proof };
}

export function prepareRealBuildArtifactManifestVerification(
  directory: string,
  expectedRunId?: string,
): Promise<{
  readonly verification: RealBuildPublicationVerification;
  readonly proof: PreparedRealBuildArtifactVerification;
}> {
  bindCurrentArtifactManifest(directory, expectedRunId);
  return prepareRealBuildReplayVerification(directory).then((replay) => {
    const verifiedReplay = verifyPreparedRealBuildReplayClosureData(directory, replay.proof);
    return prepareArtifactManifestVerificationWithReplay(directory, expectedRunId, {
      ...replay,
      verified: verifiedReplay,
    });
  });
}

export function verifyPreparedRealBuildArtifactManifest(
  directory: string,
  expectedRunId: string,
  proof: PreparedRealBuildArtifactVerification,
): RealBuildPublicationVerification {
  const proofState = preparedArtifactVerificationStates.get(proof);
  if (proofState === undefined) {
    throw new TypeError(
      "Prepared artifact verification must be the private proof returned by the asynchronous retained-PDF verifier.",
    );
  }
  const verifiedClosure = verifyPreparedRealBuildReplayClosureData(
    directory,
    proofState.replayProof,
  );
  const verification = verifyRealBuildArtifactManifestWithReplay(
    directory,
    expectedRunId,
    verifiedClosure,
  );
  if (JSON.stringify(verification) !== JSON.stringify(proofState.verification)) {
    throw new TypeError(
      "Artifact publication bindings changed after asynchronous verification; verify the exact retained directory again.",
    );
  }
  return verification;
}

export function verifyRealBuildArtifactManifest(
  directory: string,
  expectedRunId?: string,
): Promise<RealBuildPublicationVerification> {
  bindCurrentArtifactManifest(directory, expectedRunId);
  return prepareRealBuildReplayVerification(directory).then(({ proof }) => {
    const verifiedClosure = verifyPreparedRealBuildReplayClosureData(directory, proof);
    return verifyRealBuildArtifactManifestWithReplay(directory, expectedRunId, verifiedClosure);
  });
}

import { resolve } from "node:path";
