import { describe, expect, it } from "vitest";

import { panelProjectionFromFit } from "./arrow-placement";
import {
  derivePanelFaces,
  FIRST_PANEL_FACE,
  viewForLatticeHand,
  viewForPanelFace,
} from "./panel-face";

const FIT = { azimuthDegrees: 41, elevationDegrees: 26, pixelsPerUnit: 52 } as const;

describe("viewForLatticeHand", () => {
  it("leaves the as-fitted hand unchanged", () => {
    expect(viewForLatticeHand(FIT, "as-fitted")).toStrictEqual(FIT);
  });

  it("reflects a, preserves b and model-up, and keeps scale and upSign", () => {
    const faceCorrected = { ...FIT, upSign: -1 as const };
    const reflectedView = viewForLatticeHand(faceCorrected, "x-reflected");
    const fitted = panelProjectionFromFit(faceCorrected);
    const reflected = panelProjectionFromFit(reflectedView);

    expect(reflectedView).toStrictEqual({
      azimuthDegrees: 139,
      elevationDegrees: -26,
      pixelsPerUnit: 52,
      upSign: -1,
    });
    expect(reflected.a.xPx).toBeCloseTo(-fitted.a.xPx, 12);
    expect(reflected.a.yPx).toBeCloseTo(-fitted.a.yPx, 12);
    expect(reflected.b.xPx).toBeCloseTo(fitted.b.xPx, 12);
    expect(reflected.b.yPx).toBeCloseTo(fitted.b.yPx, 12);
    expect(reflected.up.xPx).toBeCloseTo(fitted.up.xPx, 12);
    expect(reflected.up.yPx).toBeCloseTo(fitted.up.yPx, 12);
  });

  it("is a horizontal reflection, not an underside face", () => {
    const fitted = panelProjectionFromFit(FIT);
    const reflected = panelProjectionFromFit(viewForLatticeHand(FIT, "x-reflected"));
    const underside = panelProjectionFromFit(viewForPanelFace(FIT, "underside"));

    expect(reflected.a.xPx).toBeCloseTo(underside.a.xPx, 12);
    expect(reflected.a.yPx).toBeCloseTo(underside.a.yPx, 12);
    expect(reflected.b.xPx).toBeCloseTo(underside.b.xPx, 12);
    expect(reflected.b.yPx).toBeCloseTo(underside.b.yPx, 12);
    expect(reflected.up.yPx).toBeCloseTo(fitted.up.yPx, 12);
    expect(underside.up.yPx).toBeCloseTo(-fitted.up.yPx, 12);
  });

  it("reflects after a quarter turn, so H(A + q) equals H(A) - q", () => {
    const reflected = viewForLatticeHand(FIT, "x-reflected");
    const turnThenReflect = viewForLatticeHand(
      { ...FIT, azimuthDegrees: FIT.azimuthDegrees + 90 },
      "x-reflected",
    );
    const reflectThenSameTurn = {
      ...reflected,
      azimuthDegrees: reflected.azimuthDegrees + 90,
    };

    expect(turnThenReflect.azimuthDegrees).toBe(reflected.azimuthDegrees - 90);
    expect(turnThenReflect.azimuthDegrees).toBe(49);
    expect(reflectThenSameTurn.azimuthDegrees).toBe(229);
    expect(turnThenReflect).not.toEqual(reflectThenSameTurn);
  });

  it("refuses an unknown hand instead of choosing a mirrored default", () => {
    expect(() => viewForLatticeHand(FIT, "ambidextrous" as "as-fitted")).toThrow(
      /as-fitted.*x-reflected.*ambidextrous/su,
    );
  });
});

describe("viewForPanelFace", () => {
  it("leaves a studs-up panel at the fitted camera, up the page", () => {
    expect(viewForPanelFace(FIT, "studs-up")).toEqual({
      azimuthDegrees: 41,
      elevationDegrees: 26,
      pixelsPerUnit: 52,
      upSign: 1,
    });
  });

  it("negates both angles and inverts up for an underside panel, and keeps the scale", () => {
    expect(viewForPanelFace(FIT, "underside")).toEqual({
      azimuthDegrees: -41,
      elevationDegrees: -26,
      pixelsPerUnit: 52,
      upSign: -1,
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

    // `a` is negated and `b` is unchanged. Negating one basis vector spans the
    // same lattice, so the grid the fitter sees is identical — the half-turn
    // that inverts up moved which vector carries the sign, not the lattice.
    expect(below.a.xPx).toBeCloseTo(-above.a.xPx, 12);
    expect(below.a.yPx).toBeCloseTo(-above.a.yPx, 12);
    expect(below.b.xPx).toBeCloseTo(above.b.xPx, 12);
    expect(below.b.yPx).toBeCloseTo(above.b.yPx, 12);
  });

  /**
   * The half-turn a booklet takes when it turns the model over, stated where it
   * can be checked: a plate stacked onto the model climbs *down* the page on a
   * panel drawn from underneath, because the model's own up axis does.
   *
   * This is the part `viewForPanelFace` shipped without, and it is not
   * recoverable by moving the eye: with up pinned to the world `+Y`, the plate
   * step is `-cos(e)` and is negative — up the page — at every azimuth and every
   * elevation short of straight down. The sweep below is the impossibility
   * proof, and it is what makes the sign a face input rather than a fit output.
   */
  it("climbs down the page from underneath, which no azimuth or elevation can reproduce", () => {
    const above = panelProjectionFromFit(viewForPanelFace(FIT, "studs-up"));
    const below = panelProjectionFromFit(viewForPanelFace(FIT, "underside"));

    expect(above.up.yPx).toBeLessThan(0);
    expect(below.up.yPx).toBeCloseTo(-above.up.yPx, 12);
    expect(below.up.yPx).toBeGreaterThan(0);

    for (let azimuthDegrees = 0; azimuthDegrees < 360; azimuthDegrees += 5) {
      for (let elevationDegrees = -89; elevationDegrees <= 89; elevationDegrees += 1) {
        const swept = panelProjectionFromFit({
          azimuthDegrees,
          elevationDegrees,
          pixelsPerUnit: FIT.pixelsPerUnit,
        });
        expect(swept.up.yPx).toBeLessThan(0);
      }
    }
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
    expect(halfAnswer.a.xPx).not.toBeCloseTo(below.a.xPx, 6);
    // And it draws a stacked plate up the page, where the panel it is standing
    // in for draws it down: the half-answer never even changes face.
    expect(halfAnswer.up.yPx).toBeLessThan(0);
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
