import { describe, expect, it } from "vitest";

import {
  parseRealBuildRegenerationTarget,
  planRealBuildCoverageRegeneration,
} from "../e2e/real-build-coverage-regeneration-plan";

describe("real-build coverage regeneration plan", () => {
  it("routes the exact first-50 semantic authority through its dedicated verifier", () => {
    expect(
      planRealBuildCoverageRegeneration(
        {
          source: "prefix50-semantic-closure",
          model: "",
          assignment: "exact-verified-semantic-identity",
        },
        50,
      ),
    ).toEqual({
      route: "prefix50-semantic-closure",
      argv: ["scripts/booklet-catalog-coverage-semantic-cli.mjs"],
    });
  });

  it.each([
    [49, "exact-verified-semantic-identity", ""],
    [50, "one-to-one", ""],
    [50, "exact-verified-semantic-identity", "caller-model"],
  ])(
    "refuses semantic authority drift at step %i, assignment %s, model %s",
    (lastStep, assignment, model) => {
      expect(() =>
        planRealBuildCoverageRegeneration(
          { source: "prefix50-semantic-closure", model, assignment },
          lastStep,
        ),
      ).toThrow(/exact printed-step-50 boundary/u);
    },
  );

  it("retains the legacy adjudicated compiler route and its exact options", () => {
    expect(
      planRealBuildCoverageRegeneration(
        { source: "adjudicated", model: "pinned-model", assignment: "one-to-one" },
        17,
      ),
    ).toEqual({
      route: "legacy-identification",
      argv: [
        "scripts/booklet-catalog-coverage.mjs",
        "--source",
        "adjudicated",
        "--model",
        "pinned-model",
        "--assign",
        "one-to-one",
        "--last-step",
        "17",
      ],
    });
  });

  it("refuses an unknown retained source rather than falling back", () => {
    expect(() =>
      planRealBuildCoverageRegeneration(
        { source: "unknown", model: "", assignment: "one-to-one" },
        50,
      ),
    ).toThrow(/unsupported source/u);
  });

  it("defaults to the complete chain and admits only an explicit calibration boundary", () => {
    expect(parseRealBuildRegenerationTarget(undefined)).toBe("action-ledger");
    expect(parseRealBuildRegenerationTarget("action-ledger")).toBe("action-ledger");
    expect(parseRealBuildRegenerationTarget("calibration")).toBe("calibration");
    expect(() => parseRealBuildRegenerationTarget("coverage")).toThrow(
      /must be calibration or action-ledger/u,
    );
  });
});
