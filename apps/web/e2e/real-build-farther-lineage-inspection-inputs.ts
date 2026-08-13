import { REAL_BUILD_SHA256_DIGEST_PATTERN } from "./real-build-candidate-lineage-identity";
import {
  MAXIMUM_LINEAGED_FARTHER_LINEAGES,
  type FartherAtomicPieceIdentity,
} from "./real-build-farther-panel-types";
import {
  MAXIMUM_VALIDATED_FARTHER_BATCH_CHILDREN,
  MAXIMUM_VALIDATED_FARTHER_BATCH_PARENTS,
} from "./real-build-farther-lineage-transition";
import {
  failLineagedFartherInspection,
  lineagedFartherInspectionArrayEntry,
  lineagedFartherInspectionArrayLength,
  lineagedFartherInspectionBoundedString,
  lineagedFartherInspectionData,
  lineagedFartherInspectionSafeInteger,
} from "./real-build-farther-lineage-inspection-primitives";
import {
  projectLineagedFartherDocumentSnapshot,
  projectLineagedFartherFrontier,
  projectLineagedFartherIdentity,
  projectLineagedFartherOriginId,
  projectLineagedFartherWitnesses,
} from "./real-build-farther-lineage-inspection-projection";
import type {
  InspectedFirstLineagedRevealingPanel,
  InspectedLineagedFartherCarry,
  InspectedLineagedFartherExpansion,
  InspectedLineagedFartherPanelObservation,
  InspectedLineagedFartherPanelScore,
  InspectedLineagedFartherTransition,
  LineagedFartherProjectionContext,
} from "./real-build-farther-lineage-inspection-types";

const MAXIMUM_EXPECTED_PIECES = 1_024;
const MAXIMUM_PANELS = 359;

const data = lineagedFartherInspectionData;
const entry = lineagedFartherInspectionArrayEntry;
const length = lineagedFartherInspectionArrayLength;
const boundedString = lineagedFartherInspectionBoundedString;
const safeInteger = lineagedFartherInspectionSafeInteger;
const fail = failLineagedFartherInspection;

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fail(`${label} must be finite`);
  return value;
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") return fail(`${label} must be boolean`);
  return value;
}

function digest(value: unknown, label: string, context: LineagedFartherProjectionContext): string {
  const result = boundedString(value, label, context);
  if (!REAL_BUILD_SHA256_DIGEST_PATTERN.test(result))
    return fail(`${label} must be a sha256 digest`);
  return result;
}

function numberArray(
  value: unknown,
  label: string,
  maximum: number,
  context: LineagedFartherProjectionContext,
): readonly number[] {
  const count = length(value, label, maximum, context);
  const result: number[] = [];
  for (let index = 0; index < count; index += 1) {
    result.push(safeInteger(entry(value, index, label), `${label}[${index}]`));
  }
  return Object.freeze(result);
}

function atomicPiece(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): FartherAtomicPieceIdentity {
  return Object.freeze({
    catalogPartId: boundedString(
      data(value, "catalogPartId", label),
      `${label}.catalogPartId`,
      context,
    ),
    colorId: boundedString(data(value, "colorId", label), `${label}.colorId`, context),
  });
}

function transition(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): InspectedLineagedFartherTransition {
  const parentLineageId = projectLineagedFartherOriginId(
    data(value, "parentLineageId", label),
    `${label}.parentLineageId`,
    context,
  );
  const throughStepNumber = safeInteger(
    data(value, "throughStepNumber", label),
    `${label}.throughStepNumber`,
  );
  const documentSnapshot = projectLineagedFartherDocumentSnapshot(
    data(value, "documentSnapshot", label),
    `${label}.documentSnapshot`,
    context,
  );
  return Object.freeze({
    parentLineageId: parentLineageId as InspectedLineagedFartherTransition["parentLineageId"],
    throughStepNumber,
    documentSnapshot,
    pieces: projectLineagedFartherWitnesses(
      data(value, "pieces", label),
      `${label}.pieces`,
      context,
    ),
  });
}

