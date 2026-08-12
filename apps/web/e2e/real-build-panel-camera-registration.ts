import type { FittedPanelView, LatticeHand } from "../src/assembly/panel-face";
import { viewForLatticeHand } from "../src/assembly/panel-face";

export interface ArrowDisplacement {
  readonly lduX: number;
  readonly lduY: number;
  readonly lduZ: number;
  readonly travelPx: number;
  readonly offLineStuds: number;
}

export type RealBuildPanelCameraTurnDegrees = 0 | 90 | 180 | 270;

/** One panel-local camera observation. It is never physical transform authority. */
export interface RealBuildPanelCameraRegistration {
  readonly latticeHand: LatticeHand;
  readonly latticeDeterminant: 1 | -1;
  /** Printed panel whose fitted raster gives `turnDegrees` and `shiftPx` meaning. */
  readonly registrationPanelStepNumber: number;
  readonly turnDegrees: RealBuildPanelCameraTurnDegrees;
  readonly shiftPx: readonly [number, number];
}

const REGISTRATION_KEYS = [
  "latticeHand",
  "latticeDeterminant",
  "registrationPanelStepNumber",
  "shiftPx",
  "turnDegrees",
] as const;
const OBSERVATION_ID_KEYS = ["documentHash", "registration", "stepNumber"] as const;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const TURNS: readonly number[] = [0, 90, 180, 270];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function describe(value: unknown): string {
  try {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? String(value) : encoded;
  } catch {
    return Object.prototype.toString.call(value);
  }
}

function hasExactKeys(value: Record<string, unknown>, required: readonly string[]): boolean {
  const actual = Object.keys(value);
  const expected = new Set(required);
  return actual.length === expected.size && actual.every((key) => expected.has(key));
}

function expectedDeterminant(hand: LatticeHand): 1 | -1 {
  return hand === "as-fitted" ? 1 : -1;
}

function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/** Copies, validates, and deeply freezes one panel-local registration. */
export function createRealBuildPanelCameraRegistration(
  input: unknown,
): RealBuildPanelCameraRegistration {
  if (!isRecord(input) || !hasExactKeys(input, REGISTRATION_KEYS)) {
    throw new TypeError(
      `A real-build panel camera registration must be an object with exactly ${REGISTRATION_KEYS.join(
        ", ",
      )}; received ${describe(input)}.`,
    );
  }
  const {
    latticeHand: hand,
    latticeDeterminant: determinant,
    registrationPanelStepNumber,
    turnDegrees,
    shiftPx: suppliedShift,
  } = input;
  if (hand !== "as-fitted" && hand !== "x-reflected") {
    throw new TypeError(
      `Panel camera registration latticeHand must be "as-fitted" or "x-reflected"; received ${describe(hand)}.`,
    );
  }
  if (determinant !== 1 && determinant !== -1) {
    throw new TypeError(
      `Panel camera registration latticeDeterminant must be 1 or -1; received ${describe(determinant)}.`,
    );
  }
  const requiredDeterminant = expectedDeterminant(hand);
  if (determinant !== requiredDeterminant) {
    throw new TypeError(
      `Panel camera registration latticeHand ${JSON.stringify(hand)} requires latticeDeterminant ${requiredDeterminant}; received ${determinant}.`,
    );
  }
  if (
    !Number.isSafeInteger(registrationPanelStepNumber) ||
    (registrationPanelStepNumber as number) < 1
  ) {
    throw new RangeError(
      `Panel camera registration registrationPanelStepNumber must be a positive safe integer; received ${describe(
        registrationPanelStepNumber,
      )}.`,
    );
  }
  const panelStepNumber = registrationPanelStepNumber as number;
  if (!TURNS.includes(turnDegrees as number)) {
    throw new RangeError(
      `Panel camera registration turnDegrees must be one of 0, 90, 180, or 270; received ${describe(turnDegrees)}.`,
    );
  }
  const shift = suppliedShift;
  if (
    !Array.isArray(shift) ||
    shift.length !== 2 ||
    !Object.prototype.hasOwnProperty.call(shift, 0) ||
    !Object.prototype.hasOwnProperty.call(shift, 1)
  ) {
    throw new RangeError(
      `Panel camera registration shiftPx must contain exactly two safe integer pixel offsets; received ${describe(shift)}.`,
    );
  }
  const [shiftX, shiftY] = shift;
  if (!Number.isSafeInteger(shiftX) || !Number.isSafeInteger(shiftY)) {
    throw new RangeError(
      `Panel camera registration shiftPx must contain exactly two safe integer pixel offsets; received ${describe(
        [shiftX, shiftY],
      )}.`,
    );
  }
  const shiftPx = Object.freeze([normalizeZero(shiftX), normalizeZero(shiftY)] as [number, number]);
  return Object.freeze({
    latticeHand: hand,
    latticeDeterminant: determinant,
    registrationPanelStepNumber: panelStepNumber,
    turnDegrees: normalizeZero(turnDegrees as number) as RealBuildPanelCameraTurnDegrees,
    shiftPx,
  });
}

