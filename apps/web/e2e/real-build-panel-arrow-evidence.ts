import type { PanelProjection } from "../src/assembly/arrow-placement";
import {
  arrowDisplacementForRealBuildPanelCameraRegistration,
  createRealBuildPanelCameraRegistration,
  type ArrowDisplacement,
  type RealBuildPanelCameraRegistration,
} from "./real-build-panel-camera-registration";

export interface PanelViewSolution {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
  readonly upSign?: 1 | -1;
}

/** Candidate-independent arrow facts measured on one panel's work raster. */
export interface RawPanelArrowMeasurement {
  readonly displacementXPx: number;
  readonly displacementYPx: number;
  /** Negative infinity records that the already-built mask was empty, yielding no family. */
  readonly travelCeilingPx: number;
  readonly workFactor: number;
}

/** One panel-bound camera fit and arrow measurement; its members cannot be mixed across panels. */
export interface PanelArrowCameraEvidence {
  readonly panelStepNumber: number;
  readonly faceCorrectedFit: PanelViewSolution;
  readonly measurement: RawPanelArrowMeasurement;
}

export interface RealBuildArrowFamilyAssembly {
  readonly panelProjectionForWorkRaster: (
    fit: PanelViewSolution,
    workFactor: number,
  ) => PanelProjection;
  readonly arrowTravelFamily: (
    projection: PanelProjection,
    displacement: Readonly<{ xPx: number; yPx: number }>,
    ceilingPx: number,
  ) => readonly ArrowDisplacement[];
}

