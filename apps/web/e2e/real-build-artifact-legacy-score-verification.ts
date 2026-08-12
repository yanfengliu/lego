import { validateBrickDocumentV1 } from "@lego-studio/protocol";
import { inspectFrozenLegacyBrowserOutputV2 } from "./real-build-artifact-legacy-browser-v2";
import { decodeFrozenLegacyPngCaptureV2 } from "./real-build-artifact-legacy-browser-v2-values";
import { projectLegacyRealBuildCompletionFailuresV4 } from "./real-build-artifact-legacy-completion-projection";
import {
  assertRealBuildDiagnosticPrefixDocument,
  isRealBuildDiagnosticPrefixSummary,
  type RealBuildDiagnosticPrefixSummary,
} from "./real-build-diagnostic-prefix";
import { realBuildFartherCapturePath } from "./real-build-score";
import type { LegacyRealBuildRunContractV2 } from "./real-build-run-contract";
import { isFrozenLegacyAtomicStepComplete } from "./real-build-artifact-legacy-report-predicates";
import type { RealBuildOptions } from "./real-build-safety";
import { parseFatalUtf8Json } from "./strict-json";

interface ArtifactEntry {
  readonly bytes: number;
  readonly digest: string;
}

interface ValidationSnapshot {
  readonly truthSnapshotHash: string | null;
  readonly validatorSetHash: string | null;
  readonly targetDocumentHash: string | null;
}

export interface LegacyRealBuildArtifactScoreVerificationInput {
  readonly scoreBytes: Buffer;
  readonly diagnosticPrefixBytes: Buffer | null;
  readonly artifactEntries: ReadonlyMap<string, ArtifactEntry>;
  readonly declaredValidationSnapshots: readonly ValidationSnapshot[];
  readonly declaredFinalStructuralHash: string | null;
  readonly declaredDiagnosticPrefix: unknown;
  readonly runId: string;
  readonly authority: unknown;
  readonly retainedContract: LegacyRealBuildRunContractV2;
  readonly preparedOptions: unknown;
  readonly browserOutputBytes: Buffer;
  readonly maximumPrintedSteps: number;
  readonly sha256Digest: (value: string | Uint8Array) => string;
}

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const LEGACY_SCORE_KEYS = [
  "schemaVersion",
  "authority",
  "runId",
  "status",
  "inputDigests",
  "accounting",
  "lastStep",
  "stepsAttempted",
  "stepsComplete",
  "piecesPlaced",
  "diagnosticPrefix",
  "finalParts",
  "structuralHash",
  "inputFailures",
  "completionFailures",
  "failures",
  "totalElapsedMs",
  "steps",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}

function isNullableDigest(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && DIGEST_PATTERN.test(value));
}

function isClosedStepFailure(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const allowed = new Set([
    "code",
    "stage",
    "message",
    "causedByStep",
    "pieceIndex",
    "catalogPartId",
    "inputKey",
    "stepNumber",
  ]);
  return (
    Object.keys(value).every((key) => allowed.has(key)) &&
    typeof value.code === "string" &&
    value.code.length > 0 &&
    typeof value.stage === "string" &&
    value.stage.length > 0 &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    ["causedByStep", "pieceIndex", "stepNumber"].every(
      (key) => value[key] === undefined || Number.isSafeInteger(value[key]),
    ) &&
    ["catalogPartId", "inputKey"].every(
      (key) => value[key] === undefined || typeof value[key] === "string",
    )
  );
}

function legacyCapturePath(stepNumber: number, kind: "panel" | "build"): string {
  return `step-${String(stepNumber).padStart(3, "0")}-${kind}.png`;
}

function projectLegacyBrowserStep(step: Record<string, unknown>): Record<string, unknown> {
  const { panelPng, buildPng, fartherCaptures, ...projected } = step;
  const stepNumber = step.stepNumber as number;
  return {
    ...projected,
    panelPng: panelPng === null ? null : legacyCapturePath(stepNumber, "panel"),
    buildPng: buildPng === null ? null : legacyCapturePath(stepNumber, "build"),
    fartherCaptures: (fartherCaptures as readonly Record<string, unknown>[]).map((capture) => ({
      captureId: capture.captureId,
      role: capture.role,
      panelStepNumber: capture.panelStepNumber,
      candidateId: capture.candidateId,
      path: realBuildFartherCapturePath(stepNumber, capture as never),
    })),
  };
}

