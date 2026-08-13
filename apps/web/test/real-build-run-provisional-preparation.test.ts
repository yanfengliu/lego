import { describe, expect, it, vi } from "vitest";

import {
  deriveRealBuildProvisionalRunPreparationFacts,
  deriveRealBuildProvisionalStepPreparationFacts,
  snapshotRealBuildProvisionalFitScalars,
} from "../e2e/real-build-run-provisional-preparation";

const A = `sha256:${"a".repeat(64)}`;
const B = `sha256:${"b".repeat(64)}`;
const C = `sha256:${"c".repeat(64)}`;
const D = `sha256:${"d".repeat(64)}`;

const runFacts = () => deriveRealBuildProvisionalRunPreparationFacts("{}", A, B, C, C);

const stepFacts = (
  overrides: Partial<{
    panelDigest: string;
    actionDigest: string;
    piecePlanDigest: string;
    stepNumber: number;
    pageNumber: number;
    panelFace: string;
    actionKind: string;
    actionEvidenceDigest: string | null;
    minXPt: number;
    maxXPt: number;
    minYPt: number;
    maxYPt: number;
    width: number;
    height: number;
    workLength: number;
    maskLength: number;
    workDigest: string;
    maskDigest: string;
    azimuth: number | null;
    elevation: number | null;
    scale: number | null;
    residual: number | null;
    upSign: 1 | -1 | null;
    fitFailure: string | null;
    coherence: number;
  }> = {},
  run = runFacts(),
) => {
  const values = {
    panelDigest: A,
    actionDigest: B,
    piecePlanDigest: C,
    stepNumber: 1,
    pageNumber: 7,
    panelFace: "studs-up",
    actionKind: "place-callouts",
    actionEvidenceDigest: D,
    minXPt: 1,
    maxXPt: 11,
    minYPt: 2,
    maxYPt: 12,
    width: 2,
    height: 3,
    workLength: 24,
    maskLength: 6,
    workDigest: A,
    maskDigest: B,
    azimuth: 15,
    elevation: 30,
    scale: 4,
    residual: 0.5,
    upSign: null,
    fitFailure: null,
    coherence: 0.8,
    ...overrides,
  };
  return deriveRealBuildProvisionalStepPreparationFacts(
    run.preparationIdentity,
    run.preparedRunInputDigest,
    run.fetchedPdfDigest,
    values.panelDigest,
    values.actionDigest,
    values.piecePlanDigest,
    values.stepNumber,
    values.pageNumber,
    values.panelFace,
    values.actionKind,
    values.actionEvidenceDigest,
    values.minXPt,
    values.maxXPt,
    values.minYPt,
    values.maxYPt,
    values.width,
    values.height,
    values.workLength,
    values.maskLength,
    values.workDigest,
    values.maskDigest,
    values.azimuth,
    values.elevation,
    values.scale,
    values.residual,
    values.upSign,
    values.fitFailure,
    values.coherence,
  );
};

