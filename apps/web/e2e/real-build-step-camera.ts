import { maskCentroid, shiftedMaskIou } from "./real-build-contract";
import type { StepFailure } from "./real-build-safety";
import type { LatticeHand } from "../src/assembly/panel-face";

export {
  createStepSilhouette,
  isStepSilhouetteCleanupFailure,
  prepareStepSilhouette,
  type PreparedStepSilhouette,
  type SilhouetteMasks,
} from "./real-build-step-silhouette";

/**
 * Where a printed step's camera points, and how a candidate is drawn through it.
 *
 * The panel's stud lattice fixes the camera's scale and its angle only up to a
 * quarter turn, and says nothing about where on the page the drawing sits, so
 * every step has to register its own model against the panel's already-built art
 * before any candidate can be compared. That registration and the render it is
 * measured with are one unit: the same view, the same frame, the same silhouette
 * keying.
 *
 * This docstring used to claim the lattice fixed the angle outright. It does not
 * — see `ANCHOR_TURNS_DEGREES` — and the assumption survived only while the
 * booklet kept the model the same way up.
 *
 * Lifted out of `runRealBuild` because three different gates now draw through
 * it — the per-piece search, the whole-step joint gate, and the step's retained
 * capture — and because the anchoring is a decision procedure with its own
 * named refusal rather than a few lines of the loop body.
 */

export interface StepCameraView {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
  /** `-1` on a panel drawn from underneath: the booklet turned the model over. */
  readonly upSign?: 1 | -1;
}

export interface StepCameraFrame {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly target: readonly [number, number, number];
  readonly sceneRadius: number;
}

export interface StepCameraAnchor {
  readonly centrePx: [number, number];
  readonly anchorIou: number | null;
  readonly anchorShiftPx: [number, number] | null;
  /**
   * The quarter turn the registration chose, in degrees, added to the fitted
   * azimuth. Null when nothing registered.
   */
  readonly anchorTurnDegrees: number | null;
  /** Every quarter turn's agreement, best first, so a near tie is inspectable. */
  readonly anchorTurnIous: readonly { readonly turnDegrees: number; readonly iou: number }[];
  readonly failure: StepFailure | null;
}

export type StepCameraTurnDegrees = 0 | 90 | 180 | 270;

export interface StepCameraLatticeHypothesis {
  readonly latticeHand: LatticeHand;
  /** The horizontal lattice-frame determinant relative to the fitted representative. */
  readonly latticeDeterminant: 1 | -1;
  /** Added to the fitted azimuth before the lattice-hand transform is applied. */
  readonly turnDegrees: StepCameraTurnDegrees;
}

export type StepCameraLatticeAttempt =
  | (StepCameraLatticeHypothesis & {
      readonly status: "scored";
      readonly iou: number;
      readonly shiftPx: readonly [number, number];
      readonly centrePx: readonly [number, number];
    })
  | (StepCameraLatticeHypothesis & {
      readonly status: "empty";
      readonly iou: null;
      readonly shiftPx: null;
      readonly centrePx: null;
    });

export interface StepCameraLatticeRegistration {
  readonly selected: Extract<StepCameraLatticeAttempt, { readonly status: "scored" }> | null;
  /** Every attempted hypothesis, scored best first and empty renders last. */
  readonly rankedHypotheses: readonly StepCameraLatticeAttempt[];
  readonly failure: StepFailure | null;
}

const ANCHOR_SCALES = [8, 3, 1] as const;
const ANCHOR_RADIUS = 4;

/**
 * The quarter turns a panel's own stud lattice cannot separate.
 *
 * Writing the projected lattice basis at azimuth `A` as `a = (cos A, sin e sin
 * A)` and `b = (-sin A, sin e cos A)` gives `a(A + 90) = b(A)` and `b(A + 90) =
 * -a(A)`: a quarter turn permutes the basis and spans the same lattice, so the
 * fit is exactly as good at all four and reports whichever its search reached.
 * The world frame pins which one is *true* only through the branch printed step
 * 1 settled into, and every rotate-the-model icon reopens it, because turning a
 * model over is a half-turn about a horizontal axis whose direction the booklet
 * does not state and which lands in this same coset.
 */
const ANCHOR_TURNS_DEGREES: readonly StepCameraTurnDegrees[] = [0, 90, 180, 270];

