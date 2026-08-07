import { instructionSilhouetteMasks, maskCentroid, shiftedMaskIou } from "./real-build-contract";
import type { StepFailure } from "./real-build-safety";

/**
 * Where a printed step's camera points, and how a candidate is drawn through it.
 *
 * The panel's stud lattice fixes the camera's angle and scale but says nothing
 * about where on the page the drawing sits, so every step has to register its
 * own model against the panel's already-built art before any candidate can be
 * compared. That registration and the render it is measured with are one unit:
 * the same view, the same frame, the same silhouette keying.
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
  readonly failure: StepFailure | null;
}

const ANCHOR_SCALES = [8, 3, 1] as const;
const ANCHOR_RADIUS = 4;

/**
 * Registers the model built so far against the panel's already-built art.
 *
 * Seeded from the centroid difference and refined coarse-to-fine, because the
 * centroid is right about the drawing's centre of mass and wrong about its
 * outline wherever the panel draws something the model does not.
 */
export function anchorStepCamera(input: {
  readonly stepNumber: number;
  readonly modelMask: Uint8Array;
  readonly builtMask: Uint8Array;
  readonly widthPx: number;
  readonly heightPx: number;
}): StepCameraAnchor {
  const { widthPx, heightPx } = input;
  const centred: [number, number] = [widthPx / 2, heightPx / 2];
  const from = maskCentroid(input.modelMask, widthPx, heightPx);
  const to = maskCentroid(input.builtMask, widthPx, heightPx);
  if (from === null || to === null) {
    return {
      centrePx: centred,
      anchorIou: null,
      anchorShiftPx: null,
      failure: {
        code: "camera-anchor-failed",
        stage: "camera-registration",
        message:
          `Step ${input.stepNumber} could not anchor its camera: ` +
          (from === null
            ? `the model built so far rendered nothing at the panel's fitted angles.`
            : `the panel's already-built art is empty after the highlight was removed, so there was nothing to register against.`),
      },
    };
  }
  const shiftedIou = (dx: number, dy: number) =>
    shiftedMaskIou({
      mask: input.modelMask,
      target: input.builtMask,
      width: widthPx,
      height: heightPx,
      dx,
      dy,
    });
  let best = {
    dx: Math.round(to.x - from.x),
    dy: Math.round(to.y - from.y),
    iou: 0,
  };
  best.iou = shiftedIou(best.dx, best.dy);
  for (const scale of ANCHOR_SCALES) {
    for (let dy = -ANCHOR_RADIUS; dy <= ANCHOR_RADIUS; dy += 1) {
      for (let dx = -ANCHOR_RADIUS; dx <= ANCHOR_RADIUS; dx += 1) {
        const candidate = { dx: best.dx + dx * scale, dy: best.dy + dy * scale };
        const iou = shiftedIou(candidate.dx, candidate.dy);
        if (iou > best.iou) best = { ...candidate, iou };
      }
    }
  }
  return {
    centrePx: [widthPx / 2 + best.dx, heightPx / 2 + best.dy],
    anchorIou: best.iou,
    anchorShiftPx: [best.dx, best.dy],
    failure: null,
  };
}