const EMPTY_ARROW_FAMILY = Object.freeze([]) as readonly ArrowDisplacement[];
const MAXIMUM_ARROW_FAMILY = 200;
const ARROW_FAMILY_INPUT_KEYS = ["assembly", "evidence", "registration"] as const;
const EVIDENCE_KEYS = ["faceCorrectedFit", "measurement", "panelStepNumber"] as const;
const PANEL_VIEW_KEYS_WITHOUT_SIGN = [
  "azimuthDegrees",
  "elevationDegrees",
  "pixelsPerUnit",
] as const;
const PANEL_VIEW_KEYS_WITH_SIGN = [...PANEL_VIEW_KEYS_WITHOUT_SIGN, "upSign"] as const;
const MEASUREMENT_KEYS = [
  "displacementXPx",
  "displacementYPx",
  "travelCeilingPx",
  "workFactor",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function describe(value: unknown): string {
  try {
    return (
      JSON.stringify(value, (_key, nested) =>
        typeof nested === "number" && !Number.isFinite(nested) ? String(nested) : nested,
      ) ?? String(value)
    );
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  const required = new Set(expected);
  return keys.length === required.size && keys.every((key) => required.has(key));
}

/** Copies and freezes raw arrow facts at the raster boundary. */
export function createRawPanelArrowMeasurement(input: unknown): RawPanelArrowMeasurement {
  if (!isRecord(input) || !hasExactKeys(input, MEASUREMENT_KEYS)) {
    throw new TypeError(
      `A raw panel arrow measurement must contain exactly ${MEASUREMENT_KEYS.join(", ")}; received ${describe(input)}.`,
    );
  }
  const { displacementXPx, displacementYPx, travelCeilingPx, workFactor } = input;
  if (
    typeof displacementXPx !== "number" ||
    !Number.isFinite(displacementXPx) ||
    typeof displacementYPx !== "number" ||
    !Number.isFinite(displacementYPx) ||
    Math.hypot(displacementXPx, displacementYPx) === 0
  ) {
    throw new RangeError(
      `Raw panel arrow displacement must be a finite, non-zero pixel vector; received ${describe([displacementXPx, displacementYPx])}.`,
    );
  }
  if (
    typeof travelCeilingPx !== "number" ||
    Number.isNaN(travelCeilingPx) ||
    travelCeilingPx === Number.POSITIVE_INFINITY
  ) {
    throw new RangeError(
      `Raw panel arrow travelCeilingPx must be a numeric upper bound below positive infinity; received ${describe(travelCeilingPx)}.`,
    );
  }
  if (!Number.isSafeInteger(workFactor) || (workFactor as number) < 1) {
    throw new RangeError(
      `Raw panel arrow workFactor must be a positive safe integer; received ${describe(workFactor)}.`,
    );
  }
  return Object.freeze({
    displacementXPx,
    displacementYPx,
    travelCeilingPx,
    workFactor: workFactor as number,
  });
}

/** Copies and freezes one camera fit before any later untrusted callback can mutate it. */
export function createPanelViewSolution(input: unknown): PanelViewSolution {
  if (
    !isRecord(input) ||
    (!hasExactKeys(input, PANEL_VIEW_KEYS_WITHOUT_SIGN) &&
      !hasExactKeys(input, PANEL_VIEW_KEYS_WITH_SIGN))
  ) {
    throw new TypeError(
      `A panel camera fit must contain exactly ${PANEL_VIEW_KEYS_WITHOUT_SIGN.join(
        ", ",
      )} and optional upSign; received ${describe(input)}.`,
    );
  }
  const { azimuthDegrees, elevationDegrees, pixelsPerUnit, upSign } = input;
  if (
    typeof azimuthDegrees !== "number" ||
    !Number.isFinite(azimuthDegrees) ||
    typeof elevationDegrees !== "number" ||
    !Number.isFinite(elevationDegrees) ||
    typeof pixelsPerUnit !== "number" ||
    !Number.isFinite(pixelsPerUnit) ||
    pixelsPerUnit <= 0 ||
    (upSign !== undefined && upSign !== 1 && upSign !== -1)
  ) {
    throw new RangeError(
      `A panel camera fit must contain finite angles, positive scale, and optional upSign 1 or -1; received ${describe(input)}.`,
    );
  }
  return Object.freeze({
    azimuthDegrees,
    elevationDegrees,
    pixelsPerUnit,
    ...(upSign === undefined ? {} : { upSign }),
  });
}

/** Copies and freezes the fit and raw arrow facts under one printed-panel identity. */
export function createPanelArrowCameraEvidence(input: unknown): PanelArrowCameraEvidence {
  if (!isRecord(input) || !hasExactKeys(input, EVIDENCE_KEYS)) {
    throw new TypeError(
      `Panel arrow camera evidence must contain exactly ${EVIDENCE_KEYS.join(", ")}; received ${describe(input)}.`,
    );
  }
  const { panelStepNumber, faceCorrectedFit: suppliedFit, measurement } = input;
  if (!Number.isSafeInteger(panelStepNumber) || (panelStepNumber as number) < 1) {
    throw new RangeError(
      `Panel arrow camera evidence panelStepNumber must be a positive safe integer; received ${describe(panelStepNumber)}.`,
    );
  }
  return Object.freeze({
    panelStepNumber: panelStepNumber as number,
    faceCorrectedFit: createPanelViewSolution(suppliedFit),
    measurement: createRawPanelArrowMeasurement(measurement),
  });
}

function snapshotArrowDisplacement(input: unknown, index: number): ArrowDisplacement {
  if (!isRecord(input)) {
    throw new TypeError(
      `Arrow-family result ${index} must be an object; received ${describe(input)}.`,
    );
  }
  const { lduX, lduY, lduZ, travelPx, offLineStuds } = input;
  if (![lduX, lduY, lduZ].every(Number.isSafeInteger)) {
    throw new RangeError(
      `Arrow-family result ${index} must have safe-integer lduX, lduY, and lduZ; received ${describe([lduX, lduY, lduZ])}.`,
    );
  }
  if (
    typeof travelPx !== "number" ||
    !Number.isFinite(travelPx) ||
    travelPx < 0 ||
    typeof offLineStuds !== "number" ||
    !Number.isFinite(offLineStuds) ||
    offLineStuds < 0
  ) {
    throw new RangeError(
      `Arrow-family result ${index} must have finite non-negative travelPx and offLineStuds; received ${describe([travelPx, offLineStuds])}.`,
    );
  }
  return Object.freeze({
    lduX: lduX as number,
    lduY: lduY as number,
    lduZ: lduZ as number,
    travelPx,
    offLineStuds,
  });
}

/** Derives q0 once, then applies an exact integer D4 map for the retained registration. */
export function arrowFamilyForRealBuildPanelCameraRegistration(input: {
  readonly evidence: PanelArrowCameraEvidence | null;
  readonly registration: RealBuildPanelCameraRegistration;
  readonly assembly: RealBuildArrowFamilyAssembly;
}): readonly ArrowDisplacement[] {
  if (!isRecord(input) || !hasExactKeys(input, ARROW_FAMILY_INPUT_KEYS)) {
    throw new TypeError(
      `A panel-camera arrow family input must contain exactly ${ARROW_FAMILY_INPUT_KEYS.join(", ")}; received ${describe(input)}.`,
    );
  }
  const { evidence: suppliedEvidence, registration: suppliedRegistration, assembly } = input;
  if (suppliedEvidence === null) return EMPTY_ARROW_FAMILY;
  const evidence = createPanelArrowCameraEvidence(suppliedEvidence);
  const registration = createRealBuildPanelCameraRegistration(suppliedRegistration);
  if (evidence.panelStepNumber !== registration.registrationPanelStepNumber) {
    throw new TypeError(
      `Panel arrow evidence belongs to printed panel ${evidence.panelStepNumber}, but the camera registration belongs to panel ${registration.registrationPanelStepNumber}; derive the family only from the panel that registered this observation.`,
    );
  }
  if (!isRecord(assembly)) {
    throw new TypeError(
      `Arrow-family assembly operations must be an object; received ${describe(assembly)}.`,
    );
  }
  const { panelProjectionForWorkRaster, arrowTravelFamily } = assembly;
  if (
    typeof panelProjectionForWorkRaster !== "function" ||
    typeof arrowTravelFamily !== "function"
  ) {
    throw new TypeError(
      `Arrow-family assembly operations must provide panelProjectionForWorkRaster and arrowTravelFamily functions; received ${describe(assembly)}.`,
    );
  }
  const drawn = Object.freeze({
    xPx: evidence.measurement.displacementXPx,
    yPx: evidence.measurement.displacementYPx,
  });
  const projection = panelProjectionForWorkRaster(
    evidence.faceCorrectedFit,
    evidence.measurement.workFactor,
  );
  const suppliedQ0Family = arrowTravelFamily(
    projection,
    drawn,
    evidence.measurement.travelCeilingPx,
  );
  if (!Array.isArray(suppliedQ0Family)) {
    throw new TypeError(
      `arrowTravelFamily must return an array; received ${describe(suppliedQ0Family)}.`,
    );
  }
  const familyLength = suppliedQ0Family.length;
  if (familyLength > MAXIMUM_ARROW_FAMILY) {
    throw new RangeError(
      `arrowTravelFamily returned ${familyLength} rows; the bounded panel-arrow contract permits at most ${MAXIMUM_ARROW_FAMILY}.`,
    );
  }
  const q0Family: ArrowDisplacement[] = [];
  for (let index = 0; index < familyLength; index += 1) {
    if (!Object.hasOwn(suppliedQ0Family, index)) {
      throw new TypeError(
        `arrowTravelFamily returned a sparse array with no row at index ${index}; required one dense displacement array.`,
      );
    }
    q0Family.push(snapshotArrowDisplacement(suppliedQ0Family[index], index));
  }
  return Object.freeze(
    q0Family.map((entry) =>
      arrowDisplacementForRealBuildPanelCameraRegistration(entry, registration),
    ),
  );
}