const LATTICE_HYPOTHESES: readonly StepCameraLatticeHypothesis[] = Object.freeze([
  ...ANCHOR_TURNS_DEGREES.map((turnDegrees) => ({
    latticeHand: "as-fitted" as const,
    latticeDeterminant: 1 as const,
    turnDegrees,
  })).map((hypothesis) => Object.freeze(hypothesis)),
  ...ANCHOR_TURNS_DEGREES.map((turnDegrees) => ({
    latticeHand: "x-reflected" as const,
    latticeDeterminant: -1 as const,
    turnDegrees,
  })).map((hypothesis) => Object.freeze(hypothesis)),
]);

interface RegisteredMask {
  readonly dx: number;
  readonly dy: number;
  readonly iou: number;
}

function registerModelMask(input: {
  readonly modelMask: Uint8Array;
  readonly builtMask: Uint8Array;
  readonly excludedMask: Uint8Array | null;
  readonly targetCentroid: { readonly x: number; readonly y: number };
  readonly widthPx: number;
  readonly heightPx: number;
}): RegisteredMask | null {
  const from = maskCentroid(input.modelMask, input.widthPx, input.heightPx);
  if (from === null) return null;
  const shiftedIou = (dx: number, dy: number) =>
    shiftedMaskIou({
      mask: input.modelMask,
      target: input.builtMask,
      width: input.widthPx,
      height: input.heightPx,
      dx,
      dy,
      excluded: input.excludedMask,
    });
  let here = {
    dx: Math.round(input.targetCentroid.x - from.x),
    dy: Math.round(input.targetCentroid.y - from.y),
    iou: 0,
  };
  here.iou = shiftedIou(here.dx, here.dy);
  for (const scale of ANCHOR_SCALES) {
    for (let dy = -ANCHOR_RADIUS; dy <= ANCHOR_RADIUS; dy += 1) {
      for (let dx = -ANCHOR_RADIUS; dx <= ANCHOR_RADIUS; dx += 1) {
        const candidate = { dx: here.dx + dx * scale, dy: here.dy + dy * scale };
        const iou = shiftedIou(candidate.dx, candidate.dy);
        if (iou > here.iou) here = { ...candidate, iou };
      }
    }
  }
  return here;
}

function requireMaskLength(
  mask: Uint8Array,
  name: string,
  widthPx: number,
  heightPx: number,
): void {
  const required = widthPx * heightPx;
  if (mask.length !== required) {
    throw new RangeError(
      `${name} contains ${mask.length} pixels, but a ${widthPx}x${heightPx} camera registration requires exactly ${required}.`,
    );
  }
}

function requireFrameDimensions(widthPx: number, heightPx: number): void {
  if (
    !Number.isSafeInteger(widthPx) ||
    widthPx <= 0 ||
    !Number.isSafeInteger(heightPx) ||
    heightPx <= 0
  ) {
    throw new RangeError(
      `Camera registration dimensions must be positive safe integers; received ${widthPx}x${heightPx}.`,
    );
  }
}

/**
 * Registers the model built so far against the panel's already-built art.
 *
 * Two things are unknown and both are resolved here by the same registration.
 * Where on the page the drawing sits, which is a translation, seeded from the
 * centroid difference and refined coarse-to-fine because the centroid is right
 * about the drawing's centre of mass and wrong about its outline wherever the
 * panel draws something the model does not. And which quarter turn of the fitted
 * azimuth the panel is actually at, which the lattice provably cannot say.
 *
 * The turn used to be assumed zero. That is right on a studs-up panel following
 * the branch step 1 settled into — measured on printed steps 2 and 3 of the
 * sample booklet, turn 0 wins at 0.9031 and 0.8898 against runners-up of 0.6946
 * and 0.8276 — and it is wrong the moment the booklet turns the model over.
 * Printed step 4, the first panel this repository ever drew from underneath,
 * registers at **0.8312** at turn 90 against **0.4821** at turn 0.
 *
 * Both are decided on agreement outside the panel's own highlight, because the
 * panel draws this step's part over the model that was already there and neither
 * side is defined inside it. That is not a refinement: on printed step 3,
 * scoring the bite too puts the wrong quarter turn first, 0.6435 against 0.6267,
 * where dropping it puts the right one first at 0.8898 against 0.7762.
 *
 * The model built so far is not a candidate and is not being chosen here: it is
 * already settled by the steps before this one, so the best-registering pose is
 * a measurement of the panel rather than a decision about the build. What can go
 * wrong is a near tie between two turns of a symmetric model, and that is why
 * every turn's agreement is published rather than only the winner's.
 */
