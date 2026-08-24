import { describe, expect, it } from "vitest";

import {
  NOMINAL_STUD_SOURCE_RADIUS_MAX_ROUNDING_DELTA_LDU,
  compileMeasuredStud,
  studSeatTouchesOutwardBoxFace,
} from "./measured-stud.ts";
import type { MeasuredPartBlueprint } from "./measured-part-types.ts";
import type { LduBounds } from "./types.ts";

const BLUEPRINT = {
  designId: "local-deck",
  ldrawId: "local-deck.dat",
} as unknown as MeasuredPartBlueprint;
const PROFILED_BLUEPRINT = {
  ...BLUEPRINT,
  validatedConnectionStudProfile: "nominal-stud-tube/1",
} as unknown as MeasuredPartBlueprint;

const BODY_BOXES: readonly LduBounds[] = [
  { min: [-10, -4, -10], max: [10, 4, 10] },
  // A separate feature rises above the stud-bearing deck.
  { min: [-2, -7, -14], max: [2, 0, -10] },
];

describe("measured stud local supporting faces", () => {
  it("admits a source-authored stud on a local deck below the global body extremum", () => {
    expect(studSeatTouchesOutwardBoxFace(BODY_BOXES, [0, -4, 0], [0, -1, 0])).toBe(true);
    const compiled = compileMeasuredStud(BLUEPRINT, BODY_BOXES, [0, -4, 0, 6, 4], 0);
    expect(compiled).toMatchObject({
      connector: { positionLdu: [0, -4, 0], normal: [0, -1, 0] },
      primitive: { axis: "y", centerLdu: [0, -6, 0], radiusLdu: 6, heightLdu: 4 },
    });
    expect("validatedConnectionProfileRadiusLdu" in compiled.primitive).toBe(false);
  });

  it("preserves the rounded source cylinder while admitting its nominal connection profile", () => {
    const sourceRadiusLdu = 6.0001514980873605;
    const compiled = compileMeasuredStud(
      PROFILED_BLUEPRINT,
      BODY_BOXES,
      [0, -4, 0, sourceRadiusLdu, 4],
      0,
    );

    expect(sourceRadiusLdu - 6).toBe(0.00015149808736047987);
    expect(NOMINAL_STUD_SOURCE_RADIUS_MAX_ROUNDING_DELTA_LDU).toBe(0.0004242640687119286);
    expect(compiled.primitive).toEqual({
      id: "stud:0",
      kind: "cylinder",
      tag: "stud",
      axis: "y",
      centerLdu: [0, -6, 0],
      radiusLdu: sourceRadiusLdu,
      validatedConnectionProfileRadiusLdu: 6,
      heightLdu: 4,
    });
  });

  it("fails closed when a nominal connection profile exceeds source rounding or stud height", () => {
    expect(() =>
      compileMeasuredStud(PROFILED_BLUEPRINT, BODY_BOXES, [0, -4, 0, 6.001, 4], 0),
    ).toThrow(/source rounding delta no greater than/u);
    expect(() => compileMeasuredStud(PROFILED_BLUEPRINT, BODY_BOXES, [0, -4, 0, 6, 5], 0)).toThrow(
      /requires height 4/u,
    );
    expect(() =>
      compileMeasuredStud(PROFILED_BLUEPRINT, BODY_BOXES, [0, -4, 0, 5.999, 4], 0),
    ).toThrow(/radius at least the nominal 6/u);
  });

  it("still refuses a floating stud with no local outward body face", () => {
    expect(studSeatTouchesOutwardBoxFace(BODY_BOXES, [0, -3, 0], [0, -1, 0])).toBe(false);
    expect(
      studSeatTouchesOutwardBoxFace(
        [{ min: [-10, -4, -10], max: [0, 4, 0] }],
        [0, -4, 0],
        [0, -1, 0],
      ),
    ).toBe(false);
    expect(() => compileMeasuredStud(BLUEPRINT, BODY_BOXES, [0, -3, 0, 6, 4], 0)).toThrow(
      /no measured body collision box supplies an exposed local y-face/u,
    );
  });

  it("refuses a geometrically local face that another body box occludes outward", () => {
    const occluded: readonly LduBounds[] = [...BODY_BOXES, { min: [-3, -6, -3], max: [3, -4, 3] }];

    expect(studSeatTouchesOutwardBoxFace(occluded, [0, -4, 0], [0, -1, 0])).toBe(false);
    expect(() => compileMeasuredStud(BLUEPRINT, occluded, [0, -4, 0, 6, 4], 0)).toThrow(
      /no measured body collision box supplies an exposed local y-face/u,
    );
  });

  it("refuses a local face with a separated centre-line obstruction farther outward", () => {
    const obstructed: readonly LduBounds[] = [
      ...BODY_BOXES,
      { min: [-3, -8, -3], max: [3, -7, 3] },
    ];

    expect(studSeatTouchesOutwardBoxFace(obstructed, [0, -4, 0], [0, -1, 0])).toBe(false);
    expect(() => compileMeasuredStud(BLUEPRINT, obstructed, [0, -4, 0, 6, 4], 0)).toThrow(
      /no measured body collision box supplies an exposed local y-face/u,
    );
  });
});
