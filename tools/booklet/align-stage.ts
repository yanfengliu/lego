import { elementKeyOf, type AnswerKey } from "./answer-key/index.ts";
import { alignSteps, checkInventoryAgainstModel, type InventoryCheck } from "./align.ts";
import { descending } from "./align-identity.ts";
import { repairAlignment, stepMatches, type RepairWindow } from "./align-repair.ts";
import { scoreIdentityAgainstModel, type IdentityScore } from "./identify-score.ts";
import type { IdentifyStage, StepIdentity } from "./identify-stage.ts";
import type { BookletRead } from "./read.ts";

/**
 * Stage 2 assembled: the run alignment, its local repair, and the checks that
 * say whether the result can be trusted — per-element inventory conservation,
 * the bricks no step places, and bag order (no brick is used before the page
 * that opens its bag).
 *
 * With identification (identify-stage.ts) the alignment holds each printed
 * step to the elements its callouts draw, and the alignment by counts alone
 * is kept beside it as a comparison, so a step whose bricks change between
 * the two is visible. Playback and the reference build use the identity
 * alignment. Without identification every step is aligned by counts, as
 * before.
 */
export const ALIGN_STAGE_VERSION = "lego.booklet-align/2";

/**
 * How a matched step came to match: `run order` when the official sequence,
 * cut into runs, satisfied it untouched; `repair` when the local repair chose
 * its bricks to satisfy it — a fit by construction, not independent evidence.
 */
export type MatchBasis = "run order" | "repair";

/**
 * What a step was held to and whether it held: `identity` (every callout
 * trusted, the bricks are exactly its elements), `count fallback` (some
 * callout flagged, or identification disagreed with the text read, so part
 * or all of the step matched by counts), `counts` (aligned without
 * identification), or `mismatch`.
 */
export type StepVerdict = "identity" | "count fallback" | "counts" | "mismatch";

export interface AlignedPrintedStep {
  readonly step: number;
  readonly page: number;
  readonly matched: boolean;
  readonly verdict: StepVerdict;
  /** Null for an unmatched step. */
  readonly matchedBy: MatchBasis | null;
  /** True when the local repair changed this step's bricks. */
  readonly repaired: boolean;
  /** Callouts matched by count only: flagged ones, or all when the step has no identity. */
  readonly countedCallouts: number;
  readonly expected: readonly number[];
  readonly actual: readonly number[];
  /** Official brick uuids this step adds, in official build order. */
  readonly bricks: readonly string[];
  /** Last build unit the run alignment gave this step (for sub-build attach timing). */
  readonly unitEnd: number;
}

export interface BagViolation {
  readonly step: number;
  readonly page: number;
  readonly brick: string;
  readonly bag: number;
  readonly bagOpensOnPage: number;
}

export type AlignWindow = RepairWindow & { readonly firstStep: number; readonly lastStep: number };

/** One alignment's counts: how many steps run order matched, repair fitted, or neither. */
export interface AlignmentCounts {
  /** Steps the run alignment matched before any repair. */
  readonly runMatchedSteps: number;
  /** Steps that satisfy their criterion, however they got there. */
  readonly matchedSteps: number;
  /** Matched steps whose bricks the repair left as the run alignment gave them. */
  readonly matchedByRunOrder: number;
  /** Matched steps whose bricks the repair chose to satisfy them. */
  readonly fittedByRepair: number;
  readonly mismatchedSteps: readonly number[];
  readonly windows: readonly AlignWindow[];
}

export interface IdentityCounts {
  /** Matched steps held to identity with every callout trusted. */
  readonly exact: number;
  readonly exactByRunOrder: number;
  readonly exactByRepair: number;
  /** Of the exact steps, those printing no callouts (nothing to identify). */
  readonly exactWithoutCallouts: number;
  readonly countFallback: number;
  readonly mismatched: number;
}

export interface AlignStage extends AlignmentCounts {
  readonly version: typeof ALIGN_STAGE_VERSION;
  /** What the steps below were aligned by. */
  readonly basis: "identity" | "counts";
  readonly steps: readonly AlignedPrintedStep[];
  /** Null when the alignment is by counts. */
  readonly identity: IdentityCounts | null;
  /** The alignment by counts alone, kept as a comparison; null when it is the alignment above. */
  readonly byCounts: AlignmentCounts | null;
  /** Steps whose parts (elements) differ between the identity alignment and the one by counts. */
  readonly partsChangedFromCounts: readonly number[];
  /** Steps whose bricks differ at all, other copies of the same element included (each has its own pose). */
  readonly bricksChangedFromCounts: readonly number[];
  /** Identification scored against the official model; null without identification. */
  readonly identityScore: IdentityScore | null;
  readonly unitsCovered: number;
  readonly unitCount: number;
  readonly unplaced: readonly {
    readonly uuid: string;
    readonly designRevision: string;
    readonly element: string;
  }[];
  readonly inventory: InventoryCheck;
  /** design/material groups (bricks without itemNos) matched to inventory elements. */
  readonly elementsMappedByInventory: number;
  readonly unresolvedElementGroups: readonly string[];
  readonly bagViolations: readonly BagViolation[];
  readonly bagOpeningsChecked: number;
  readonly sequenceProblems: readonly string[];
}