function expansion(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): InspectedLineagedFartherExpansion {
  const parentLineageId = projectLineagedFartherOriginId(
    data(value, "parentLineageId", label),
    `${label}.parentLineageId`,
    context,
  );
  const narrowingRenders = safeInteger(
    data(value, "narrowingRenders", label),
    `${label}.narrowingRenders`,
  );
  const offeredPerPiece = numberArray(
    data(value, "offeredPerPiece", label),
    `${label}.offeredPerPiece`,
    MAXIMUM_EXPECTED_PIECES,
    context,
  );
  const carriedPerPiece = numberArray(
    data(value, "carriedPerPiece", label),
    `${label}.carriedPerPiece`,
    MAXIMUM_EXPECTED_PIECES,
    context,
  );
  const rawChildren = data(value, "children", label);
  const childCount = length(
    rawChildren,
    `${label}.children`,
    MAXIMUM_VALIDATED_FARTHER_BATCH_CHILDREN,
    context,
  );
  if (childCount > MAXIMUM_VALIDATED_FARTHER_BATCH_CHILDREN - context.budget.children) {
    return fail(`${label}.children exceeds the aggregate farther-inspection child budget`);
  }
  context.budget.children += childCount;
  const children: InspectedLineagedFartherTransition[] = [];
  for (let index = 0; index < childCount; index += 1) {
    children.push(
      transition(
        entry(rawChildren, index, `${label}.children`),
        `${label}.children[${index}]`,
        context,
      ),
    );
  }
  return Object.freeze({
    parentLineageId: parentLineageId as InspectedLineagedFartherExpansion["parentLineageId"],
    narrowingRenders,
    offeredPerPiece,
    carriedPerPiece,
    children: Object.freeze(children),
  });
}

export function projectLineagedFartherCarry(
  value: unknown,
  context: LineagedFartherProjectionContext,
): InspectedLineagedFartherCarry {
  const frontier = projectLineagedFartherFrontier(
    data(value, "frontier", "lineaged carry"),
    "lineaged carry.frontier",
    context,
  );
  const stepNumber = safeInteger(
    data(value, "stepNumber", "lineaged carry"),
    "lineaged carry.stepNumber",
  );
  const maximumLineages = safeInteger(
    data(value, "maximumLineages", "lineaged carry"),
    "lineaged carry.maximumLineages",
  );
  const maximumNarrowingRenders = safeInteger(
    data(value, "maximumNarrowingRenders", "lineaged carry"),
    "lineaged carry.maximumNarrowingRenders",
  );
  const rawExpected = data(value, "expectedAtomicPieces", "lineaged carry");
  const rawExpansions = data(value, "expansions", "lineaged carry");
  const expectedCount = length(
    rawExpected,
    "lineaged carry.expectedAtomicPieces",
    MAXIMUM_EXPECTED_PIECES,
    context,
  );
  const expansionCount = length(
    rawExpansions,
    "lineaged carry.expansions",
    MAXIMUM_VALIDATED_FARTHER_BATCH_PARENTS,
    context,
  );
  const expectedAtomicPieces: FartherAtomicPieceIdentity[] = [];
  const expansions: InspectedLineagedFartherExpansion[] = [];
  for (let index = 0; index < expectedCount; index += 1)
    expectedAtomicPieces.push(
      atomicPiece(
        entry(rawExpected, index, "lineaged carry.expectedAtomicPieces"),
        `lineaged carry.expectedAtomicPieces[${index}]`,
        context,
      ),
    );
  for (let index = 0; index < expansionCount; index += 1)
    expansions.push(
      expansion(
        entry(rawExpansions, index, "lineaged carry.expansions"),
        `lineaged carry.expansions[${index}]`,
        context,
      ),
    );
  return Object.freeze({
    frontier,
    stepNumber,
    expectedAtomicPieces: Object.freeze(expectedAtomicPieces),
    expansions: Object.freeze(expansions),
    maximumLineages,
    maximumNarrowingRenders,
  });
}

