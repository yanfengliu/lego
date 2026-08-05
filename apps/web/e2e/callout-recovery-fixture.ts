import type { RecoveryFixtureCase } from "./callout-types";

/**
 * Preregistered against the immutable 6651557 source below. These are the
 * exact labels for which the old component seed was missing, text-only,
 * contaminated, or the wrong semantic evidence type. The fixture is
 * intentionally independent of runtime output:
 * extraction must match this identity set and satisfy these fixed predicates.
 */
export const CALLOUT_RECOVERY_FIXTURE = Object.freeze({
  schemaVersion: "lego.callout-recovery-benchmark/1" as const,
  sourceHash: "sha256:baef0a373164b58d7c982984b52d4e50b10cc59ed28007acb456faa72359bd27",
  cases: [
    semantic("p103|q2|x253.179|y92.215", 450, 250),
    physical("p110|q2|x22.677|y409.789"),
    physical("p110|q2|x22.677|y460.544"),
    physical("p110|q2|x22.677|y492.031"),
    physical("p111|q4|x42.520|y445.292"),
    physical("p111|q4|x42.520|y489.871"),
    semantic("p111|q4|x725.103|y415.705", 850, 500),
    semantic("p147|q2|x532.191|y440.120", 350, 300),
    physical("p158|q1|x395.433|y442.591"),
    semantic("p173|q2|x330.444|y327.720", 1_100, 450),
    semantic("p182|q2|x333.883|y418.464", 750, 350),
    semantic("p187|q2|x268.113|y339.249", 800, 350),
    semantic("p199|q2|x315.163|y148.519", 250, 400),
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
    semantic("p213|q2|x112.849|y272.876", 250, 500),
    semantic("p216|q2|x353.685|y318.273", 1_550, 350),
    physical("p22|q2|x109.082|y495.055"),
    physical("p24|q3|x139.735|y493.255"),
    semantic("p32|q2|x511.589|y390.747", 250, 400),
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
    semantic("p76|q2|x315.636|y170.033", 650, 400),
    semantic("p79|q2|x357.198|y161.718", 750, 300),
    physical("p81|q4|x158.187|y491.455"),
    semantic("p89|q2|x332.007|y431.482", 450, 250),
    semantic("p93|q2|x332.066|y400.171", 450, 250),
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
    semantic("p99|q2|x267.940|y62.979", 450, 250),
  ] satisfies readonly RecoveryFixtureCase[],
});

/** Source-pinned conservation totals for a fresh full-booklet publication. */
export const FULL_BOOKLET_CALLOUT_ACCOUNTING = Object.freeze({
  rawNxIdentityCount: 881,
  rawNxQuantityTotal: 1_512,
  physicalPartArtIdentityCount: 863,
  physicalPartArtQuantityTotal: 1_472,
  semanticIdentityCount: 18,
  semanticQuantityTotal: 40,
  fixedFailureClassSize: 34,
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

function semantic(
  identity: string,
  minimumWidthPx: number,
  minimumHeightPx: number,
): RecoveryFixtureCase {
  return {
    identity,
    evidenceKind: "subassembly-repeat",
    regionKind: "vector-box-full",
    requiredMasks: ["quantity-label"],
    minimumWidthPx,
    minimumHeightPx,
    minimumForegroundPixels: 10_000,
    minimumBoundaryClearancePx: 16,
  };
}

export const CALLOUT_RECOVERY_BY_IDENTITY = new Map(
  CALLOUT_RECOVERY_FIXTURE.cases.map((entry) => [entry.identity, entry] as const),
);

export const SEMANTIC_CALLOUTS = CALLOUT_RECOVERY_FIXTURE.cases.filter(
  ({ evidenceKind }) => evidenceKind !== "part-art",
);
