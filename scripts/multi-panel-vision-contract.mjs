import { randomUUID } from "node:crypto";
import { TextDecoder } from "node:util";

import {
  PART_IDENTIFICATION_MODEL_IDENTITY,
  isPinnedModelIdentity,
} from "./part-identification-model.mjs";
import { parseStrictJsonBytes } from "./part-identification-strict-json.mjs";
import {
  MultiPanelVisionError,
  DEFAULT_MULTI_PANEL_BUDGETS,
  MAX_MULTI_PANEL_REQUEST_BYTES,
  assertDigest,
  assertExactKeys,
  assertId,
  assertWhole,
  boundBytes,
  canonicalJsonBytes,
  sha256,
  verifiedBytes,
} from "./multi-panel-vision-primitives.mjs";
import {
  MULTI_PANEL_PROMPT,
  MULTI_PANEL_REASONS,
  MULTI_PANEL_VERDICTS,
} from "./multi-panel-vision-prompt.mjs";
import {
  faceFold,
  makeBrief,
  normalizeBudgets,
  normalizePanel,
  normalizePieces,
} from "./multi-panel-vision-request-fields.mjs";

export {
  MultiPanelVisionError,
  DEFAULT_MULTI_PANEL_BUDGETS,
  MAX_MULTI_PANEL_REQUEST_BYTES,
  boundBytes,
  canonicalJsonBytes,
  sha256,
  verifiedBytes,
  MULTI_PANEL_PROMPT,
  MULTI_PANEL_REASONS,
  MULTI_PANEL_VERDICTS,
};

export const MULTI_PANEL_REQUEST_SCHEMA = "lego.multi-panel-vision-request/1";
export const MULTI_PANEL_ATTEMPT_SCHEMA = "lego.multi-panel-vision-attempt/1";

const VERDICTS = new Set(MULTI_PANEL_VERDICTS);
const REASONS = new Set(MULTI_PANEL_REASONS);
const fatalUtf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

