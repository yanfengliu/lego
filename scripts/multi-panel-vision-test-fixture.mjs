import { createHash } from "node:crypto";

import { PART_IDENTIFICATION_MODEL_IDENTITY } from "./part-identification-model.mjs";
import { encodePng } from "./part-identification-card-test-fixture.mjs";
import { sha256 } from "./multi-panel-vision-contract.mjs";

export const png = (label) => {
  const color = createHash("sha256").update(label).digest().subarray(0, 3);
  return encodePng(1, 1, new Uint8Array([color[0], color[1], color[2], 0xff]));
};

export const booklet = Object.freeze({
  pdfDigest: sha256(Buffer.from("synthetic stand-in for recipes/6651557.pdf", "utf8")),
  pdfByteLength: 12_345_678,
});

export const scope = Object.freeze({
  baseDocumentId: "document:sha256:step-prefix",
  catalogId: "catalog:builtin-12",
  truthId: "truth:catalog-12-validator-7",
  actionLedgerId: "ledger:set-6651557-actions",
  candidateNodeId: "candidate:step-5:green-plate",
  transformSetId: "transforms:ldu-v4",
});

export const pieces = Object.freeze([
  Object.freeze({
    partInstanceId: "piece:green-plate:a",
    catalogPartId: "3023",
    colorId: 2,
    transformId: "transform:green-plate:left",
  }),
  Object.freeze({
    partInstanceId: "piece:green-plate:b",
    catalogPartId: "3023",
    colorId: 2,
    transformId: "transform:green-plate:right",
  }),
]);

export const rotationIconsThrough = (lastStep) =>
  Array.from({ length: lastStep }, (_, index) => {
    const stepNumber = index + 1;
    return {
      stepNumber,
      rotationIconPresent: [4, 5, 7, 8, 10].includes(stepNumber),
    };
  });

export const panel = (stepNumber, label = String(stepNumber)) => ({
  stepNumber,
  pdfPage: stepNumber <= 5 ? 11 : stepNumber <= 8 ? 12 : 13,
  cropBounds: {
    x: 40 + stepNumber,
    y: 80 + stepNumber,
    width: 420,
    height: 360,
    unit: "pdf-point",
  },
  sourcePngBytes: png(`source-${label}`),
  candidateRenderPngBytes: png(`candidate-${label}`),
  prefixThroughStep: stepNumber,
  viewId: `booklet-step-${stepNumber}`,
  cameraId: `camera-fit-step-${stepNumber}`,
});

export const response = (verdict, reason, usage = {}) => ({
  modelIdentity: PART_IDENTIFICATION_MODEL_IDENTITY,
  rawResponseBytes: Buffer.from(JSON.stringify({ verdict, reason }), "utf8"),
  transportTraceBytes: Buffer.from(
    JSON.stringify({ fixture: true, verdict, reason, toolCalls: 1 }),
    "utf8",
  ),
  usage: {
    inputTokens: usage.inputTokens ?? 1_200,
    outputTokens: usage.outputTokens ?? 20,
    costMicrousd: usage.costMicrousd ?? 25_000,
    elapsedMs: usage.elapsedMs ?? 200,
  },
});

export function step5Input(overrides = {}) {
  return {
    runId: "set-6651557-step-5-continuity",
    scope,
    booklet,
    claim: {
      stepNumber: 5,
      atomicGroupId: "atomic:step-5:green-plates",
      pieces,
    },
    faceSeed: "studs-up",
    rotationIcons: rotationIconsThrough(overrides.retainedThroughStep ?? 7),
    panelN: panel(5),
    panelNPlusOne: panel(6),
    laterPanels: [panel(7)],
    retainedThroughStep: 7,
    nextAttemptId: (index) => `attempt:set-6651557:step-5:${index + 1}`,
    ...overrides,
  };
}

export function step4Input(overrides = {}) {
  return {
    runId: "set-6651557-step-4-continuity",
    scope: { ...scope, candidateNodeId: "candidate:step-4:black-plates" },
    booklet,
    claim: {
      stepNumber: 4,
      atomicGroupId: "atomic:step-4:black-plates",
      pieces,
    },
    faceSeed: "studs-up",
    rotationIcons: rotationIconsThrough(5),
    panelN: panel(4),
    panelNPlusOne: panel(5),
    laterPanels: [],
    retainedThroughStep: 5,
    nextAttemptId: (index) => `attempt:set-6651557:step-4:${index + 1}`,
    ...overrides,
  };
}
