import { instructionSilhouetteMasks } from "./real-build-contract";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import type { StepCameraFrame, StepCameraView } from "./real-build-step-camera";

/** The colour the probe part is painted, and the key its silhouette is read at. */
const PROBE_COLOR_ID = "builtin:magenta";
const PROBE_KEY_HEX = 0x923978;
const STEP_SILHOUETTE_CLEANUP_FAILURES = new WeakSet<object>();

// Browser probe modules are untrusted dynamic imports; Node recomputes their output.
type BrowserModule = ReturnType<typeof JSON.parse>;

export interface SilhouetteMasks {
  readonly all: Uint8Array;
  readonly probe: Uint8Array;
}

export interface PreparedStepSilhouette {
  readonly render: (view: StepCameraView, centrePx: readonly [number, number]) => SilhouetteMasks;
  readonly dispose: () => void;
}

function stepSilhouetteCleanupFailure(message: string): TypeError {
  const failure = new TypeError(message);
  STEP_SILHOUETTE_CLEANUP_FAILURES.add(failure);
  return failure;
}

/** Identifies a repository-created failure that requires discarding the render context. */
export function isStepSilhouetteCleanupFailure(value: unknown): value is TypeError {
  return value !== null && typeof value === "object" && STEP_SILHOUETTE_CLEANUP_FAILURES.has(value);
}

/**
 * Derives and paints one instruction scene, then renders any number of camera views through it.
 * The renderer owns a reusable readback buffer, so every render is copied before it is returned.
 */
export function prepareStepSilhouette(input: {
  readonly rendering: BrowserModule;
  readonly renderer: { readonly render: (root: unknown, camera: unknown) => ArrayLike<number> };
  readonly subject: unknown;
  readonly probePartIds: string | readonly string[] | null;
  readonly frame: StepCameraFrame;
  readonly widthPx: number;
  readonly heightPx: number;
}): PreparedStepSilhouette {
  const { rendering, renderer, subject, probePartIds, frame, widthPx, heightPx } = input;
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
  let disposed = false;
  try {
    rendering.setInstructionSilhouetteMode(scene.root, true);
  } catch (error) {
    try {
      scene.dispose();
    } catch {
      throw stepSilhouetteCleanupFailure(
        "Step silhouette setup failed and its partially prepared scene could not be disposed; discard the task-owned render context.",
      );
    }
    throw error;
  }
  return intrinsicRealBuildFreeze({
    render(view: StepCameraView, centrePx: readonly [number, number]): SilhouetteMasks {
      if (disposed) {
        throw new TypeError("A disposed prepared step silhouette cannot render another view.");
      }
      const camera = rendering.createOrthographicViewCamera(
        { ...view, centerXPx: centrePx[0], centerYPx: centrePx[1] },
        frame,
      );
      const pixels = new Uint8Array(renderer.render(scene.root, camera));
      return instructionSilhouetteMasks(pixels, widthPx, heightPx, PROBE_KEY_HEX);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      scene.dispose();
    },
  });
}

/** One-shot compatibility wrapper for call sites that render unrelated subjects. */
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
    const prepared = prepareStepSilhouette({
      rendering,
      renderer,
      subject,
      probePartIds,
      frame,
      widthPx,
      heightPx,
    });
    try {
      return prepared.render(view, centrePx);
    } finally {
      prepared.dispose();
    }
  };
}