describe("real-build provisional preparation facts", () => {
  it("exports data-only derivation without any authority or mint API", async () => {
    const namespace = await import("../e2e/real-build-run-provisional-preparation");
    expect(Object.keys(namespace).sort()).toEqual([
      "deriveRealBuildProvisionalRunPreparationFacts",
      "deriveRealBuildProvisionalStepPreparationFacts",
      "snapshotRealBuildProvisionalFitScalars",
    ]);
    expect(Object.keys(namespace).join(" ")).not.toMatch(/authority|bind|consume|issue|mint/iu);
  });

  it("binds detached run bytes, source closure, module requests, and fetched PDF", () => {
    const original = runFacts();
    const changedInput = deriveRealBuildProvisionalRunPreparationFacts("[]", A, B, C, C);
    const changedSource = deriveRealBuildProvisionalRunPreparationFacts("{}", D, B, C, C);
    const changedModules = deriveRealBuildProvisionalRunPreparationFacts("{}", A, D, C, C);
    const changedPdf = deriveRealBuildProvisionalRunPreparationFacts("{}", A, B, D, D);

    expect(changedInput.preparedRunInputDigest).not.toBe(original.preparedRunInputDigest);
    expect(changedSource.sourceClosureDigest).not.toBe(original.sourceClosureDigest);
    expect(changedSource.preparationIdentity).not.toBe(original.preparationIdentity);
    expect(changedModules.moduleRequestDigest).not.toBe(original.moduleRequestDigest);
    expect(changedModules.sourceClosureDigest).not.toBe(original.sourceClosureDigest);
    expect(changedModules.preparationIdentity).not.toBe(original.preparationIdentity);
    expect(changedPdf.fetchedPdfDigest).not.toBe(original.fetchedPdfDigest);
    expect(changedPdf.preparationIdentity).not.toBe(original.preparationIdentity);
  });

  it("binds every page, crop, face, action, piece plan, raster, mask, and fit commitment", () => {
    const original = stepFacts();
    const variants = [
      stepFacts({ stepNumber: 2 }),
      stepFacts({ pageNumber: 8 }),
      stepFacts({ maxXPt: 12 }),
      stepFacts({ panelFace: "underside" }),
      stepFacts({ actionDigest: D }),
      stepFacts({ actionEvidenceDigest: C }),
      stepFacts({ piecePlanDigest: D }),
      stepFacts({ width: 3, workLength: 36, maskLength: 9 }),
      stepFacts({ workDigest: C }),
      stepFacts({ maskDigest: C }),
      stepFacts({ azimuth: 16 }),
      stepFacts({ upSign: -1 }),
    ];
    expect(new Set(variants.map(({ printedStepIdentity }) => printedStepIdentity))).toHaveLength(
      variants.length,
    );
    expect(
      variants.every((value) => value.printedStepIdentity !== original.printedStepIdentity),
    ).toBe(true);
  });

  it("uses a distinct provisional identity and binds its containing source/module preparation", () => {
    const originalRun = runFacts();
    const changedSourceRun = deriveRealBuildProvisionalRunPreparationFacts("{}", D, B, C, C);
    const changedModuleRun = deriveRealBuildProvisionalRunPreparationFacts("{}", A, D, C, C);
    const original = stepFacts({}, originalRun);

    expect(stepFacts({}, changedSourceRun).printedStepIdentity).not.toBe(
      original.printedStepIdentity,
    );
    expect(stepFacts({}, changedModuleRun).printedStepIdentity).not.toBe(
      original.printedStepIdentity,
    );
    expect(original.runPreparationIdentity).toBe(originalRun.preparationIdentity);
  });

  it("rejects mismatched raster semantics and unbounded run input before hashing", () => {
    expect(() => stepFacts({ workLength: 23 })).toThrow(/raster lengths/iu);
    expect(() => stepFacts({ maskLength: 5 })).toThrow(/raster lengths/iu);
    expect(() =>
      stepFacts({ width: 16_777_217, height: 1, workLength: 67_108_868, maskLength: 16_777_217 }),
    ).toThrow(/must not exceed/iu);
    expect(() => stepFacts({ fitFailure: "x".repeat(4_097) })).toThrow(/at most 4096/iu);
    expect(() => deriveRealBuildProvisionalRunPreparationFacts("{}", A, B, C, D)).toThrow(
      /does not equal/iu,
    );
  });

  it("never probes or serializes hostile getter/toJSON wrappers", () => {
    const getter = vi.fn(() => A);
    const toJSON = vi.fn(() => A);
    const hostile = Object.create(null, {
      azimuthDegrees: { get: getter },
      elevationDegrees: { value: 30 },
      pixelsPerUnit: { value: 4 },
      residualPx: { value: 0.5 },
      toJSON: { value: toJSON },
    });

    expect(() => deriveRealBuildProvisionalRunPreparationFacts(hostile, A, B, C, C)).toThrow(
      /primitive UTF-8 string/iu,
    );
    expect(() => snapshotRealBuildProvisionalFitScalars(hostile)).toThrow(/own data field/iu);
    expect(getter).not.toHaveBeenCalled();
    expect(toJSON).not.toHaveBeenCalled();
  });
});
