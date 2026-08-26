import { describeBrowserThrown } from "./real-build-browser-error-boundary";
import { snapshotPanelCameraCanonicalDocument } from "./real-build-panel-camera-json-snapshot";
import { snapshotRealBuildPassivePanel } from "./real-build-passive-panel-boundary";
import type { RealBuildOptions, StepFailure } from "./real-build-safety";

const PASSIVE_CALLOUT_BOX_KEYS = ["minXPt", "maxXPt", "minYPt", "maxYPt"] as const;
const MAXIMUM_RUN_COVERAGE_CALLOUTS = 2_048;
const MAXIMUM_MAPPED_CALLOUT_KEYS_PER_PANEL = 2_048;
const MAXIMUM_PANEL_NESTED_ROWS = 2_048;

const EXECUTION_PANEL_KEYS = [
  "stepNumber",
  "pageNumber",
  "panelFace",
  "minXPt",
  "maxXPt",
  "minYPt",
  "maxYPt",
  "calloutBoxes",
  "mappedCalloutKeys",
  "action",
  "pieces",
  "omittedPieces",
  "calloutPieces",
  "classifiedPhysicalCalloutPieces",
  "semanticMultiplierQuantity",
  "omittedPhysicalPieces",
  "coverageFailures",
  "missingDesigns",
  "unresolvedCallouts",
] as const;
const STEP_FAILURE_REQUIRED_KEYS = ["code", "stage", "message"] as const;
const STEP_FAILURE_OPTIONAL_KEYS = [
  "causedByStep",
  "pieceIndex",
  "catalogPartId",
  "inputKey",
  "stepNumber",
] as const;

const REAL_BUILD_OPTION_KEY_SET = {
  pdfjsUrl: true,
  workerUrl: true,
  pdfUrl: true,
  latticeUrl: true,
  renderingUrl: true,
  kernelUrl: true,
  commandsUrl: true,
  assemblyUrl: true,
  measuredFartherOriginSourceAttestation: true,
  panels: true,
  passivePanels: true,
  expectedPrintedSteps: true,
  lastStep: true,
  renderScale: true,
  panelWidth: true,
  workFactor: true,
  maxRendersPerPiece: true,
  blindRenderBudget: true,
  deferredCandidateBudget: true,
  panelCameraBranchBudget: true,
  deferredNarrowingRenderBudget: true,
  fartherPanelMaximumReachSteps: true,
  fartherPanelRenderBudget: true,
  explodedGhostRenderBudget: true,
  minimumDeferredAgreementMargin: true,
  minimumDeferredAgreement: true,
  proximityMarginPx: true,
  targetPartCount: true,
  maxParts: true,
  minimumScoreMargin: true,
  minimumWholeStepScore: true,
  minimumExclusiveHighlightPixelsPerPiece: true,
  highlightCalibrationDigest: true,
  accounting: true,
  inputDigests: true,
  coverageInputBindings: true,
  coverageByCallout: true,
} as const satisfies Readonly<Record<keyof RealBuildOptions, true>>;
const REAL_BUILD_OPTION_KEYS = Object.freeze(
  Object.keys(REAL_BUILD_OPTION_KEY_SET) as readonly (keyof RealBuildOptions)[],
);

interface DetachedRunInput {
  readonly parts: readonly [RealBuildOptions];
}

function dataValue(value: unknown, key: string, label: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be one plain object of own data properties.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`${label}.${key} descriptor could not be inspected.`);
  }
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be one own data property.`);
  }
  return descriptor.value;
}

function optionalDataValue(
  value: unknown,
  key: string,
  label: string,
): { readonly present: false } | { readonly present: true; readonly value: unknown } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be one plain object of own data properties.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new TypeError(`${label}.${key} descriptor could not be inspected.`);
  }
  if (descriptor === undefined) return { present: false };
  if (!("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be one own data property when present.`);
  }
  return { present: true, value: descriptor.value };
}

