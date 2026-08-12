import { describe, expect, it } from "vitest";

import {
  arrowTravelFamily,
  panelProjectionForWorkRaster,
  type PanelProjection,
} from "../src/assembly/arrow-placement";
import {
  arrowDisplacementForRealBuildPanelCameraRegistration,
  createRealBuildPanelCameraRegistration,
  type ArrowDisplacement,
  type RealBuildPanelCameraRegistration,
  type RealBuildPanelCameraTurnDegrees,
} from "../e2e/real-build-panel-camera-registration";
import {
  arrowFamilyForRealBuildPanelCameraRegistration,
  createPanelArrowCameraEvidence,
  createPanelViewSolution,
  createRawPanelArrowMeasurement,
  type PanelArrowCameraEvidence,
  type PanelViewSolution,
  type RawPanelArrowMeasurement,
  type RealBuildArrowFamilyAssembly,
} from "../e2e/real-build-panel-arrow-evidence";

const FIT = {
  azimuthDegrees: 54.882572739160764,
  elevationDegrees: 35.639060713178495,
  pixelsPerUnit: 40.574776536412344,
  upSign: -1 as const,
};
const WORK_FACTOR = 2;
const BASE_PROJECTION = panelProjectionForWorkRaster(FIT, WORK_FACTOR);
const TRUE_TRAVEL = {
  xPx: BASE_PROJECTION.up.xPx * 7,
  yPx: BASE_PROJECTION.up.yPx * 7,
};
const TRUE_TRAVEL_PX = Math.hypot(TRUE_TRAVEL.xPx, TRUE_TRAVEL.yPx);
const DRAWN_TRAVEL_PX = 33.50220230104512;
const MEASUREMENT = createRawPanelArrowMeasurement({
  displacementXPx: (TRUE_TRAVEL.xPx * DRAWN_TRAVEL_PX) / TRUE_TRAVEL_PX,
  displacementYPx: (TRUE_TRAVEL.yPx * DRAWN_TRAVEL_PX) / TRUE_TRAVEL_PX,
  travelCeilingPx: 80.49463,
  workFactor: WORK_FACTOR,
});
const ASSEMBLY: RealBuildArrowFamilyAssembly = {
  panelProjectionForWorkRaster,
  arrowTravelFamily,
};
const TURNS: readonly RealBuildPanelCameraTurnDegrees[] = [0, 90, 180, 270];
const HANDS = ["as-fitted", "x-reflected"] as const;

function registration(
  latticeHand: RealBuildPanelCameraRegistration["latticeHand"] = "as-fitted",
  turnDegrees: RealBuildPanelCameraTurnDegrees = 0,
  panelStepNumber = 5,
): RealBuildPanelCameraRegistration {
  return createRealBuildPanelCameraRegistration({
    latticeHand,
    latticeDeterminant: latticeHand === "as-fitted" ? 1 : -1,
    registrationPanelStepNumber: panelStepNumber,
    turnDegrees,
    shiftPx: [0, 0],
  });
}

function evidence(
  measurement: RawPanelArrowMeasurement = MEASUREMENT,
  faceCorrectedFit: PanelViewSolution = FIT,
  panelStepNumber = 5,
): PanelArrowCameraEvidence {
  return createPanelArrowCameraEvidence({
    panelStepNumber,
    faceCorrectedFit,
    measurement,
  });
}

function family(
  selectedRegistration: RealBuildPanelCameraRegistration = registration(),
  selectedEvidence: PanelArrowCameraEvidence | null = evidence(),
  assembly: RealBuildArrowFamilyAssembly = ASSEMBLY,
): readonly ArrowDisplacement[] {
  return arrowFamilyForRealBuildPanelCameraRegistration({
    evidence: selectedEvidence,
    registration: selectedRegistration,
    assembly,
  });
}

