import { describe, expect, it } from "vitest";

import { panelProjectionFromFit } from "./arrow-placement";
import { derivePanelFaces, FIRST_PANEL_FACE, viewForPanelFace } from "./panel-face";

const FIT = { azimuthDegrees: 41, elevationDegrees: 26, pixelsPerUnit: 52 } as const;

describe("viewForPanelFace", () => {
  it("leaves a studs-up panel at the fitted camera", () => {
    expect(viewForPanelFace(FIT, "studs-up")).toEqual({
      azimuthDegrees: 41,
      elevationDegrees: 26,
      pixelsPerUnit: 52,
    });
  });

  it("negates both angles for an underside panel, and keeps the scale", () => {
    expect(viewForPanelFace(FIT, "underside")).toEqual({
      azimuthDegrees: -41,
      elevationDegrees: -26,
      pixelsPerUnit: 52,
    });
  });

  it("refuses a face it does not recognise rather than defaulting to studs-up", () => {
    expect(() => viewForPanelFace(FIT, "sideways" as "studs-up")).toThrow(/studs-up.*underside/su);
  });

  /**
   * The reason the icon is needed at all: the two faces project the same stud
   * lattice, so no amount of fitting separates them.
   *
   * Asserted against the real projection rather than restated as algebra — `a`
   * is identical and `b` is exactly negated, and negating one basis vector
   * spans the same lattice.
   */
  it("spans the same lattice as the fitted view, which is why the fit cannot tell them apart", () => {
    const above = panelProjectionFromFit(viewForPanelFace(FIT, "studs-up"));
    const below = panelProjectionFromFit(viewForPanelFace(FIT, "underside"));

    expect(below.a.xPx).toBeCloseTo(above.a.xPx, 12);
    expect(below.a.yPx).toBeCloseTo(above.a.yPx, 12);
    expect(below.b.xPx).toBeCloseTo(-above.b.xPx, 12);
    expect(below.b.yPx).toBeCloseTo(-above.b.yPx, 12);
    // A plate stacked upward projects the same way from either face: the height
    // term is even in the elevation, so only the horizontal basis carries the
    // difference.
    expect(below.up.yPx).toBeCloseTo(above.up.yPx, 12);
  });

  /**
   * `(A, -e)` is the tempting half-answer. It is a third camera: it puts the eye
   * below the model but arrives from the wrong side, so it reproduces neither
   * printed face and its `a` basis matches neither.
   */
  it("is not the same as negating the elevation alone", () => {
    const above = panelProjectionFromFit(viewForPanelFace(FIT, "studs-up"));
    const below = panelProjectionFromFit(viewForPanelFace(FIT, "underside"));
    const halfAnswer = panelProjectionFromFit({ ...FIT, elevationDegrees: -FIT.elevationDegrees });

    expect(halfAnswer.a.yPx).not.toBeCloseTo(above.a.yPx, 6);
    expect(halfAnswer.a.yPx).not.toBeCloseTo(below.a.yPx, 6);
  });
});

describe("derivePanelFaces", () => {
  const withIcons = (iconSteps: readonly number[], count: number) =>
    Array.from({ length: count }, (_unused, index) => ({
      stepNumber: index + 1,
      rotationIconPresent: iconSteps.includes(index + 1),
    }));

  it("seeds at studs-up and toggles on the step the icon is printed on", () => {
    // The icon annotates the viewpoint of the panel it sits in, so that panel is
    // already drawn from the new face.
    expect(derivePanelFaces(withIcons([4, 5, 7, 8], 9)).map(({ panelFace }) => panelFace)).toEqual([
      "studs-up",
      "studs-up",
      "studs-up",
      "underside",
      "studs-up",
      "studs-up",
      "underside",
      "studs-up",
      "studs-up",
    ]);
  });

  it("orders by step number rather than trusting the caller's order", () => {
    const shuffled = [
      { stepNumber: 3, rotationIconPresent: false },
      { stepNumber: 1, rotationIconPresent: false },
      { stepNumber: 2, rotationIconPresent: true },
    ];
    expect(derivePanelFaces(shuffled)).toEqual([
      { stepNumber: 1, panelFace: "studs-up" },
      { stepNumber: 2, panelFace: "underside" },
      { stepNumber: 3, panelFace: "underside" },
    ]);
  });

  it("takes the seed as a parameter, because the opening face is an assumption", () => {
    expect(FIRST_PANEL_FACE).toBe("studs-up");
    expect(
      derivePanelFaces(withIcons([2], 3), "underside").map(({ panelFace }) => panelFace),
    ).toEqual(["underside", "studs-up", "studs-up"]);
  });

  /**
   * Why a missed icon is not a one-step error: parity never resynchronises, so
   * one dropped icon inverts every step after it. This is the shape of the bug
   * that scored 7 of 43 before the fill-colour fix.
   */
  it("inverts every later step when one icon is missed, not just its own", () => {
    const complete = derivePanelFaces(withIcons([4, 7, 10], 12));
    const missed = derivePanelFaces(withIcons([7, 10], 12));

    const disagreements = complete.filter(
      (entry, index) => entry.panelFace !== missed[index]!.panelFace,
    );
    // Every step from the missed icon to the end, not the one step it sits on:
    // later icons keep toggling from the wrong phase, so the two never
    // resynchronise.
    expect(disagreements.map(({ stepNumber }) => stepNumber)).toEqual([
      4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(complete.at(-1)!.panelFace).toBe("underside");
    expect(missed.at(-1)!.panelFace).toBe("studs-up");
  });
});
