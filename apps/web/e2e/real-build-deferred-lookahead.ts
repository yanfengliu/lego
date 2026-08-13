import { instructionSilhouetteMasks, maskCentroid } from "./real-build-contract";
import type { DeferralEvidence } from "./real-build-deferral";
import type { FartherPlacementWitness } from "./real-build-farther-panel-types";
import type { RuntimeBrickIdentity } from "./real-build-fixed-actions";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import type { RealBuildOptions, RealBuildPanelSpec, StepFailure } from "./real-build-safety";
import { anchorStepCamera } from "./real-build-step-camera";
import { classifyRealBuildLookaheadMeasure } from "./real-build-lookahead-measure";

// The browser probe's modules are untrusted dynamic imports; the typed Node
// finalizer recomputes everything they produce.
type BrowserModule = ReturnType<typeof JSON.parse>;

type LookaheadCameraEvidence = Pick<
  DeferralEvidence,
  | "lookaheadUpSign"
  | "lookaheadMeasure"
  | "lookaheadTurnDegrees"
  | "lookaheadTurnAnchorIou"
  | "lookaheadTurnMargin"
>;

type DeferredLookaheadFailure = {
  readonly ready: false;
  readonly failure: StepFailure;
};

type DeferredLookaheadReady = {
  readonly ready: true;
  readonly width: number;
  readonly height: number;
  readonly builtMask: Uint8Array;
  readonly excludedMask: Uint8Array;
  readonly builtCentroid: ReturnType<typeof maskCentroid>;
  readonly lookaheadBuiltPixels: number;
  readonly measure: NonNullable<DeferralEvidence["lookaheadMeasure"]>;
  readonly cameraEvidence: LookaheadCameraEvidence;
  readonly turnDegrees: number;
  readonly renderer: { readonly dispose: () => void };
  readonly renderSilhouetteAt: (
    subject: unknown,
    turnDegrees: number,
  ) => { readonly mask: Uint8Array; readonly pixels: Uint8Array };
};

export type DeferredLookaheadPreparation = DeferredLookaheadFailure | DeferredLookaheadReady;

export interface DeferredUnresolvedCandidate<D> {
  readonly candidateId: string;
  readonly document: D;
  readonly documentHash: string;
  readonly partIds: readonly string[];
  readonly stepId: string | null;
  readonly registrations: readonly RuntimeBrickIdentity[];
  readonly pieces: readonly FartherPlacementWitness[];
  readonly lookaheadAgreement: number;
  /** Registration applied when measuring the lookahead agreement. */
  readonly lookaheadShiftPx: readonly [number, number];
  /**
   * Exact silhouette render whose pixels produced `lookaheadAgreement`.
   *
   * Null only outside the bounded retained subset. The document/hash/witness
   * row remains authoritative for every candidate; this image exists so a
   * reviewer can inspect the score-bearing production render without causing
   * a fresh render after a later aggregate-budget refusal.
   */
  readonly lookaheadPixels: Uint8Array | null;
}

/**
 * Prepare the exact score-bearing view of the panel that settles a deferred step.
 *
 * The renderer is created before candidate enumeration, matching the decision
 * procedure's observable ordering, and ownership transfers to the caller only
 * on success. Every failure after creation disposes it here.
 */