export function createMultiPanelRequest(input) {
  const budgets = normalizeBudgets(input.budgets);
  const stepNumber = assertWhole(input.claim?.stepNumber, "claim.stepNumber", 1);
  const panels = [input.panelN, input.panelNPlusOne, ...(input.panelK ? [input.panelK] : [])];
  if (panels.some((panel) => typeof panel !== "object" || panel === null)) {
    throw new MultiPanelVisionError("Every attempt requires exact panel N and N+1 inputs.");
  }
  if (input.panelN.stepNumber !== stepNumber || input.panelNPlusOne.stepNumber !== stepNumber + 1) {
    throw new MultiPanelVisionError(
      `Panel steps must be N=${stepNumber} and N+1=${stepNumber + 1}; received ${input.panelN.stepNumber} and ${input.panelNPlusOne.stepNumber}.`,
    );
  }
  if (input.panelK && input.panelK.stepNumber <= stepNumber + 1) {
    throw new MultiPanelVisionError("A farther witness K must be later than N+1.");
  }
  const maxStep = Math.max(...panels.map(({ stepNumber: panelStep }) => panelStep));
  const fold = faceFold(input.rotationIcons, maxStep, input.faceSeed ?? "studs-up");
  const faceByStep = new Map(
    fold.map(({ stepNumber: foldedStep, resultingPanelFace }) => [foldedStep, resultingPanelFace]),
  );
  const scope = Object.freeze({
    baseDocumentId: assertId(input.scope?.baseDocumentId, "scope.baseDocumentId"),
    catalogId: assertId(input.scope?.catalogId, "scope.catalogId"),
    truthId: assertId(input.scope?.truthId, "scope.truthId"),
    actionLedgerId: assertId(input.scope?.actionLedgerId, "scope.actionLedgerId"),
    candidateNodeId: assertId(input.scope?.candidateNodeId, "scope.candidateNodeId"),
    transformSetId: assertId(input.scope?.transformSetId, "scope.transformSetId"),
  });
  const claim = Object.freeze({
    stepNumber,
    atomicGroupId: assertId(input.claim?.atomicGroupId, "claim.atomicGroupId"),
    pieces: normalizePieces(input.claim?.pieces),
  });
  const normalizedPanels = panels.map((panel, index) =>
    normalizePanel(panel, index === 0 ? "N" : index === 1 ? "N+1" : "K", faceByStep, budgets),
  );
  for (const panel of normalizedPanels) {
    if (panel.candidateRender.prefixThroughStep !== panel.stepNumber) {
      throw new MultiPanelVisionError(
        `${panel.role} candidate render must contain the exact prefix through printed step ${panel.stepNumber}; received ${panel.candidateRender.prefixThroughStep}.`,
      );
    }
  }
  const prompt = boundBytes(
    Buffer.from(MULTI_PANEL_PROMPT, "utf8"),
    "text/plain; charset=utf-8",
    "vision prompt",
  );
  const brief = boundBytes(
    Buffer.from(makeBrief(claim, normalizedPanels), "utf8"),
    "text/plain; charset=utf-8",
    "vision brief",
  );
  const instruction = boundBytes(
    Buffer.concat([
      Buffer.from(MULTI_PANEL_PROMPT, "utf8"),
      Buffer.from("\n\n", "utf8"),
      Buffer.from(makeBrief(claim, normalizedPanels), "utf8"),
    ]),
    "text/plain; charset=utf-8",
    "complete model instruction",
  );
  if (prompt.byteLength > budgets.maxPromptBytes || brief.byteLength > budgets.maxBriefBytes) {
    throw new MultiPanelVisionError(
      `Prompt/brief use ${prompt.byteLength}/${brief.byteLength} bytes above their ${budgets.maxPromptBytes}/${budgets.maxBriefBytes} byte budgets.`,
    );
  }
  const requestBody = Object.freeze({
    schemaVersion: MULTI_PANEL_REQUEST_SCHEMA,
    attemptId: assertId(input.attemptId ?? randomUUID(), "attemptId"),
    requestedModelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
    scope,
    booklet: Object.freeze({
      pdfDigest: assertDigest(input.booklet?.pdfDigest, "booklet.pdfDigest"),
      pdfByteLength: assertWhole(input.booklet?.pdfByteLength, "booklet.pdfByteLength", 1),
    }),
    claim,
    faceAuthority: Object.freeze({ seedStep: 1, seedFace: input.faceSeed ?? "studs-up", fold }),
    panels: Object.freeze(normalizedPanels),
    prompt,
    brief,
    instruction,
    budgets,
  });
  const imageBytes = normalizedPanels.reduce(
    (total, panel) => total + panel.sourcePng.byteLength + panel.candidateRender.png.byteLength,
    0,
  );
  const imagePixels = normalizedPanels.reduce(
    (total, panel) =>
      total +
      panel.sourcePng.width * panel.sourcePng.height +
      panel.candidateRender.png.width * panel.candidateRender.png.height,
    0,
  );
  if (imageBytes > budgets.maxImageBytes) {
    throw new MultiPanelVisionError(
      `Attempt images use ${imageBytes} bytes, above maxImageBytes ${budgets.maxImageBytes}.`,
    );
  }
  if (imagePixels > budgets.maxImagePixels) {
    throw new MultiPanelVisionError(
      `Attempt images use ${imagePixels} pixels, above maxImagePixels ${budgets.maxImagePixels}.`,
    );
  }
  const request = Object.freeze({
    ...requestBody,
    requestDigest: sha256(canonicalJsonBytes(requestBody)),
  });
  const requestBytes = canonicalJsonBytes(request).byteLength;
  if (requestBytes > MAX_MULTI_PANEL_REQUEST_BYTES) {
    throw new MultiPanelVisionError(
      `Bound MCP request uses ${requestBytes} bytes, above its ${MAX_MULTI_PANEL_REQUEST_BYTES}-byte transport limit. Reduce the exact image bundle before calling a model.`,
    );
  }
  return request;
}

