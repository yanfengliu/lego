import type { RecoveryFixtureCase } from "./callout-types";

/**
 * Preregistered against the immutable 6651557 source below. These are the
 * exact labels for which the old component seed was missing, text-only, or
 * contaminated. The fixture is intentionally independent of runtime output:
 * extraction must match this identity set and satisfy these fixed predicates.
 */
export const CALLOUT_RECOVERY_FIXTURE = Object.freeze({
  schemaVersion: "lego.callout-recovery-benchmark/1" as const,
  sourceHash: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
  cases: [
    physical("p110|q2|x22.677|y409.789"),
    physical("p110|q2|x22.677|y460.544"),
    physical("p110|q2|x22.677|y492.031"),
    physical("p111|q4|x42.520|y445.292"),
    physical("p111|q4|x42.520|y489.871"),
    physical("p158|q1|x395.433|y442.591"),
    physical("p209|q2|x105.151|y496.735"),
    {
      identity: "p209|q2|x650.759|y397.824",
      evidenceKind: "assembly-action",
      regionKind: "vector-box-full",
      requiredMasks: ["quantity-label"],
      minimumWidthPx: 700,
      minimumHeightPx: 300,
      minimumForegroundPixels: 5_000,
      minimumBoundaryClearancePx: 16,
    },
    physical("p213|q4|x154.442|y474.991"),
    physical("p22|q2|x109.082|y495.055"),
    physical("p24|q3|x139.735|y493.255"),
    {
      identity: "p33|q4|x274.854|y340.077",
      evidenceKind: "subassembly-repeat",
      regionKind: "vector-box-full",
      requiredMasks: ["quantity-label"],
      minimumWidthPx: 1_200,
      minimumHeightPx: 500,
      minimumForegroundPixels: 10_000,
      minimumBoundaryClearancePx: 16,
    },
    physical("p62|q1|x138.488|y474.991"),
    physical("p64|q1|x126.704|y495.055"),
    physical("p68|q1|x135.751|y474.991"),
    physical("p81|q4|x158.187|y491.455"),
    {
      identity: "p96|q2|x685.147|y70.803",
      evidenceKind: "assembly-action",
      regionKind: "panel-neighbor-action",
      requiredMasks: ["quantity-label"],
      minimumWidthPx: 1_200,
      minimumHeightPx: 700,
      minimumForegroundPixels: 10_000,
      minimumBoundaryClearancePx: 16,
    },
    physical("p96|q4|x23.652|y364.342"),
    physical("p96|q8|x23.652|y410.868"),
  ] satisfies readonly RecoveryFixtureCase[],
});

function physical(identity: string): RecoveryFixtureCase {
  return {
    identity,
    evidenceKind: "part-art",
    regionKind: "isolated-component",
    requiredMasks: ["all-pdf-text"],
    minimumWidthPx: 64,
    minimumHeightPx: 64,
    minimumForegroundPixels: 1_000,
    minimumBoundaryClearancePx: 0,
  };
}

export const CALLOUT_RECOVERY_BY_IDENTITY = new Map(
  CALLOUT_RECOVERY_FIXTURE.cases.map((entry) => [entry.identity, entry] as const),
);

export const SEMANTIC_CALLOUTS = CALLOUT_RECOVERY_FIXTURE.cases.filter(
  ({ evidenceKind }) => evidenceKind !== "part-art",
);
