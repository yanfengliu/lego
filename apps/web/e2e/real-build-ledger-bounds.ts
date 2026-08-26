import { OFFICIAL_REAL_BUILD_ACCOUNTING } from "./real-build-contract";
import {
  type LedgerCopyIdentity,
  type LedgerPieceIdentity,
  type LedgerStep,
  type LedgerStepAction,
  type LedgerTransform,
  type RealBuildActionLedger,
  type RealBuildActionLedgerProvenance,
} from "./real-build-ledger-contract";
import type { StepFailure } from "./real-build-safety";

const MAXIMUM_LEDGER_STEPS = 359;
const MAXIMUM_LEDGER_IDENTITIES = OFFICIAL_REAL_BUILD_ACCOUNTING.inventoryPieces;
const MAXIMUM_LEDGER_FAILURES = 4_096;
const MAXIMUM_LEDGER_REFUSALS = 4_000;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

const TOP_LEVEL_KEYS = [
  "schemaVersion",
  "pdfDigest",
  "officialModelDigest",
  "coverageDigest",
  "calloutManifestDigest",
  "sourceArtReboundDigest",
  "builderCalibrationDigest",
  "transitionClassificationsDigest",
  "steps",
  "provenance",
] as const;
const STEP_KEYS = ["stepNumber", "pageNumber", "panelEvidenceDigest", "callouts", "action"];
const CALLOUT_KEYS = ["calloutKey", "physicalBrickRefs", "semanticMultiplierQuantity"];
const PIECE_KEYS = [
  "brickRef",
  "designId",
  "materialId",
  "catalogPartId",
  "colorId",
  "calloutKey",
  "identificationConfidence",
  "cropDigest",
  "identificationInputDigest",
  "evidenceDigest",
  "transform",
] as const;
const PROVENANCE_KEYS = [
  "generator",
  "authenticated",
  "expectedPrintedSteps",
  "requestedLastStep",
  "alignedThroughStep",
  "stopReason",
  "directPieceCount",
  "transitionStepCount",
  "refusals",
] as const;
const REFUSAL_KEYS = ["stepNumber", "calloutKey", "brickRef", "reason"] as const;

class LedgerShapeError extends Error {}

function recordKeys(value: unknown, label: string): readonly PropertyKey[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LedgerShapeError(`${label} must be a current /4 JSON object.`);
  }
  try {
    return Reflect.ownKeys(value);
  } catch {
    throw new LedgerShapeError(`${label} could not be inspected as bounded data.`);
  }
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
  label: string,
): Readonly<Record<string, unknown>> {
  const keys = recordKeys(value, label);
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    throw new LedgerShapeError(`${label} must contain exactly its current /4 fields.`);
  }
  const values: Record<string, unknown> = {};
  for (const key of expectedKeys) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      throw new LedgerShapeError(`${label}.${key} could not be inspected as bounded data.`);
    }
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new LedgerShapeError(`${label}.${key} must be descriptor-safe data.`);
    }
    values[key] = descriptor.value;
  }
  return values;
}

function ownDataValue(value: unknown, key: string, label: string): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LedgerShapeError(`${label} must be a current /4 JSON object.`);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, key);
  } catch {
    throw new LedgerShapeError(`${label}.${key} could not be inspected as bounded data.`);
  }
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new LedgerShapeError(`${label}.${key} must be descriptor-safe data.`);
  }
  return descriptor.value;
}

function arrayValues(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): readonly unknown[] {
  let isArray: boolean;
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    isArray = Array.isArray(value);
    lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  } catch {
    throw new LedgerShapeError(`${label} could not be inspected as a bounded array.`);
  }
  const length =
    lengthDescriptor !== undefined && "value" in lengthDescriptor
      ? lengthDescriptor.value
      : Number.NaN;
  if (!isArray || !Number.isSafeInteger(length) || length < minimum || length > maximum) {
    const bound =
      minimum === maximum
        ? `exactly ${maximum}`
        : minimum === 0
          ? `at most ${maximum}`
          : `${minimum} through ${maximum}`;
    throw new LedgerShapeError(`${label} must be an array containing ${bound} entries.`);
  }
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value as object);
  } catch {
    throw new LedgerShapeError(`${label} could not be inspected as a bounded array.`);
  }
  const expectedKeys = [...Array.from({ length }, (_, index) => String(index)), "length"];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) {
    throw new LedgerShapeError(`${label} must contain only dense current /4 array entries.`);
  }
  return expectedKeys.slice(0, -1).map((key) => {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      throw new LedgerShapeError(`${label}[${key}] could not be inspected as bounded data.`);
    }
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new LedgerShapeError(`${label}[${key}] must be descriptor-safe data.`);
    }
    return descriptor.value;
  });
}

