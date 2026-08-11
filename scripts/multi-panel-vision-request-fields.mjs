import {
  DEFAULT_MULTI_PANEL_BUDGETS,
  MultiPanelVisionError,
  assertExactKeys,
  assertId,
  assertWhole,
  boundBytes,
} from "./multi-panel-vision-primitives.mjs";

const FACES = new Set(["studs-up", "underside"]);
export const MAX_MULTI_PANEL_PRINTED_STEPS = 4_096;

export function normalizeBudgets(value = {}) {
  const merged = { ...DEFAULT_MULTI_PANEL_BUDGETS, ...value };
  assertExactKeys(merged, Object.keys(DEFAULT_MULTI_PANEL_BUDGETS), "Multi-panel budgets");
  for (const [key, amount] of Object.entries(merged)) {
    assertWhole(amount, `budgets.${key}`, 0);
    const hardMaximum = DEFAULT_MULTI_PANEL_BUDGETS[key];
    if (amount > hardMaximum) {
      throw new MultiPanelVisionError(
        `budgets.${key} ${amount} exceeds the checker hard maximum ${hardMaximum}; callers may narrow a budget, never widen the external boundary.`,
      );
    }
  }
  if (merged.maxModelCalls < 1) {
    throw new MultiPanelVisionError("budgets.maxModelCalls must permit at least the N/N+1 call.");
  }
  for (const key of Object.keys(DEFAULT_MULTI_PANEL_BUDGETS).filter(
    (candidate) => candidate !== "maxFartherPanels",
  )) {
    if (merged[key] < 1) {
      throw new MultiPanelVisionError(
        `budgets.${key} must be positive for a model attempt; only maxFartherPanels may be zero.`,
      );
    }
  }
  return Object.freeze(merged);
}

export function normalizePieces(pieces) {
  if (!Array.isArray(pieces) || pieces.length < 1 || pieces.length > 64) {
    throw new MultiPanelVisionError("An atomic group must contain 1..64 pieces.");
  }
  const normalized = pieces.map((piece, index) => {
    assertExactKeys(
      piece,
      ["partInstanceId", "catalogPartId", "colorId", "transformId"],
      `claim.pieces[${index}]`,
    );
    return {
      partInstanceId: assertId(piece.partInstanceId, `claim.pieces[${index}].partInstanceId`),
      catalogPartId: assertId(piece.catalogPartId, `claim.pieces[${index}].catalogPartId`),
      colorId: assertWhole(piece.colorId, `claim.pieces[${index}].colorId`),
      transformId: assertId(piece.transformId, `claim.pieces[${index}].transformId`),
    };
  });
  normalized.sort((left, right) => left.partInstanceId.localeCompare(right.partInstanceId));
  const ids = normalized.map(({ partInstanceId }) => partInstanceId);
  if (new Set(ids).size !== ids.length) {
    throw new MultiPanelVisionError(
      "An atomic group repeats a partInstanceId; duplicate pieces need distinct stable ids.",
    );
  }
  return Object.freeze(normalized.map(Object.freeze));
}

export function faceFold(rotationIcons, maxStep, seedFace) {
  if (!FACES.has(seedFace)) {
    throw new MultiPanelVisionError(
      `Face seed must be studs-up or underside; received ${JSON.stringify(seedFace)}.`,
    );
  }
  if (!Array.isArray(rotationIcons)) {
    throw new MultiPanelVisionError("rotationIcons must be an array.");
  }
  if (
    !Number.isSafeInteger(maxStep) ||
    maxStep < 1 ||
    maxStep > MAX_MULTI_PANEL_PRINTED_STEPS ||
    rotationIcons.length > MAX_MULTI_PANEL_PRINTED_STEPS
  ) {
    throw new MultiPanelVisionError(
      `Face parity is bounded to 1..${MAX_MULTI_PANEL_PRINTED_STEPS} printed steps; received maxStep ${JSON.stringify(maxStep)} and ${rotationIcons.length} observations.`,
    );
  }
  const byStep = new Map();
  for (const [index, icon] of rotationIcons.entries()) {
    assertExactKeys(icon, ["stepNumber", "rotationIconPresent"], `rotationIcons[${index}]`);
    const stepNumber = assertWhole(icon.stepNumber, `rotationIcons[${index}].stepNumber`, 1);
    if (typeof icon.rotationIconPresent !== "boolean" || byStep.has(stepNumber)) {
      throw new MultiPanelVisionError(
        `rotationIcons must contain one boolean observation for step ${stepNumber}.`,
      );
    }
    byStep.set(stepNumber, icon.rotationIconPresent);
  }
  let face = seedFace;
  const fold = [];
  for (let stepNumber = 1; stepNumber <= maxStep; stepNumber += 1) {
    if (!byStep.has(stepNumber)) {
      throw new MultiPanelVisionError(
        `rotationIcons is missing printed step ${stepNumber}; face parity cannot skip a step.`,
      );
    }
    const rotationIconPresent = byStep.get(stepNumber);
    if (stepNumber === 1 && rotationIconPresent) {
      throw new MultiPanelVisionError(
        "rotationIcons step 1 cannot toggle the explicit step-1 face seed; resolve the contradictory face evidence before calling vision.",
      );
    }
    if (stepNumber > 1 && rotationIconPresent) {
      face = face === "studs-up" ? "underside" : "studs-up";
    }
    fold.push(Object.freeze({ stepNumber, rotationIconPresent, resultingPanelFace: face }));
  }
  if (byStep.size !== maxStep) {
    throw new MultiPanelVisionError(
      `rotationIcons contains ${byStep.size} steps but this attempt binds exactly steps 1..${maxStep}.`,
    );
  }
  return Object.freeze(fold);
}

