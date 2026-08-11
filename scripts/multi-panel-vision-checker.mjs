import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { writeContainedFile } from "./part-identification-io.mjs";
import {
  MULTI_PANEL_ATTEMPT_SCHEMA,
  MultiPanelVisionError,
  canonicalJsonBytes,
  consumeMultiPanelAttempt,
  sealMultiPanelAttempt,
  sha256,
  verifiedBytes,
  verifyMultiPanelAttempt,
  verifyMultiPanelRequest,
} from "./multi-panel-vision-contract.mjs";
import {
  assertMultiPanelRunBudgets,
  prepareMultiPanelVisionRun,
  requestForRemainingAttempt,
  totalMultiPanelUsage,
} from "./multi-panel-vision-run-plan.mjs";

export const MULTI_PANEL_RESULT_SCHEMA = "lego.multi-panel-vision-result/1";

export class MultiPanelVisionRunError extends MultiPanelVisionError {
  constructor(message, completedAttempts, failedRequest, cause) {
    super(message);
    this.name = "MultiPanelVisionRunError";
    this.completedAttempts = Object.freeze([...completedAttempts]);
    this.failedRequest = failedRequest;
    this.cause = cause;
  }
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const DIGEST = /^sha256:[0-9a-f]{64}$/u;

const assertId = (value, label) => {
  if (typeof value !== "string" || !ID.test(value)) {
    throw new MultiPanelVisionError(`${label} must be a stable 1..200 character identifier.`);
  }
  return value;
};

const assertExactKeys = (value, keys, label) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MultiPanelVisionError(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort().join(",");
  const expected = [...keys].sort().join(",");
  if (actual !== expected) {
    throw new MultiPanelVisionError(
      `${label} must contain exactly ${expected.replaceAll(",", ", ")}; received ${actual.replaceAll(",", ", ") || "no fields"}.`,
    );
  }
};

function panelForCall(request, panel, kind) {
  const blob = kind === "source" ? panel.sourcePng : panel.candidateRender.png;
  return Object.freeze({
    name: `${kind}-${panel.role.replace("+", "plus")}-step-${String(panel.stepNumber).padStart(3, "0")}.png`,
    kind,
    role: panel.role,
    stepNumber: panel.stepNumber,
    panelFace: panel.candidateRender.panelFace,
    digest: blob.digest,
    bytes: Buffer.from(verifiedBytes(blob, `${panel.role} ${kind} attachment`)),
  });
}

/**
 * The only model-facing boundary in this checker.
 *
 * It contains exact byte attachments and no path, cwd, tool grant, or repository
 * handle. A live adapter must attach these bytes through its provider API; this
 * module deliberately does not fall back to granting a CLI `Read` capability.
 */
export function modelCallForMultiPanelRequest(request) {
  verifyMultiPanelRequest(request);
  const attachments = request.panels.flatMap((panel) => [
    panelForCall(request, panel, "source"),
    panelForCall(request, panel, "candidate"),
  ]);
  return Object.freeze({
    attemptId: request.attemptId,
    requestDigest: request.requestDigest,
    modelIdentity: request.requestedModelIdentity,
    request,
    promptBytes: Buffer.from(verifiedBytes(request.prompt, "model prompt")),
    briefBytes: Buffer.from(verifiedBytes(request.brief, "model brief")),
    instructionBytes: Buffer.from(verifiedBytes(request.instruction, "model instruction")),
    attachments: Object.freeze(attachments),
  });
}

function resultBody(input, attempts, outcome, firstFartherRevealingStep) {
  const first = attempts[0];
  const final = attempts.at(-1);
  const usage = assertMultiPanelRunBudgets(attempts, first.request.budgets);
  return Object.freeze({
    schemaVersion: MULTI_PANEL_RESULT_SCHEMA,
    runId: assertId(input.runId, "runId"),
    authority: "local-diagnostic",
    authenticated: false,
    scope: first.request.scope,
    claim: first.request.claim,
    booklet: first.request.booklet,
    retainedThroughStep: input.retainedThroughStep,
    outcome,
    reason: final.answer.reason,
    firstFartherRevealingStep,
    disposition:
      outcome === "corroborated"
        ? "deterministic-validators-still-required"
        : outcome === "vetoed"
          ? "refuse-entire-candidate-node"
          : "refuse-not-observable",
    mayCertify: false,
    mayMutateDocument: false,
    mayBypassValidators: false,
    usage,
    attempts: Object.freeze([...attempts]),
  });
}

function sealResult(input, attempts, outcome, firstFartherRevealingStep) {
  const body = resultBody(input, attempts, outcome, firstFartherRevealingStep);
  return Object.freeze({ ...body, resultDigest: sha256(canonicalJsonBytes(body)) });
}

/**
 * Runs the refusal-only sequence.
 *
 * The first call sees N and N+1. A farther K is attached only after that call
 * returns unjudgeable; calls stop at the first decisive K. If every retained
 * later panel remains unjudgeable, the result is `not-observable`, never same.
 */
export async function runMultiPanelVisionCheck(input, invokeModel) {
  if (typeof invokeModel !== "function") {
    throw new MultiPanelVisionError(
      "invokeModel must attach the supplied exact bytes and return a captured response envelope.",
    );
  }
  const { preparedInput, preparedRequests, runBudgets } = prepareMultiPanelVisionRun(input);
  const attempts = [];

  const runAttempt = async (index, panelK = null) => {
    let request = null;
    try {
      const prepared = preparedRequests[index];
      request =
        index === 0
          ? prepared
          : requestForRemainingAttempt(preparedInput, panelK, prepared, runBudgets, attempts);
      const response = await invokeModel(modelCallForMultiPanelRequest(request));
      const attempt = sealMultiPanelAttempt(request, response);
      attempts.push(attempt);
      assertMultiPanelRunBudgets(attempts, runBudgets);
      return consumeMultiPanelAttempt(attempt);
    } catch (cause) {
      if (cause instanceof MultiPanelVisionRunError) throw cause;
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw new MultiPanelVisionRunError(
        `Multi-panel attempt ${index + 1} failed after ${attempts.length} completed attempt(s): ${detail}`,
        attempts,
        request,
        cause,
      );
    }
  };

  let consumed = await runAttempt(0);
  if (consumed.status === "corroborated") return sealResult(input, attempts, "corroborated", null);
  if (consumed.status === "vetoed") return sealResult(input, attempts, "vetoed", null);

  for (const [index, panelK] of preparedInput.laterPanels.entries()) {
    consumed = await runAttempt(index + 1, panelK);
    if (consumed.status === "corroborated") {
      return sealResult(input, attempts, "corroborated", panelK.stepNumber);
    }
    if (consumed.status === "vetoed") {
      return sealResult(input, attempts, "vetoed", panelK.stepNumber);
    }
  }
  return sealResult(input, attempts, "not-observable", null);
}

export function verifyMultiPanelVisionResult(result) {
  assertExactKeys(
    result,
    [
      "schemaVersion",
      "runId",
      "authority",
      "authenticated",
      "scope",
      "claim",
      "booklet",
      "retainedThroughStep",
      "outcome",
      "reason",
      "firstFartherRevealingStep",
      "disposition",
      "mayCertify",
      "mayMutateDocument",
      "mayBypassValidators",
      "usage",
      "attempts",
      "resultDigest",
    ],
    "Multi-panel result",
  );
  if (result.schemaVersion !== MULTI_PANEL_RESULT_SCHEMA || !DIGEST.test(result.resultDigest)) {
    throw new MultiPanelVisionError("Result schema or digest is invalid.");
  }
  const { resultDigest, ...body } = result;
  if (sha256(canonicalJsonBytes(body)) !== resultDigest) {
    throw new MultiPanelVisionError(
      "Result failed its content digest; refuse tampered attempt lineage.",
    );
  }
  if (
    result.authority !== "local-diagnostic" ||
    result.authenticated !== false ||
    result.mayCertify !== false ||
    result.mayMutateDocument !== false ||
    result.mayBypassValidators !== false
  ) {
    throw new MultiPanelVisionError(
      "A local vision result cannot acquire certification, mutation, validator, or authenticated authority.",
    );
  }
  assertId(result.runId, "result.runId");
  if (!Array.isArray(result.attempts) || result.attempts.length < 1) {
    throw new MultiPanelVisionError("A result must retain at least its N/N+1 attempt.");
  }
  result.attempts.forEach(verifyMultiPanelAttempt);
  const first = result.attempts[0];
  if (first.schemaVersion !== MULTI_PANEL_ATTEMPT_SCHEMA || first.request.panels.length !== 2) {
    throw new MultiPanelVisionError("The first attempt must bind exactly N and N+1.");
  }
  const stableScope = canonicalJsonBytes(first.request.scope);
  const stableClaim = canonicalJsonBytes(first.request.claim);
  const stableBooklet = canonicalJsonBytes(first.request.booklet);
  const stableInitialPanels = canonicalJsonBytes(first.request.panels);
  const stableInitialFold = canonicalJsonBytes(first.request.faceAuthority.fold);
  const stepNumber = first.request.claim.stepNumber;
  if (
    !Number.isSafeInteger(result.retainedThroughStep) ||
    result.retainedThroughStep < stepNumber + 1
  ) {
    throw new MultiPanelVisionError(
      `retainedThroughStep must be a safe whole step at least N+1 (${stepNumber + 1}).`,
    );
  }
  if (
    stableScope.compare(canonicalJsonBytes(result.scope)) !== 0 ||
    stableClaim.compare(canonicalJsonBytes(result.claim)) !== 0 ||
    stableBooklet.compare(canonicalJsonBytes(result.booklet)) !== 0
  ) {
    throw new MultiPanelVisionError(
      "Result scope, claim, or booklet does not reproduce its first attempt.",
    );
  }
  const attemptIds = new Set();
  for (let index = 1; index < result.attempts.length; index += 1) {
    const previous = result.attempts[index - 1];
    const current = result.attempts[index];
    if (previous.answer.verdict !== "unjudgeable" || current.request.panels.length !== 3) {
      throw new MultiPanelVisionError(
        "A farther K is legal only after the preceding attempt was unjudgeable.",
      );
    }
    const expectedK = stepNumber + 1 + index;
    if (current.request.panels[2].stepNumber !== expectedK) {
      throw new MultiPanelVisionError(`Farther attempt ${index} skipped step ${expectedK}.`);
    }
    if (expectedK > result.retainedThroughStep) {
      throw new MultiPanelVisionError(
        `Farther attempt ${index} uses step ${expectedK} beyond retainedThroughStep ${result.retainedThroughStep}.`,
      );
    }
    if (stableInitialPanels.compare(canonicalJsonBytes(current.request.panels.slice(0, 2))) !== 0) {
      throw new MultiPanelVisionError(
        "A farther attempt changed the exact N/N+1 source or render packet.",
      );
    }
    if (
      stableInitialFold.compare(
        canonicalJsonBytes(
          current.request.faceAuthority.fold.slice(0, first.request.faceAuthority.fold.length),
        ),
      ) !== 0
    ) {
      throw new MultiPanelVisionError(
        "A farther attempt changed the deterministic face history already bound by N/N+1.",
      );
    }
  }
  if (result.attempts.length - 1 > first.request.budgets.maxFartherPanels) {
    throw new MultiPanelVisionError(
      "Result retains more farther-panel attempts than its bound maxFartherPanels.",
    );
  }
  for (const attempt of result.attempts) {
    if (
      stableScope.compare(canonicalJsonBytes(attempt.request.scope)) !== 0 ||
      stableClaim.compare(canonicalJsonBytes(attempt.request.claim)) !== 0 ||
      stableBooklet.compare(canonicalJsonBytes(attempt.request.booklet)) !== 0
    ) {
      throw new MultiPanelVisionError(
        "Attempt lineage changed scope, atomic claim, or source PDF.",
      );
    }
    if (attemptIds.has(attempt.request.attemptId)) {
      throw new MultiPanelVisionError(
        `Attempt id ${attempt.request.attemptId} repeats in immutable lineage.`,
      );
    }
    attemptIds.add(attempt.request.attemptId);
  }
  const final = result.attempts.at(-1).answer;
  const expectedOutcome =
    final.verdict === "same"
      ? "corroborated"
      : final.verdict === "different"
        ? "vetoed"
        : "not-observable";
  if (result.outcome !== expectedOutcome) {
    throw new MultiPanelVisionError(
      `Result outcome ${result.outcome} does not consume final verdict ${final.verdict}.`,
    );
  }
  const expectedDisposition =
    expectedOutcome === "corroborated"
      ? "deterministic-validators-still-required"
      : expectedOutcome === "vetoed"
        ? "refuse-entire-candidate-node"
        : "refuse-not-observable";
  if (result.reason !== final.reason || result.disposition !== expectedDisposition) {
    throw new MultiPanelVisionError(
      "Result reason or disposition does not consume its final answer.",
    );
  }
  if (
    result.outcome === "not-observable" &&
    result.attempts.length !== result.retainedThroughStep - stepNumber
  ) {
    throw new MultiPanelVisionError(
      "A not-observable result did not inspect every retained panel after N.",
    );
  }
  const expectedFarther =
    result.attempts.length > 1 && final.verdict !== "unjudgeable"
      ? result.attempts.at(-1).request.panels[2].stepNumber
      : null;
  if (result.firstFartherRevealingStep !== expectedFarther) {
    throw new MultiPanelVisionError(
      "firstFartherRevealingStep does not name the decisive K attempt.",
    );
  }
  const usage = totalMultiPanelUsage(result.attempts);
  if (canonicalJsonBytes(usage).compare(canonicalJsonBytes(result.usage)) !== 0) {
    throw new MultiPanelVisionError("Result usage does not reproduce its retained attempts.");
  }
  assertMultiPanelRunBudgets(result.attempts, first.request.budgets);
  return result;
}

export function writeMultiPanelVisionResult(outputRoot, result) {
  verifyMultiPanelVisionResult(result);
  const runId = assertId(result.runId, "runId");
  const fileId = sha256(Buffer.from(runId, "utf8")).slice("sha256:".length);
  const relativePath = `multi-panel-${fileId}.json`;
  const path = resolve(outputRoot, relativePath);
  if (existsSync(path)) {
    throw new MultiPanelVisionError(
      `Immutable result ${JSON.stringify(path)} already exists; use a new runId instead of replacing evidence.`,
    );
  }
  writeContainedFile(outputRoot, relativePath, `${JSON.stringify(result, null, 2)}\n`, {
    label: "Immutable multi-panel vision result",
  });
  return path;
}