export interface ElementResolution {
  readonly elementOf: ReadonlyMap<string, string>;
  /** design/material groups mapped to an inventory element by a unique quantity match. */
  readonly mappedByInventory: number;
  readonly unresolvedGroups: readonly string[];
}

/**
 * Each brick's element id: its own itemNos when the model carries them,
 * otherwise the one inventory element whose printed quantity equals the
 * number of bricks sharing its design and material — and only when exactly
 * one unclaimed element fits.
 */
export function resolveElements(
  key: AnswerKey,
  inventory: Readonly<Record<string, number>>,
): ElementResolution {
  const elementOf = new Map<string, string>();
  const claimed = new Set<string>();
  const groups = new Map<string, string[]>();
  for (const brick of key.model.bricks) {
    if (brick.itemNos.length > 0) {
      const listed = brick.itemNos.find((item) => item in inventory) ?? brick.itemNos.join(",");
      elementOf.set(brick.uuid, listed);
      claimed.add(listed);
    } else {
      const group = elementKeyOf(brick);
      groups.set(group, [...(groups.get(group) ?? []), brick.uuid]);
    }
  }
  let mappedByInventory = 0;
  const unresolvedGroups: string[] = [];
  for (const [group, members] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
    const fits = Object.entries(inventory).filter(
      ([element, quantity]) => !claimed.has(element) && quantity === members.length,
    );
    const target = fits.length === 1 ? fits[0]![0] : group;
    if (fits.length === 1) {
      claimed.add(target);
      mappedByInventory += 1;
    } else {
      unresolvedGroups.push(
        `${group} (${members.length} bricks, ${fits.length} inventory elements fit)`,
      );
    }
    for (const uuid of members) elementOf.set(uuid, target);
  }
  return { elementOf, mappedByInventory, unresolvedGroups };
}

interface Solved {
  readonly counts: AlignmentCounts;
  readonly unitsCovered: number;
  readonly steps: readonly {
    readonly step: number;
    readonly page: number;
    readonly matched: boolean;
    readonly matchedBy: MatchBasis | null;
    readonly repaired: boolean;
    readonly unitEnd: number;
    readonly runOrder: readonly string[];
    readonly bricks: readonly string[];
  }[];
}

/** Aligns by run, repairs locally, and counts: by identity where `identities` gives a target. */
function alignAndRepair(
  read: BookletRead,
  key: AnswerKey,
  element: (uuid: string) => string,
  identities: readonly StepIdentity[] | null,
): Solved {
  const { units } = key.sequence;
  const order = new Map<string, number>();
  for (const unit of units) for (const ref of unit.brickRefs) order.set(ref, order.size);
  const run = alignSteps(
    read.steps.map((step, index) => ({ ...step, identity: identities?.[index]?.target ?? null })),
    units.map((unit) => ({ elements: unit.brickRefs.map(element) })),
  );
  const repairInput = run.steps.map((aligned, index) => ({
    callouts: read.steps[index]!.callouts,
    identity: identities?.[index]?.target ?? null,
    bricks: units
      .slice(aligned.unitStart, aligned.unitEnd)
      .flatMap((unit) => unit.brickRefs)
      .map((uuid) => ({ uuid, element: element(uuid), order: order.get(uuid)! })),
  }));
  const repaired = repairAlignment(repairInput);
  const steps = run.steps.map((aligned, index) => {
    const bricks = repaired.steps[index]!.bricks.map(({ uuid }) => uuid);
    const runOrder = repairInput[index]!.bricks.map(({ uuid }) => uuid);
    const matched = stepMatches(repaired.steps[index]!);
    const changed = runOrder.join(",") !== bricks.join(",");
    return {
      step: aligned.step,
      page: aligned.page,
      matched,
      matchedBy: matched ? (changed ? ("repair" as const) : ("run order" as const)) : null,
      repaired: changed,
      unitEnd: aligned.unitEnd,
      runOrder,
      bricks,
    };
  });
  return {
    unitsCovered: run.unitsCovered,
    steps,
    counts: {
      runMatchedSteps: run.matchedSteps,
      matchedSteps: steps.filter(({ matched }) => matched).length,
      matchedByRunOrder: steps.filter(({ matchedBy }) => matchedBy === "run order").length,
      fittedByRepair: steps.filter(({ matchedBy }) => matchedBy === "repair").length,
      mismatchedSteps: steps.filter(({ matched }) => !matched).map(({ step }) => step),
      windows: repaired.windows.map((window) => ({
        ...window,
        firstStep: read.steps[window.first]!.step,
        lastStep: read.steps[window.last]!.step,
      })),
    },
  };
}

