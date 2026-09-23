import type { AnswerKey, AnswerKeyLoad } from "./answer-key/index.ts";
import type { AlignStage } from "./align-stage.ts";
import type { CatalogStage } from "./catalog-coverage.ts";
import type { Playback } from "./playback.ts";
import type { BookletRead } from "./read.ts";

/**
 * The headline counts (committed as status/booklet-baseline.json) and the
 * console summary, at most 40 lines. Only counts leave this module for Git:
 * no booklet text, no official-model data.
 */
export type Stage<T> =
  | { readonly status: "ran"; readonly ms: number; readonly value: T }
  | { readonly status: "skipped"; readonly reason: string };

/** The repository's older manifest-v6 source count (building-system.md). */
export const OLDER_SOURCE_COUNT = Object.freeze({ callouts: 881, pieces: 1_512 });
/** The committed selected-path diagnostic's frontier (building-system.md, 2026-08-28). */
export const COMMITTED_FRONTIER = Object.freeze({
  validThrough: 28,
  blockedAt: 29,
  partsThrough: 163,
});
export const SUMMARY_MAX_LINES = 40;

interface Stages {
  readonly read: Stage<BookletRead>;
  readonly align: Stage<AlignStage>;
  readonly catalog: Stage<CatalogStage>;
  readonly playback: Stage<Playback>;
  readonly key: AnswerKey | null;
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

function multipliers(read: BookletRead) {
  const labels = read.exceptions.filter(({ kind }) => kind === "multiplier");
  return { labels: labels.length, sum: sum(labels.flatMap(({ quantities }) => quantities)) };
}

function bagPanels(read: BookletRead) {
  return read.exceptions
    .filter(({ kind }) => kind === "bag-panel")
    .map(({ page, quantities, pieces }) => ({ page, labels: quantities.length, pieces }));
}

function playbackCounts(playback: Playback) {
  const firstNot = playback.steps.find(({ status }) => status !== "valid");
  const firstInvalid = playback.steps.find(({ status }) => status === "invalid");
  const firstBlocked = playback.steps.find(({ status }) => status === "catalog-blocked");
  return {
    steps: playback.steps.length,
    validSteps: playback.steps.filter(({ status }) => status === "valid").length,
    invalidSteps: playback.steps.filter(({ status }) => status === "invalid").length,
    blockedSteps: playback.steps.filter(({ status }) => status === "catalog-blocked").length,
    validThrough: firstNot ? firstNot.step - 1 : (playback.steps.at(-1)?.step ?? 0),
    firstInvalid: firstInvalid?.step ?? null,
    firstBlocked: firstBlocked?.step ?? null,
    stepsAddingIssues: playback.steps.filter(
      ({ status, newIssues }) => status === "invalid" && newIssues > 0,
    ).length,
    partsThroughValid: firstNot
      ? (playback.steps.find(({ step }) => step === firstNot.step - 1)?.placedParts ?? 0)
      : playback.placed.length,
  };
}

export function headlineOf({ read, align, catalog, playback, key }: Stages) {
  const r = read.status === "ran" ? read.value : null;
  const a = align.status === "ran" ? align.value : null;
  const c = catalog.status === "ran" ? catalog.value : null;
  return {
    read: r && {
      steps: r.steps.length,
      contiguous: r.sequence.contiguous,
      firstPage: r.sequence.firstPage,
      lastPage: r.sequence.lastPage,
      overprintsRemoved: r.overprintsRemoved,
      stepCallouts: r.stepCallouts,
      calloutLabels: r.calloutLabels,
      multipliers: multipliers(r),
      bagPanels: bagPanels(r),
      orphanCallouts: r.exceptions.filter(({ kind }) => kind === "orphan-callout").length,
      inventory: { rows: r.inventory.rows, pieces: r.inventory.pieces },
    },
    key: key && {
      bricks: key.model.bricks.length,
      lxfmlSteps: key.sequence.units.length,
      stepsAddingBricks: key.sequence.units.filter(({ brickRefs }) => brickRefs.length > 0).length,
      unplacedBricks: key.sequence.unplaced.length,
      ldraw: key.ldraw.status,
    },
    align: a && {
      stepsAligned: a.matchedSteps,
      steps: a.steps.length,
      runOrderMatched: a.runMatchedSteps,
      repairWindows: a.windows.length,
      unsolvedWindows: a.windows.filter(({ solved }) => !solved).length,
      bricksAssigned: sum(a.steps.map(({ bricks }) => bricks.length)),
      unplacedBricks: a.unplaced.length,
      inventoryMismatches: a.inventory.mismatches.length + a.inventory.missingFromInventory.length,
      bagViolations: a.bagViolations.length,
    },
    catalog: c && {
      ...c.totals,
      firstStepNeedingMissing: c.firstStepNeedingMissing?.step ?? null,
      firstStepNeedingMissingColor: c.firstStepNeedingMissingColor?.step ?? null,
    },
    playback: playback.status === "ran" ? playbackCounts(playback.value) : null,
  };
}

export type Headline = ReturnType<typeof headlineOf>;

function flatten(value: unknown, prefix: string, into: Map<string, string>): void {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, inner] of Object.entries(value))
      flatten(inner, prefix === "" ? key : `${prefix}.${key}`, into);
  } else {
    into.set(prefix, JSON.stringify(value));
  }
}

