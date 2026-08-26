/**
 * What the catalog version invalidates, in the order it has to be rebuilt.
 *
 * Three real-build inputs are derived from the pinned catalog and from each
 * other, and none of them says so. A catalog bump leaves every one of them
 * correct-looking and stale, and the first symptom is a real-build rejection
 * that reads like a modeling failure in somebody else's lane. Twice in one day
 * that cost a session: `builder-canonical-calibration.json` rejected a run as
 * `builder-calibration-invalid` after `builtin.basic-parts/7` landed, and
 * `catalog-coverage.json` stopped reproducing mid-run when `/8` landed.
 *
 * So the order lives here once, as data, and both the regeneration entry point
 * and the rejection messages read it. A message that names the stale input
 * without naming the command and the ordering is only half an error: regenerate
 * the middle of this chain first and it is stale again by the time the run
 * reads it.
 */

export interface RealBuildInputChainStage {
  /** Ordinal position; a stage may only be rebuilt after every lower ordinal. */
  readonly order: number;
  readonly artifact: string;
  /** What makes this stage stale. */
  readonly derivedFrom: readonly string[];
  /** The exact command that rebuilds it. */
  readonly command: string;
}

export const REAL_BUILD_INPUT_CHAIN: readonly RealBuildInputChainStage[] = [
  {
    order: 1,
    artifact: "apps/web/e2e/real-build-builder-sources.ts",
    derivedFrom: ["the pinned catalog's part definitions, geometry, connectors and collision"],
    command:
      "update the reviewed BUILDER_STEP1_DESIGN_SOURCES digests in the same change that bumps BUILTIN_CATALOG_VERSION",
  },
  {
    order: 2,
    artifact: "output/real-build/catalog-coverage.json",
    derivedFrom: ["the pinned catalog", "the callout manifest", "the identification closure"],
    command:
      "node scripts/booklet-catalog-coverage.mjs --source <deterministic|adjudicated> --model <pinned-id> --assign <nearest|one-to-one|quantity-informed> --last-step <1..359>",
  },
  {
    order: 3,
    artifact: "output/real-build/builder-canonical-calibration.json",
    derivedFrom: ["the pinned catalog", "the reviewed Builder source pins", "the official model"],
    command: "python -B scripts/generate-builder-calibration.py",
  },
  {
    order: 4,
    artifact: "output/real-build/action-ledger.json",
    derivedFrom: [
      "output/real-build/catalog-coverage.json",
      "output/real-build/builder-canonical-calibration.json",
      "output/real-build/transition-classifications.json",
      "the official model",
    ],
    command:
      "LEGO_REAL_BUILD_LAST_STEP=<1..359> LEGO_REAL_BUILD_PUBLISH_ACTION_LEDGER=1 npx playwright test apps/web/e2e/real-build-action-ledger.spec.ts",
  },
] as const;

export const REAL_BUILD_INPUT_CHAIN_ENTRY_POINT =
  "LEGO_REAL_BUILD_LAST_STEP=<1..359> LEGO_REAL_BUILD_REGENERATE_INPUTS=1 npx playwright test apps/web/e2e/real-build-inputs.spec.ts" as const;

function stageFor(artifact: string): RealBuildInputChainStage {
  const stage = REAL_BUILD_INPUT_CHAIN.find((candidate) => candidate.artifact === artifact);
  if (stage === undefined) {
    throw new TypeError(
      `${artifact} is not a declared real-build input-chain stage. Add it to REAL_BUILD_INPUT_CHAIN ` +
        `with its ordinal, what it is derived from, and the exact command that rebuilds it, so a ` +
        `rejection can name all three.`,
    );
  }
  return stage;
}

/**
 * The recovery half of a staleness rejection: what to run, and in what order.
 *
 * Callers append this to a message that has already named what was stale and
 * which input caused it, so the whole rejection says what happened, what caused
 * it, and what would satisfy it.
 */
export function realBuildInputChainRecovery(artifact: string): string {
  const stage = stageFor(artifact);
  const earlier = REAL_BUILD_INPUT_CHAIN.filter(({ order }) => order < stage.order);
  return (
    `Rebuild it with: ${stage.command}. ` +
    `It is derived from ${stage.derivedFrom.join(", ")}, so a change to any of those makes it stale. ` +
    (earlier.length === 0
      ? `It is first in the real-build input chain, so nothing has to be rebuilt before it. `
      : `It is stage ${stage.order} of ${REAL_BUILD_INPUT_CHAIN.length} in the real-build input chain and ` +
        `must not be rebuilt before ${earlier.map(({ artifact: path }) => path).join(" then ")} — ` +
        `regenerating the middle of the chain first republishes it against inputs that are themselves ` +
        `stale. `) +
    `Run \`${REAL_BUILD_INPUT_CHAIN_ENTRY_POINT}\` to rebuild the whole chain in order.`
  );
}

/** The ordered chain as prose, for an entry point or a report that has to show all of it. */
export function describeRealBuildInputChain(): string {
  return REAL_BUILD_INPUT_CHAIN.map(
    ({ order, artifact, command }) => `${order}. ${artifact} — ${command}`,
  ).join("\n");
}