function verdictOf(matched: boolean, identity: StepIdentity | null): StepVerdict {
  if (!matched) return "mismatch";
  if (identity === null) return "counts";
  return identity.target !== null && identity.target.flagged.length === 0
    ? "identity"
    : "count fallback";
}

function identityCounts(steps: readonly AlignedPrintedStep[], read: BookletRead): IdentityCounts {
  const exact = steps.filter(({ verdict }) => verdict === "identity");
  const noCallouts = new Set(
    read.steps.filter(({ callouts }) => callouts.length === 0).map(({ step }) => step),
  );
  return {
    exact: exact.length,
    exactByRunOrder: exact.filter(({ matchedBy }) => matchedBy === "run order").length,
    exactByRepair: exact.filter(({ matchedBy }) => matchedBy === "repair").length,
    exactWithoutCallouts: exact.filter(({ step }) => noCallouts.has(step)).length,
    countFallback: steps.filter(({ verdict }) => verdict === "count fallback").length,
    mismatched: steps.filter(({ verdict }) => verdict === "mismatch").length,
  };
}

export function runAlignStage(
  read: BookletRead,
  key: AnswerKey,
  identify: IdentifyStage | null = null,
): AlignStage {
  const resolution = resolveElements(key, read.inventory.quantities);
  const element = (uuid: string) => resolution.elementOf.get(uuid)!;
  const byCounts = alignAndRepair(read, key, element, null);
  const byIdentity = identify ? alignAndRepair(read, key, element, identify.steps) : null;
  const primary = byIdentity ?? byCounts;

  const steps: AlignedPrintedStep[] = primary.steps.map((aligned, index) => {
    const identity = identify?.steps[index] ?? null;
    const counts = new Map<string, number>();
    for (const uuid of aligned.bricks)
      counts.set(element(uuid), (counts.get(element(uuid)) ?? 0) + 1);
    return {
      step: aligned.step,
      page: aligned.page,
      matched: aligned.matched,
      verdict: verdictOf(aligned.matched, identity),
      matchedBy: aligned.matchedBy,
      repaired: aligned.repaired,
      countedCallouts: identity?.target?.flagged.length ?? read.steps[index]!.callouts.length,
      expected: descending(read.steps[index]!.callouts),
      actual: descending([...counts.values()]),
      bricks: aligned.bricks,
      unitEnd: aligned.unitEnd,
    };
  });

  const opening = new Map<number, number>();
  for (const { bag, page } of read.bagOpenings) if (!opening.has(bag)) opening.set(bag, page);
  const bagViolations: BagViolation[] = [];
  for (const step of steps) {
    for (const brick of step.bricks) {
      const bag = key.model.bags.get(brick)?.bag ?? null;
      if (bag === null || !opening.has(bag)) continue;
      if (step.page < opening.get(bag)!) {
        bagViolations.push({
          step: step.step,
          page: step.page,
          brick,
          bag,
          bagOpensOnPage: opening.get(bag)!,
        });
      }
    }
  }
  /** Steps whose bricks differ between the two alignments, compared by `identityOf` each brick. */
  const changedFromCounts = (identityOf: (uuid: string) => string) =>
    byIdentity
      ? byIdentity.steps
          .filter((aligned, index) => {
            const set = (bricks: readonly string[]) => bricks.map(identityOf).sort().join(",");
            return set(aligned.bricks) !== set(byCounts.steps[index]!.bricks);
          })
          .map(({ step }) => step)
      : [];

  return {
    version: ALIGN_STAGE_VERSION,
    basis: byIdentity ? "identity" : "counts",
    steps,
    ...primary.counts,
    identity: byIdentity ? identityCounts(steps, read) : null,
    byCounts: byIdentity ? byCounts.counts : null,
    partsChangedFromCounts: changedFromCounts(element),
    bricksChangedFromCounts: changedFromCounts((uuid) => uuid),
    identityScore:
      byIdentity && identify
        ? scoreIdentityAgainstModel(
            byIdentity.steps.map((aligned, index) => ({
              identity: identify.steps[index]!,
              runOrder: aligned.runOrder.map((uuid) => ({ uuid, element: element(uuid) })),
              final: aligned.bricks.map((uuid) => ({ uuid, element: element(uuid) })),
            })),
          )
        : null,
    unitsCovered: primary.unitsCovered,
    unitCount: key.sequence.units.length,
    unplaced: key.sequence.unplaced.map((uuid) => ({
      uuid,
      designRevision: key.brickByUuid.get(uuid)!.designRevision,
      element: element(uuid),
    })),
    inventory: checkInventoryAgainstModel(
      read.inventory.quantities,
      key.model.bricks.map(({ uuid }) => element(uuid)),
    ),
    elementsMappedByInventory: resolution.mappedByInventory,
    unresolvedElementGroups: resolution.unresolvedGroups,
    bagViolations,
    bagOpeningsChecked: opening.size,
    sequenceProblems: key.sequence.problems,
  };
}
