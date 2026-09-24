import type { AnswerKey, AnswerKeyLoad } from "./answer-key/index.ts";
import type { AlignStage } from "./align-stage.ts";
import type { CatalogStage } from "./catalog-coverage.ts";
import type { ExportFrameCheck } from "./export-frames.ts";
import type { IdentifyStage } from "./identify-stage.ts";
import type { FrameRegistry } from "./ldraw-frames.ts";
import type { PlaybackStage } from "./playback-stage.ts";
import type { BookletRead } from "./read.ts";
import {
  alignHeadLines,
  alignHeadline,
  identifyHeadline,
  identifyLines,
  scoreLines,
} from "./summary-identify.ts";
import {
  exportFramesHeadline,
  exportFramesLines,
  keyLine,
  pairingHeadline,
  playbackHeadline,
  playbackLines,
} from "./summary-playback.ts";

/**
 * The headline counts (committed as status/booklet-baseline.json) and the
 * console summary, at most 40 lines. Only counts leave this module for Git:
 * no booklet text, no official-model data.
 *
 * A stage either ran, was skipped because an input is absent, or failed
 * because an input is present but cannot be used (malformed, oversized, or an
 * official export that contradicts itself). A failed stage fails the run.
 */
export type Stage<T> =
  | { readonly status: "ran"; readonly ms: number; readonly value: T }
  | { readonly status: "skipped"; readonly reason: string }
  | { readonly status: "failed"; readonly reason: string };

/** The repository's older manifest-v6 source count (building-system.md). */
export const OLDER_SOURCE_COUNT = Object.freeze({ callouts: 881, pieces: 1_512 });
export const SUMMARY_MAX_LINES = 40;

