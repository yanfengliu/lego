import type { PageShape } from "../src/instructions/page-shapes";
import type { PanelCalloutBox, StepPanel } from "../src/instructions/step-panels";

import type { PanelEvidenceEntry } from "./real-build-panel-evidence";
import type {
  TransitionClassifier,
  TransitionClassifierProposal,
  TransitionPanelEvidence,
} from "./real-build-transition-classification";

/**
 * What can be read off a printed panel without rendering it, and the classifier
 * that decides from that alone.
 *
 * Measured on 6651557 (224 pages, 359 printed steps): the brick artwork is
 * raster — every assembly arrives as `paintImageXObject` — so the yellow
 * "this is the part that moves" outline, the leader lines and the placement
 * arrows are invisible to the vector layer. What the vector layer does carry is
 * page chrome, and one piece of chrome is decisive: the rotate-the-model icon,
 * drawn as a white 44.937pt square with a black glyph over it.
 *
 * That icon is *not* the transition kind. It appears on 43 printed steps of
 * this booklet, and most of those also print piece callouts, so it annotates
 * the viewpoint of an ordinary building step rather than naming an action.
 * Reading it as "this step is a rotation" would mislabel placement steps. It is
 * recorded as evidence in the notes and deliberately not used as the decision.
 *
 * The consequence, stated plainly: this classifier cannot tell a rotation-only
 * step from an attachment, because the only cues that separate them are in the
 * raster. On this booklet that costs nothing — every zero-callout panel is a
 * placement — but on a booklet with rotation-only steps it would be wrong, and
 * the fix is the model seam, not a cleverer reading of the vector layer.
 */

/** Exact side of the rotate-the-model chrome icon, measured across all 43 in this booklet. */
export const ROTATION_ICON_SIDE_PT = 44.937;
export const ROTATION_ICON_SIDE_TOLERANCE_PT = 0.5;
export const ROTATION_ICON_FILL_HEX = "#ffffff";

export const DETERMINISTIC_TRANSITION_CLASSIFIER_ID =
  "lego.deterministic-transition-classifier/1" as const;

/** Which face of the assembly a printed panel is drawn from. */
export type PanelFace = "studs-up" | "underside";

/**
 * The face printed step 1 is drawn from, and the seed of the whole toggle.
 *
 * It is an assumption, not a measurement: a booklet could open on an inverted
 * subassembly. It is stated here so it can be checked rather than believed —
 * `derivePanelFaces` returns the seed it used, and a vision judgement of any
 * one panel fixes the phase of every other by parity.
 */
export const FIRST_PANEL_FACE: PanelFace = "studs-up";

export interface TransitionPanelFeatures extends TransitionPanelEvidence {
  /** The booklet's rotate-the-model icon is drawn inside this panel. */
  readonly rotationIconPresent: boolean;
  /**
   * Which face this panel is drawn from, as a running toggle of the icon.
   *
   * The booklet builds this set partly upside down and prints the icon at each
   * turn, so the icon is a viewpoint change and not an action: the panel it is
   * printed on is already drawn from the new face. A loop that ignores it
   * renders candidates against the opposite side of the printed drawing from
   * step 4 onward, and no frame or identification can recover that.
   */
  readonly panelFace: PanelFace;
}

/**
 * Folds the icon into a face per step, in printed order.
 *
 * Separate from the feature derivation because the fold is the claim worth
 * testing on its own: it needs only the icon flags and the seed, so it can be
 * checked against a blind reading of the panels without a PDF in the room.
 */
export function derivePanelFaces(
  steps: readonly { readonly stepNumber: number; readonly rotationIconPresent: boolean }[],
  seed: PanelFace = FIRST_PANEL_FACE,
): readonly { readonly stepNumber: number; readonly panelFace: PanelFace }[] {
  let face = seed;
  return [...steps]
    .sort((left, right) => left.stepNumber - right.stepNumber)
    .map((step) => {
      if (step.rotationIconPresent) face = face === "studs-up" ? "underside" : "studs-up";
      return { stepNumber: step.stepNumber, panelFace: face };
    });
}

function isRotationIcon(shape: PageShape): boolean {
  if (shape.fillHex !== ROTATION_ICON_FILL_HEX) return false;
  const width = shape.bounds.maxXPt - shape.bounds.minXPt;
  const height = shape.bounds.maxYPt - shape.bounds.minYPt;
  return (
    Math.abs(width - ROTATION_ICON_SIDE_PT) <= ROTATION_ICON_SIDE_TOLERANCE_PT &&
    Math.abs(height - ROTATION_ICON_SIDE_PT) <= ROTATION_ICON_SIDE_TOLERANCE_PT
  );
}

/**
 * One feature row per printed step, in step order.
 *
 * Every panel is described, not only the zero-callout ones, so the decision
 * "this step is a transition at all" is visible in the same artifact as the
 * decision about what kind it is.
 */
