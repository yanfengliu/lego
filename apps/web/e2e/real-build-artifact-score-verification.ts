import { documentStructuralHash } from "@lego-studio/brick-kernel";
import { validateBrickDocumentV1, type BrickDocumentV1 } from "@lego-studio/protocol";

import {
  assertReadableRealBuildBrowserOutput,
  decodeRealBuildPngCapture,
} from "./real-build-browser-output";
import {
  assertRealBuildDiagnosticPrefixDocument,
  isRealBuildDiagnosticPrefixSummary,
  type RealBuildDiagnosticPrefixSummary,
} from "./real-build-diagnostic-prefix";
import { finalizeExecutedRealBuildResult } from "./real-build-finalize";
import type { RealBuildReplayClosureManifest } from "./real-build-replay";
import type { RealBuildRunContract } from "./real-build-run-contract";
import {
  createRealBuildScore,
  realBuildFartherCapturePath,
  REAL_BUILD_SCORE_SCHEMA,
} from "./real-build-score";
import {
  isAtomicStepComplete,
  type RealBuildOptions,
  type RealBuildResult,
} from "./real-build-safety";
import { parseFatalUtf8Json } from "./strict-json";

interface ArtifactEntry {
  readonly bytes: number;
  readonly digest: string;
}

interface DeclaredValidationSnapshot {
  readonly truthSnapshotHash?: string | null;
  readonly validatorSetHash?: string | null;
  readonly targetDocumentHash?: string | null;
}

export interface RealBuildArtifactScoreVerificationInput {
  readonly scoreBytes: Buffer;
  readonly documentBytes: Buffer | null;
  readonly diagnosticPrefixBytes: Buffer | null;
  readonly artifactEntries: ReadonlyMap<string, ArtifactEntry>;
  readonly declaredValidationSnapshots: readonly DeclaredValidationSnapshot[];
  readonly declaredFinalStructuralHash: string | null;
  readonly declaredDiagnosticPrefix: unknown;
  readonly runId: string;
  readonly authority: RealBuildResult["authority"];
  readonly retainedContract: RealBuildRunContract;
  readonly preparedOptions: RealBuildOptions;
  readonly replayLevel: RealBuildReplayClosureManifest["replayLevel"];
  readonly earliestBoundary: RealBuildReplayClosureManifest["earliestBoundary"];
  readonly browserOutputBytes: Buffer | undefined;
  readonly maximumPrintedSteps: number;
  readonly sha256Digest: (value: string | Uint8Array) => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactObjectKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    JSON.stringify(Object.keys(value).sort((left, right) => left.localeCompare(right))) ===
    JSON.stringify([...keys].sort((left, right) => left.localeCompare(right)))
  );
}

function isNullableDigest(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value));
}

