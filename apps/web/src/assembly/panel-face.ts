/**
 * Which face of the assembly a printed panel is drawn from, and what that does
 * to the camera a candidate is rendered at.
 *
 * This set is built partly upside down. The booklet turns the model over
 * mid-build, prints an icon at each turn, and draws every panel after it from
 * the other side. A loop that ignores the icon compares its candidate render
 * against the opposite face of the printed drawing, and nothing else in the run
 * can catch that: the panel camera is fitted to the panel's own stud grid, and
 * a projected square lattice is identical from above and below.
 *
 * That identity is exact rather than approximate, which is why the face cannot
 * be recovered by fitting harder. Writing the projected lattice basis at
 * azimuth `A` and elevation `e` as
 *
 *     a(A, e) = ( cos A,  sin e sin A )
 *     b(A, e) = (-sin A,  sin e cos A )
 *
 * gives `a(A, -e) = a(-A, e)` and `b(A, -e) = -b(-A, e)`. Negating one basis
 * vector spans the same lattice, so the two views are indistinguishable to any
 * fit that sees only the grid — and the fitter's search over re-basings always
 * returns the positive-elevation twin. Refitting all forty panels of the
 * camera-fit run a second time as below-views returned no solution on any of
 * them, the five drawn from underneath included.
 *
 * So the face is a render-time input and not a fit output: the fit supplies
 * azimuth, scale and phase, and the icon supplies the sign of the elevation.
 */

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

/** The part of a camera fit that a face can change. */
export interface FittedPanelView {
  readonly azimuthDegrees: number;
  readonly elevationDegrees: number;
  readonly pixelsPerUnit: number;
}

/**
 * The camera a candidate must be rendered at to be comparable with a panel
 * drawn from `face`.
 *
 * Both signs flip. `(A, -e)` is the tempting half-answer and it is a third
 * camera that reproduces neither face: it does put the eye below the model, but
 * it arrives from the wrong side of it. The fit reports the *negated* azimuth
 * when the true view is below — that is the `a(A, -e) = a(-A, e)` identity
 * above read in the other direction — so undoing it negates both.
 *
 * Strictly the azimuth is `-A` modulo 90, because the lattice pins the azimuth
 * no further than its quarter-turn coset; `-A` is the representative of that
 * coset, and which member is chosen is the azimuth-branch question the panel
 * score resolves by rendering each, not something this function can settle.
 */
export function viewForPanelFace(fit: FittedPanelView, face: PanelFace): FittedPanelView {
  if (face !== "studs-up" && face !== "underside") {
    throw new TypeError(
      `A panel face must be "studs-up" or "underside"; received ${JSON.stringify(face)}. ` +
        `Rendering a candidate without knowing the face compares it against the opposite side of the drawing.`,
    );
  }
  if (face === "studs-up") {
    return {
      azimuthDegrees: fit.azimuthDegrees,
      elevationDegrees: fit.elevationDegrees,
      pixelsPerUnit: fit.pixelsPerUnit,
    };
  }
  return {
    azimuthDegrees: -fit.azimuthDegrees,
    elevationDegrees: -fit.elevationDegrees,
    pixelsPerUnit: fit.pixelsPerUnit,
  };
}

/**
 * Folds the rotate-the-model icon into a face per step, in printed order.
 *
 * Separate from the feature derivation because the fold is the claim worth
 * testing on its own: it needs only the icon flags and the seed, so it can be
 * checked against a blind reading of the panels without a PDF in the room.
 *
 * The fold is a running parity, so it is only meaningful over a contiguous
 * prefix that starts at the seed's step. A missed icon inverts every step after
 * it and never resynchronises — before the fill-colour fix that cost 36 of 43
 * steps, not the one step the missed icon was on.
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