function score(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): InspectedLineagedFartherPanelScore {
  const rawShift = data(value, "shiftPx", label);
  const shiftLength = length(rawShift, `${label}.shiftPx`, 2, context);
  if (shiftLength !== 2) return fail(`${label}.shiftPx must contain exactly 2 coordinates`);
  const rawMeasure = data(value, "measure", label);
  if (rawMeasure !== "iou" && rawMeasure !== "containment")
    return fail(`${label}.measure is invalid`);
  const excluded = data(value, "excludedMaskDigest", label);
  return Object.freeze({
    identity: projectLineagedFartherIdentity(
      data(value, "identity", label),
      `${label}.identity`,
      context,
    ),
    fartherOriginLineageId: projectLineagedFartherOriginId(
      data(value, "fartherOriginLineageId", label),
      `${label}.fartherOriginLineageId`,
      context,
    ) as InspectedLineagedFartherPanelScore["fartherOriginLineageId"],
    cameraEvidenceId: boundedString(
      data(value, "cameraEvidenceId", label),
      `${label}.cameraEvidenceId`,
      context,
    ),
    measure: rawMeasure,
    candidateMaskDigest: digest(
      data(value, "candidateMaskDigest", label),
      `${label}.candidateMaskDigest`,
      context,
    ),
    builtMaskDigest: digest(
      data(value, "builtMaskDigest", label),
      `${label}.builtMaskDigest`,
      context,
    ),
    excludedMaskDigest:
      excluded === null ? null : digest(excluded, `${label}.excludedMaskDigest`, context),
    shiftPx: Object.freeze([
      safeInteger(entry(rawShift, 0, `${label}.shiftPx`), `${label}.shiftPx[0]`),
      safeInteger(entry(rawShift, 1, `${label}.shiftPx`), `${label}.shiftPx[1]`),
    ] as [number, number]),
    agreement: finiteNumber(data(value, "agreement", label), `${label}.agreement`),
  });
}

function panel(
  value: unknown,
  label: string,
  context: LineagedFartherProjectionContext,
): InspectedLineagedFartherPanelObservation {
  const status = data(value, "status", label);
  if (status !== "scored") return fail(`${label}.status must be scored`);
  const stepNumber = safeInteger(data(value, "stepNumber", label), `${label}.stepNumber`);
  const renderCount = safeInteger(data(value, "renderCount", label), `${label}.renderCount`);
  const rawScores = data(value, "scores", label);
  const scoreCount = length(
    rawScores,
    `${label}.scores`,
    MAXIMUM_LINEAGED_FARTHER_LINEAGES,
    context,
  );
  if (scoreCount > MAXIMUM_LINEAGED_FARTHER_LINEAGES - context.budget.scores) {
    return fail(`${label}.scores exceeds the aggregate farther-inspection score budget`);
  }
  context.budget.scores += scoreCount;
  const scores: InspectedLineagedFartherPanelScore[] = [];
  for (let index = 0; index < scoreCount; index += 1)
    scores.push(
      score(entry(rawScores, index, `${label}.scores`), `${label}.scores[${index}]`, context),
    );
  return Object.freeze({
    stepNumber,
    status,
    renderCount,
    scores: Object.freeze(scores),
  });
}

export function projectFirstLineagedRevealingPanel(
  value: unknown,
  context: LineagedFartherProjectionContext,
): InspectedFirstLineagedRevealingPanel {
  const frontier = projectLineagedFartherFrontier(
    data(value, "frontier", "lineaged panel"),
    "lineaged panel.frontier",
    context,
  );
  const minimumAgreement = finiteNumber(
    data(value, "minimumAgreement", "lineaged panel"),
    "lineaged panel.minimumAgreement",
  );
  const minimumMargin = finiteNumber(
    data(value, "minimumMargin", "lineaged panel"),
    "lineaged panel.minimumMargin",
  );
  const maximumPanelRenders = safeInteger(
    data(value, "maximumPanelRenders", "lineaged panel"),
    "lineaged panel.maximumPanelRenders",
  );
  const maximumReachSteps = safeInteger(
    data(value, "maximumReachSteps", "lineaged panel"),
    "lineaged panel.maximumReachSteps",
  );
  const fartherPanelsAvailable = booleanValue(
    data(value, "fartherPanelsAvailable", "lineaged panel"),
    "lineaged panel.fartherPanelsAvailable",
  );
  const rawPanels = data(value, "panels", "lineaged panel");
  const panelCount = length(rawPanels, "lineaged panel.panels", MAXIMUM_PANELS, context);
  const panels: InspectedLineagedFartherPanelObservation[] = [];
  for (let index = 0; index < panelCount; index += 1)
    panels.push(
      panel(
        entry(rawPanels, index, "lineaged panel.panels"),
        `lineaged panel.panels[${index}]`,
        context,
      ),
    );
  return Object.freeze({
    frontier,
    panels: Object.freeze(panels),
    minimumAgreement,
    minimumMargin,
    maximumPanelRenders,
    maximumReachSteps,
    fartherPanelsAvailable,
  });
}
