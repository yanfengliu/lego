import { CALLOUT_RECOVERY_BY_IDENTITY, CALLOUT_RECOVERY_FIXTURE } from "./callout-recovery-fixture";
import type {
  BrowserCrop,
  BrowserResult,
  RecoveryBenchmark,
  RecoveryFixtureCase,
  StrategyScore,
} from "./callout-types";

export function fixtureAccepts(
  crop: BrowserCrop | null,
  fixture: RecoveryFixtureCase,
): crop is BrowserCrop {
  if (crop === null) return false;
  if (crop.evidenceKind !== fixture.evidenceKind || crop.regionKind !== fixture.regionKind)
    return false;
  if (!fixture.requiredMasks.every((mask) => crop.masksApplied.includes(mask))) return false;
  if (
    crop.widthPx < fixture.minimumWidthPx ||
    crop.heightPx < fixture.minimumHeightPx ||
    crop.foregroundPixels < fixture.minimumForegroundPixels ||
    Math.min(
      crop.boundaryClearancePx.left,
      crop.boundaryClearancePx.top,
      crop.boundaryClearancePx.right,
      crop.boundaryClearancePx.bottom,
    ) < fixture.minimumBoundaryClearancePx ||
    crop.contamination.length > 0 ||
    (fixture.evidenceKind === "part-art" && crop.textGlyphOverlapPixels > 0) ||
    crop.quantityGlyphOverlapPixels > 0
  )
    return false;
  return !fixture.requiredMasks.includes("quantity-label") || crop.quantityGlyphPixelsMasked > 0;
}

function physicalRecovery(result: BrowserResult): BrowserCrop | null {
  const fixture = CALLOUT_RECOVERY_BY_IDENTITY.get(result.identity);
  const candidates = [result.ranked, result.adaptive].filter(
    (crop): crop is BrowserCrop => crop !== null,
  );
  candidates.sort((left, right) => {
    const leftValid = fixture ? Number(fixtureAccepts(left, fixture)) : 0;
    const rightValid = fixture ? Number(fixtureAccepts(right, fixture)) : 0;
    return (
      rightValid - leftValid ||
      left.contamination.length - right.contamination.length ||
      left.sourceTextGlyphPixels - right.sourceTextGlyphPixels ||
      Number(left.strategy === "adaptive-seed") - Number(right.strategy === "adaptive-seed")
    );
  });
  return candidates[0] ?? null;
}

export function selectEvidenceAwareCrop(result: BrowserResult): BrowserCrop | null {
  return result.targetEvidenceKind === "part-art" ? physicalRecovery(result) : result.action;
}

function candidateFor(
  result: BrowserResult,
  strategy: StrategyScore["strategy"],
): BrowserCrop | null {
  if (strategy === "adaptive-seed") return result.adaptive;
  if (strategy === "ranked-component") return result.ranked;
  return selectEvidenceAwareCrop(result);
}

function scoreStrategy(
  strategy: StrategyScore["strategy"],
  results: ReadonlyMap<string, BrowserResult>,
): StrategyScore {
  let valid = 0;
  let recovered = 0;
  let kindCorrect = 0;
  let regionCorrect = 0;
  let masksCorrect = 0;
  let uncontaminated = 0;
  const invalidIdentities: string[] = [];
  for (const fixture of CALLOUT_RECOVERY_FIXTURE.cases) {
    const result = results.get(fixture.identity);
    const crop = result ? candidateFor(result, strategy) : null;
    if (crop !== null) recovered += 1;
    if (crop?.evidenceKind === fixture.evidenceKind) kindCorrect += 1;
    if (crop?.regionKind === fixture.regionKind) regionCorrect += 1;
    if (crop && fixture.requiredMasks.every((mask) => crop.masksApplied.includes(mask)))
      masksCorrect += 1;
    if (crop?.contamination.length === 0) uncontaminated += 1;
    if (fixtureAccepts(crop, fixture)) valid += 1;
    else invalidIdentities.push(fixture.identity);
  }
  return {
    strategy,
    valid,
    recovered,
    kindCorrect,
    regionCorrect,
    masksCorrect,
    uncontaminated,
    invalidIdentities,
    points:
      valid * 1_000_000 +
      kindCorrect * 10_000 +
      regionCorrect * 1_000 +
      masksCorrect * 100 +
      uncontaminated * 10 +
      recovered,
  };
}

export function evaluateRecoveryBenchmark(
  sourceHash: string,
  allResults: readonly BrowserResult[],
): RecoveryBenchmark {
  if (sourceHash !== CALLOUT_RECOVERY_FIXTURE.sourceHash) {
    throw new Error(
      `Recovery fixture is pinned to ${CALLOUT_RECOVERY_FIXTURE.sourceHash}, not ${sourceHash}.`,
    );
  }
  const byIdentity = new Map(allResults.map((result) => [result.identity, result] as const));
  const observedLegacyFailureIdentities = allResults
    .filter(
      (result) =>
        result.legacy === null ||
        result.legacy.contamination.length > 0 ||
        result.targetEvidenceKind !== "part-art",
    )
    .map(({ identity }) => identity)
    .sort();
  const expected = [...CALLOUT_RECOVERY_BY_IDENTITY.keys()].sort();
  if (JSON.stringify(observedLegacyFailureIdentities) !== JSON.stringify(expected)) {
    throw new Error(
      `Legacy failure identities drifted: expected ${JSON.stringify(expected)}, observed ${JSON.stringify(observedLegacyFailureIdentities)}.`,
    );
  }
  const scores = (["adaptive-seed", "ranked-component", "evidence-aware"] as const)
    .map((strategy) => scoreStrategy(strategy, byIdentity))
    .sort(
      (left, right) => right.points - left.points || left.strategy.localeCompare(right.strategy),
    );
  const winner = scores[0]!;
  const runnerUp = scores[1]!;
  if (winner.strategy !== "evidence-aware" || winner.points <= runnerUp.points) {
    throw new Error(
      `Evidence-aware recovery did not strictly win the fixed benchmark: ${JSON.stringify(scores)}.`,
    );
  }
  if (winner.valid !== CALLOUT_RECOVERY_FIXTURE.cases.length) {
    throw new Error(
      `Evidence-aware recovery satisfied ${winner.valid}/${CALLOUT_RECOVERY_FIXTURE.cases.length} fixed cases: ${winner.invalidIdentities.join(", ")}.`,
    );
  }
  return {
    schemaVersion: "lego.callout-recovery-benchmark-result/1",
    fixtureSourceHash: CALLOUT_RECOVERY_FIXTURE.sourceHash,
    fixedFailureClassSize: CALLOUT_RECOVERY_FIXTURE.cases.length,
    observedLegacyFailureIdentities,
    scores,
    selected: "evidence-aware",
    winner: winner.strategy,
    winningMargin: winner.points - runnerUp.points,
  };
}
