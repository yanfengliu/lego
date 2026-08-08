import { instructionSilhouetteMasks, maskCentroid, shiftedMaskIou } from "./real-build-contract";
import type { StepFailure } from "./real-build-safety";

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

export interface SilhouetteMasks {
  readonly all: Uint8Array;
  readonly probe: Uint8Array;
}

/** The colour the probe part is painted, and the key its silhouette is read at. */
const PROBE_COLOR_ID = "builtin:magenta";
const PROBE_KEY_HEX = 0x923978;

// The browser probe's modules are untrusted dynamic imports; the typed Node
// finalizer recomputes everything they produce.
type BrowserModule = ReturnType<typeof JSON.parse>;

/**
 * A document's silhouette at this step's camera, with some parts keyed apart.
 *
 * `all` is everything drawn and `probe` is only the named parts, which is what
 * lets one render answer both "what does the assembly look like" and "which of
 * those pixels belong to the piece being placed".
 */
export function createStepSilhouette(input: {
  readonly rendering: BrowserModule;
  readonly renderer: { readonly render: (root: unknown, camera: unknown) => ArrayLike<number> };
  readonly view: StepCameraView;
  readonly frame: StepCameraFrame;
  readonly widthPx: number;
  readonly heightPx: number;
}): (
  subject: unknown,
  probePartIds: string | readonly string[] | null,
  centrePx: readonly [number, number],
) => SilhouetteMasks {
  const { rendering, renderer, view, frame, widthPx, heightPx } = input;
  return (subject, probePartIds, centrePx) => {
    const subjectParts = (subject as { parts: { id: string }[] }).parts;
    const probed = new Set(
      probePartIds === null ? [] : typeof probePartIds === "string" ? [probePartIds] : probePartIds,
    );
    const painted = {
      ...(subject as object),
      parts: subjectParts.map((part) =>
        probed.has(part.id) ? { ...part, colorId: PROBE_COLOR_ID } : part,
      ),
    };
    const scene = rendering.deriveBrickScene(painted, { finish: "instruction" });
    let pixels: Uint8Array;
    try {
      rendering.setInstructionSilhouetteMode(scene.root, true);
      const camera = rendering.createOrthographicViewCamera(
        { ...view, centerXPx: centrePx[0], centerYPx: centrePx[1] },
        frame,
      );
      pixels = new Uint8Array(renderer.render(scene.root, camera));
    } finally {
      scene.dispose();
    }
    return instructionSilhouetteMasks(pixels, widthPx, heightPx, PROBE_KEY_HEX);
  };
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
const ANCHOR_TURNS_DEGREES = [0, 90, 180, 270] as const;

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
    const from = maskCentroid(modelMask, widthPx, heightPx);
    if (from === null) continue;
    const shiftedIou = (dx: number, dy: number) =>
      shiftedMaskIou({
        mask: modelMask,
        target: input.builtMask,
        width: widthPx,
        height: heightPx,
        dx,
        dy,
        excluded: input.excludedMask ?? null,
      });
    let here = {
      dx: Math.round(to.x - from.x),
      dy: Math.round(to.y - from.y),
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
