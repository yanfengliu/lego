import { describe, expect, it } from "vitest";

import { createRealBuildPrefix50VerifiedProjectionReader } from "./part-identification-prefix50-verified-projection.mjs";

describe("prefix-50 opaque verified-projection boundary", () => {
  it("rejects parsed artifacts and caller-shaped opaque-handle lookalikes", () => {
    expect(() =>
      createRealBuildPrefix50VerifiedProjectionReader({
        actionPreparation: { bytes: Buffer.from("{}"), verified: {} },
        officialWorldReconciliation: { bytes: Buffer.from("{}"), verified: {} },
        structuralEvents: { bytes: Buffer.from("{}"), verified: {} },
      }),
    ).toThrow(/opaque independent-verifier result/u);
  });
});
