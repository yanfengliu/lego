import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  derivePanelRasterEvidence: vi.fn(),
  settleDeferredPrintedStep: vi.fn(),
  attemptFartherPrintedStep: vi.fn(),
}));

vi.mock("../e2e/real-build-panel-raster", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../e2e/real-build-panel-raster")>()),
  derivePanelRasterEvidence: boundary.derivePanelRasterEvidence,
}));

vi.mock("../e2e/real-build-deferred-step", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../e2e/real-build-deferred-step")>()),
  settleDeferredPrintedStep: boundary.settleDeferredPrintedStep,
}));

vi.mock("../e2e/real-build-farther-step", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../e2e/real-build-farther-step")>()),
  attemptFartherPrintedStep: boundary.attemptFartherPrintedStep,
}));

import { createRunDeferredPanelCoordinator } from "../e2e/real-build-run-visual";
import type { RealBuildPanelRasterSpec, RealBuildPanelSpec } from "../e2e/real-build-safety";
import { completeRealBuildTestOptions } from "./real-build-test-options";

const unresolved = Object.freeze([
  Object.freeze({ candidateId: "candidate-a" }),
  Object.freeze({ candidateId: "candidate-b" }),
]);

function deferredResult() {
  return {
    evidence: Object.freeze({ settled: false }),
    failure: null,
    pieceReports: Object.freeze([{ stepNumber: 50 }]),
    placement: null,
    unresolvedCandidates: unresolved,
  };
}

function coordinator(input: {
  readonly spec: RealBuildPanelSpec;
  readonly deferralTarget: RealBuildPanelRasterSpec;
  readonly executionPanels: readonly RealBuildPanelSpec[];
  readonly observationPanels: readonly RealBuildPanelRasterSpec[];
  readonly place: ReturnType<typeof vi.fn>;
}) {
  const options = completeRealBuildTestOptions(50);
  return createRunDeferredPanelCoordinator({
    ...input,
    currentPageNumber: input.deferralTarget.pageNumber,
    currentPageCanvas: Object.freeze({}) as never,
    pdf: Object.freeze({}) as never,
    options,
    modules: Object.freeze({}) as never,
    baseDocument: Object.freeze({ id: "prefix-50" }),
    place: input.place as never,
  });
}

async function settle(value: ReturnType<typeof coordinator>) {
  return value.settle({
    trigger: "no-local-signal",
    ownPanelMargin: null,
    stepId: null,
    scoreOwnPanel: () => 0,
  });
}

describe("real-build passive lookahead execution boundary", () => {
  beforeEach(() => {
    boundary.derivePanelRasterEvidence.mockReset().mockReturnValue(Object.freeze({}));
    boundary.settleDeferredPrintedStep.mockReset().mockReturnValue(deferredResult());
    boundary.attemptFartherPrintedStep.mockReset().mockResolvedValue({
      evidence: Object.freeze({}),
      captures: Object.freeze([]),
      selectedOrigin: null,
      failure: null,
    });
  });

  it("may read panel 51 for step 50 but never executes panel 51's hostile action", async () => {
    const options = completeRealBuildTestOptions(50);
    const step50 = options.panels[49]!;
    let passiveExecutionReads = 0;
    const step51 = new Proxy(options.passivePanels[0]!, {
      get(target, property, receiver) {
        if (property === "action" || property === "pieces") {
          passiveExecutionReads += 1;
          throw new Error("passive execution field must remain unread");
        }
        return Reflect.get(target, property, receiver) as unknown;
      },
    });
    const place = vi.fn(() => {
      throw new Error("passive panel action reached placement");
    });

    const result = await settle(
      coordinator({
        spec: step50,
        deferralTarget: step51,
        executionPanels: options.panels,
        observationPanels: [...options.panels, step51],
        place,
      }),
    );

    expect(boundary.derivePanelRasterEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ spec: expect.objectContaining({ stepNumber: 51 }) }),
    );
    expect(boundary.settleDeferredPrintedStep).toHaveBeenCalledOnce();
    expect(boundary.attemptFartherPrintedStep).not.toHaveBeenCalled();
    expect(place).not.toHaveBeenCalled();
    expect(passiveExecutionReads).toBe(0);
    expect(result).toEqual({
      deferral: { settled: false },
      farther: null,
      fartherCaptures: [],
      failure: null,
      pieceReports: [{ stepNumber: 50 }],
      placement: null,
    });
  });

  it("allows an intervening requested step 50 while keeping panel 51 source-only", async () => {
    const options = completeRealBuildTestOptions(50);
    const step49 = options.panels[48]!;
    const step50 = options.panels[49]!;
    const step51 = options.passivePanels[0]!;
    const place = vi.fn();

    await settle(
      coordinator({
        spec: step49,
        deferralTarget: step50,
        executionPanels: options.panels,
        observationPanels: [...options.panels, step51],
        place,
      }),
    );

    expect(boundary.attemptFartherPrintedStep).toHaveBeenCalledWith(
      expect.objectContaining({
        originSpec: expect.objectContaining({ stepNumber: 49 }),
        interveningSpec: expect.objectContaining({ stepNumber: 50 }),
        fartherSpec: null,
        fartherRasterSpec: expect.objectContaining({ stepNumber: 51 }),
      }),
    );
  });
});
