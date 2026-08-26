import { describe, expect, it } from "vitest";

import type { StepPanel } from "../src/instructions/step-panels";
import { produceRealBuildRunPanelInputs } from "../e2e/real-build-run-panel-production";
import { planRealBuildRunPanelWindow } from "../e2e/real-build-run-panel-window";
import type { CalloutResolution } from "../e2e/real-build-input-files";
import type { V6ManifestCallout } from "../e2e/real-build-safety";
import { REAL_BUILD_TEST_INPUT_DIGESTS } from "./real-build-test-options";

const sourcePanel = (stepNumber: number): StepPanel => ({
  stepNumber,
  pageNumber: stepNumber,
  bounds: { minXPt: 0, maxXPt: 100, minYPt: 0, maxYPt: 100 },
  labelXPt: 1,
  labelYPt: 1,
  quantities: [],
});

describe("real-build prefix panel producer", () => {
  it("builds only prefix action specs while preserving a raster-only passive suffix", () => {
    let tailReads = 0;
    const hostile = <T extends object>(value: T): T =>
      new Proxy(value, {
        get(target, property, receiver) {
          if (property !== "stepNumber") {
            tailReads += 1;
            throw new Error(`tail field ${String(property)} must remain unread`);
          }
          return Reflect.get(target, property, receiver) as unknown;
        },
      });
    const panelWindow = planRealBuildRunPanelWindow({
      panels: Array.from({ length: 359 }, (_, index) => sourcePanel(index + 1)),
      requestedLastStep: 50,
      expectedPrintedSteps: 359,
      maximumPassiveLookaheadSteps: 2,
    });
    const tailManifest = hostile({
      stepNumber: 51,
      identity: "tail-callout",
    }) as unknown as V6ManifestCallout;
    const tailLedger = hostile({ stepNumber: 51, action: { kind: "transition" } });
    const tailCoverage = hostile({ stepNumber: 51 }) as unknown as CalloutResolution;
    const facesByStep = new Map(
      Array.from({ length: 52 }, (_, index) => [index + 1, "studs-up" as const]),
    );

    const produced = produceRealBuildRunPanelInputs({
      repoRoot: process.cwd(),
      calloutDirectory: "output/unused-prefix-producer-fixture",
      panelWindow,
      requestedLastStep: 50,
      facesByStep,
      calloutBoxesByStep: {},
      stepByCalloutIdentity: new Map(),
      manifestCallouts: [tailManifest],
      ledgerSteps: [tailLedger],
      officialModel: null,
      coverageByCallout: { "tail-callout": tailCoverage },
      inputDigests: REAL_BUILD_TEST_INPUT_DIGESTS,
    });

    expect(produced.specs.map(({ stepNumber }) => stepNumber)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
    expect(produced.passivePanels.map(({ stepNumber }) => stepNumber)).toEqual([51, 52]);
    expect(Object.keys(produced.passivePanels[0]!).sort()).toEqual(
      [
        "calloutBoxes",
        "maxXPt",
        "maxYPt",
        "minXPt",
        "minYPt",
        "pageNumber",
        "panelFace",
        "stepNumber",
      ].sort(),
    );
    expect(produced.coverageByCallout).toEqual({});
    expect(tailReads).toBe(0);
  });

  it("refuses a broader validated window before compiling action specs", () => {
    const panelWindow = planRealBuildRunPanelWindow({
      panels: Array.from({ length: 359 }, (_, index) => sourcePanel(index + 1)),
      requestedLastStep: 359,
      expectedPrintedSteps: 359,
      maximumPassiveLookaheadSteps: 2,
    });

    expect(() =>
      produceRealBuildRunPanelInputs({
        repoRoot: process.cwd(),
        calloutDirectory: "output/unused-prefix-producer-fixture",
        panelWindow,
        requestedLastStep: 50,
        facesByStep: new Map(),
        calloutBoxesByStep: {},
        stepByCalloutIdentity: new Map(),
        manifestCallouts: [],
        ledgerSteps: [],
        officialModel: null,
        coverageByCallout: {},
        inputDigests: REAL_BUILD_TEST_INPUT_DIGESTS,
      }),
    ).toThrow(/window request 359, 359 execution rows/iu);
  });

  it("refuses an unbranded caller-authored window even when its counts match", () => {
    const panels = Array.from({ length: 359 }, (_, index) => sourcePanel(index + 1));
    const forged = {
      requestedLastStep: 50,
      expectedPrintedSteps: 359,
      maximumPassiveLookaheadSteps: 2,
      executionPanels: panels.slice(0, 50),
      passiveObservationPanels: panels.slice(50, 52),
      observationPanels: panels.slice(0, 52),
    };

    expect(() =>
      produceRealBuildRunPanelInputs({
        repoRoot: process.cwd(),
        calloutDirectory: "output/unused-prefix-producer-fixture",
        panelWindow: forged,
        requestedLastStep: 50,
        facesByStep: new Map(),
        calloutBoxesByStep: {},
        stepByCalloutIdentity: new Map(),
        manifestCallouts: [],
        ledgerSteps: [],
        officialModel: null,
        coverageByCallout: {},
        inputDigests: REAL_BUILD_TEST_INPUT_DIGESTS,
      }),
    ).toThrow(/exact module-planned 359-step source window/u);
  });

  it("rejects every extra or accessor in producer-side passive descriptors", () => {
    for (const field of ["placementAuthority", "authenticatedPlacements"]) {
      let hostileReads = 0;
      const panels = Array.from({ length: 359 }, (_, index) => sourcePanel(index + 1));
      Object.defineProperty(panels[50]!, field, {
        enumerable: true,
        get() {
          hostileReads += 1;
          throw new Error(`passive source ${field} must remain unread`);
        },
      });
      const panelWindow = planRealBuildRunPanelWindow({
        panels,
        requestedLastStep: 50,
        expectedPrintedSteps: 359,
        maximumPassiveLookaheadSteps: 1,
      });

      expect(() =>
        produceRealBuildRunPanelInputs({
          repoRoot: process.cwd(),
          calloutDirectory: "output/unused-prefix-producer-fixture",
          panelWindow,
          requestedLastStep: 50,
          facesByStep: new Map(),
          calloutBoxesByStep: {},
          stepByCalloutIdentity: new Map(),
          manifestCallouts: [],
          ledgerSteps: [],
          officialModel: null,
          coverageByCallout: {},
          inputDigests: REAL_BUILD_TEST_INPUT_DIGESTS,
        }),
      ).toThrow(new RegExp(`passive source panel.*unsupported own field "${field}"`, "u"));
      expect(hostileReads).toBe(0);
    }

    let nestedReads = 0;
    const callout = {
      minXPt: 1,
      maxXPt: 2,
      minYPt: 3,
      maxYPt: 4,
    } as Record<string, unknown>;
    Object.defineProperty(callout, "completionAuthority", {
      enumerable: true,
      get() {
        nestedReads += 1;
        throw new Error("nested producer authority must remain unread");
      },
    });
    const panelWindow = planRealBuildRunPanelWindow({
      panels: Array.from({ length: 359 }, (_, index) => sourcePanel(index + 1)),
      requestedLastStep: 50,
      expectedPrintedSteps: 359,
      maximumPassiveLookaheadSteps: 1,
    });
    expect(() =>
      produceRealBuildRunPanelInputs({
        repoRoot: process.cwd(),
        calloutDirectory: "output/unused-prefix-producer-fixture",
        panelWindow,
        requestedLastStep: 50,
        facesByStep: new Map(),
        calloutBoxesByStep: { 51: [callout as never] },
        stepByCalloutIdentity: new Map(),
        manifestCallouts: [],
        ledgerSteps: [],
        officialModel: null,
        coverageByCallout: {},
        inputDigests: REAL_BUILD_TEST_INPUT_DIGESTS,
      }),
    ).toThrow(/passive source calloutBoxes\[0\].*unsupported own field "completionAuthority"/u);
    expect(nestedReads).toBe(0);
  });
});