export type BaselineComparison =
  | { readonly status: "absent" }
  | { readonly status: "same" }
  | { readonly status: "changed"; readonly changes: readonly string[] };

export function compareWithBaseline(headline: Headline, baseline: unknown): BaselineComparison {
  if (baseline === null || typeof baseline !== "object" || !("headline" in baseline))
    return { status: "absent" };
  const now = new Map<string, string>();
  const then = new Map<string, string>();
  flatten(headline, "", now);
  flatten((baseline as { headline: unknown }).headline, "", then);
  const changes = [...new Set([...now.keys(), ...then.keys()])]
    .filter((key) => now.get(key) !== then.get(key))
    .sort()
    .map((key) => `${key} ${then.get(key) ?? "(none)"} -> ${now.get(key) ?? "(none)"}`);
  return changes.length === 0 ? { status: "same" } : { status: "changed", changes };
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const list = (values: readonly (string | number)[], max = 6) =>
  values.length <= max
    ? values.join(", ")
    : `${values.slice(0, max).join(", ")} … (+${values.length - max})`;

function readLines(read: BookletRead, ms: number): string[] {
  const m = multipliers(read);
  const panels = bagPanels(read);
  const older = {
    callouts: read.stepCallouts.tokens + m.labels,
    pieces: read.stepCallouts.pieces + m.sum,
  };
  const olderAgrees =
    older.callouts === OLDER_SOURCE_COUNT.callouts && older.pieces === OLDER_SOURCE_COUNT.pieces;
  return [
    `[read] ${seconds(ms)} · steps ${read.sequence.contiguous ? `1..${read.sequence.highest} contiguous` : `NOT contiguous (missing ${list(read.sequence.missing)}; duplicate ${list(read.sequence.duplicates)})`} on pages ${read.sequence.firstPage}-${read.sequence.lastPage} · ${read.overprintsRemoved} overprinted labels removed`,
    `  step callouts: ${read.stepCallouts.tokens} "Nx" = ${read.stepCallouts.pieces} pieces; all callout-size labels ${read.calloutLabels.tokens} = ${read.calloutLabels.pieces}`,
    `  step-less panels: ${panels.map(({ page, labels, pieces }) => `p${page} ${labels} label(s) = ${pieces}`).join("; ") || "none"}; orphan callouts ${read.exceptions.filter(({ kind }) => kind === "orphan-callout").length}`,
    `  inventory p${read.inventory.pages.join("-")}: ${read.inventory.rows} rows = ${read.inventory.pieces} pieces${read.inventory.findings.length > 0 ? ` (${read.inventory.findings.length} findings)` : ""}`,
    `  older ${OLDER_SOURCE_COUNT.callouts}/${OLDER_SOURCE_COUNT.pieces}: step callouts + ${m.labels} sub-build multipliers (sum ${m.sum}) = ${older.callouts}/${older.pieces} ${olderAgrees ? "(reproduced)" : "(NOT reproduced)"}`,
  ];
}

function alignLines(align: AlignStage, ms: number): string[] {
  const moved = sum(align.windows.map(({ moved: count }) => count));
  const mismatch = align.steps.filter(({ matched }) => !matched);
  return [
    `[align] ${seconds(ms)} · ${align.matchedSteps}/${align.steps.length} steps aligned (${align.runMatchedSteps} by run order; ${align.windows.length} repair windows moved ${moved} bricks, ${align.windows.filter(({ solved }) => !solved).length} unsolved)`,
    `  ${sum(align.steps.map(({ bricks }) => bricks.length))} bricks assigned; unplaced by any step: ${align.unplaced.map(({ designRevision }) => designRevision).join(", ") || "none"} · inventory mismatches ${align.inventory.mismatches.length + align.inventory.missingFromInventory.length} · bag-order violations ${align.bagViolations.length}`,
    `  mismatches: ${
      mismatch.length === 0
        ? "none"
        : list(
            mismatch.map(
              ({ step, expected, actual }) =>
                `${step} (${expected.join("+")} vs ${actual.join("+")})`,
            ),
            4,
          )
    }`,
  ];
}

function catalogLines(catalog: CatalogStage, ms: number): string[] {
  const t = catalog.totals;
  const missing = catalog.firstStepNeedingMissing;
  const color = catalog.firstStepNeedingMissingColor;
  return [
    `[catalog] ${seconds(ms)} · ${t.designs} designs: ${t.exact} exact, ${t.interchangeable} interchangeable, ${t.missing} missing · pieces ${t.piecesExact} / ${t.piecesInterchangeable} / ${t.piecesMissing} of ${t.pieces}`,
    `  first step needing an uncovered design: ${missing ? `${missing.step} (${list(missing.designs, 4)})` : "none"} · needing an absent colour: ${color ? `${color.step} (LDraw ${color.codes.join(", ")})` : "none"}`,
  ];
}

function playbackLines(playback: Playback, ms: number): string[] {
  const counts = playbackCounts(playback);
  const invalid = playback.steps.find(({ status }) => status === "invalid");
  const blocked = playback.steps.find(({ status }) => status === "catalog-blocked");
  const lines = [
    `[playback] ${seconds(ms)} · valid ${counts.validSteps} / invalid ${counts.invalidSteps} / catalog-blocked ${counts.blockedSteps} of ${counts.steps} · valid through step ${counts.validThrough} (${counts.partsThroughValid} parts)`,
  ];
  if (invalid) {
    const first = invalid.issues[0];
    lines.push(
      `  first invalid: step ${invalid.step} (p${invalid.page}) ${first ? `${first.code} in ${first.assembly}: ${first.message}` : ""}`.slice(
        0,
        220,
      ),
    );
  }
  const fresh = playback.steps
    .filter(({ status, newIssues }) => status === "invalid" && newIssues > 0)
    .map(({ step }) => step);
  lines.push(`  steps adding a new issue: ${fresh.length === 0 ? "none" : list(fresh, 12)}`);
  if (blocked) {
    lines.push(
      `  first catalog-blocked: step ${blocked.step} (p${blocked.page}) ${list(
        blocked.blocks.map(({ design, kind }) => `${design} ${kind}`),
        3,
      )}`.slice(0, 220),
    );
  }
  const bases = playback.frameBases;
  lines.push(
    `  frames: ${bases.measured} measured, ${bases.declared} catalog-declared, ${bases["inferred-top-of-body"]} inferred · world shift [${playback.worldShiftLdu?.join(", ") ?? "none"}]`,
    `  committed selected-path frontier (a placement search, not official poses): valid through ${COMMITTED_FRONTIER.validThrough} (${COMMITTED_FRONTIER.partsThrough} parts), blocked at ${COMMITTED_FRONTIER.blockedAt}`,
  );
  return lines;
}

export function summaryLines(
  input: Stages & {
    readonly keyLoad: Stage<AnswerKeyLoad> | null;
    readonly statusPath: string;
    readonly baseline: BaselineComparison;
    readonly totalMs: number;
  },
): string[] {
  const { read, align, catalog, playback, key } = input;
  const lines = [`npm run booklet · ${seconds(input.totalMs)} total`];
  lines.push(
    ...(read.status === "ran" ? readLines(read.value, read.ms) : [`[read] ${read.reason}`]),
  );
  if (key && input.keyLoad?.status === "ran") {
    lines.push(
      `[key] ${seconds(input.keyLoad.ms)} · ${key.model.bricks.length} official bricks · ${key.sequence.units.length} LXFML steps, ${key.sequence.units.filter(({ brickRefs }) => brickRefs.length > 0).length} add bricks · official LDraw ${key.ldraw.status}${key.sequence.problems.length > 0 ? ` · ${key.sequence.problems.length} sequence problems` : ""}`,
    );
  }
  lines.push(
    ...(align.status === "ran" ? alignLines(align.value, align.ms) : [`[align] ${align.reason}`]),
  );
  lines.push(
    ...(catalog.status === "ran"
      ? catalogLines(catalog.value, catalog.ms)
      : [`[catalog] ${catalog.reason}`]),
  );
  lines.push(
    ...(playback.status === "ran"
      ? playbackLines(playback.value, playback.ms)
      : [`[playback] ${playback.reason}`]),
  );
  const baseline =
    input.baseline.status === "changed"
      ? `baseline: ${input.baseline.changes.length} count(s) changed — ${list(input.baseline.changes, 3)}`
      : `baseline: ${input.baseline.status === "same" ? "unchanged" : "none (npm run booklet -- --write-baseline)"}`;
  lines.push(baseline, `per-step rows: ${input.statusPath}`);
  return lines.slice(0, SUMMARY_MAX_LINES);
}