export function prepareDeferredLookahead(input: {
  readonly spec: RealBuildPanelSpec;
  readonly lookahead: {
    readonly spec: RealBuildPanelSpec;
    readonly evidence: PanelRasterEvidence;
  };
  readonly options: RealBuildOptions;
  readonly baseDocument: unknown;
  readonly rendering: BrowserModule;
}): DeferredLookaheadPreparation {
  const { spec, lookahead, options, rendering } = input;

  // The settling panel's own camera, face and all. `faceCorrectedFit` carries
  // the `upSign` the booklet's rotate-the-model icon implies and this used to
  // drop it, which renders every candidate upright: right on a studs-up panel
  // and the opposite side of the drawing on an underside one. A deferral crosses
  // printed pages by construction, so the settling panel's face is not the
  // deferring step's face and cannot be assumed.
  const corrected = lookahead.evidence.faceCorrectedFit as
    (typeof lookahead.evidence.faceCorrectedFit & { readonly upSign?: 1 | -1 }) | null;
  const view =
    corrected === null
      ? null
      : {
          azimuthDegrees: corrected.azimuthDegrees,
          elevationDegrees: corrected.elevationDegrees,
          pixelsPerUnit: corrected.pixelsPerUnit / options.workFactor,
          upSign: corrected.upSign ?? (1 as const),
        };
  if (view === null) {
    return {
      ready: false,
      failure: {
        code: "deferred-panel-unscored",
        stage: "evidence",
        stepNumber: spec.stepNumber,
        message:
          `Step ${spec.stepNumber} deferred to printed step ${lookahead.spec.stepNumber}, which has no ` +
          `face-corrected camera (fit ${JSON.stringify(lookahead.evidence.fitFailure)}, face ` +
          `${JSON.stringify(lookahead.spec.panelFace)}). A candidate rendered at an unknown angle or face is ` +
          `compared against a different picture than the one printed.`,
      },
    };
  }

  // Whether the lookahead panel can say where it stopped drawing what this step
  // built — asked before anything is enumerated or rendered, because it is a
  // fact about the printed page rather than about any candidate.
  //
  // The agreement this deferral is decided by is defined on panel N+1's art
  // *minus the region its own new pieces occupy*, and that region comes from the
  // filled highlight. A panel whose highlight contour does not close yields a
  // stroke and no filled region, so nothing but a thin outline is removed and
  // the pieces panel N+1 places are left inside the art step N is required to
  // explain.
  //
  // That used to be a refusal, and it is the wrong verdict for the same reason
  // printed step 5's `highlight-reuse-unexplained` was: it is arithmetically
  // correct about a question the panel does not answer. About half of this
  // booklet's contours are open, so a lookahead that can only read a closed one
  // cannot settle the booklet. What the open case changes is not whether the
  // panel is evidence but what the evidence says: `builtMask` is then a superset
  // of what any step-N candidate can draw, so the candidate has to be *contained*
  // in it rather than equal to it, and the term that charges a candidate for
  // pixels no candidate could own is dropped. The separation margin still has to
  // be cleared either way.
  const measure = classifyRealBuildLookaheadMeasure(lookahead.evidence.highlight).measure;

  const { width, height, builtMask, highlight } = lookahead.evidence;
  const excludedMask = new Uint8Array(width * height);
  let lookaheadBuiltPixels = 0;
  for (let index = 0; index < excludedMask.length; index += 1) {
    excludedMask[index] = highlight.mask[index] === 1 || highlight.strokeMask[index] === 1 ? 1 : 0;
    if (builtMask[index] === 1) lookaheadBuiltPixels += 1;
  }
  const builtCentroid = maskCentroid(builtMask, width, height);
  const frame = {
    widthPx: width,
    heightPx: height,
    target: [0, 0, 0] as [number, number, number],
    sceneRadius: 60,
  };

  const renderer = rendering.createInstructionRenderer({ width, height });
  const renderSilhouetteAt = (
    subject: unknown,
    turnDegrees: number,
  ): { readonly mask: Uint8Array; readonly pixels: Uint8Array } => {
    const scene = rendering.deriveBrickScene(subject, { finish: "instruction" });
    try {
      rendering.setInstructionSilhouetteMode(scene.root, true);
      const camera = rendering.createOrthographicViewCamera(
        {
          ...view,
          azimuthDegrees: view.azimuthDegrees + turnDegrees,
          centerXPx: width / 2,
          centerYPx: height / 2,
        },
        frame,
      );
      const pixels = new Uint8Array(renderer.render(scene.root, camera));
      return {
        mask: instructionSilhouetteMasks(pixels, width, height, 0x923978).all,
        pixels,
      };
    } finally {
      scene.dispose();
    }
  };
  const silhouetteAt = (subject: unknown, turnDegrees: number): Uint8Array =>
    renderSilhouetteAt(subject, turnDegrees).mask;

  // Which quarter turn of the settling panel's fitted azimuth it is actually
  // drawn at. The lattice provably cannot say — a quarter turn permutes the
  // projected basis and spans the same lattice — and this deferral used to
  // assume zero, which is right only while the booklet keeps the model the same
  // way up between the deferring step and the one that settles it.
  //
  // Resolved the way `anchorStepCamera` resolves it on a step's own panel: by
  // registering the prefix that is already settled against the panel's
  // already-built art, outside that panel's own highlight. The prefix is not a
  // candidate and is not being chosen here, so the best-registering turn is a
  // measurement of the panel rather than a decision about the build.
  //
  // With nothing built there is nothing to register, and turn zero is not a
  // guess but a definition: all four turns are equally valid world frames and
  // the branch the first printed step settles into is what fixes which one every
  // later step is relative to.
  const basePartCount = (input.baseDocument as { parts: readonly unknown[] }).parts.length;
  let turnDegrees = 0;
  let turnAnchorIou: number | null = null;
  let turnMargin: number | null = null;
  if (basePartCount > 0) {
    const anchored = anchorStepCamera({
      stepNumber: spec.stepNumber,
      renderModelMask: (turn) => silhouetteAt(input.baseDocument, turn),
      builtMask,
      excludedMask,
      widthPx: width,
      heightPx: height,
    });
    if (anchored.failure !== null || anchored.anchorTurnDegrees === null) {
      renderer.dispose();
      return {
        ready: false,
        failure: anchored.failure ?? {
          code: "camera-anchor-failed",
          stage: "camera-registration",
          stepNumber: spec.stepNumber,
          message:
            `Step ${spec.stepNumber} deferred to printed step ${lookahead.spec.stepNumber} and could not ` +
            `resolve which quarter turn that panel is drawn at.`,
        },
      };
    }
    turnDegrees = anchored.anchorTurnDegrees;
    turnAnchorIou = anchored.anchorIou;
    turnMargin =
      anchored.anchorTurnIous.length > 1
        ? anchored.anchorTurnIous[0]!.iou - anchored.anchorTurnIous[1]!.iou
        : null;
  }
  const cameraEvidence = {
    lookaheadUpSign: view.upSign,
    lookaheadMeasure: measure,
    lookaheadTurnDegrees: turnDegrees,
    lookaheadTurnAnchorIou: turnAnchorIou,
    lookaheadTurnMargin: turnMargin,
  } as const;

  return {
    ready: true,
    width,
    height,
    builtMask,
    excludedMask,
    builtCentroid,
    lookaheadBuiltPixels,
    measure,
    cameraEvidence,
    turnDegrees,
    renderer,
    renderSilhouetteAt,
  };
}