function normalizeCrop(bounds, label) {
  assertExactKeys(bounds, ["x", "y", "width", "height", "unit"], label);
  if (bounds.unit !== "pdf-point") {
    throw new MultiPanelVisionError(`${label}.unit must be pdf-point.`);
  }
  for (const key of ["x", "y", "width", "height"]) {
    if (!Number.isFinite(bounds[key]) || (key !== "x" && key !== "y" && bounds[key] <= 0)) {
      throw new MultiPanelVisionError(
        `${label}.${key} must be finite and dimensions must be positive.`,
      );
    }
  }
  return Object.freeze({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    unit: bounds.unit,
  });
}

export function normalizePanel(panel, role, faceByStep, budgets) {
  const stepNumber = assertWhole(panel.stepNumber, `${role}.stepNumber`, 1);
  const sourcePng = boundBytes(panel.sourcePngBytes, "image/png", `${role} source PNG`);
  const candidateRenderPng = boundBytes(
    panel.candidateRenderPngBytes,
    "image/png",
    `${role} candidate render PNG`,
  );
  const imageBytes = sourcePng.byteLength + candidateRenderPng.byteLength;
  const imagePixels =
    sourcePng.width * sourcePng.height + candidateRenderPng.width * candidateRenderPng.height;
  if (imageBytes > budgets.maxImageBytes) {
    throw new MultiPanelVisionError(
      `${role} source and render use ${imageBytes} bytes, above maxImageBytes ${budgets.maxImageBytes}.`,
    );
  }
  if (imagePixels > budgets.maxImagePixels) {
    throw new MultiPanelVisionError(
      `${role} source and render use ${imagePixels} pixels, above maxImagePixels ${budgets.maxImagePixels}.`,
    );
  }
  return Object.freeze({
    role,
    stepNumber,
    pdfPage: assertWhole(panel.pdfPage, `${role}.pdfPage`, 1),
    cropBounds: normalizeCrop(panel.cropBounds, `${role}.cropBounds`),
    sourcePng,
    candidateRender: Object.freeze({
      prefixThroughStep: assertWhole(panel.prefixThroughStep, `${role}.prefixThroughStep`, 1),
      viewId: assertId(panel.viewId, `${role}.viewId`),
      cameraId: assertId(panel.cameraId, `${role}.cameraId`),
      panelFace: faceByStep.get(stepNumber),
      png: candidateRenderPng,
    }),
  });
}

export function makeBrief(claim, panels) {
  const lines = [
    `One atomic group adds ${claim.pieces.length} piece(s) at printed step ${claim.stepNumber}.`,
    "The immutable request retains candidate, document, catalog, truth, ledger, transform, and piece identities for audit, but those repository identifiers are deliberately not transmitted in this model brief.",
  ];
  lines.push("Bound source/render pairs:");
  for (const panel of panels) {
    lines.push(
      `- ${panel.role} step ${panel.stepNumber}, PDF page ${panel.pdfPage}, face ${panel.candidateRender.panelFace}, ` +
        `source ${panel.sourcePng.digest}, render ${panel.candidateRender.png.digest}, prefix through step ${panel.candidateRender.prefixThroughStep}`,
    );
  }
  return lines.join("\n");
}