function requireView(input: FittedPanelView): FittedPanelView {
  if (!isRecord(input)) {
    throw new TypeError(`A panel camera view must be an object; received ${describe(input)}.`);
  }
  const { azimuthDegrees, elevationDegrees, pixelsPerUnit, upSign } = input;
  const values = { azimuthDegrees, elevationDegrees, pixelsPerUnit };
  for (const field of ["azimuthDegrees", "elevationDegrees", "pixelsPerUnit"] as const) {
    if (typeof values[field] !== "number" || !Number.isFinite(values[field])) {
      throw new TypeError(
        `Panel camera view ${field} must be finite; received ${describe(values[field])}.`,
      );
    }
  }
  if (!(pixelsPerUnit > 0)) {
    throw new RangeError(
      `Panel camera view pixelsPerUnit must be positive; received ${pixelsPerUnit}.`,
    );
  }
  if (upSign !== undefined && upSign !== 1 && upSign !== -1) {
    throw new TypeError(
      `Panel camera view upSign must be 1, -1, or absent; received ${describe(upSign)}.`,
    );
  }
  return Object.freeze({
    azimuthDegrees,
    elevationDegrees,
    pixelsPerUnit,
    ...(upSign === undefined ? {} : { upSign }),
  });
}

/** Adds the quarter turn before applying the determinant-changing hand transform. */
export function viewForRealBuildPanelCameraRegistration(
  suppliedView: FittedPanelView,
  suppliedRegistration: RealBuildPanelCameraRegistration,
): FittedPanelView {
  const view = requireView(suppliedView);
  const registration = createRealBuildPanelCameraRegistration(suppliedRegistration);
  const transformed = viewForLatticeHand(
    { ...view, azimuthDegrees: view.azimuthDegrees + registration.turnDegrees },
    registration.latticeHand,
  );
  return Object.freeze({ ...transformed });
}

/**
 * Re-expresses a q0/as-fitted arrow-family row for one panel camera registration.
 *
 * Quarter turns rotate the fitted X/Z basis before the optional hand reversal;
 * applying only the hand would be wrong for every non-zero turn. Travel and
 * off-line error remain measurements of the same projected vector.
 */
export function arrowDisplacementForRealBuildPanelCameraRegistration(
  displacement: ArrowDisplacement,
  suppliedRegistration: RealBuildPanelCameraRegistration,
): ArrowDisplacement {
  if (!isRecord(displacement)) {
    throw new TypeError(
      `An arrow displacement must be an object; received ${describe(displacement)}.`,
    );
  }
  const { lduX, lduY, lduZ, travelPx, offLineStuds } = displacement;
  const coordinates = { lduX, lduY, lduZ };
  for (const field of ["lduX", "lduY", "lduZ"] as const) {
    if (!Number.isSafeInteger(coordinates[field])) {
      throw new RangeError(
        `Arrow displacement ${field} must be a safe integer LDU coordinate; received ${describe(
          coordinates[field],
        )}.`,
      );
    }
  }
  const measurements = { travelPx, offLineStuds };
  for (const field of ["travelPx", "offLineStuds"] as const) {
    if (
      typeof measurements[field] !== "number" ||
      !Number.isFinite(measurements[field]) ||
      measurements[field] < 0
    ) {
      throw new RangeError(
        `Arrow displacement ${field} must be a finite non-negative measurement; received ${describe(
          measurements[field],
        )}.`,
      );
    }
  }
  const registration = createRealBuildPanelCameraRegistration(suppliedRegistration);
  const [turnedX, turnedZ] =
    registration.turnDegrees === 0
      ? [lduX, lduZ]
      : registration.turnDegrees === 90
        ? [lduZ, -lduX]
        : registration.turnDegrees === 180
          ? [-lduX, -lduZ]
          : [-lduZ, lduX];
  return Object.freeze({
    lduX: normalizeZero(registration.latticeHand === "x-reflected" ? -turnedX : turnedX),
    lduY: normalizeZero(lduY),
    lduZ: normalizeZero(turnedZ),
    travelPx: normalizeZero(travelPx),
    offLineStuds: normalizeZero(offLineStuds),
  });
}

/** A panel-observation ID; this must not replace a candidate's stable document identity. */
export function realBuildPanelCameraObservationId(input: {
  readonly stepNumber: number;
  readonly documentHash: string;
  readonly registration: RealBuildPanelCameraRegistration;
}): string {
  if (!isRecord(input) || !hasExactKeys(input, OBSERVATION_ID_KEYS)) {
    throw new TypeError(
      `A panel camera observation ID input must be an object with exactly ${OBSERVATION_ID_KEYS.join(
        ", ",
      )}; received ${describe(input)}.`,
    );
  }
  const { stepNumber, documentHash, registration: suppliedRegistration } = input;
  if (!Number.isSafeInteger(stepNumber) || stepNumber < 1) {
    throw new RangeError(
      `Panel camera observation stepNumber must be a positive safe integer; received ${describe(stepNumber)}.`,
    );
  }
  if (typeof documentHash !== "string" || !DIGEST_PATTERN.test(documentHash)) {
    throw new TypeError(
      `Panel camera observation documentHash must be a lowercase sha256 digest; received ${describe(
        documentHash,
      )}.`,
    );
  }
  const registration = createRealBuildPanelCameraRegistration(suppliedRegistration);
  const [x, y] = registration.shiftPx;
  return (
    `step-${String(stepNumber).padStart(3, "0")}:${documentHash}:panel-camera:` +
    `${registration.latticeHand}:d${registration.latticeDeterminant}:p${String(
      registration.registrationPanelStepNumber,
    ).padStart(3, "0")}:q${String(registration.turnDegrees).padStart(3, "0")}:x${x}:y${y}`
  );
}
