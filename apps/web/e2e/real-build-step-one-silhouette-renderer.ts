import type { FittedPanelView } from "../src/assembly/panel-face";
import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import {
  createRealBuildPanelCameraRegistration,
  viewForRealBuildPanelCameraRegistration,
} from "./real-build-panel-camera-registration";
import {
  prepareStepSilhouette,
  type StepCameraFrame,
  type StepCameraLatticeHypothesis,
} from "./real-build-step-camera";

type BrowserModule = ReturnType<typeof JSON.parse>;

export interface RealBuildStepOnePreparedMaskRenderer {
  readonly render: (hypothesis: StepCameraLatticeHypothesis) => Uint8Array;
  readonly dispose: () => void;
}

export interface RealBuildStepOnePreparedMaskRendererBoundary {
  readonly owner: object;
  readonly render: RealBuildStepOnePreparedMaskRenderer["render"];
  readonly dispose: RealBuildStepOnePreparedMaskRenderer["dispose"];
}

export type RealBuildStepOneMaskRendererFactory = (input: {
  readonly candidateId: string;
  readonly document: unknown;
}) => RealBuildStepOnePreparedMaskRenderer;

interface RealBuildStepOneMaskRendererMetadata {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly frameWidthPx: number;
  readonly frameHeightPx: number;
  readonly registrationPanelStepNumber: number;
}

const TRUSTED_FACTORIES = new WeakMap<object, RealBuildStepOneMaskRendererMetadata>();
const SAFE_REFLECT_APPLY = Reflect.apply;
const SAFE_OBJECT = Object;
const SAFE_GET_OWN_PROPERTY_DESCRIPTOR = Object.getOwnPropertyDescriptor;

function positiveSafeInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new RangeError(`${field} must be a positive safe integer; received ${String(value)}.`);
  }
  return value as number;
}

function finiteNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be finite; received ${String(value)}.`);
  }
  return value;
}

/** Snapshots the own callable methods of one repository-created prepared renderer. */
export function inspectRealBuildStepOnePreparedMaskRenderer(
  value: unknown,
): RealBuildStepOnePreparedMaskRendererBoundary {
  if (value === null || typeof value !== "object") {
    throw new TypeError("Step-one camera renderer preparation must return an object.");
  }
  let render: PropertyDescriptor | undefined;
  let dispose: PropertyDescriptor | undefined;
  try {
    render = SAFE_REFLECT_APPLY(SAFE_GET_OWN_PROPERTY_DESCRIPTOR, SAFE_OBJECT, [value, "render"]);
    dispose = SAFE_REFLECT_APPLY(SAFE_GET_OWN_PROPERTY_DESCRIPTOR, SAFE_OBJECT, [value, "dispose"]);
  } catch {
    throw new TypeError("Step-one camera renderer methods could not be inspected safely.");
  }
  if (
    render === undefined ||
    dispose === undefined ||
    !("value" in render) ||
    !("value" in dispose) ||
    typeof render.value !== "function" ||
    typeof dispose.value !== "function"
  ) {
    throw new TypeError(
      "Step-one camera renderer preparation must return own data render and dispose functions.",
    );
  }
  return { owner: value, render: render.value, dispose: dispose.value };
}

/**
 * Creates the only renderer factory accepted by the step-1 diagnostic.
 * One factory call derives one child scene; all eight hand/turn hypotheses reuse it.
 */
export function createRealBuildStepOneSilhouetteRendererFactory(input: {
  readonly rendering: BrowserModule;
  readonly renderer: { readonly render: (root: unknown, camera: unknown) => ArrayLike<number> };
  readonly fittedView: FittedPanelView;
  readonly frame: StepCameraFrame;
  readonly centrePx: readonly [number, number];
  readonly widthPx: number;
  readonly heightPx: number;
  readonly registrationPanelStepNumber: number;
}): RealBuildStepOneMaskRendererFactory {
  const suppliedRendering = input.rendering;
  const suppliedRenderer = input.renderer;
  const deriveBrickScene = suppliedRendering?.deriveBrickScene;
  const setInstructionSilhouetteMode = suppliedRendering?.setInstructionSilhouetteMode;
  const createOrthographicViewCamera = suppliedRendering?.createOrthographicViewCamera;
  const renderPixels = suppliedRenderer?.render;
  if (
    typeof deriveBrickScene !== "function" ||
    typeof setInstructionSilhouetteMode !== "function" ||
    typeof createOrthographicViewCamera !== "function" ||
    typeof renderPixels !== "function"
  ) {
    throw new TypeError(
      "Step-one silhouette renderer configuration requires callable scene, silhouette, camera, and render functions.",
    );
  }
  const widthPx = positiveSafeInteger(input.widthPx, "Step-one renderer widthPx");
  const heightPx = positiveSafeInteger(input.heightPx, "Step-one renderer heightPx");
  const suppliedFrame = input.frame;
  const frameWidthPx = positiveSafeInteger(
    suppliedFrame?.widthPx,
    "Step-one renderer frame.widthPx",
  );
  const frameHeightPx = positiveSafeInteger(
    suppliedFrame?.heightPx,
    "Step-one renderer frame.heightPx",
  );
  if (frameWidthPx !== widthPx || frameHeightPx !== heightPx) {
    throw new RangeError(
      `Step-one renderer frame ${frameWidthPx}x${frameHeightPx} must match its ${widthPx}x${heightPx} raster.`,
    );
  }
  const target = suppliedFrame?.target;
  if (target === undefined || target.length !== 3) {
    throw new TypeError("Step-one renderer frame.target must contain exactly three coordinates.");
  }
  const frame = intrinsicRealBuildFreeze({
    widthPx: frameWidthPx,
    heightPx: frameHeightPx,
    target: intrinsicRealBuildFreeze([
      finiteNumber(target[0], "Step-one renderer frame.target[0]"),
      finiteNumber(target[1], "Step-one renderer frame.target[1]"),
      finiteNumber(target[2], "Step-one renderer frame.target[2]"),
    ] as [number, number, number]),
    sceneRadius: finiteNumber(suppliedFrame.sceneRadius, "Step-one renderer frame.sceneRadius"),
  });
  if (frame.sceneRadius <= 0) {
    throw new RangeError(
      `Step-one renderer frame.sceneRadius must be positive; received ${frame.sceneRadius}.`,
    );
  }
  const suppliedCentre = input.centrePx;
  if (suppliedCentre.length !== 2) {
    throw new TypeError("Step-one renderer centrePx must contain exactly two coordinates.");
  }
  const centrePx = intrinsicRealBuildFreeze([
    finiteNumber(suppliedCentre[0], "Step-one renderer centrePx[0]"),
    finiteNumber(suppliedCentre[1], "Step-one renderer centrePx[1]"),
  ] as [number, number]);
  const registrationPanelStepNumber = positiveSafeInteger(
    input.registrationPanelStepNumber,
    "Step-one renderer registrationPanelStepNumber",
  );
  const zeroRegistration = createRealBuildPanelCameraRegistration({
    latticeHand: "as-fitted",
    latticeDeterminant: 1,
    registrationPanelStepNumber,
    turnDegrees: 0,
    shiftPx: [0, 0],
  });
  const fittedView = viewForRealBuildPanelCameraRegistration(
    intrinsicRealBuildFreeze({ ...input.fittedView }),
    zeroRegistration,
  );
  const rendering = intrinsicRealBuildFreeze({
    deriveBrickScene(document: unknown, options: unknown): unknown {
      return SAFE_REFLECT_APPLY(deriveBrickScene, suppliedRendering, [document, options]);
    },
    setInstructionSilhouetteMode(root: unknown, enabled: boolean): unknown {
      return SAFE_REFLECT_APPLY(setInstructionSilhouetteMode, suppliedRendering, [root, enabled]);
    },
    createOrthographicViewCamera(view: unknown, suppliedCameraFrame: unknown): unknown {
      return SAFE_REFLECT_APPLY(createOrthographicViewCamera, suppliedRendering, [
        view,
        suppliedCameraFrame,
      ]);
    },
  });
  const renderer = intrinsicRealBuildFreeze({
    render(root: unknown, camera: unknown): ArrayLike<number> {
      return SAFE_REFLECT_APPLY(renderPixels, suppliedRenderer, [root, camera]);
    },
  });
  const factory: RealBuildStepOneMaskRendererFactory = ({ document }) => {
    const prepared = prepareStepSilhouette({
      rendering,
      renderer,
      subject: document,
      probePartIds: null,
      frame,
      widthPx,
      heightPx,
    });
    return intrinsicRealBuildFreeze({
      render(hypothesis: StepCameraLatticeHypothesis): Uint8Array {
        const registration = createRealBuildPanelCameraRegistration({
          ...hypothesis,
          registrationPanelStepNumber,
          shiftPx: [0, 0],
        });
        const view = viewForRealBuildPanelCameraRegistration(fittedView, registration);
        return prepared.render(view, centrePx).all;
      },
      dispose(): void {
        prepared.dispose();
      },
    });
  };
  TRUSTED_FACTORIES.set(
    factory,
    intrinsicRealBuildFreeze({
      widthPx,
      heightPx,
      frameWidthPx,
      frameHeightPx,
      registrationPanelStepNumber,
    }),
  );
  return factory;
}

/** Prevents a caller callback from claiming scene reuse or a raster binding it does not own. */
export function requireRealBuildStepOneMaskRendererFactory(
  value: unknown,
  source: {
    readonly widthPx: number;
    readonly heightPx: number;
    readonly registrationPanelStepNumber: number;
  },
): RealBuildStepOneMaskRendererFactory {
  const metadata = typeof value === "function" ? TRUSTED_FACTORIES.get(value) : undefined;
  if (metadata === undefined) {
    throw new TypeError(
      "Step-one compiled camera diagnostic requires the exact renderer factory returned by createRealBuildStepOneSilhouetteRendererFactory.",
    );
  }
  if (
    metadata.widthPx !== source.widthPx ||
    metadata.heightPx !== source.heightPx ||
    metadata.frameWidthPx !== source.widthPx ||
    metadata.frameHeightPx !== source.heightPx ||
    metadata.registrationPanelStepNumber !== source.registrationPanelStepNumber
  ) {
    throw new RangeError(
      `Step-one renderer factory is bound to raster ${metadata.widthPx}x${metadata.heightPx}, frame ${metadata.frameWidthPx}x${metadata.frameHeightPx}, panel ${metadata.registrationPanelStepNumber}; the detached source requires raster and frame ${source.widthPx}x${source.heightPx}, panel ${source.registrationPanelStepNumber}.`,
    );
  }
  return value as RealBuildStepOneMaskRendererFactory;
}
