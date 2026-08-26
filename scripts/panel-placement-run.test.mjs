import { describe, expect, it, vi } from "vitest";

import {
  panelPlacementBriefs,
  panelPlacementLedgerVerificationFailure,
  panelPlacementRequestedLastStep,
  readVerifiedPanelPlacementLedger,
} from "./panel-placement-run.mjs";

const DIGEST = `sha256:${"0".repeat(64)}`;
const retained = {
  schemaVersion: "lego.real-build-action-ledger/4",
  pdfDigest: DIGEST,
  officialModelDigest: DIGEST,
  coverageDigest: DIGEST,
  calloutManifestDigest: DIGEST,
  sourceArtReboundDigest: DIGEST,
  builderCalibrationDigest: DIGEST,
  transitionClassificationsDigest: DIGEST,
  steps: [
    {
      stepNumber: 1,
      action: {
        kind: "transition",
        transition: "rotation",
        classificationEvidenceDigest: DIGEST,
      },
    },
  ],
  provenance: {
    generator: "apps/web/e2e/real-build-action-ledger.spec.ts",
    authenticated: false,
    expectedPrintedSteps: 359,
    requestedLastStep: 1,
    alignedThroughStep: 1,
    stopReason: "test prefix is closed",
    directPieceCount: 0,
    transitionStepCount: 1,
    refusals: [],
  },
};
const encoded = Buffer.from(`${JSON.stringify(retained)}\n`, "utf8");
const compiled = (overrides = {}) => ({
  encoded,
  emitted: retained,
  validationFailures: [],
  expectedPrintedSteps: 359,
  requestedLastStep: 1,
  validatedThroughStep: 1,
  ...overrides,
});

describe("panel-placement action-ledger preflight", () => {
  it("returns the exact in-memory canonical ledger only when retained bytes match", async () => {
    const canonical = compiled();
    const compile = vi.fn(async () => canonical);
    const result = await readVerifiedPanelPlacementLedger({
      readRetainedBytes: () => encoded,
      compile,
    });
    expect(compile).toHaveBeenCalledOnce();
    expect(compile).toHaveBeenCalledWith(1);
    expect(result.ledger).toBe(canonical.emitted);
    expect(result.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
  });

  it("retains a canonically verified nonempty partial prefix without claiming later rows", async () => {
    const partial = {
      ...retained,
      provenance: {
        ...retained.provenance,
        requestedLastStep: 50,
        stopReason: "corroboration stopped honestly after step 1 of requested prefix 50",
      },
    };
    const partialEncoded = Buffer.from(`${JSON.stringify(partial)}\n`, "utf8");
    const canonical = compiled({
      encoded: partialEncoded,
      emitted: partial,
      requestedLastStep: 50,
      validatedThroughStep: 1,
    });
    const compile = vi.fn(async () => canonical);
    const result = await readVerifiedPanelPlacementLedger({
      readRetainedBytes: () => partialEncoded,
      compile,
    });
    expect(compile).toHaveBeenCalledWith(50);
    expect(result.ledger.steps).toHaveLength(1);
    expect(result.ledger.provenance).toMatchObject({
      requestedLastStep: 50,
      alignedThroughStep: 1,
    });
    expect(() => panelPlacementBriefs(result.ledger, [2])).toThrow(
      /Action ledger has no printed step 2/u,
    );
  });

  it("requires an explicit retained prefix and rejects empty canonical validation", () => {
    expect(panelPlacementRequestedLastStep(encoded)).toBe(1);
    expect(() =>
      panelPlacementRequestedLastStep(Buffer.from('{"provenance":{}}\n', "utf8")),
    ).toThrow(/explicit requestedLastStep from 1 through 50/u);
    expect(
      panelPlacementLedgerVerificationFailure(
        encoded,
        compiled({ validatedThroughStep: 0, validationFailures: [] }),
      ),
    ).toContain("validated through 0");
  });

  it("rejects legacy /3, extra provenance fields, and any raw tail above the request", () => {
    const legacy = { ...retained, schemaVersion: "lego.real-build-action-ledger/3" };
    expect(() =>
      panelPlacementRequestedLastStep(Buffer.from(JSON.stringify(legacy), "utf8")),
    ).toThrow(/bounded current \/4 action ledger/u);
    const extraProvenance = {
      ...retained,
      provenance: { ...retained.provenance, broaderTailIsSafe: true },
    };
    expect(() =>
      panelPlacementRequestedLastStep(Buffer.from(JSON.stringify(extraProvenance), "utf8")),
    ).toThrow(/bounded current \/4 action ledger/u);
    const tail = {
      ...retained,
      steps: [...retained.steps, { stepNumber: 2, action: { kind: "transition" } }],
      provenance: { ...retained.provenance, alignedThroughStep: 2, transitionStepCount: 2 },
    };
    expect(() =>
      panelPlacementRequestedLastStep(Buffer.from(JSON.stringify(tail), "utf8")),
    ).toThrow(/bounded current \/4 action ledger/u);
  });

  it("rejects stale bytes and validation failures with bounded diagnostics", async () => {
    expect(panelPlacementLedgerVerificationFailure(Buffer.from("stale"), compiled())).toMatch(
      /retained bytes digest sha256:[0-9a-f]{64}.*canonical compiled digest/u,
    );
    const hostile = "unbounded-message".repeat(100_000);
    const failures = Array.from({ length: 12 }, (_, index) => ({
      code: `category-${index}`,
      message: hostile,
    }));
    const failure = panelPlacementLedgerVerificationFailure(
      encoded,
      compiled({
        validationFailures: failures,
      }),
    );
    expect(failure).toContain("through assembled step 1");
    expect(failure).toContain("4 more categories omitted");
    expect(failure).not.toContain(hostile);
    expect(failure.length).toBeLessThan(1_000);
    await expect(
      readVerifiedPanelPlacementLedger({
        readRetainedBytes: () => encoded,
        compile: async () => compiled({ validationFailures: failures }),
      }),
    ).rejects.toThrow(/no output or model call started/u);
  });

  it("preflights the whole requested range before jobs can be started", () => {
    const ledger = {
      steps: [{ stepNumber: 1, action: { kind: "place-callouts", pieces: [] } }],
    };
    expect(() => panelPlacementBriefs(ledger, [1, 999])).toThrow(
      /unique integer from 1 through 50/u,
    );
    expect(() => panelPlacementBriefs(ledger, [1, 2])).toThrow(
      /Action ledger has no printed step 2/u,
    );
  });
});