export function deriveTransitionPanelFeatures(input: {
  readonly panels: readonly StepPanel[];
  readonly calloutBoxesByStep: Readonly<Record<number, readonly PanelCalloutBox[]>>;
  readonly panelEvidenceByStep: Readonly<Record<number, PanelEvidenceEntry>>;
  readonly shapesByPage: ReadonlyMap<number, readonly PageShape[]>;
  readonly expectedPrintedSteps: number;
}): readonly TransitionPanelFeatures[] {
  if (!Number.isInteger(input.expectedPrintedSteps) || input.expectedPrintedSteps < 1) {
    throw new TypeError(
      `Transition features need the booklet's printed step count as a positive integer; received ` +
        `${JSON.stringify(input.expectedPrintedSteps)}. It decides which step may claim the final view.`,
    );
  }
  const withoutFace = [...input.panels]
    .sort((left, right) => left.stepNumber - right.stepNumber)
    .map((panel) => {
      const evidence = input.panelEvidenceByStep[panel.stepNumber];
      if (evidence === undefined) {
        throw new TypeError(
          `Printed step ${panel.stepNumber} has a panel but no panel-evidence digest. Derive features from ` +
            `the same real-build panel evidence that produced the panels, not from two separate passes.`,
        );
      }
      if (evidence.pageNumber !== panel.pageNumber) {
        throw new TypeError(
          `Printed step ${panel.stepNumber} is on page ${panel.pageNumber} but its panel evidence names page ` +
            `${evidence.pageNumber}. Regenerate both from one derivation.`,
        );
      }
      const shapes = input.shapesByPage.get(panel.pageNumber) ?? [];
      return {
        stepNumber: panel.stepNumber,
        pageNumber: panel.pageNumber,
        panelEvidenceDigest: evidence.digest,
        newPieceCalloutCount: (input.calloutBoxesByStep[panel.stepNumber] ?? []).length,
        isTerminalPrintedStep: panel.stepNumber === input.expectedPrintedSteps,
        rotationIconPresent: shapes.some((shape) => {
          if (!isRotationIcon(shape)) return false;
          const centreX = (shape.bounds.minXPt + shape.bounds.maxXPt) / 2;
          const centreY = (shape.bounds.minYPt + shape.bounds.maxYPt) / 2;
          return (
            centreX >= panel.bounds.minXPt &&
            centreX < panel.bounds.maxXPt &&
            centreY >= panel.bounds.minYPt &&
            centreY < panel.bounds.maxYPt
          );
        }),
      };
    });
  const faceByStep = new Map(
    derivePanelFaces(withoutFace).map(({ stepNumber, panelFace }) => [stepNumber, panelFace]),
  );
  return withoutFace.map((feature) => ({
    ...feature,
    panelFace: faceByStep.get(feature.stepNumber)!,
  }));
}

/**
 * The deterministic classifier. It proposes; `buildTransitionClassificationEntry` disposes.
 *
 * Two rules, both stated in the notes it writes:
 *   - the terminal printed step of the booklet is the completed model;
 *   - any other panel with no piece callout is placing something built beside it.
 * It never proposes a rotation, because it cannot see the cue that would prove
 * one. Declining is available and unused here; a model classifier plugged into
 * the same seam would use it.
 */
export const deterministicTransitionClassifier: TransitionClassifier<
  TransitionPanelFeatures
> = async (panel) => proposeDeterministicTransition(panel);

/** The synchronous rule, exposed for tests that want the decision without the promise. */
export function proposeDeterministicTransition(
  panel: TransitionPanelFeatures,
): TransitionClassifierProposal | null {
  if (panel.newPieceCalloutCount !== 0) return null;
  const icon = panel.rotationIconPresent
    ? "The rotate-the-model icon is printed in this panel; this booklet prints that icon on 43 steps, most of " +
      "which also place pieces, so it records the viewpoint and not the action."
    : "No rotate-the-model icon is printed in this panel.";
  const provenance =
    `human-claim: a person read all 26 zero-callout panels of this booklet and this rule applies that ` +
    `reading mechanically, from the PDF vector layer only. The artwork is raster and was not inspected, so ` +
    `a rotation-only step could not have been told apart from a placement. Unauthenticated.`;
  if (panel.isTerminalPrintedStep) {
    return {
      decision: "final-view",
      classifierKind: "human-claim",
      notes:
        `Printed step ${panel.stepNumber} on page ${panel.pageNumber} prints no Nx piece callout in its panel ` +
        `and is the last printed step of the booklet, so the model is complete once it is done. ${icon} ` +
        `${provenance}`,
    };
  }
  return {
    decision: "attachment",
    classifierKind: "human-claim",
    notes:
      `Printed step ${panel.stepNumber} on page ${panel.pageNumber} prints no Nx piece callout in its panel, ` +
      `so it adds no new element; this booklet draws such a panel as the placement of a subassembly built ` +
      `beside it. ${icon} ${provenance}`,
  };
}
