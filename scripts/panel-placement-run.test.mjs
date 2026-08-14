import { describe, expect, it, vi } from "vitest";

import {
  panelPlacementBriefs,
  panelPlacementLedgerVerificationFailure,
  readVerifiedPanelPlacementLedger,
} from "./panel-placement-run.mjs";

const encoded = Buffer.from('{"steps":[]}\n', "utf8");
const compiled = (overrides = {}) => ({
  encoded,
  emitted: { steps: [] },
  validationFailures: [],
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
    expect(result.ledger).toBe(canonical.emitted);
    expect(result.digest).toMatch(/^sha256:[0-9a-f]{64}$/u);
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
      compiled({ validationFailures: failures, validatedThroughStep: 26 }),
    );
    expect(failure).toContain("through assembled step 26");
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
      /unique integer from 1 through 359/u,
    );
    expect(() => panelPlacementBriefs(ledger, [1, 2])).toThrow(
      /Action ledger has no printed step 2/u,
    );
  });
});
