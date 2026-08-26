import { instructionSilhouetteMasks, maskCentroid } from "./real-build-contract";
import { registerPrefixAgreement } from "./real-build-deferral";
import type { FartherPanelObservationInput } from "./real-build-farther-panel-types";
import type { PanelRasterEvidence } from "./real-build-panel-raster";
import { rgbaPngDataUrl, type PreparedRealBuildModules } from "./real-build-browser-preflight";
import type { RealBuildOptions, RealBuildPanelRasterSpec } from "./real-build-safety";
import { anchorStepCamera } from "./real-build-step-camera";

export interface FartherPanelScoreResult {
  readonly observation: FartherPanelObservationInput;
  readonly candidatePngs: readonly { readonly candidateId: string; readonly png: string }[];
}

const correctedView = (
  evidence: PanelRasterEvidence,
  options: RealBuildOptions,
): {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
  readonly upSign: 1 | -1;
} | null => {
  const corrected = evidence.faceCorrectedFit as
    (NonNullable<PanelRasterEvidence["faceCorrectedFit"]> & { readonly upSign?: 1 | -1 }) | null;
  return corrected === null
    ? null
    : {
        azimuthDegrees: corrected.azimuthDegrees,
        elevationDegrees: corrected.elevationDegrees,
        pixelsPerUnit: corrected.pixelsPerUnit / options.workFactor,
        upSign: corrected.upSign ?? 1,
      };
};

const frameFor = (evidence: PanelRasterEvidence) => ({
  widthPx: evidence.width,
  heightPx: evidence.height,
  target: [0, 0, 0] as const,
  sceneRadius: 60,
});

/** Scores exact documents against one farther panel using one base-bound quarter turn. */
export function scoreFartherDocumentsAgainstPanel<D>(input: {
  readonly spec: RealBuildPanelRasterSpec;
  readonly evidence: PanelRasterEvidence;
  readonly anchorDocument: D;
  readonly candidates: readonly { readonly candidateId: string; readonly document: D }[];
  readonly reservedPanelRenders: number;
  readonly subject?: "origin" | "frontier";
  /** A farther origin is a strict prefix even when K's own highlight closes. */
  readonly measure?: "iou" | "containment";
  readonly options: RealBuildOptions;
  readonly rendering: PreparedRealBuildModules["rendering"];
}): FartherPanelScoreResult {
  const { spec, evidence, rendering } = input;
  if (
    !Number.isSafeInteger(input.reservedPanelRenders) ||
    input.reservedPanelRenders !== input.candidates.length
  ) {
    throw new RangeError(
      `Panel ${spec.stepNumber} reserved ${input.reservedPanelRenders} candidate renders for ` +
        `${input.candidates.length} exact candidates; required one pre-reserved render per score row.`,
    );
  }
  const view = correctedView(evidence, input.options);
  if (view === null) {
    return {
      observation: {
        stepNumber: spec.stepNumber,
        status: "not-observable",
        reason: "camera-unresolved",
      },
      candidatePngs: [],
    };
  }
  const { width, height, builtMask, highlight } = evidence;
  const builtCentroid = maskCentroid(builtMask, width, height);
  if (builtCentroid === null) {
    return {
      observation: {
        stepNumber: spec.stepNumber,
        status: "not-observable",
        reason: "no-built-art",
      },
      candidatePngs: [],
    };
  }
  const excludedMask = new Uint8Array(width * height);
  let filledHighlightPixels = 0;
  for (let index = 0; index < excludedMask.length; index += 1) {
    excludedMask[index] = highlight.mask[index] === 1 || highlight.strokeMask[index] === 1 ? 1 : 0;
    if (highlight.mask[index] === 1 && highlight.strokeMask[index] !== 1)
      filledHighlightPixels += 1;
  }
  const measure = input.measure ?? (filledHighlightPixels === 0 ? "containment" : "iou");
  const frame = frameFor(evidence);
  const renderer = rendering.createInstructionRenderer({ width, height });
  try {
    const renderSilhouetteAt = (
      subject: D,
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
    const anchored = anchorStepCamera({
      stepNumber: spec.stepNumber,
      renderModelMask: (turnDegrees) => renderSilhouetteAt(input.anchorDocument, turnDegrees).mask,
      builtMask,
      excludedMask,
      widthPx: width,
      heightPx: height,
    });
    if (anchored.failure !== null || anchored.anchorTurnDegrees === null) {
      return {
        observation: {
          stepNumber: spec.stepNumber,
          status: "not-observable",
          reason: "camera-unresolved",
        },
        candidatePngs: [],
      };
    }
    const turnDegrees = anchored.anchorTurnDegrees;
    const scores: { candidateId: string; agreement: number }[] = [];
    const candidatePngs: { candidateId: string; png: string }[] = [];
    for (const candidate of input.candidates) {
      const scoreRender = renderSilhouetteAt(candidate.document, turnDegrees);
      const from = maskCentroid(scoreRender.mask, width, height);
      const agreement =
        from === null
          ? { agreement: 0, shiftPx: [0, 0] as const }
          : registerPrefixAgreement({
              candidateMask: scoreRender.mask,
              builtMask,
              excludedMask,
              width,
              height,
              seedPx: [builtCentroid.x - from.x, builtCentroid.y - from.y],
              measure,
            });
      scores.push({ candidateId: candidate.candidateId, agreement: agreement.agreement });
      candidatePngs.push({
        candidateId: candidate.candidateId,
        png: rgbaPngDataUrl(scoreRender.pixels, width, height),
      });
    }
    return {
      observation: {
        stepNumber: spec.stepNumber,
        status: "scored",
        subject: input.subject ?? "frontier",
        scores: Object.freeze(scores),
      },
      candidatePngs: Object.freeze(candidatePngs),
    };
  } finally {
    renderer.dispose();
  }
}