function denseDataArray(value: unknown, label: string, maximumRows: number): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be one dense ordinary array.`);
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    throw new TypeError(`${label}.length descriptor could not be inspected.`);
  }
  const length =
    lengthDescriptor !== undefined && "value" in lengthDescriptor
      ? lengthDescriptor.value
      : Number.NaN;
  if (!Number.isSafeInteger(length) || (length as number) < 0 || (length as number) > maximumRows) {
    throw new TypeError(
      `${label}.length must be one non-negative safe integer no greater than ${maximumRows}.`,
    );
  }
  const rows: unknown[] = [];
  for (let index = 0; index < (length as number); index += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      throw new TypeError(`${label}[${index}] descriptor could not be inspected.`);
    }
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError(`${label} must be dense; index ${index} is absent or an accessor.`);
    }
    rows.push(descriptor.value);
  }
  return rows;
}

function projectDataObject(
  value: unknown,
  label: string,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[] = [],
): Record<string, unknown> {
  const projected = Object.create(null) as Record<string, unknown>;
  for (const key of requiredKeys) projected[key] = dataValue(value, key, label);
  for (const key of optionalKeys) {
    const inspected = optionalDataValue(value, key, label);
    if (inspected.present) projected[key] = inspected.value;
  }
  return projected;
}

function projectTuple3(value: unknown, label: string): readonly unknown[] {
  const values = denseDataArray(value, label, 3);
  if (values.length !== 3) throw new TypeError(`${label} must contain exactly three values.`);
  return values;
}

function projectTransform(value: unknown, label: string): unknown {
  return {
    positionLdu: projectTuple3(dataValue(value, "positionLdu", label), `${label}.positionLdu`),
    orientationId: dataValue(value, "orientationId", label),
  };
}

function projectCalloutBox(value: unknown, label: string): unknown {
  return projectDataObject(value, label, PASSIVE_CALLOUT_BOX_KEYS);
}

function projectCalloutBoxes(value: unknown, label: string): readonly unknown[] {
  return denseDataArray(value, label, MAXIMUM_RUN_COVERAGE_CALLOUTS).map((box, index) =>
    projectCalloutBox(box, `${label}[${index}]`),
  );
}

function projectDirectPiece(value: unknown, label: string): unknown {
  const projected = projectDataObject(value, label, [
    "identityKey",
    "designId",
    "materialId",
    "catalogPartId",
    "colorId",
    "calloutKey",
    "identificationConfidence",
    "cropDigest",
    "identificationInputDigest",
    "expectedTransform",
  ]);
  projected.expectedTransform = projectTransform(
    projected.expectedTransform,
    `${label}.expectedTransform`,
  );
  return projected;
}

function projectOmittedPiece(value: unknown, label: string): unknown {
  const projected = projectDataObject(value, label, [
    "identityKey",
    "designId",
    "materialId",
    "catalogPartId",
    "colorId",
    "evidenceDigest",
    "transform",
  ]);
  projected.transform = projectTransform(projected.transform, `${label}.transform`);
  return projected;
}

function projectMultiBuildCopy(value: unknown, label: string): unknown {
  const projected = projectDataObject(value, label, [
    "identityKey",
    "sourceIdentityKey",
    "designId",
    "materialId",
    "catalogPartId",
    "colorId",
    "evidenceDigest",
    "transform",
  ]);
  projected.transform = projectTransform(projected.transform, `${label}.transform`);
  return projected;
}

function projectStepAction(value: unknown, label: string): unknown {
  const kind = dataValue(value, "kind", label);
  if (kind === "place-callouts") {
    return projectDataObject(value, label, ["kind", "assembledPieces", "evidenceDigest"]);
  }
  if (kind === "multi-build-copy") {
    const projected = projectDataObject(value, label, [
      "kind",
      "assembledPieces",
      "sourceStepNumber",
      "evidenceDigest",
      "copies",
    ]);
    projected.copies = denseDataArray(
      projected.copies,
      `${label}.copies`,
      MAXIMUM_PANEL_NESTED_ROWS,
    ).map((copy, index) => projectMultiBuildCopy(copy, `${label}.copies[${index}]`));
    return projected;
  }
  if (kind === "transition") {
    return projectDataObject(value, label, [
      "kind",
      "assembledPieces",
      "transition",
      "panelEvidenceDigest",
      "classificationEvidenceDigest",
      "evidenceDigest",
    ]);
  }
  throw new TypeError(`${label}.kind must name one supported real-build action.`);
}

function projectStepFailure(value: unknown, label: string): unknown {
  return projectDataObject(value, label, STEP_FAILURE_REQUIRED_KEYS, STEP_FAILURE_OPTIONAL_KEYS);
}

function projectExecutionPanel(value: unknown, label: string): unknown {
  const projected = projectDataObject(value, label, EXECUTION_PANEL_KEYS);
  projected.calloutBoxes = projectCalloutBoxes(projected.calloutBoxes, `${label}.calloutBoxes`);
  projected.mappedCalloutKeys = denseDataArray(
    projected.mappedCalloutKeys,
    `${label}.mappedCalloutKeys`,
    MAXIMUM_MAPPED_CALLOUT_KEYS_PER_PANEL,
  );
  projected.action = projectStepAction(projected.action, `${label}.action`);
  projected.pieces = denseDataArray(
    projected.pieces,
    `${label}.pieces`,
    MAXIMUM_PANEL_NESTED_ROWS,
  ).map((piece, index) => projectDirectPiece(piece, `${label}.pieces[${index}]`));
  projected.omittedPieces = denseDataArray(
    projected.omittedPieces,
    `${label}.omittedPieces`,
    MAXIMUM_PANEL_NESTED_ROWS,
  ).map((piece, index) => projectOmittedPiece(piece, `${label}.omittedPieces[${index}]`));
  projected.coverageFailures = denseDataArray(
    projected.coverageFailures,
    `${label}.coverageFailures`,
    MAXIMUM_PANEL_NESTED_ROWS,
  ).map((failure, index) => projectStepFailure(failure, `${label}.coverageFailures[${index}]`));
  for (const key of ["missingDesigns", "unresolvedCallouts"] as const) {
    projected[key] = denseDataArray(projected[key], `${label}.${key}`, MAXIMUM_PANEL_NESTED_ROWS);
  }
  return projected;
}

function panelStepNumber(value: unknown, label: string): number {
  const stepNumber = dataValue(value, "stepNumber", label);
  if (!Number.isSafeInteger(stepNumber)) {
    throw new TypeError(`${label}.stepNumber must be one safe integer.`);
  }
  return stepNumber as number;
}

function rasterOnlyPanel(value: unknown, label: string): unknown {
  return snapshotRealBuildPassivePanel(value, label);
}

function projectCoverageClaim(value: unknown, label: string): unknown {
  return projectDataObject(
    value,
    label,
    ["pageNumber", "quantity", "stepNumber"],
    ["identity", "identificationConfidence", "cropDigest", "inputDigest"],
  );
}

function prefixCoverage(value: unknown, lastStep: number, calloutKeys: readonly string[]): unknown {
  const label = "Real-build options.coverageByCallout";
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be one plain object of own data properties.`);
  }
  const coverage = Object.create(null) as Record<string, unknown>;
  for (const calloutKey of calloutKeys) {
    const inspected = optionalDataValue(value, calloutKey, label);
    if (!inspected.present) continue;
    const claim = projectCoverageClaim(inspected.value, `${label}.${calloutKey}`);
    const claimLabel = `${label}.${calloutKey}`;
    if (panelStepNumber(claim, claimLabel) <= lastStep) {
      coverage[calloutKey] = claim;
    }
  }
  return coverage;
}