export function verifyMultiPanelRequest(request) {
  assertExactKeys(
    request,
    [
      "schemaVersion",
      "attemptId",
      "requestedModelIdentity",
      "scope",
      "booklet",
      "claim",
      "faceAuthority",
      "panels",
      "prompt",
      "brief",
      "instruction",
      "budgets",
      "requestDigest",
    ],
    "Multi-panel request",
  );
  if (request.schemaVersion !== MULTI_PANEL_REQUEST_SCHEMA) {
    throw new MultiPanelVisionError(
      `Unsupported request schema ${JSON.stringify(request.schemaVersion)}.`,
    );
  }
  assertDigest(request.requestDigest, "requestDigest");
  const { requestDigest, ...body } = request;
  if (sha256(canonicalJsonBytes(body)) !== requestDigest) {
    throw new MultiPanelVisionError(
      `Request ${request.attemptId ?? "unknown"} failed its content digest; refuse tampered evidence.`,
    );
  }
  if (
    !Array.isArray(request.panels) ||
    (request.panels.length !== 2 && request.panels.length !== 3)
  ) {
    throw new MultiPanelVisionError("A request must bind N and N+1, with at most one farther K.");
  }
  const recreated = createMultiPanelRequest({
    attemptId: request.attemptId,
    scope: request.scope,
    booklet: request.booklet,
    claim: request.claim,
    faceSeed: request.faceAuthority?.seedFace,
    rotationIcons: request.faceAuthority?.fold?.map(({ stepNumber, rotationIconPresent }) => ({
      stepNumber,
      rotationIconPresent,
    })),
    panelN: panelInputFromBoundRequest(request.panels[0], "N"),
    panelNPlusOne: panelInputFromBoundRequest(request.panels[1], "N+1"),
    ...(request.panels.length === 3
      ? { panelK: panelInputFromBoundRequest(request.panels[2], "K") }
      : {}),
    budgets: request.budgets,
  });
  if (canonicalJsonBytes(recreated).compare(canonicalJsonBytes(request)) !== 0) {
    throw new MultiPanelVisionError(
      "Request does not exactly reproduce the canonical source-bound request; refuse altered prompt, brief, scope, panel metadata, face authority, model identity, or budget fields even when an outer digest was recomputed.",
    );
  }
  if (canonicalJsonBytes(request).byteLength > MAX_MULTI_PANEL_REQUEST_BYTES) {
    throw new MultiPanelVisionError(
      `Bound MCP request exceeds its ${MAX_MULTI_PANEL_REQUEST_BYTES}-byte transport limit.`,
    );
  }
  return request;
}

function panelInputFromBoundRequest(panel, role) {
  if (typeof panel !== "object" || panel === null) {
    throw new MultiPanelVisionError(`${role} panel is missing from the bound request.`);
  }
  return {
    stepNumber: panel.stepNumber,
    pdfPage: panel.pdfPage,
    cropBounds: panel.cropBounds,
    sourcePngBytes: verifiedBytes(panel.sourcePng, `${role} source PNG`),
    candidateRenderPngBytes: verifiedBytes(
      panel.candidateRender?.png,
      `${role} candidate render PNG`,
    ),
    prefixThroughStep: panel.candidateRender?.prefixThroughStep,
    viewId: panel.candidateRender?.viewId,
    cameraId: panel.candidateRender?.cameraId,
  };
}

