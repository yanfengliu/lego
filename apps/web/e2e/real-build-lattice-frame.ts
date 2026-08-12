import type { FittedPanelView, LatticeHand } from "../src/assembly/panel-face";
import { viewForLatticeHand } from "../src/assembly/panel-face";
import type { ArrowDisplacement } from "./real-build-panel-raster";

export type RealBuildLatticeTurnDegrees = 0 | 90 | 180 | 270;

/** One fully qualified horizontal frame retained with a real-build candidate. */
export interface RealBuildLatticeFrame {
  readonly latticeHand: LatticeHand;
  readonly latticeDeterminant: 1 | -1;
  readonly turnDegrees: RealBuildLatticeTurnDegrees;
  readonly shiftPx: readonly [number, number];
}

const FRAME_KEYS = ["latticeHand", "latticeDeterminant", "shiftPx", "turnDegrees"] as const;
const CANDIDATE_ID_KEYS = ["documentHash", "frame", "stepNumber"] as const;
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

/** Copies, validates, and deeply freezes one frame from an untrusted boundary. */
export function createRealBuildLatticeFrame(input: unknown): RealBuildLatticeFrame {
  if (!isRecord(input) || !hasExactKeys(input, FRAME_KEYS)) {
    throw new TypeError(
      `A real-build lattice frame must be an object with exactly ${FRAME_KEYS.join(
        ", ",
      )}; received ${describe(input)}.`,
    );
  }
  const {
    latticeHand: hand,
    latticeDeterminant: determinant,
    turnDegrees,
    shiftPx: suppliedShift,
  } = input;
  if (hand !== "as-fitted" && hand !== "x-reflected") {
    throw new TypeError(
      `Frame latticeHand must be "as-fitted" or "x-reflected"; received ${describe(hand)}.`,
    );
  }
  if (determinant !== 1 && determinant !== -1) {
    throw new TypeError(
      `Frame latticeDeterminant must be 1 or -1; received ${describe(determinant)}.`,
    );
  }
  const requiredDeterminant = expectedDeterminant(hand);
  if (determinant !== requiredDeterminant) {
    throw new TypeError(
      `Frame latticeHand ${JSON.stringify(hand)} requires latticeDeterminant ${requiredDeterminant}; received ${determinant}.`,
    );
  }
  if (!TURNS.includes(turnDegrees as number)) {
    throw new RangeError(
      `Frame turnDegrees must be one of 0, 90, 180, or 270; received ${describe(turnDegrees)}.`,
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
      `Frame shiftPx must contain exactly two safe integer pixel offsets; received ${describe(shift)}.`,
    );
  }
  const [shiftX, shiftY] = shift;
  if (!Number.isSafeInteger(shiftX) || !Number.isSafeInteger(shiftY)) {
    throw new RangeError(
      `Frame shiftPx must contain exactly two safe integer pixel offsets; received ${describe([
        shiftX,
        shiftY,
      ])}.`,
    );
  }
  const shiftPx = Object.freeze([normalizeZero(shiftX), normalizeZero(shiftY)] as [number, number]);
  return Object.freeze({
    latticeHand: hand,
    latticeDeterminant: determinant,
    turnDegrees: normalizeZero(turnDegrees as number) as RealBuildLatticeTurnDegrees,
    shiftPx,
  });
}

function requireView(input: FittedPanelView): FittedPanelView {
  if (!isRecord(input)) {
    throw new TypeError(`A lattice-frame view must be an object; received ${describe(input)}.`);
  }
  const { azimuthDegrees, elevationDegrees, pixelsPerUnit, upSign } = input;
  const values = { azimuthDegrees, elevationDegrees, pixelsPerUnit };
  for (const field of ["azimuthDegrees", "elevationDegrees", "pixelsPerUnit"] as const) {
    if (typeof values[field] !== "number" || !Number.isFinite(values[field])) {
      throw new TypeError(
        `Lattice-frame view ${field} must be finite; received ${describe(values[field])}.`,
      );
    }
  }
  if (!(pixelsPerUnit > 0)) {
    throw new RangeError(
      `Lattice-frame view pixelsPerUnit must be positive; received ${pixelsPerUnit}.`,
    );
  }
  if (upSign !== undefined && upSign !== 1 && upSign !== -1) {
    throw new TypeError(
      `Lattice-frame view upSign must be 1, -1, or absent; received ${describe(upSign)}.`,
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
export function viewForRealBuildLatticeFrame(
  suppliedView: FittedPanelView,
  suppliedFrame: RealBuildLatticeFrame,
): FittedPanelView {
  const view = requireView(suppliedView);
  const frame = createRealBuildLatticeFrame(suppliedFrame);
  const transformed = viewForLatticeHand(
    { ...view, azimuthDegrees: view.azimuthDegrees + frame.turnDegrees },
    frame.latticeHand,
  );
  return Object.freeze({ ...transformed });
}

/**
 * Re-expresses a q0/as-fitted arrow-family row in one qualified frame.
 *
 * Quarter turns rotate the fitted X/Z basis before the optional hand reversal;
 * applying only the hand would be wrong for every non-zero turn. Travel and
 * off-line error remain measurements of the same projected vector.
 */
export function arrowDisplacementForRealBuildLatticeFrame(
  displacement: ArrowDisplacement,
  suppliedFrame: RealBuildLatticeFrame,
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
  const frame = createRealBuildLatticeFrame(suppliedFrame);
  const [turnedX, turnedZ] =
    frame.turnDegrees === 0
      ? [lduX, lduZ]
      : frame.turnDegrees === 90
        ? [lduZ, -lduX]
        : frame.turnDegrees === 180
          ? [-lduX, -lduZ]
          : [-lduZ, lduX];
  return Object.freeze({
    lduX: normalizeZero(frame.latticeHand === "x-reflected" ? -turnedX : turnedX),
    lduY: normalizeZero(lduY),
    lduZ: normalizeZero(turnedZ),
    travelPx: normalizeZero(travelPx),
    offLineStuds: normalizeZero(offLineStuds),
  });
}

/** A frame-qualified ID; equal document bytes in opposite hands cannot alias. */
export function realBuildFrameCandidateId(input: {
  readonly stepNumber: number;
  readonly documentHash: string;
  readonly frame: RealBuildLatticeFrame;
}): string {
  if (!isRecord(input) || !hasExactKeys(input, CANDIDATE_ID_KEYS)) {
    throw new TypeError(
      `A frame candidate ID input must be an object with exactly ${CANDIDATE_ID_KEYS.join(
        ", ",
      )}; received ${describe(input)}.`,
    );
  }
  const { stepNumber, documentHash, frame: suppliedFrame } = input;
  if (!Number.isSafeInteger(stepNumber) || stepNumber < 1) {
    throw new RangeError(
      `Frame candidate stepNumber must be a positive safe integer; received ${describe(stepNumber)}.`,
    );
  }
  if (typeof documentHash !== "string" || !DIGEST_PATTERN.test(documentHash)) {
    throw new TypeError(
      `Frame candidate documentHash must be a lowercase sha256 digest; received ${describe(
        documentHash,
      )}.`,
    );
  }
  const frame = createRealBuildLatticeFrame(suppliedFrame);
  const [x, y] = frame.shiftPx;
  return (
    `step-${String(stepNumber).padStart(3, "0")}:${documentHash}:frame:` +
    `${frame.latticeHand}:d${frame.latticeDeterminant}:q${String(frame.turnDegrees).padStart(3, "0")}:x${x}:y${y}`
  );
}
