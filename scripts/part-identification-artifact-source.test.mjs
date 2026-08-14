import { describe, expect, it } from "vitest";

import { fixture } from "./booklet-catalog-coverage-test-fixture.mjs";
import { assertV6CalloutManifest } from "./part-identification-artifacts.mjs";

function manifestRunId(manifest) {
  return /^runs\/([0-9a-f]{24})\//u.exec(manifest.callouts[0].file)[1];
}

describe("v6 callout publication run binding", () => {
  it("accepts the one content-addressed directory derived by the producer seam", () => {
    const prepared = fixture();
    expect(() =>
      assertV6CalloutManifest(prepared.manifest, prepared.manifestExpectation),
    ).not.toThrow();
  });

  it("refuses physical crop paths spliced from different retained runs", () => {
    const prepared = fixture();
    const manifest = structuredClone(prepared.manifest);
    const firstRunId = manifestRunId(manifest);
    const otherRunId = firstRunId === "f".repeat(24) ? "e".repeat(24) : "f".repeat(24);
    manifest.callouts[1].file = manifest.callouts[1].file.replace(firstRunId, otherRunId);
    expect(() => assertV6CalloutManifest(manifest, prepared.manifestExpectation)).toThrow(
      new RegExp(
        `entry 1 selects run ${otherRunId}.*earlier records select run ${firstRunId}.*one immutable publication run`,
        "su",
      ),
    );
  });

  it("refuses a uniformly renamed run whose metadata derives another address", () => {
    const prepared = fixture();
    const manifest = structuredClone(prepared.manifest);
    const derivedRunId = manifestRunId(manifest);
    const forgedRunId = derivedRunId === "f".repeat(24) ? "e".repeat(24) : "f".repeat(24);
    for (const callout of manifest.callouts) {
      callout.file = callout.file.replace(derivedRunId, forgedRunId);
    }
    expect(() => assertV6CalloutManifest(manifest, prepared.manifestExpectation)).toThrow(
      new RegExp(`selects run ${forgedRunId}.*derive content-addressed run ${derivedRunId}`, "su"),
    );
  });
});
