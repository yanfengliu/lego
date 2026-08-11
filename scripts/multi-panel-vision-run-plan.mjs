import {
  MultiPanelVisionError,
  canonicalJsonBytes,
  createMultiPanelRequest,
} from "./multi-panel-vision-contract.mjs";
import {
  MAX_MULTI_PANEL_PRINTED_STEPS,
  normalizeBudgets,
} from "./multi-panel-vision-request-fields.mjs";

function validateFartherSequence(stepNumber, laterPanels, retainedThroughStep) {
  if (
    !Number.isSafeInteger(stepNumber) ||
    stepNumber < 1 ||
    stepNumber >= MAX_MULTI_PANEL_PRINTED_STEPS ||
    !Number.isSafeInteger(retainedThroughStep) ||
    retainedThroughStep < stepNumber + 1 ||
    retainedThroughStep > MAX_MULTI_PANEL_PRINTED_STEPS
  ) {
    throw new MultiPanelVisionError(
      `The run step and retainedThroughStep must be safe whole steps with N+1 inside 1..${MAX_MULTI_PANEL_PRINTED_STEPS}; received N=${JSON.stringify(stepNumber)} and retainedThroughStep=${JSON.stringify(retainedThroughStep)}.`,
    );
  }
  if (!Array.isArray(laterPanels)) throw new MultiPanelVisionError("laterPanels must be an array.");
  if (laterPanels.length > MAX_MULTI_PANEL_PRINTED_STEPS) {
    throw new MultiPanelVisionError(
      `laterPanels contains ${laterPanels.length} entries, above the ${MAX_MULTI_PANEL_PRINTED_STEPS}-step hard bound.`,
    );
  }
  const expectedCount = retainedThroughStep - (stepNumber + 1);
  if (laterPanels.length !== expectedCount) {
    throw new MultiPanelVisionError(
      `The retained sequence through step ${retainedThroughStep} requires ${expectedCount} farther panel(s) for steps ${stepNumber + 2}..${retainedThroughStep}; received ${laterPanels.length}. Missing panels cannot support not-observable.`,
    );
  }
  laterPanels.forEach((panel, index) => {
    const expectedStep = stepNumber + 2 + index;
    if (panel?.stepNumber !== expectedStep) {
      throw new MultiPanelVisionError(
        `Farther panel index ${index} must be printed step ${expectedStep}; received ${JSON.stringify(panel?.stepNumber)}. The scan may not skip an occluded witness.`,
      );
    }
  });
}

function rotationPrefix(rotationIcons, maxStep) {
  if (!Array.isArray(rotationIcons) || rotationIcons.length > MAX_MULTI_PANEL_PRINTED_STEPS) {
    throw new MultiPanelVisionError(
      `rotationIcons must be an array with at most ${MAX_MULTI_PANEL_PRINTED_STEPS} entries.`,
    );
  }
  return rotationIcons.filter(({ stepNumber }) => stepNumber <= maxStep);
}

export function totalMultiPanelUsage(attempts) {
  return attempts.reduce(
    (total, attempt) => ({
      modelCalls: total.modelCalls + 1,
      inputTokens: total.inputTokens + attempt.response.usage.inputTokens,
      outputTokens: total.outputTokens + attempt.response.usage.outputTokens,
      costMicrousd: total.costMicrousd + attempt.response.usage.costMicrousd,
      elapsedMs: total.elapsedMs + attempt.response.usage.elapsedMs,
      retainedBytes: total.retainedBytes + canonicalJsonBytes(attempt).byteLength,
      imageBytes:
        total.imageBytes +
        attempt.request.panels.reduce(
          (panelTotal, panel) =>
            panelTotal + panel.sourcePng.byteLength + panel.candidateRender.png.byteLength,
          0,
        ),
      imagePixels:
        total.imagePixels +
        attempt.request.panels.reduce(
          (panelTotal, panel) =>
            panelTotal +
            panel.sourcePng.width * panel.sourcePng.height +
            panel.candidateRender.png.width * panel.candidateRender.png.height,
          0,
        ),
    }),
    {
      modelCalls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costMicrousd: 0,
      elapsedMs: 0,
      retainedBytes: 0,
      imageBytes: 0,
      imagePixels: 0,
    },
  );
}

export function assertMultiPanelRunBudgets(attempts, budgets) {
  const usage = totalMultiPanelUsage(attempts);
  for (const [field, budget] of [
    ["modelCalls", "maxModelCalls"],
    ["inputTokens", "maxInputTokens"],
    ["outputTokens", "maxOutputTokens"],
    ["costMicrousd", "maxCostMicrousd"],
    ["elapsedMs", "maxWallTimeMs"],
    ["retainedBytes", "maxRetainedBytes"],
    ["imageBytes", "maxImageBytes"],
    ["imagePixels", "maxImagePixels"],
  ]) {
    if (usage[field] > budgets[budget]) {
      throw new MultiPanelVisionError(
        `Run ${field} ${usage[field]} exceeded ${budget} ${budgets[budget]}; preserve completed attempts and refuse instead of claiming not-observable.`,
      );
    }
  }
  return Object.freeze(usage);
}

function requestForAttempt(input, panelK, attemptId, budgets) {
  const maxStep = panelK?.stepNumber ?? input.claim.stepNumber + 1;
  return createMultiPanelRequest({
    ...input,
    attemptId,
    rotationIcons: rotationPrefix(input.rotationIcons, maxStep),
    panelK,
    budgets,
  });
}