/** Validates the action prefix and projects bounded raster/coverage observations before detaching. */
function projectRunOptions(value: unknown): RealBuildOptions {
  const lastStep = dataValue(value, "lastStep", "Real-build options");
  const expectedPrintedSteps = dataValue(value, "expectedPrintedSteps", "Real-build options");
  const maximumReach = dataValue(value, "fartherPanelMaximumReachSteps", "Real-build options");
  if (
    expectedPrintedSteps !== 359 ||
    !Number.isSafeInteger(lastStep) ||
    (lastStep as number) < 1 ||
    (lastStep as number) > 359 ||
    !Number.isSafeInteger(maximumReach) ||
    (maximumReach as number) < 1 ||
    (maximumReach as number) >= 359
  ) {
    throw new TypeError(
      "Real-build options must bind the fixed 359-step source/index contract, a safe requested lastStep " +
        "from 1 through 359, and safe farther-panel reach from 1 through 358 before panel projection.",
    );
  }
  const executionPanels = denseDataArray(
    dataValue(value, "panels", "Real-build options"),
    "Real-build options.panels",
    359,
  ).map((panel, index) => {
    const label = `Real-build options.panels[${index}]`;
    const stepNumber = panelStepNumber(panel, label);
    if (stepNumber > (lastStep as number)) {
      throw new TypeError(
        `${label} supplies action-bearing printed step ${stepNumber} above requested step ` +
          `${String(lastStep)}. Tail actions must be absent rather than silently projected away; retain ` +
          `only a raster descriptor in passivePanels when bounded corroboration is required.`,
      );
    }
    return projectExecutionPanel(panel, label);
  });
  const passiveLastStep = Math.min(
    expectedPrintedSteps as number,
    (lastStep as number) + (maximumReach as number),
  );
  const passivePanels = denseDataArray(
    dataValue(value, "passivePanels", "Real-build options"),
    "Real-build options.passivePanels",
    359,
  ).flatMap((panel, index) => {
    const label = `Real-build options.passivePanels[${index}]`;
    const stepNumber = panelStepNumber(panel, label);
    const rasterPanel = rasterOnlyPanel(panel, label);
    return stepNumber > (lastStep as number) && stepNumber <= passiveLastStep ? [rasterPanel] : [];
  });
  const calloutKeys = new Set<string>();
  for (let index = 0; index < executionPanels.length; index += 1) {
    const panel = executionPanels[index];
    const label = `Real-build options.panels[${index}]`;
    const mappedCalloutKeys = denseDataArray(
      dataValue(panel, "mappedCalloutKeys", label),
      `${label}.mappedCalloutKeys`,
      MAXIMUM_MAPPED_CALLOUT_KEYS_PER_PANEL,
    );
    for (const calloutKey of mappedCalloutKeys) {
      if (typeof calloutKey !== "string" || calloutKey.length < 1 || calloutKey.length > 512) {
        throw new TypeError(`${label}.mappedCalloutKeys must contain bounded strings.`);
      }
      calloutKeys.add(calloutKey);
      if (calloutKeys.size > MAXIMUM_RUN_COVERAGE_CALLOUTS) {
        throw new RangeError(
          `Real-build run references more than ${MAXIMUM_RUN_COVERAGE_CALLOUTS} distinct coverage callouts.`,
        );
      }
    }
  }
  const coverageByCallout = prefixCoverage(
    dataValue(value, "coverageByCallout", "Real-build options"),
    lastStep as number,
    [...calloutKeys],
  );
  const projected = Object.create(null) as Record<string, unknown>;
  for (const key of REAL_BUILD_OPTION_KEYS) {
    const sourceValue = dataValue(value, key, "Real-build options");
    projected[key] =
      key === "panels"
        ? executionPanels
        : key === "passivePanels"
          ? passivePanels
          : key === "coverageByCallout"
            ? coverageByCallout
            : key === "measuredFartherOriginSourceAttestation"
              ? sourceValue === null
                ? null
                : projectDataObject(sourceValue, `Real-build options.${key}`, [
                    "schemaVersion",
                    "fileCount",
                    "digest",
                  ])
              : key === "accounting"
                ? projectDataObject(sourceValue, `Real-build options.${key}`, [
                    "rawCalloutQuantity",
                    "classifiedPhysicalCalloutPieces",
                    "semanticMultiplierQuantity",
                    "omittedPhysicalPieces",
                    "directCalloutPieces",
                    "multiBuildCopyPieces",
                    "looseInventoryPieces",
                    "assembledTargetPieces",
                    "inventoryPieces",
                  ])
                : key === "inputDigests"
                  ? projectDataObject(sourceValue, `Real-build options.${key}`, [
                      "pdf",
                      "calloutManifest",
                      "coverage",
                      "officialModel",
                      "actionLedger",
                      "highlightCalibration",
                      "builderCalibration",
                      "builderGeometry",
                      "transitionClassifications",
                    ])
                  : key === "coverageInputBindings"
                    ? projectDataObject(sourceValue, `Real-build options.${key}`, [
                        "pdf",
                        "calloutManifest",
                      ])
                    : sourceValue;
  }
  return projected as unknown as RealBuildOptions;
}