export function anchorStepCamera(input: {
  readonly stepNumber: number;
  /** Renders the model built so far at the fitted azimuth plus `turnDegrees`. */
  readonly renderModelMask: (turnDegrees: number) => Uint8Array;
  readonly builtMask: Uint8Array;
  /**
   * Where this panel stopped reporting what was already built — its own
   * highlight — so neither side is scored there. Null scores every pixel.
   */
  readonly excludedMask?: Uint8Array | null;
  readonly widthPx: number;
  readonly heightPx: number;
}): StepCameraAnchor {
  const { widthPx, heightPx } = input;
  const centred: [number, number] = [widthPx / 2, heightPx / 2];
  const refused = (message: string): StepCameraAnchor => ({
    centrePx: centred,
    anchorIou: null,
    anchorShiftPx: null,
    anchorTurnDegrees: null,
    anchorTurnIous: [],
    failure: {
      code: "camera-anchor-failed",
      stage: "camera-registration",
      message: `Step ${input.stepNumber} could not anchor its camera: ${message}`,
    },
  });
  const to = maskCentroid(input.builtMask, widthPx, heightPx);
  if (to === null) {
    return refused(
      `the panel's already-built art is empty after the highlight was removed, so there was nothing to register against.`,
    );
  }

  let best: {
    readonly turnDegrees: number;
    readonly dx: number;
    readonly dy: number;
    readonly iou: number;
  } | null = null;
  const perTurn: { turnDegrees: number; iou: number }[] = [];
  for (const turnDegrees of ANCHOR_TURNS_DEGREES) {
    const modelMask = input.renderModelMask(turnDegrees);
    const here = registerModelMask({
      modelMask,
      builtMask: input.builtMask,
      excludedMask: input.excludedMask ?? null,
      targetCentroid: to,
      widthPx,
      heightPx,
    });
    if (here === null) continue;
    perTurn.push({ turnDegrees, iou: here.iou });
    if (best === null || here.iou > best.iou) best = { turnDegrees, ...here };
  }
  perTurn.sort((left, right) => right.iou - left.iou);
  if (best === null) {
    return refused(
      `the model built so far rendered nothing at any quarter turn of the panel's fitted angles.`,
    );
  }
  return {
    centrePx: [widthPx / 2 + best.dx, heightPx / 2 + best.dy],
    anchorIou: best.iou,
    anchorShiftPx: [best.dx, best.dy],
    anchorTurnDegrees: best.turnDegrees,
    anchorTurnIous: perTurn,
    failure: null,
  };
}

/**
 * Registers both horizontal determinant cosets of a face-corrected panel view.
 *
 * The printed stud lattice is unchanged when its world-X basis is reversed, so
 * a lattice fit cannot decide whether it named the assembly's horizontal hand
 * correctly. This procedure makes that missing state measurable: four proper
 * quarter turns and their four x-reflected counterparts are all rendered and
 * every row retains its own translation. An exact tie is refused rather than
 * settled by enumeration order.
 *
 * This is a binary-silhouette registration contract. A reflected camera also
 * reverses depth, so this procedure does not claim RGB or occlusion equivalence
 * and does not by itself authorize a physical document branch.
 */