export function parseMultiPanelAnswer(rawBytes) {
  let text;
  try {
    text = fatalUtf8.decode(Buffer.from(rawBytes));
  } catch (cause) {
    throw new MultiPanelVisionError(`Vision response is not exact UTF-8: ${cause.message}.`);
  }
  const lines = text.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length !== 1) {
    throw new MultiPanelVisionError(
      `Vision response must contain exactly one non-empty JSON line; received ${lines.length}. Duplicate lines are all refused.`,
    );
  }
  let answer;
  try {
    answer = parseStrictJsonBytes(Buffer.from(lines[0], "utf8"));
  } catch (cause) {
    throw new MultiPanelVisionError(`Vision response is not strict JSON: ${cause.message}.`);
  }
  assertExactKeys(answer, ["verdict", "reason"], "Vision answer");
  if (!VERDICTS.has(answer.verdict) || !REASONS.has(answer.reason)) {
    throw new MultiPanelVisionError(
      `Vision answer must use verdict ${MULTI_PANEL_VERDICTS.join("|")} and reason ${MULTI_PANEL_REASONS.join("|")}.`,
    );
  }
  if (answer.verdict !== "unjudgeable" && answer.reason === "occluded") {
    throw new MultiPanelVisionError("Only an unjudgeable answer may use reason occluded.");
  }
  return Object.freeze({ verdict: answer.verdict, reason: answer.reason });
}

function normalizeUsage(usage) {
  assertExactKeys(
    usage,
    ["inputTokens", "outputTokens", "costMicrousd", "elapsedMs"],
    "Model usage",
  );
  return Object.freeze({
    inputTokens: assertWhole(usage.inputTokens, "usage.inputTokens"),
    outputTokens: assertWhole(usage.outputTokens, "usage.outputTokens"),
    costMicrousd: assertWhole(usage.costMicrousd, "usage.costMicrousd"),
    elapsedMs: assertWhole(usage.elapsedMs, "usage.elapsedMs"),
  });
}

function assertUsageWithinBudgets(usage, budgets) {
  for (const [field, budget] of [
    ["inputTokens", "maxInputTokens"],
    ["outputTokens", "maxOutputTokens"],
    ["costMicrousd", "maxCostMicrousd"],
    ["elapsedMs", "maxWallTimeMs"],
  ]) {
    if (usage[field] > budgets[budget]) {
      throw new MultiPanelVisionError(
        `Model ${field} ${usage[field]} exceeded bound ${budget} ${budgets[budget]}.`,
      );
    }
  }
}

export function sealMultiPanelAttempt(request, response) {
  verifyMultiPanelRequest(request);
  if (
    !isPinnedModelIdentity(response.modelIdentity, request.requestedModelIdentity.requestedModelId)
  ) {
    throw new MultiPanelVisionError(
      "Model response did not prove the exact pinned model identity.",
    );
  }
  const rawResponse = boundBytes(
    response.rawResponseBytes,
    "text/plain; charset=utf-8",
    "raw model response",
  );
  if (rawResponse.byteLength > request.budgets.maxRawResponseBytes) {
    throw new MultiPanelVisionError(
      `Raw response uses ${rawResponse.byteLength} bytes above maxRawResponseBytes ${request.budgets.maxRawResponseBytes}.`,
    );
  }
  const answer = parseMultiPanelAnswer(verifiedBytes(rawResponse, "raw model response"));
  const transportTrace = boundBytes(
    response.transportTraceBytes,
    "text/plain; charset=utf-8",
    "raw model transport trace",
  );
  if (transportTrace.byteLength > request.budgets.maxTransportTraceBytes) {
    throw new MultiPanelVisionError(
      `Transport trace uses ${transportTrace.byteLength} bytes above maxTransportTraceBytes ${request.budgets.maxTransportTraceBytes}.`,
    );
  }
  const usage = normalizeUsage(response.usage);
  assertUsageWithinBudgets(usage, request.budgets);
  const body = Object.freeze({
    schemaVersion: MULTI_PANEL_ATTEMPT_SCHEMA,
    request,
    response: Object.freeze({
      modelIdentity: response.modelIdentity,
      rawResponse,
      transportTrace,
      usage,
    }),
    answer,
  });
  const attempt = Object.freeze({ ...body, attemptDigest: sha256(canonicalJsonBytes(body)) });
  if (canonicalJsonBytes(attempt).byteLength > request.budgets.maxRetainedBytes) {
    throw new MultiPanelVisionError(
      "One retained attempt exceeds maxRetainedBytes before a run can preserve it.",
    );
  }
  return attempt;
}