function bindLegacyCapture(
  path: string,
  dataUrl: unknown,
  entries: ReadonlyMap<string, ArtifactEntry>,
  sha256Digest: (value: string | Uint8Array) => string,
): void {
  if (typeof dataUrl !== "string") {
    throw new TypeError(`Legacy retained capture ${path} lacks its exact browser PNG data URL.`);
  }
  const bytes = decodeFrozenLegacyPngCaptureV2(dataUrl);
  const entry = entries.get(path);
  if (entry === undefined || entry.bytes !== bytes.length || entry.digest !== sha256Digest(bytes)) {
    throw new TypeError(
      `Legacy retained capture ${path} does not equal its exact browser-output PNG bytes.`,
    );
  }
}

/** Inspection-only verification of the frozen `/2 browser -> /4 score` projection. */
export function verifyLegacyRealBuildArtifactScoreV4(
  input: LegacyRealBuildArtifactScoreVerificationInput,
): void {
  const options = input.preparedOptions as RealBuildOptions;
  const browserValue = parseFatalUtf8Json<unknown>(
    input.browserOutputBytes,
    "legacy artifact browser-output role",
  );
  const browserOutput = inspectFrozenLegacyBrowserOutputV2(browserValue, options);
  if (browserOutput.status !== "executed") {
    throw new TypeError(
      "Legacy artifact-manifest /3 inspection supports only its frozen downstream browser-output /2 generation.",
    );
  }
  const score = parseFatalUtf8Json<Record<string, unknown>>(
    input.scoreBytes,
    "legacy retained score artifact",
  );
  if (
    !hasExactKeys(score, LEGACY_SCORE_KEYS) ||
    score.schemaVersion !== "lego.real-build-score/4" ||
    score.runId !== input.runId ||
    JSON.stringify(score.authority) !== JSON.stringify(input.authority) ||
    JSON.stringify(score.inputDigests) !== JSON.stringify(input.retainedContract.inputDigests) ||
    JSON.stringify(score.accounting) !== JSON.stringify(options.accounting) ||
    score.lastStep !== input.retainedContract.budgets.lastStep ||
    score.lastStep !== options.lastStep ||
    !["completed", "prefix-complete", "incomplete"].includes(String(score.status)) ||
    !isNullableDigest(score.structuralHash) ||
    score.structuralHash !== input.declaredFinalStructuralHash ||
    JSON.stringify(score.diagnosticPrefix) !== JSON.stringify(input.declaredDiagnosticPrefix) ||
    !Array.isArray(score.steps) ||
    score.steps.length > input.maximumPrintedSteps ||
    !Array.isArray(score.inputFailures) ||
    score.inputFailures.length !== 0 ||
    !Array.isArray(score.completionFailures) ||
    score.completionFailures.length === 0 ||
    !score.completionFailures.every(isClosedStepFailure) ||
    !Array.isArray(score.failures) ||
    !Number.isFinite(score.totalElapsedMs) ||
    (score.totalElapsedMs as number) < 0 ||
    (score.totalElapsedMs as number) > 4 * 60 * 60 * 1_000 ||
    !Number.isSafeInteger(score.finalParts) ||
    (score.finalParts as number) < 0 ||
    (score.finalParts as number) > options.maxParts ||
    (score.diagnosticPrefix !== null && !isRealBuildDiagnosticPrefixSummary(score.diagnosticPrefix))
  ) {
    throw new TypeError(
      "Legacy score /4 must bind its exact run-contract /2, authority, inputs, bounded status, and diagnostic tuple.",
    );
  }
  const browserSteps = browserOutput.reports as readonly Record<string, unknown>[];
  const projectedSteps = browserSteps.map(projectLegacyBrowserStep);
  if (JSON.stringify(score.steps) !== JSON.stringify(projectedSteps)) {
    throw new TypeError(
      "Legacy score /4 steps do not exactly project from the retained browser-output /2 rows.",
    );
  }
  for (const step of browserSteps) {
    const stepNumber = step.stepNumber as number;
    if (step.panelPng !== null) {
      bindLegacyCapture(
        legacyCapturePath(stepNumber, "panel"),
        step.panelPng,
        input.artifactEntries,
        input.sha256Digest,
      );
    }
    if (step.buildPng !== null) {
      bindLegacyCapture(
        legacyCapturePath(stepNumber, "build"),
        step.buildPng,
        input.artifactEntries,
        input.sha256Digest,
      );
    }
    for (const capture of step.fartherCaptures as readonly Record<string, unknown>[]) {
      bindLegacyCapture(
        realBuildFartherCapturePath(stepNumber, capture as never),
        capture.png,
        input.artifactEntries,
        input.sha256Digest,
      );
    }
  }
  const completeRows = projectedSteps.filter((step) =>
    isFrozenLegacyAtomicStepComplete(step as never),
  );
  const piecesPlaced = projectedSteps.reduce(
    (total, step) => total + (step.placedPieces as number),
    0,
  );
  const failures = projectedSteps
    .filter((step) => isRecord(step.outcome) && step.outcome.status === "failed")
    .map((step) => ({
      stepNumber: step.stepNumber,
      failure: (step.outcome as Record<string, unknown>).failure,
    }));
  const totalsMismatch =
    score.stepsAttempted !== projectedSteps.length
      ? "stepsAttempted"
      : score.stepsComplete !== completeRows.length
        ? "stepsComplete"
        : score.piecesPlaced !== piecesPlaced
          ? "piecesPlaced"
          : JSON.stringify(score.failures) !== JSON.stringify(failures)
            ? "failures"
            : score.totalElapsedMs !== browserOutput.totalElapsedMs
              ? "totalElapsedMs"
              : null;
  if (totalsMismatch !== null) {
    throw new TypeError(`Legacy score /4 ${totalsMismatch} does not reproduce browser-output /2.`);
  }
  if (score.structuralHash !== null || score.finalParts !== 0) {
    throw new TypeError(
      "Legacy artifact-manifest /3 may inspect only its empty canonical tuple; it cannot recover current finalization authority.",
    );
  }
  if (score.diagnosticPrefix === null || input.diagnosticPrefixBytes === null) {
    throw new TypeError(
      "Legacy artifact-manifest /3 requires its frozen diagnostic-prefix truth snapshot and exact bytes.",
    );
  }
  const summary = score.diagnosticPrefix as RealBuildDiagnosticPrefixSummary;
  const leadingComplete = projectedSteps.findIndex(
    (step) => !isFrozenLegacyAtomicStepComplete(step as never),
  );
  const throughStep = leadingComplete < 0 ? projectedSteps.length : leadingComplete;
  const diagnosticDocument = parseFatalUtf8Json<unknown>(
    input.diagnosticPrefixBytes,
    "legacy diagnostic-prefix document",
  );
  if (!validateBrickDocumentV1(diagnosticDocument)) {
    throw new TypeError("Legacy diagnostic-prefix bytes are not a valid BrickDocumentV1.");
  }
  assertRealBuildDiagnosticPrefixDocument(input.diagnosticPrefixBytes, summary);
  const expectedCompletionFailures = projectLegacyRealBuildCompletionFailuresV4({
    output: browserOutput,
    options,
    diagnosticDocument,
  });
  if (
    score.status !== "incomplete" ||
    summary.targetEquivalence !== "unreconciled" ||
    summary.throughStepNumber !== throughStep ||
    JSON.stringify(score.completionFailures) !== JSON.stringify(expectedCompletionFailures) ||
    browserOutput.documentJson !== input.diagnosticPrefixBytes.toString("utf8")
  ) {
    throw new TypeError(
      "Legacy diagnostic prefix must bind the exact leading complete browser document and full frozen completion-failure projection.",
    );
  }
  const scoreSnapshots = [
    ...new Map(
      projectedSteps.flatMap((step) => {
        const validation = step.validation;
        if (!isRecord(validation)) {
          throw new TypeError("Legacy score /4 rows must retain validation records.");
        }
        if (validation.attempted !== true) return [];
        const snapshot = {
          truthSnapshotHash: validation.truthSnapshotHash as string | null,
          validatorSetHash: validation.validatorSetHash as string | null,
          targetDocumentHash: validation.targetDocumentHash as string | null,
        };
        if (Object.values(snapshot).some((value) => !isNullableDigest(value))) {
          throw new TypeError("Legacy score attempted validation digests are malformed.");
        }
        return [[JSON.stringify(Object.values(snapshot)), snapshot] as const];
      }),
    ).values(),
  ];
  if (JSON.stringify(scoreSnapshots) !== JSON.stringify(input.declaredValidationSnapshots)) {
    throw new TypeError(
      "Legacy artifact truthSnapshots differ from the exact browser-to-score validation projection.",
    );
  }
}