export interface RealBuildRunInputSnapshot {
  readonly options: RealBuildOptions;
  readonly canonical: string;
  readonly canonicalizeCurrentInput: () => string;
}

function snapshotOptions(value: unknown): {
  readonly options: RealBuildOptions;
  readonly canonical: string;
} {
  // Reuse the bounded, descriptor-only canonical JSON detacher. The one
  // `parts` entry is the complete options value; nested panels, accounting,
  // digests, coverage, actions, identities and coordinates are all copied.
  const projected = projectRunOptions(value);
  const snapshot = snapshotPanelCameraCanonicalDocument<DetachedRunInput>(
    Object.freeze({ parts: Object.freeze([projected]) }),
    { maximumParts: 1 },
  );
  return { options: snapshot.document.parts[0], canonical: snapshot.canonical };
}

/** Detaches every result-determining JSON-like option before the first await. */
export function snapshotRealBuildRunInput(
  suppliedOptions: RealBuildOptions,
): RealBuildRunInputSnapshot {
  const detached = snapshotOptions(suppliedOptions);
  return Object.freeze({
    options: detached.options,
    canonical: detached.canonical,
    canonicalizeCurrentInput: () => snapshotOptions(suppliedOptions).canonical,
  });
}

export const __testOnly = Object.freeze({ prefixCoverage, projectRunOptions, rasterOnlyPanel });

/**
 * Rejects post-preflight mutation before page rasterization or placement. The
 * detached copy remains the execution input, while this comparison makes a
 * concurrent caller edit explicit instead of silently changing run identity.
 */
export function realBuildRunInputDriftFailure(
  snapshot: RealBuildRunInputSnapshot,
): StepFailure | null {
  try {
    if (snapshot.canonicalizeCurrentInput() === snapshot.canonical) return null;
    return {
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "panels",
      message:
        "The preflight-bound real-build input, including its panel order/page bindings, digests, accounting, " +
        "coverage, or execution budgets, changed during asynchronous module/PDF preparation. Execution was " +
        "refused before page rasterization, candidate search, or placement; submit one immutable input.",
    };
  } catch (error) {
    return {
      code: "printed-step-sequence-invalid",
      stage: "input",
      inputKey: "panels",
      message:
        "The preflight-bound real-build input could not be re-inspected after asynchronous module/PDF " +
        `preparation: ${describeBrowserThrown(error)}. Execution was refused before page rasterization, ` +
        "candidate search, or placement; submit plain immutable input data.",
    };
  }
}