describe("arrowFamilyForRealBuildPanelCameraRegistration", () => {
  it("derives the tolerance-bound q0 family once and preserves its canonical order through all eight D4 registrations", () => {
    const base = family();
    expect(base.length).toBeGreaterThan(1);

    for (const latticeHand of HANDS) {
      for (const turnDegrees of TURNS) {
        const selectedRegistration = registration(latticeHand, turnDegrees);
        const expected = base.map((entry) =>
          arrowDisplacementForRealBuildPanelCameraRegistration(entry, selectedRegistration),
        );
        let projectionCalls = 0;
        let familyCalls = 0;
        const actual = family(selectedRegistration, evidence(), {
          panelProjectionForWorkRaster: (fit, workFactor) => {
            projectionCalls += 1;
            expect(fit).toStrictEqual(FIT);
            return panelProjectionForWorkRaster(fit, workFactor);
          },
          arrowTravelFamily: (projection, displacement, ceilingPx) => {
            familyCalls += 1;
            return arrowTravelFamily(projection, displacement, ceilingPx);
          },
        });

        expect(actual).toStrictEqual(expected);
        expect(projectionCalls).toBe(1);
        expect(familyCalls).toBe(1);
      }
    }
  });

  it("returns a shared frozen empty family without touching callbacks when panel arrow evidence is absent", () => {
    const unused = (): never => {
      throw new Error("No arrow operation should run without panel arrow evidence.");
    };
    const first = family(registration("x-reflected", 270), null, {
      panelProjectionForWorkRaster: unused,
      arrowTravelFamily: unused,
    });
    const second = family(registration(), null, {
      panelProjectionForWorkRaster: unused,
      arrowTravelFamily: unused,
    });

    expect(first).toBe(second);
    expect(first).toStrictEqual([]);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("refuses cross-panel evidence before either assembly callback runs", () => {
    let callbackCalls = 0;
    const unused = (): never => {
      callbackCalls += 1;
      throw new Error("Cross-panel evidence must be refused before callbacks.");
    };

    expect(() =>
      family(registration("as-fitted", 0, 6), evidence(MEASUREMENT, FIT, 5), {
        panelProjectionForWorkRaster: unused,
        arrowTravelFamily: unused,
      }),
    ).toThrow(/evidence belongs to printed panel 5.*registration belongs to panel 6/su);
    expect(callbackCalls).toBe(0);
  });

  it("snapshots hostile getters before callbacks and freezes callback inputs and copied output", () => {
    const reads = new Map<string, number>();
    const state: Record<string, unknown> = {
      dx: 12,
      dy: -19,
      ceiling: 50,
      factor: 2,
      azimuth: 41,
      elevation: 26,
      scale: 52,
      up: -1,
      panel: 5,
      hand: "x-reflected",
      determinant: -1,
      turn: 90,
      shiftX: 0,
      shiftY: 0,
    };
    const getter = (key: string, stateKey = key): PropertyDescriptor => ({
      enumerable: true,
      get: () => {
        reads.set(key, (reads.get(key) ?? 0) + 1);
        return state[stateKey];
      },
    });
    const measurement = {};
    Object.defineProperties(measurement, {
      displacementXPx: getter("dx"),
      displacementYPx: getter("dy"),
      travelCeilingPx: getter("ceiling"),
      workFactor: getter("factor"),
    });
    const fit = {};
    Object.defineProperties(fit, {
      azimuthDegrees: getter("azimuth"),
      elevationDegrees: getter("elevation"),
      pixelsPerUnit: getter("scale"),
      upSign: getter("up"),
    });
    const suppliedEvidence = {};
    Object.defineProperties(suppliedEvidence, {
      faceCorrectedFit: { enumerable: true, get: () => fit },
      measurement: { enumerable: true, get: () => measurement },
      panelStepNumber: getter("evidencePanel", "panel"),
    });
    const shift: unknown[] = [0, 0];
    Object.defineProperties(shift, {
      0: getter("shiftX"),
      1: getter("shiftY"),
    });
    const suppliedRegistration = {};
    Object.defineProperties(suppliedRegistration, {
      latticeHand: getter("hand"),
      latticeDeterminant: getter("determinant"),
      registrationPanelStepNumber: getter("registrationPanel", "panel"),
      shiftPx: { enumerable: true, get: () => shift },
      turnDegrees: getter("turn"),
    });
    const candidate = {
      lduX: -60,
      lduY: -8,
      lduZ: -40,
      travelPx: 23,
      offLineStuds: 0.04,
    };
    let receivedView: PanelViewSolution | null = null;
    let receivedDrawn: Readonly<{ xPx: number; yPx: number }> | null = null;
    const operations = {
      panelProjectionForWorkRaster: (view: PanelViewSolution, factor: number) => {
        receivedView = view;
        expect(factor).toBe(2);
        Object.assign(state, {
          dx: 900,
          dy: 901,
          ceiling: 1,
          azimuth: 7,
          elevation: 8,
          scale: 9,
          hand: "as-fitted",
          determinant: 1,
          turn: 0,
          panel: 99,
        });
        return {} as PanelProjection;
      },
      arrowTravelFamily: (
        _projection: PanelProjection,
        drawn: Readonly<{ xPx: number; yPx: number }>,
        ceiling: number,
      ) => {
        receivedDrawn = drawn;
        expect(ceiling).toBe(50);
        return [candidate];
      },
    };
    const input = {};
    Object.defineProperties(input, {
      assembly: { enumerable: true, get: () => operations },
      evidence: { enumerable: true, get: () => suppliedEvidence },
      registration: { enumerable: true, get: () => suppliedRegistration },
    });

    const result = arrowFamilyForRealBuildPanelCameraRegistration(input as never);

    expect(result).toStrictEqual([
      { lduX: 40, lduY: -8, lduZ: 60, travelPx: 23, offLineStuds: 0.04 },
    ]);
    expect(receivedView).toStrictEqual({
      azimuthDegrees: 41,
      elevationDegrees: 26,
      pixelsPerUnit: 52,
      upSign: -1,
    });
    expect(receivedDrawn).toStrictEqual({ xPx: 12, yPx: -19 });
    expect(Object.isFrozen(receivedView)).toBe(true);
    expect(Object.isFrozen(receivedDrawn)).toBe(true);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result[0])).toBe(true);
    expect(Object.fromEntries(reads)).toStrictEqual({
      evidencePanel: 1,
      azimuth: 1,
      elevation: 1,
      scale: 1,
      up: 1,
      dx: 1,
      dy: 1,
      ceiling: 1,
      factor: 1,
      hand: 1,
      determinant: 1,
      registrationPanel: 1,
      turn: 1,
      shiftX: 1,
      shiftY: 1,
    });
  });

  it("refuses sparse and oversized family output before transforming any row", () => {
    const sparse = new Array<ArrowDisplacement>(1);
    expect(() =>
      family(registration(), evidence(), {
        panelProjectionForWorkRaster,
        arrowTravelFamily: () => sparse,
      }),
    ).toThrow(/sparse array.*index 0.*dense displacement array/su);

    const oversized = Array.from({ length: 201 }, () => ({
      lduX: 0,
      lduY: 0,
      lduZ: 0,
      travelPx: 1,
      offLineStuds: 0,
    }));
    expect(() =>
      family(registration(), evidence(), {
        panelProjectionForWorkRaster,
        arrowTravelFamily: () => oversized,
      }),
    ).toThrow(/returned 201 rows.*at most 200/su);
  });

  it("preserves the negative-infinity empty-built-mask sentinel as an empty family", () => {
    const emptyMaskMeasurement = createRawPanelArrowMeasurement({
      ...MEASUREMENT,
      travelCeilingPx: Number.NEGATIVE_INFINITY,
    });
    const result = family(registration("x-reflected", 270), evidence(emptyMaskMeasurement));

    expect(emptyMaskMeasurement.travelCeilingPx).toBe(Number.NEGATIVE_INFINITY);
    expect(result).toStrictEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("refuses malformed evidence and family rows with field-specific errors", () => {
    expect(() =>
      evidence(
        createRawPanelArrowMeasurement({
          ...MEASUREMENT,
          displacementXPx: 0,
          displacementYPx: 0,
        }),
      ),
    ).toThrow(/displacement.*finite, non-zero pixel vector/su);
    expect(() =>
      family(registration(), evidence(), {
        panelProjectionForWorkRaster,
        arrowTravelFamily: () => [{ lduX: 0.5 } as never],
      }),
    ).toThrow(/result 0.*safe-integer lduX/su);
  });
});

describe("panel arrow camera evidence boundaries", () => {
  it("copies each hostile measurement and fit field once and freezes both snapshots", () => {
    const reads = new Map<string, number>();
    const hostile = (fields: Readonly<Record<string, unknown>>): object => {
      const input = {};
      for (const [key, value] of Object.entries(fields)) {
        Object.defineProperty(input, key, {
          enumerable: true,
          get: () => {
            reads.set(key, (reads.get(key) ?? 0) + 1);
            return value;
          },
        });
      }
      return input;
    };
    const measurement = createRawPanelArrowMeasurement(
      hostile({
        displacementXPx: 12,
        displacementYPx: -19,
        travelCeilingPx: 50,
        workFactor: 2,
      }),
    );
    const fit = createPanelViewSolution(
      hostile({
        azimuthDegrees: 41,
        elevationDegrees: 26,
        pixelsPerUnit: 52,
        upSign: -1,
      }),
    );

    expect(measurement).toStrictEqual({
      displacementXPx: 12,
      displacementYPx: -19,
      travelCeilingPx: 50,
      workFactor: 2,
    });
    expect(fit).toStrictEqual({
      azimuthDegrees: 41,
      elevationDegrees: 26,
      pixelsPerUnit: 52,
      upSign: -1,
    });
    expect(Object.isFrozen(measurement)).toBe(true);
    expect(Object.isFrozen(fit)).toBe(true);
    expect(Object.fromEntries(reads)).toStrictEqual({
      displacementXPx: 1,
      displacementYPx: 1,
      travelCeilingPx: 1,
      workFactor: 1,
      azimuthDegrees: 1,
      elevationDegrees: 1,
      pixelsPerUnit: 1,
      upSign: 1,
    });
  });
});