export function verifyRealBuildArtifactScore(input: RealBuildArtifactScoreVerificationInput): void {
  const score = parseFatalUtf8Json<Record<string, unknown>>(
    input.scoreBytes,
    "retained score artifact",
  );
  if (
    !exactObjectKeys(score, [
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
    ]) ||
    score.schemaVersion !== REAL_BUILD_SCORE_SCHEMA ||
    score.runId !== input.runId ||
    JSON.stringify(score.authority) !== JSON.stringify(input.authority) ||
    JSON.stringify(score.inputDigests) !== JSON.stringify(input.retainedContract.inputDigests) ||
    JSON.stringify(score.accounting) !== JSON.stringify(input.preparedOptions.accounting) ||
    score.lastStep !== input.retainedContract.budgets.lastStep ||
    score.lastStep !== input.preparedOptions.lastStep ||
    !["completed", "prefix-complete", "incomplete", "input-rejected"].includes(
      String(score.status),
    ) ||
    !isNullableDigest(score.structuralHash) ||
    score.structuralHash !== input.declaredFinalStructuralHash ||
    JSON.stringify(score.diagnosticPrefix) !== JSON.stringify(input.declaredDiagnosticPrefix) ||
    !Array.isArray(score.steps) ||
    score.steps.length > input.maximumPrintedSteps ||
    !Array.isArray(score.inputFailures) ||
    !Array.isArray(score.completionFailures) ||
    !Array.isArray(score.failures) ||
    !Number.isFinite(score.totalElapsedMs) ||
    (score.totalElapsedMs as number) < 0 ||
    (score.totalElapsedMs as number) > 4 * 60 * 60 * 1_000 ||
    !Number.isSafeInteger(score.finalParts) ||
    (score.finalParts as number) < 0 ||
    (score.finalParts as number) > input.preparedOptions.maxParts ||
    (score.diagnosticPrefix !== null && !isRealBuildDiagnosticPrefixSummary(score.diagnosticPrefix))
  ) {
    throw new TypeError(
      "Retained score must bind the artifact run, authority, input digests, structural hash, and bounded step list.",
    );
  }
  if (input.replayLevel === "downstream-only") {
    const browserOutput = parseFatalUtf8Json<unknown>(
      input.browserOutputBytes!,
      "artifact browser-output role",
    );
    assertReadableRealBuildBrowserOutput(browserOutput, input.preparedOptions);
    const reproducedResult = finalizeExecutedRealBuildResult({
      options: input.preparedOptions,
      browserOutput,
    });
    const reproducedScore = createRealBuildScore({
      runId: input.runId,
      result: reproducedResult,
      accounting: input.preparedOptions.accounting,
      lastStep: input.preparedOptions.lastStep,
    });
    if (JSON.stringify(score) !== JSON.stringify(reproducedScore)) {
      throw new TypeError(
        "Retained score does not exactly reproduce from the independently finalized browser output and prepared options.",
      );
    }
    const reproducedDocument =
      reproducedResult.documentJson !== null && reproducedResult.structuralHash !== null
        ? Buffer.from(reproducedResult.documentJson)
        : null;
    const reproducedDiagnosticPrefix =
      reproducedResult.diagnosticPrefix === null
        ? null
        : Buffer.from(reproducedResult.diagnosticPrefix.documentJson);
    if (
      (input.documentBytes === null) !== (reproducedDocument === null) ||
      (input.documentBytes !== null && !input.documentBytes.equals(reproducedDocument!))
    ) {
      throw new TypeError(
        "Retained document.json does not equal the exact document independently finalized from browser output.",
      );
    }
    if (
      (input.diagnosticPrefixBytes === null) !== (reproducedDiagnosticPrefix === null) ||
      (input.diagnosticPrefixBytes !== null &&
        !input.diagnosticPrefixBytes.equals(reproducedDiagnosticPrefix!))
    ) {
      throw new TypeError(
        "Retained diagnostic-prefix.json does not equal the exact diagnostic document independently finalized from browser output.",
      );
    }
    for (const [index, step] of reproducedScore.steps.entries()) {
      // A row the browser never produced, or produced unreadably, is retained
      // as a typed unreadable row with no captures at all, so there is no PNG
      // to bind and no browser row to bind it to.
      const browserStep = browserOutput.reports[index];
      if (browserStep === undefined) {
        if (step.panelPng !== null || step.buildPng !== null || step.fartherCaptures.length !== 0) {
          throw new TypeError(
            `Retained score step ${index} claims a PNG capture the browser output has no row for.`,
          );
        }
        continue;
      }
      for (const [capture, retainedValue] of [
        [step.panelPng, browserStep.panelPng],
        [step.buildPng, browserStep.buildPng],
      ] as const) {
        if (capture !== null) {
          const entry = input.artifactEntries.get(capture);
          const expectedBytes = decodeRealBuildPngCapture(retainedValue!);
          if (
            entry === undefined ||
            entry.bytes !== expectedBytes.length ||
            entry.digest !== input.sha256Digest(expectedBytes)
          ) {
            throw new TypeError(
              `Retained step capture ${capture} does not equal its exact browser-output PNG bytes.`,
            );
          }
        }
      }
      if (step.fartherCaptures.length !== browserStep.fartherCaptures.length) {
        throw new TypeError(
          `Retained score step ${step.stepNumber} projects ${step.fartherCaptures.length} farther captures, ` +
            `but the exact browser row contains ${browserStep.fartherCaptures.length}.`,
        );
      }
      for (let captureIndex = 0; captureIndex < step.fartherCaptures.length; captureIndex += 1) {
        const projected = step.fartherCaptures[captureIndex]!;
        const browserCapture = browserStep.fartherCaptures[captureIndex]!;
        const expectedPath = realBuildFartherCapturePath(step.stepNumber, browserCapture);
        const expectedBytes = decodeRealBuildPngCapture(browserCapture.png);
        const entry = input.artifactEntries.get(projected.path);
        if (
          projected.captureId !== browserCapture.captureId ||
          projected.role !== browserCapture.role ||
          projected.panelStepNumber !== browserCapture.panelStepNumber ||
          projected.candidateId !== browserCapture.candidateId ||
          projected.path !== expectedPath ||
          entry === undefined ||
          entry.bytes !== expectedBytes.length ||
          entry.digest !== input.sha256Digest(expectedBytes)
        ) {
          throw new TypeError(
            `Retained farther capture ${projected.path} does not equal its exact browser-output metadata and PNG bytes.`,
          );
        }
      }
    }
  }
  let completedSteps = 0;
  let leadingCompleteSteps = 0;
  let piecesPlaced = 0;
  const derivedFailures: unknown[] = [];
  for (let index = 0; index < score.steps.length; index += 1) {
    const step = score.steps[index];
    if (
      !isRecord(step) ||
      step.stepNumber !== index + 1 ||
      !Number.isSafeInteger(step.placedPieces) ||
      (step.placedPieces as number) < 0 ||
      !Number.isSafeInteger(step.expectedAssembledPieces) ||
      (step.expectedAssembledPieces as number) < 0 ||
      !isRecord(step.outcome) ||
      (step.canonicalStepId !== null && typeof step.canonicalStepId !== "string") ||
      !isNullableDigest(step.actionEvidenceDigest)
    ) {
      throw new TypeError(`Retained score step ${index} has an invalid completion shape.`);
    }
    const complete = isAtomicStepComplete({
      outcome: step.outcome as never,
      placedPieces: step.placedPieces as number,
      expectedAssembledPieces: step.expectedAssembledPieces as number,
      canonicalStepId: step.canonicalStepId as string | null,
      actionEvidenceDigest: step.actionEvidenceDigest,
    });
    if (complete) {
      completedSteps += 1;
      if (leadingCompleteSteps === index) leadingCompleteSteps += 1;
    }
    piecesPlaced += step.placedPieces as number;
    if (step.outcome.status === "failed") {
      derivedFailures.push({ stepNumber: step.stepNumber, failure: step.outcome.failure });
    }
  }
  const successfulPrefix =
    score.steps.length === input.preparedOptions.lastStep && completedSteps === score.steps.length;
  const totalsMismatch =
    score.stepsAttempted !== score.steps.length
      ? `stepsAttempted ${score.stepsAttempted} against ${score.steps.length} retained step row(s)`
      : score.stepsComplete !== completedSteps
        ? `stepsComplete ${score.stepsComplete} against ${completedSteps} row(s) that satisfy atomic completion`
        : score.piecesPlaced !== piecesPlaced
          ? `piecesPlaced ${score.piecesPlaced} against ${piecesPlaced} summed over the rows`
          : JSON.stringify(score.failures) !== JSON.stringify(derivedFailures)
            ? `${score.failures.length} retained failure(s) against ${derivedFailures.length} derived from rows whose outcome is failed`
            : null;
  if (totalsMismatch !== null) {
    throw new TypeError(`Retained score totals do not reproduce its step rows: ${totalsMismatch}.`);
  }
  if (score.status === "completed" || score.status === "prefix-complete") {
    if (!successfulPrefix) {
      throw new TypeError(
        `Retained score claims ${score.status} but only ${completedSteps} of ${score.steps.length} row(s) ` +
          `completed against a requested prefix of ${input.preparedOptions.lastStep}.`,
      );
    }
    const claimTooShort =
      score.status === "completed" && input.preparedOptions.lastStep < input.maximumPrintedSteps;
    const claimTooLong =
      score.status === "prefix-complete" &&
      input.preparedOptions.lastStep >= input.maximumPrintedSteps;
    if (claimTooShort || claimTooLong) {
      throw new TypeError(
        `Retained score claims ${score.status} at requested last step ${input.preparedOptions.lastStep}; ` +
          `completed is reserved for the full ${input.maximumPrintedSteps} printed steps and prefix-complete for anything shorter.`,
      );
    }
  }
  if (score.status === "input-rejected") {
    // A rejected run retains one typed refusal row per requested printed step
    // - that is what `inputRejectedRealBuildResult` exists to do, and what says
    // which step each cause lands on. Demanding zero rows made this branch
    // unsatisfiable, so every rejected run threw here whatever its cause.
    //
    // What the status forbids is a claim. Not only "no completion, no placement,
    // no document": a rejected run refused *before* execution, so no row may
    // claim it attempted a piece, reached a canonical build step, or validated
    // anything. Without that, one token input failure plus N rows of ordinary
    // execution failures verifies as an input rejection, and this artifact is
    // what the position-of-record document is written from.
    const executedRow = score.steps.findIndex(
      (step) =>
        isRecord(step) &&
        ((Number.isSafeInteger(step.attemptedPieces) && (step.attemptedPieces as number) > 0) ||
          step.canonicalStepId !== null ||
          (isRecord(step.validation) && step.validation.attempted === true)),
    );
    const rejectionMismatch =
      score.inputFailures.length === 0
        ? "no input failure was retained to justify the rejection"
        : score.structuralHash !== null
          ? `a structural hash ${String(score.structuralHash)} was claimed`
          : completedSteps !== 0
            ? `${completedSteps} row(s) claim atomic completion`
            : piecesPlaced !== 0
              ? `${piecesPlaced} piece(s) claim placement`
              : derivedFailures.length !== score.steps.length
                ? `${score.steps.length - derivedFailures.length} of ${score.steps.length} retained row(s) are not failures`
                : executedRow >= 0
                  ? `row ${executedRow + 1} claims it attempted pieces, reached a canonical step, or validated a document, ` +
                    `which a run refused before execution cannot have done`
                  : score.steps.length !== 0 &&
                      score.steps.length !== input.preparedOptions.lastStep
                    ? `${score.steps.length} refusal row(s) against a requested prefix of ${input.preparedOptions.lastStep}; ` +
                      `a rejected run retains one row per requested step, or none at all when it was refused before the panels were selected`
                    : null;
    if (rejectionMismatch !== null) {
      throw new TypeError(
        `Retained input-rejected score claims more than a refusal: ${rejectionMismatch}.`,
      );
    }
  }
  if (score.status === "incomplete" && successfulPrefix && score.completionFailures.length === 0) {
    throw new TypeError(
      `Retained score claims incomplete, yet all ${score.steps.length} requested row(s) completed and no completion failure was retained.`,
    );
  }
  const metadataOnly = input.replayLevel === "metadata-only";
  if (
    metadataOnly !== (score.status === "input-rejected") ||
    metadataOnly !== (input.earliestBoundary === "input-rejection")
  ) {
    throw new TypeError(
      "Metadata-only/input-rejection replay closure and retained input-rejected status must occur together.",
    );
  }
  if ((score.structuralHash === null) !== (input.documentBytes === null)) {
    throw new TypeError(
      "Retained document.json presence must exactly match the score structural-hash claim.",
    );
  }
  if ((score.diagnosticPrefix === null) !== (input.diagnosticPrefixBytes === null)) {
    throw new TypeError(
      "Retained diagnostic-prefix.json presence must exactly match the score diagnostic-prefix claim.",
    );
  }
  if (score.diagnosticPrefix !== null) {
    const summary = score.diagnosticPrefix as RealBuildDiagnosticPrefixSummary;
    const frameFailure = score.completionFailures.some(
      (failure) => isRecord(failure) && failure.code === "official-frame-calibration-missing",
    );
    if (
      score.status !== "incomplete" ||
      score.structuralHash !== null ||
      input.documentBytes !== null ||
      score.finalParts !== 0 ||
      summary.throughStepNumber !== leadingCompleteSteps ||
      summary.throughStepNumber > input.preparedOptions.lastStep ||
      summary.parts > input.preparedOptions.maxParts ||
      !frameFailure
    ) {
      throw new TypeError(
        `A diagnostic prefix requires incomplete status, an empty canonical tuple, an official-frame refusal, and ` +
          `exact longest atomic prefix ${leadingCompleteSteps} within the prepared part/step bounds.`,
      );
    }
    assertRealBuildDiagnosticPrefixDocument(
      input.diagnosticPrefixBytes!,
      score.diagnosticPrefix as never,
    );
  }
  if (score.structuralHash === null && score.finalParts !== 0) {
    throw new TypeError(
      "A score without trusted canonical document bytes and structural hash must retain finalParts=0.",
    );
  }
  if (input.documentBytes !== null) {
    const document = parseFatalUtf8Json<unknown>(input.documentBytes, "retained document artifact");
    if (
      !validateBrickDocumentV1(document) ||
      documentStructuralHash(document as BrickDocumentV1) !== score.structuralHash ||
      (document as BrickDocumentV1).parts.length !== score.finalParts
    ) {
      throw new TypeError(
        "Retained document.json must be a valid BrickDocument with the score's exact structural hash and final part count.",
      );
    }
  }
  const scoreValidationSnapshots = [
    ...new Map(
      score.steps.flatMap((step) => {
        if (!isRecord(step) || !isRecord(step.validation)) {
          throw new TypeError("Retained score steps must contain validation records.");
        }
        if (step.validation.attempted !== true) return [];
        const snapshot = {
          truthSnapshotHash: step.validation.truthSnapshotHash,
          validatorSetHash: step.validation.validatorSetHash,
          targetDocumentHash: step.validation.targetDocumentHash,
        };
        if (
          !isNullableDigest(snapshot.truthSnapshotHash) ||
          !isNullableDigest(snapshot.validatorSetHash) ||
          !isNullableDigest(snapshot.targetDocumentHash)
        ) {
          throw new TypeError(
            "Retained score attempted validations must contain nullable canonical digest triples.",
          );
        }
        return [[JSON.stringify(Object.values(snapshot)), snapshot] as const];
      }),
    ).values(),
  ];
  if (
    JSON.stringify(scoreValidationSnapshots) !== JSON.stringify(input.declaredValidationSnapshots)
  ) {
    throw new TypeError(
      "Artifact truthSnapshots differ from the retained score validation evidence.",
    );
  }
}