function boundedString(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > maximum) {
    throw new LedgerShapeError(`${label} must contain 1 through ${maximum} characters.`);
  }
  return value;
}

function nullableString(value: unknown, label: string, maximum: number): string | null {
  return value === null ? null : boundedString(value, label, maximum);
}

function digestValue(value: unknown, label: string): string {
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw new LedgerShapeError(`${label} must be one lowercase sha256 digest.`);
  }
  return value;
}

function whole(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new LedgerShapeError(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value as number;
}

function transformValue(value: unknown, label: string): LedgerTransform | null {
  if (value === null) return null;
  const transform = exactRecord(value, ["orientationId", "positionLdu"], label);
  const position = arrayValues(transform.positionLdu, `${label}.positionLdu`, 3, 3).map(
    (coordinate, index) => {
      if (
        typeof coordinate !== "number" ||
        !Number.isFinite(coordinate) ||
        Math.abs(coordinate) > 1_000_000
      ) {
        throw new LedgerShapeError(
          `${label}.positionLdu[${index}] must be finite and within +/-1000000.`,
        );
      }
      return coordinate;
    },
  ) as [number, number, number];
  return {
    positionLdu: position,
    orientationId: boundedString(transform.orientationId, `${label}.orientationId`, 128),
  };
}

function pieceValue(
  value: unknown,
  label: string,
  copy: boolean,
): LedgerPieceIdentity | LedgerCopyIdentity {
  const fields = copy ? [...PIECE_KEYS, "sourceBrickRef"] : PIECE_KEYS;
  const piece = exactRecord(value, fields, label);
  const confidence = piece.identificationConfidence;
  if (
    confidence !== "vision-kept" &&
    confidence !== "pair-judged-same" &&
    confidence !== "source-art-rebound" &&
    confidence !== "official-model"
  ) {
    throw new LedgerShapeError(
      `${label}.identificationConfidence ${JSON.stringify(confidence)} is outside the /4 enum.`,
    );
  }
  const brickRef = boundedString(piece.brickRef, `${label}.brickRef`, 256);
  const designId = boundedString(piece.designId, `${label}.designId`, 64);
  const materialId = boundedString(piece.materialId, `${label}.materialId`, 64);
  const catalogPartId = boundedString(piece.catalogPartId, `${label}.catalogPartId`, 256);
  const colorId = boundedString(piece.colorId, `${label}.colorId`, 128);
  const calloutKey = nullableString(piece.calloutKey, `${label}.calloutKey`, 512);
  const cropDigest =
    piece.cropDigest === null ? null : digestValue(piece.cropDigest, `${label}.cropDigest`);
  const identificationInputDigest = digestValue(
    piece.identificationInputDigest,
    `${label}.identificationInputDigest`,
  );
  const transform = transformValue(piece.transform, `${label}.transform`);
  const evidenceDigest = digestValue(piece.evidenceDigest, `${label}.evidenceDigest`);
  return copy
    ? ({
        brickRef,
        sourceBrickRef: boundedString(piece.sourceBrickRef, `${label}.sourceBrickRef`, 256),
        designId,
        materialId,
        catalogPartId,
        colorId,
        calloutKey,
        identificationConfidence: confidence,
        cropDigest,
        identificationInputDigest,
        transform,
        evidenceDigest,
      } satisfies LedgerCopyIdentity)
    : ({
        brickRef,
        designId,
        materialId,
        catalogPartId,
        colorId,
        calloutKey,
        identificationConfidence: confidence,
        cropDigest,
        identificationInputDigest,
        transform,
        evidenceDigest,
      } satisfies LedgerPieceIdentity);
}

interface ShapeCounters {
  actionIdentities: number;
  callouts: number;
  physicalReferences: number;
}

function requireInventoryBound(counters: ShapeCounters): void {
  if (
    counters.actionIdentities > MAXIMUM_LEDGER_IDENTITIES ||
    counters.callouts > MAXIMUM_LEDGER_IDENTITIES ||
    counters.physicalReferences > MAXIMUM_LEDGER_IDENTITIES
  ) {
    throw new LedgerShapeError(
      `Action ledger exceeds the ${MAXIMUM_LEDGER_IDENTITIES}-identity official inventory bound ` +
        `across its action rows, callouts, or physical references.`,
    );
  }
}

function actionValue(value: unknown, label: string, counters: ShapeCounters): LedgerStepAction {
  const kind = ownDataValue(value, "kind", label);
  if (kind === "place-callouts") {
    const action = exactRecord(value, ["kind", "pieces", "omittedPieces"], label);
    const pieces = arrayValues(action.pieces, `${label}.pieces`, 0, MAXIMUM_LEDGER_IDENTITIES).map(
      (piece, index) => pieceValue(piece, `${label}.pieces[${index}]`, false),
    );
    const omittedPieces = arrayValues(
      action.omittedPieces,
      `${label}.omittedPieces`,
      0,
      MAXIMUM_LEDGER_IDENTITIES,
    ).map((piece, index) => pieceValue(piece, `${label}.omittedPieces[${index}]`, false));
    counters.actionIdentities += pieces.length + omittedPieces.length;
    requireInventoryBound(counters);
    return { kind: "place-callouts", pieces, omittedPieces };
  }
  if (kind === "multi-build-copy") {
    const action = exactRecord(value, ["kind", "sourceStepNumber", "copies"], label);
    const copies = arrayValues(action.copies, `${label}.copies`, 0, MAXIMUM_LEDGER_IDENTITIES).map(
      (piece, index) => pieceValue(piece, `${label}.copies[${index}]`, true) as LedgerCopyIdentity,
    );
    counters.actionIdentities += copies.length;
    requireInventoryBound(counters);
    return {
      kind: "multi-build-copy",
      sourceStepNumber: whole(action.sourceStepNumber, `${label}.sourceStepNumber`, 1, 359),
      copies,
    };
  }
  if (kind === "transition") {
    const action = exactRecord(
      value,
      ["kind", "transition", "classificationEvidenceDigest"],
      label,
    );
    if (
      action.transition !== "rotation" &&
      action.transition !== "attachment" &&
      action.transition !== "final-view"
    ) {
      throw new LedgerShapeError(`${label}.transition is outside the /4 enum.`);
    }
    return {
      kind: "transition",
      transition: action.transition,
      classificationEvidenceDigest: digestValue(
        action.classificationEvidenceDigest,
        `${label}.classificationEvidenceDigest`,
      ),
    };
  }
  throw new LedgerShapeError(`${label}.kind is outside the current /4 action union.`);
}

function stepValue(value: unknown, index: number, counters: ShapeCounters): LedgerStep {
  const label = `Action ledger steps[${index}]`;
  const step = exactRecord(value, STEP_KEYS, label);
  const callouts = arrayValues(
    step.callouts,
    `${label}.callouts`,
    0,
    MAXIMUM_LEDGER_IDENTITIES,
  ).map((rawCallout, calloutIndex) => {
    const calloutLabel = `${label}.callouts[${calloutIndex}]`;
    const callout = exactRecord(rawCallout, CALLOUT_KEYS, calloutLabel);
    const physicalBrickRefs = arrayValues(
      callout.physicalBrickRefs,
      `${calloutLabel}.physicalBrickRefs`,
      0,
      MAXIMUM_LEDGER_IDENTITIES,
    ).map((brickRef, brickIndex) =>
      boundedString(brickRef, `${calloutLabel}.physicalBrickRefs[${brickIndex}]`, 256),
    );
    if (new Set(physicalBrickRefs).size !== physicalBrickRefs.length) {
      throw new LedgerShapeError(`${calloutLabel}.physicalBrickRefs must be unique.`);
    }
    counters.physicalReferences += physicalBrickRefs.length;
    return {
      calloutKey: boundedString(callout.calloutKey, `${calloutLabel}.calloutKey`, 512),
      physicalBrickRefs,
      semanticMultiplierQuantity: whole(
        callout.semanticMultiplierQuantity,
        `${calloutLabel}.semanticMultiplierQuantity`,
        0,
        10_000,
      ),
    };
  });
  counters.callouts += callouts.length;
  requireInventoryBound(counters);
  return {
    stepNumber: whole(step.stepNumber, `${label}.stepNumber`, 1, 359),
    pageNumber: whole(step.pageNumber, `${label}.pageNumber`, 1, 10_000),
    panelEvidenceDigest: digestValue(step.panelEvidenceDigest, `${label}.panelEvidenceDigest`),
    callouts,
    action: actionValue(step.action, `${label}.action`, counters),
  };
}

function provenanceValue(value: unknown): RealBuildActionLedgerProvenance {
  const provenance = exactRecord(value, PROVENANCE_KEYS, "Action ledger provenance");
  const refusals = arrayValues(
    provenance.refusals,
    "Action ledger provenance.refusals",
    0,
    MAXIMUM_LEDGER_REFUSALS,
  ).map((rawRefusal, index) => {
    const label = `Action ledger provenance.refusals[${index}]`;
    const refusal = exactRecord(rawRefusal, REFUSAL_KEYS, label);
    return {
      stepNumber: whole(refusal.stepNumber, `${label}.stepNumber`, 1, 359),
      calloutKey: nullableString(refusal.calloutKey, `${label}.calloutKey`, 512),
      brickRef: nullableString(refusal.brickRef, `${label}.brickRef`, 256),
      reason: boundedString(refusal.reason, `${label}.reason`, 16_384),
    };
  });
  if (provenance.authenticated !== false) {
    throw new LedgerShapeError("Action ledger provenance.authenticated must remain false.");
  }
  return {
    generator: boundedString(
      provenance.generator,
      "Action ledger provenance.generator",
      512,
    ) as RealBuildActionLedgerProvenance["generator"],
    authenticated: false,
    expectedPrintedSteps: whole(
      provenance.expectedPrintedSteps,
      "Action ledger provenance.expectedPrintedSteps",
      359,
      359,
    ) as 359,
    requestedLastStep: whole(
      provenance.requestedLastStep,
      "Action ledger provenance.requestedLastStep",
      1,
      50,
    ),
    alignedThroughStep: whole(
      provenance.alignedThroughStep,
      "Action ledger provenance.alignedThroughStep",
      1,
      50,
    ),
    stopReason: boundedString(provenance.stopReason, "Action ledger provenance.stopReason", 16_384),
    directPieceCount: whole(
      provenance.directPieceCount,
      "Action ledger provenance.directPieceCount",
      0,
      MAXIMUM_LEDGER_IDENTITIES,
    ),
    transitionStepCount: whole(
      provenance.transitionStepCount,
      "Action ledger provenance.transitionStepCount",
      0,
      MAXIMUM_LEDGER_STEPS,
    ),
    refusals,
  };
}

const limitFailure = (message: string): StepFailure => ({
  code: "action-ledger-incomplete",
  stage: "input",
  inputKey: "actionLedger.steps",
  message,
});

/** Rebuilds only a closed descriptor-safe /4 ledger before semantic admission. */
export function preflightRealBuildActionLedger(
  value: unknown,
):
  | { readonly ledger: RealBuildActionLedger; readonly failure: null }
  | { readonly ledger: null; readonly failure: StepFailure } {
  try {
    const top = exactRecord(value, TOP_LEVEL_KEYS, "Action ledger");
    const rawSteps = arrayValues(top.steps, "Action ledger steps", 1, MAXIMUM_LEDGER_STEPS);
    const counters: ShapeCounters = { actionIdentities: 0, callouts: 0, physicalReferences: 0 };
    const steps = rawSteps.map((step, index) => stepValue(step, index, counters));
    return {
      ledger: {
        schemaVersion: boundedString(
          top.schemaVersion,
          "Action ledger schemaVersion",
          128,
        ) as RealBuildActionLedger["schemaVersion"],
        pdfDigest: digestValue(top.pdfDigest, "Action ledger pdfDigest"),
        officialModelDigest: digestValue(
          top.officialModelDigest,
          "Action ledger officialModelDigest",
        ),
        coverageDigest: digestValue(top.coverageDigest, "Action ledger coverageDigest"),
        calloutManifestDigest: digestValue(
          top.calloutManifestDigest,
          "Action ledger calloutManifestDigest",
        ),
        sourceArtReboundDigest: digestValue(
          top.sourceArtReboundDigest,
          "Action ledger sourceArtReboundDigest",
        ),
        builderCalibrationDigest: digestValue(
          top.builderCalibrationDigest,
          "Action ledger builderCalibrationDigest",
        ),
        transitionClassificationsDigest: digestValue(
          top.transitionClassificationsDigest,
          "Action ledger transitionClassificationsDigest",
        ),
        steps,
        provenance: provenanceValue(top.provenance),
      },
      failure: null,
    };
  } catch (error) {
    return {
      ledger: null,
      failure: limitFailure(
        error instanceof LedgerShapeError
          ? error.message
          : "Action ledger /4 shape could not be inspected as bounded descriptor-safe data.",
      ),
    };
  }
}

/** Retains a bounded prefix plus one explicit sentinel instead of silently truncating failures. */
export function boundedLedgerFailures(): {
  readonly add: (...items: readonly StepFailure[]) => void;
  readonly result: () => readonly StepFailure[];
} {
  const retained: StepFailure[] = [];
  let omitted = 0;
  return {
    add: (...items) => {
      for (const item of items) {
        if (retained.length < MAXIMUM_LEDGER_FAILURES - 1) retained.push(item);
        else omitted += 1;
      }
    },
    result: () =>
      omitted === 0
        ? retained
        : [
            ...retained,
            {
              code: "validation-failure-limit",
              stage: "input",
              inputKey: "actionLedger.validationFailures",
              message:
                `Action ledger validation retained ${retained.length} failures and omitted ${omitted} ` +
                `after reaching the ${MAXIMUM_LEDGER_FAILURES}-entry result bound.`,
            },
          ],
  };
}
