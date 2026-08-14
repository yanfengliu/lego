import { describe, expect, it } from "vitest";

import { requirePublishableRealBuildActionLedger } from "../e2e/real-build-action-ledger-compile";
import type { StepFailure } from "../e2e/real-build-safety";

describe("action-ledger publisher write barrier", () => {
  it("accepts only a fully validated assembled prefix", () => {
    expect(() =>
      requirePublishableRealBuildActionLedger({ validatedThroughStep: 26, validationFailures: [] }),
    ).not.toThrow();
  });

  it("rejects before write with bounded categories instead of raw failure text", () => {
    const hostile = "raw-attacker-diagnostic-".repeat(10_000);
    const validationFailures = Array.from({ length: 12 }, (_, index): StepFailure => ({
      code: `category-${index}` as StepFailure["code"],
      stage: "input",
      message: hostile,
    }));
    let caught: unknown;
    try {
      requirePublishableRealBuildActionLedger({ validatedThroughStep: 26, validationFailures });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TypeError);
    const message = (caught as Error).message;
    expect(message).toContain("Refusing to publish");
    expect(message).toContain("through its complete assembled prefix ending at printed step 26");
    expect(message).toContain("4 more categories omitted");
    expect(message).toContain("no ledger file was written");
    expect(message).not.toContain(hostile);
    expect(message.length).toBeLessThan(1_500);
  });
});