interface Stages {
  readonly read: Stage<BookletRead>;
  readonly identify: Stage<IdentifyStage>;
  readonly align: Stage<AlignStage>;
  readonly catalog: Stage<CatalogStage>;
  readonly exportFrames: Stage<ExportFrameCheck>;
  readonly playback: Stage<PlaybackStage>;
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

/** A first step that needs something: the step, "none", or "unknown" without an aligned booklet. */
function firstStep(align: AlignStage | null, found: { step: number } | null): number | string {
  if (!align) return "unknown";
  return found?.step ?? "none";
}

export function headlineOf({
  read,
  identify,
  align,
  catalog,
  exportFrames,
  playback,
  key,
}: Stages) {
  const r = read.status === "ran" ? read.value : null;
  const i = identify.status === "ran" ? identify.value : null;
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
    identify: i && identifyHeadline(i, a?.identityScore ?? null),
    key: key && {
      bricks: key.model.bricks.length,
      lxfmlSteps: key.sequence.units.length,
      stepsAddingBricks: key.sequence.units.filter(({ brickRefs }) => brickRefs.length > 0).length,
      unplacedBricks: key.sequence.unplaced.length,
      ldraw: pairingHeadline(key),
    },
    align: a && alignHeadline(a),
    catalog: c && {
      ...c.totals,
      firstStepNeedingMissing: firstStep(a, c.firstStepNeedingMissing),
      firstStepNeedingMissingColor: firstStep(a, c.firstStepNeedingMissingColor),
    },
    exportFrames: exportFrames.status === "ran" ? exportFramesHeadline(exportFrames.value) : null,
    playback: playback.status === "ran" ? playbackHeadline(playback.value) : null,
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

function alignLines(align: AlignStage, ms: number, identifyNote: string): string[] {
  const mismatch = align.steps.filter(({ matched }) => !matched);
  return [
    ...alignHeadLines(align, ms, identifyNote),
    `  ${sum(align.steps.map(({ bricks }) => bricks.length))} bricks assigned; unplaced by any step: ${align.unplaced.map(({ designRevision }) => designRevision).join(", ") || "none"} · inventory mismatches ${align.inventory.mismatches.length + align.inventory.missingFromInventory.length} · bag-order violations ${align.bagViolations.length}`,
    `  unmatched: ${
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

function catalogLines(catalog: CatalogStage, align: AlignStage | null, ms: number): string[] {
  const t = catalog.totals;
  const missing = catalog.firstStepNeedingMissing;
  const color = catalog.firstStepNeedingMissingColor;
  const unknown = "unknown (no aligned booklet)";
  return [
    `[catalog] ${seconds(ms)} · ${t.designs} designs: ${t.exact} exact, ${t.interchangeable} interchangeable, ${t.missing} missing · pieces ${t.piecesExact} / ${t.piecesInterchangeable} / ${t.piecesMissing} of ${t.pieces}`,
    `  first step needing an uncovered design: ${!align ? unknown : missing ? `${missing.step} (${list(missing.designs, 4)})` : "none"} · needing an absent colour: ${!align ? unknown : color ? `${color.step} (LDraw ${color.codes.join(", ")})` : "none"}`,
  ];
}

const notRun = (label: string, stage: { status: "skipped" | "failed"; reason: string }) =>
  `[${label}] ${stage.status === "failed" ? `FAILED: ${stage.reason}` : stage.reason}`;

export function summaryLines(
  input: Stages & {
    readonly keyLoad: Stage<AnswerKeyLoad> | null;
    /**
     * The first-50 frame registry's load, reported here unless it loaded;
     * when it did, playback's frame lines carry its comparison.
     */
    readonly frameRegistry: Stage<FrameRegistry>;
    readonly statusPath: string;
    readonly baseline: BaselineComparison;
    readonly totalMs: number;
  },
): string[] {
  const { read, identify, align, catalog, exportFrames, playback, key } = input;
  const failed = [
    read,
    identify,
    align,
    catalog,
    exportFrames,
    playback,
    input.keyLoad,
    input.frameRegistry,
  ].some((stage) => stage?.status === "failed");
  const lines = [
    `npm run booklet · ${seconds(input.totalMs)} total${failed ? " · FAILED (a present input could not be used; see below)" : ""}`,
  ];
  lines.push(...(read.status === "ran" ? readLines(read.value, read.ms) : [notRun("read", read)]));
  lines.push(
    ...(identify.status === "ran"
      ? identifyLines(identify.value, identify.ms)
      : [notRun("identify", identify)]),
  );
  if (input.keyLoad?.status === "failed") lines.push(notRun("key", input.keyLoad));
  else if (key && input.keyLoad?.status === "ran") lines.push(...keyLine(key, input.keyLoad.ms));
  const identifyNote =
    identify.status === "ran"
      ? "identification ran"
      : `identification did not run: ${identify.status === "failed" ? "it failed" : "skipped"}`;
  lines.push(
    ...(align.status === "ran"
      ? alignLines(align.value, align.ms, identifyNote)
      : [notRun("align", align)]),
  );
  if (align.status === "ran" && align.value.identityScore)
    lines.push(...scoreLines(align.value.identityScore));
  lines.push(
    ...(catalog.status === "ran"
      ? catalogLines(catalog.value, align.status === "ran" ? align.value : null, catalog.ms)
      : [notRun("catalog", catalog)]),
  );
  lines.push(
    ...(exportFrames.status === "ran"
      ? exportFramesLines(exportFrames.value, exportFrames.ms)
      : [notRun("export frames", exportFrames)]),
  );
  lines.push(
    ...(playback.status === "ran"
      ? playbackLines(playback.value, playback.ms)
      : [notRun("playback", playback)]),
  );
  const registry = input.frameRegistry;
  if (registry.status !== "ran") lines.push(notRun("frame registry", registry));
  else if (registry.value.status === "absent")
    lines.push(
      `[frame registry] input absent: no first-50 frame registry at ${registry.value.path}`,
    );
  else if (playback.status !== "ran")
    lines.push(
      `[frame registry] loaded ${registry.value.frames.size} rows; not compared with the catalog frames, because playback did not run`,
    );
  const baseline =
    input.baseline.status === "changed"
      ? `baseline: ${input.baseline.changes.length} count(s) changed — ${list(input.baseline.changes, 3)}`
      : `baseline: ${input.baseline.status === "same" ? "unchanged" : "none (npm run booklet -- --write-baseline)"}`;
  lines.push(baseline, `per-step rows: ${input.statusPath}`);
  return lines.slice(0, SUMMARY_MAX_LINES);
}
