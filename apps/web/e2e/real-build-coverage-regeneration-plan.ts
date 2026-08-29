export interface RetainedCoverageMode {
  readonly source: string;
  readonly model: string;
  readonly assignment: string;
}

export interface CoverageRegenerationPlan {
  readonly route: "legacy-identification" | "prefix50-semantic-closure";
  readonly argv: readonly string[];
}

export type RealBuildRegenerationTarget = "calibration" | "action-ledger";

export function parseRealBuildRegenerationTarget(
  value: string | undefined,
): RealBuildRegenerationTarget {
  if (value === undefined || value === "" || value === "action-ledger") return "action-ledger";
  if (value === "calibration") return value;
  throw new TypeError(
    `LEGO_REAL_BUILD_REGENERATE_THROUGH must be calibration or action-ledger; received ${JSON.stringify(value)}.`,
  );
}

const LEGACY_SOURCES = new Set(["deterministic", "adjudicated"]);

/**
 * Selects the compiler that can reproduce the retained coverage authority.
 * A semantic-closure artifact cannot be relabelled as either legacy source mode.
 */
export function planRealBuildCoverageRegeneration(
  mode: RetainedCoverageMode,
  requestedLastStep: number,
): CoverageRegenerationPlan {
  if (!Number.isInteger(requestedLastStep) || requestedLastStep < 1 || requestedLastStep > 50) {
    throw new TypeError(
      `Catalog coverage regeneration supports an integer requested last step from 1 through 50; received ${JSON.stringify(requestedLastStep)}.`,
    );
  }

  if (mode.source === "prefix50-semantic-closure") {
    if (
      mode.assignment !== "exact-verified-semantic-identity" ||
      mode.model !== "" ||
      requestedLastStep !== 50
    ) {
      throw new TypeError(
        "Prefix-50 semantic coverage can be replayed only for exact-verified-semantic-identity, " +
          "without a model, and at the exact printed-step-50 boundary.",
      );
    }
    return {
      route: "prefix50-semantic-closure",
      argv: ["scripts/booklet-catalog-coverage-semantic-cli.mjs"],
    };
  }

  if (!LEGACY_SOURCES.has(mode.source)) {
    throw new TypeError(
      `Retained catalog coverage declares unsupported source ${JSON.stringify(mode.source)}; ` +
        "no regeneration compiler was selected.",
    );
  }
  if (mode.source === "adjudicated" && mode.model === "") {
    throw new TypeError(
      "Adjudicated catalog coverage regeneration requires its retained model id.",
    );
  }

  return {
    route: "legacy-identification",
    argv: [
      "scripts/booklet-catalog-coverage.mjs",
      "--source",
      mode.source,
      ...(mode.model === "" ? [] : ["--model", mode.model]),
      "--assign",
      mode.assignment,
      "--last-step",
      String(requestedLastStep),
    ],
  };
}