function preflightRequests(input, budgets) {
  if (input.laterPanels.length > budgets.maxFartherPanels) {
    throw new MultiPanelVisionError(
      `The retained sequence needs ${input.laterPanels.length} farther panels, above maxFartherPanels ${budgets.maxFartherPanels}; refuse before transmitting any image.`,
    );
  }
  const panelKs = [null, ...input.laterPanels];
  if (panelKs.length > budgets.maxModelCalls) {
    throw new MultiPanelVisionError(
      `A complete ambiguity scan needs ${panelKs.length} model calls, above maxModelCalls ${budgets.maxModelCalls}; refuse before transmitting any image.`,
    );
  }
  if (input.nextAttemptId !== undefined && typeof input.nextAttemptId !== "function") {
    throw new MultiPanelVisionError("nextAttemptId must be a function when supplied.");
  }
  const seenAttemptIds = new Set();
  const requests = panelKs.map((panelK, index) => {
    const attemptId = input.nextAttemptId?.(index) ?? `${input.runId}:attempt:${index + 1}`;
    if (seenAttemptIds.has(attemptId)) {
      throw new MultiPanelVisionError(
        `Attempt id ${attemptId} was reused; every model boundary is immutable and unique.`,
      );
    }
    seenAttemptIds.add(attemptId);
    return requestForAttempt(input, panelK, attemptId, budgets);
  });
  const possibleImageBytes = requests.reduce(
    (total, request) =>
      total +
      request.panels.reduce(
        (panelTotal, panel) =>
          panelTotal + panel.sourcePng.byteLength + panel.candidateRender.png.byteLength,
        0,
      ),
    0,
  );
  const possibleImagePixels = requests.reduce(
    (total, request) =>
      total +
      request.panels.reduce(
        (panelTotal, panel) =>
          panelTotal +
          panel.sourcePng.width * panel.sourcePng.height +
          panel.candidateRender.png.width * panel.candidateRender.png.height,
        0,
      ),
    0,
  );
  if (possibleImageBytes > budgets.maxImageBytes) {
    throw new MultiPanelVisionError(
      `A complete ambiguity scan would transmit ${possibleImageBytes} image bytes, above maxImageBytes ${budgets.maxImageBytes}; refuse before transmitting a partial sequence.`,
    );
  }
  if (possibleImagePixels > budgets.maxImagePixels) {
    throw new MultiPanelVisionError(
      `A complete ambiguity scan would expose ${possibleImagePixels} decoded pixels, above maxImagePixels ${budgets.maxImagePixels}; refuse before transmitting a partial sequence.`,
    );
  }
  const retainedRequestFloor = requests.reduce(
    (total, request) => total + canonicalJsonBytes(request).byteLength,
    0,
  );
  if (retainedRequestFloor > budgets.maxRetainedBytes) {
    throw new MultiPanelVisionError(
      `The bound requests alone need ${retainedRequestFloor} retained bytes, above maxRetainedBytes ${budgets.maxRetainedBytes}; refuse before creating evidence that cannot be retained.`,
    );
  }
  return Object.freeze(requests);
}

function remainingAttemptBudgets(runBudgets, attempts) {
  const used = totalMultiPanelUsage(attempts);
  const remaining = {
    ...runBudgets,
    maxRetainedBytes: runBudgets.maxRetainedBytes - used.retainedBytes,
    maxInputTokens: runBudgets.maxInputTokens - used.inputTokens,
    maxOutputTokens: runBudgets.maxOutputTokens - used.outputTokens,
    maxCostMicrousd: runBudgets.maxCostMicrousd - used.costMicrousd,
    maxWallTimeMs: runBudgets.maxWallTimeMs - used.elapsedMs,
  };
  for (const key of [
    "maxRetainedBytes",
    "maxInputTokens",
    "maxOutputTokens",
    "maxCostMicrousd",
    "maxWallTimeMs",
  ]) {
    if (remaining[key] <= 0) {
      throw new MultiPanelVisionError(
        `No ${key} remains for another model call; preserve prior attempts and refuse without transmitting another image.`,
      );
    }
  }
  return Object.freeze(remaining);
}

export function prepareMultiPanelVisionRun(input) {
  const stepNumber = input.claim?.stepNumber;
  const laterPanels = input.laterPanels ?? [];
  const runBudgets = normalizeBudgets(input.budgets);
  if (Array.isArray(laterPanels) && laterPanels.length > runBudgets.maxFartherPanels) {
    throw new MultiPanelVisionError(
      `The retained sequence needs ${laterPanels.length} farther panels, above maxFartherPanels ${runBudgets.maxFartherPanels}; refuse before scanning an oversized panel array.`,
    );
  }
  validateFartherSequence(stepNumber, laterPanels, input.retainedThroughStep);
  const preparedInput = { ...input, laterPanels };
  const preparedRequests = preflightRequests(preparedInput, runBudgets);
  return Object.freeze({ preparedInput, preparedRequests, runBudgets });
}

export function requestForRemainingAttempt(preparedInput, panelK, prepared, runBudgets, attempts) {
  const request = requestForAttempt(
    preparedInput,
    panelK,
    prepared.attemptId,
    remainingAttemptBudgets(runBudgets, attempts),
  );
  if (canonicalJsonBytes(request).byteLength > request.budgets.maxRetainedBytes) {
    throw new MultiPanelVisionError(
      `Attempt ${request.attemptId} cannot fit its remaining maxRetainedBytes ${request.budgets.maxRetainedBytes}; refuse before transmitting another image.`,
    );
  }
  return request;
}