export function anchorStepCameraLatticeFrame(input: {
  readonly stepNumber: number;
  readonly renderModelMask: (hypothesis: StepCameraLatticeHypothesis) => Uint8Array;
  readonly builtMask: Uint8Array;
  readonly excludedMask?: Uint8Array | null;
  readonly widthPx: number;
  readonly heightPx: number;
}): StepCameraLatticeRegistration {
  const {
    widthPx,
    heightPx,
    stepNumber,
    renderModelMask,
    builtMask: suppliedBuiltMask,
    excludedMask: suppliedExcludedMask,
  } = input;
  requireFrameDimensions(widthPx, heightPx);
  requireMaskLength(suppliedBuiltMask, "The panel's already-built mask", widthPx, heightPx);
  if (suppliedExcludedMask !== undefined && suppliedExcludedMask !== null) {
    requireMaskLength(suppliedExcludedMask, "The panel's excluded mask", widthPx, heightPx);
  }
  const builtMask = new Uint8Array(suppliedBuiltMask);
  const excludedMask =
    suppliedExcludedMask === undefined || suppliedExcludedMask === null
      ? null
      : new Uint8Array(suppliedExcludedMask);
  const failure = (code: StepFailure["code"], message: string): StepFailure => ({
    code,
    stage: "camera-registration",
    stepNumber,
    message: `Step ${stepNumber} could not resolve its horizontal camera frame: ${message}`,
  });
  const targetCentroid = maskCentroid(builtMask, widthPx, heightPx);
  if (targetCentroid === null) {
    return {
      selected: null,
      rankedHypotheses: [],
      failure: failure(
        "camera-anchor-failed",
        "the panel's already-built art is empty after the highlight was removed, so there was nothing to register against.",
      ),
    };
  }

  const attempts = LATTICE_HYPOTHESES.map((hypothesis): StepCameraLatticeAttempt => {
    const modelMask = renderModelMask(hypothesis);
    requireMaskLength(
      modelMask,
      `The ${hypothesis.latticeHand} turn-${hypothesis.turnDegrees} model mask`,
      widthPx,
      heightPx,
    );
    const registered = registerModelMask({
      modelMask,
      builtMask,
      excludedMask,
      targetCentroid,
      widthPx,
      heightPx,
    });
    if (registered === null) {
      return { ...hypothesis, status: "empty", iou: null, shiftPx: null, centrePx: null };
    }
    return {
      ...hypothesis,
      status: "scored",
      iou: registered.iou,
      shiftPx: [registered.dx, registered.dy],
      centrePx: [widthPx / 2 + registered.dx, heightPx / 2 + registered.dy],
    };
  });
  const hypothesisRank = (attempt: StepCameraLatticeAttempt): number =>
    LATTICE_HYPOTHESES.findIndex(
      (entry) =>
        entry.latticeHand === attempt.latticeHand && entry.turnDegrees === attempt.turnDegrees,
    );
  const rankedHypotheses = Object.freeze(
    [...attempts]
      .sort((left, right) => {
        if (left.status !== right.status) return left.status === "scored" ? -1 : 1;
        if (left.status === "scored" && right.status === "scored" && left.iou !== right.iou) {
          return right.iou - left.iou;
        }
        return hypothesisRank(left) - hypothesisRank(right);
      })
      .map((attempt) =>
        attempt.status === "empty"
          ? Object.freeze(attempt)
          : Object.freeze({
              ...attempt,
              shiftPx: Object.freeze([...attempt.shiftPx] as [number, number]),
              centrePx: Object.freeze([...attempt.centrePx] as [number, number]),
            }),
      ),
  );
  const best = rankedHypotheses.find(
    (attempt): attempt is Extract<StepCameraLatticeAttempt, { readonly status: "scored" }> =>
      attempt.status === "scored",
  );
  if (best === undefined) {
    return {
      selected: null,
      rankedHypotheses,
      failure: failure(
        "camera-anchor-failed",
        "the model built so far rendered nothing in any of the eight hand-and-turn hypotheses.",
      ),
    };
  }
  const leaders = rankedHypotheses.filter(
    (attempt): attempt is Extract<StepCameraLatticeAttempt, { readonly status: "scored" }> =>
      attempt.status === "scored" && attempt.iou === best.iou,
  );
  const leaderHands = new Set(leaders.map(({ latticeHand }) => latticeHand));
  const describe = (attempt: (typeof leaders)[number]): string =>
    `${attempt.latticeHand} turn ${attempt.turnDegrees} at IoU ${attempt.iou} and shift [${attempt.shiftPx.join(
      ",",
    )}]`;
  if (leaderHands.size > 1) {
    return {
      selected: null,
      rankedHypotheses,
      failure: failure(
        "camera-handedness-unresolved",
        `${leaders.map(describe).join(" tied with ")}. Retain all eight frame hypotheses until asymmetric built geometry or another bound panel separates the horizontal hands.`,
      ),
    };
  }
  if (leaders.length > 1) {
    return {
      selected: null,
      rankedHypotheses,
      failure: failure(
        "camera-anchor-failed",
        `${leaders.map(describe).join(" tied with ")}. Retain every tied quarter turn until another bound panel separates them.`,
      ),
    };
  }
  return { selected: best, rankedHypotheses, failure: null };
}