export function verifyMultiPanelAttempt(attempt) {
  assertExactKeys(
    attempt,
    ["schemaVersion", "request", "response", "answer", "attemptDigest"],
    "Multi-panel attempt",
  );
  if (attempt.schemaVersion !== MULTI_PANEL_ATTEMPT_SCHEMA) {
    throw new MultiPanelVisionError(
      `Unsupported attempt schema ${JSON.stringify(attempt.schemaVersion)}.`,
    );
  }
  assertDigest(attempt.attemptDigest, "attemptDigest");
  const { attemptDigest, ...body } = attempt;
  if (sha256(canonicalJsonBytes(body)) !== attemptDigest) {
    throw new MultiPanelVisionError(
      "Attempt failed its content digest; refuse tampered source, render, prompt, identity, or response evidence.",
    );
  }
  verifyMultiPanelRequest(attempt.request);
  assertExactKeys(
    attempt.response,
    ["modelIdentity", "rawResponse", "transportTrace", "usage"],
    "Attempt response",
  );
  if (
    !isPinnedModelIdentity(
      attempt.response.modelIdentity,
      attempt.request.requestedModelIdentity.requestedModelId,
    )
  ) {
    throw new MultiPanelVisionError(
      "Attempt response model identity no longer matches its pinned request.",
    );
  }
  const rawResponseBytes = verifiedBytes(attempt.response.rawResponse, "attempt raw response");
  if (rawResponseBytes.byteLength > attempt.request.budgets.maxRawResponseBytes) {
    throw new MultiPanelVisionError(
      `Attempt raw response exceeds maxRawResponseBytes ${attempt.request.budgets.maxRawResponseBytes}.`,
    );
  }
  const parsed = parseMultiPanelAnswer(rawResponseBytes);
  const traceBytes = verifiedBytes(attempt.response.transportTrace, "attempt transport trace");
  if (traceBytes.byteLength > attempt.request.budgets.maxTransportTraceBytes) {
    throw new MultiPanelVisionError(
      `Attempt transport trace exceeds maxTransportTraceBytes ${attempt.request.budgets.maxTransportTraceBytes}.`,
    );
  }
  if (canonicalJsonBytes(parsed).compare(canonicalJsonBytes(attempt.answer)) !== 0) {
    throw new MultiPanelVisionError(
      "Stored answer does not reproduce the exact raw response bytes.",
    );
  }
  const usage = normalizeUsage(attempt.response.usage);
  assertUsageWithinBudgets(usage, attempt.request.budgets);
  if (canonicalJsonBytes(attempt).byteLength > attempt.request.budgets.maxRetainedBytes) {
    throw new MultiPanelVisionError(
      `Retained attempt exceeds maxRetainedBytes ${attempt.request.budgets.maxRetainedBytes}.`,
    );
  }
  return attempt;
}

export function consumeMultiPanelAttempt(attempt) {
  verifyMultiPanelAttempt(attempt);
  const { verdict, reason } = attempt.answer;
  return Object.freeze({
    attemptId: attempt.request.attemptId,
    attemptDigest: attempt.attemptDigest,
    candidateNodeId: attempt.request.scope.candidateNodeId,
    atomicGroupId: attempt.request.claim.atomicGroupId,
    partInstanceIds: Object.freeze(
      attempt.request.claim.pieces.map(({ partInstanceId }) => partInstanceId),
    ),
    status:
      verdict === "same" ? "corroborated" : verdict === "different" ? "vetoed" : "unjudgeable",
    reason,
    mayCertify: false,
    mayMutateDocument: false,
    mayBypassValidators: false,
    requiredAction:
      verdict === "same"
        ? "run-deterministic-validators"
        : verdict === "different"
          ? "refuse-entire-candidate-node"
          : "seek-farther-or-refuse-not-observable",
  });
}
