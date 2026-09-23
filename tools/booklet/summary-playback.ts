import type { AnswerKey } from "./answer-key/index.ts";
import type { ExportFrameCheck } from "./export-frames.ts";
import type { Playback } from "./playback.ts";
import { primaryPlayback, type PlaybackStage } from "./playback-stage.ts";

/**
 * Console lines and headline counts for the answer key's pairing, the export
 * frame check and reference playback. Counts only leave for Git; the lines
 * name designs and LDraw files, which are part numbers, never poses.
 */

/** The committed selected-path diagnostic's frontier (building-system.md, 2026-08-28). */
export const COMMITTED_FRONTIER = Object.freeze({
  validThrough: 28,
  blockedAt: 29,
  partsThrough: 163,
});

const list = (values: readonly (string | number)[], max = 6) =>
  values.length <= max
    ? values.join(", ")
    : `${values.slice(0, max).join(", ")} … (+${values.length - max})`;
const fmt = (values: readonly number[]) => `(${values.join(", ")})`;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function pairingHeadline(key: AnswerKey) {
  const ldraw = key.ldraw;
  if (ldraw.status === "absent" || ldraw.status === "malformed") return { status: ldraw.status };
  return {
    status: ldraw.status,
    ...ldraw.pairing.counts,
    invarianceFailures: ldraw.pairing.invarianceFailures.length,
    colorConflicts: ldraw.pairing.colorConflicts.length,
  };
}

export function keyLine(key: AnswerKey, ms: number): string[] {
  const head = `[key] ${seconds(ms)} · ${key.model.bricks.length} official bricks · ${key.sequence.units.length} LXFML steps, ${key.sequence.units.filter(({ brickRefs }) => brickRefs.length > 0).length} add bricks${key.sequence.problems.length > 0 ? ` · ${key.sequence.problems.length} sequence problems` : ""}`;
  const ldraw = key.ldraw;
  if (ldraw.status === "absent") return [head, `  official LDraw: ${ldraw.reason}`];
  if (ldraw.status === "malformed") return [head, `  official LDraw MALFORMED: ${ldraw.reason}`];
  const { counts, invarianceFailures, colorConflicts } = ldraw.pairing;
  const lines = [
    head,
    `  official LDraw ${ldraw.status === "paired" ? "paired by file order" : "CONTRADICTED"}: ${counts.verifiedBricks} bricks verified (${counts.verifiedDesigns} designs agree across instances); unverified: ${counts.singleInstanceDesigns} single-instance designs, ${counts.compositeBricks} multi-part brick(s) · ${invarianceFailures.length} invariance failures, ${colorConflicts.length} colour conflicts`,
  ];
  const first = invarianceFailures[0] ?? colorConflicts[0];
  if (first) lines.push(`  first contradiction: ${first}`.slice(0, 240));
  return lines;
}

export function exportFramesHeadline(check: ExportFrameCheck) {
  const count = (verdict: string) =>
    check.comparisons.filter((comparison) => comparison.verdict === verdict).length;
  return {
    pins: check.pins,
    pinnedInExport: check.comparisons.length,
    agree: count("agrees"),
    equivalentBySymmetry: count("equivalent by symmetry"),
    disagree: count("disagrees"),
    unusablePins: count("unusable pin"),
    catalogRecordsMatching: check.comparisons.filter(
      ({ catalogRecord }) => catalogRecord === "matches the pin",
    ).length,
    uncheckedDesigns: check.uncheckedDesigns,
    corrections: check.corrections.map(({ designId, source }) => `${designId} (${source})`),
    staleCorrections: check.staleCorrections.length,
  };
}

export function exportFramesLines(check: ExportFrameCheck, ms: number): string[] {
  const h = exportFramesHeadline(check);
  const named = (verdict: string) =>
    check.comparisons
      .filter((comparison) => comparison.verdict === verdict)
      .map(({ designId, export: exported, pin }) =>
        verdict === "agrees"
          ? designId
          : `${designId}: export origin ${fmt(exported.originLdu)}, pin ${pin.turn} ${fmt(pin.originLdu)}`,
      );
  const lines = [
    `[export frames] ${seconds(ms)} · ${check.pins === "loaded" ? `${h.pinnedInExport} pinned designs in the export: ${h.agree} agree, ${h.equivalentBySymmetry} equivalent by symmetry, ${h.disagree} disagree, ${h.unusablePins} unusable pins; catalog Builder records match ${h.catalogRecordsMatching}` : `no pins at ${check.pinsPath}`} · ${h.uncheckedDesigns} designs have no pin (frames unchecked)`,
  ];
  for (const verdict of ["disagrees", "equivalent by symmetry", "unusable pin"]) {
    const names = named(verdict);
    if (names.length > 0) lines.push(`  ${verdict}: ${list(names, 3)}`.slice(0, 240));
  }
  lines.push(
    `  corrections applied: ${check.corrections.length === 0 ? "none" : check.corrections.map(({ designId, source, to }) => `${designId} (${source === "pin" ? "pin" : "review, fitted"}: origin ${fmt(to.originLdu)})`).join("; ")}${check.staleCorrections.length > 0 ? ` · STALE, not applied: ${check.staleCorrections.join("; ")}` : ""}`.slice(
      0,
      300,
    ),
  );
  return lines;
}

function counts(playback: Playback) {
  const firstNot = playback.steps.find(({ status }) => status !== "valid");
  return {
    stepsReplayed: playback.steps.length,
    validSteps: playback.steps.filter(({ status }) => status === "valid").length,
    invalidSteps: playback.steps.filter(({ status }) => status === "invalid").length,
    blockedSteps: playback.steps.filter(({ status }) => status === "catalog-blocked").length,
    validThrough: firstNot ? firstNot.step - 1 : (playback.steps.at(-1)?.step ?? 0),
    firstNonValid: firstNot ? `${firstNot.step} ${firstNot.status}` : null,
    firstInvalid: playback.steps.find(({ status }) => status === "invalid")?.step ?? null,
    firstBlocked: playback.steps.find(({ status }) => status === "catalog-blocked")?.step ?? null,
    stepsAddingIssues: playback.steps.filter(
      ({ status, newIssues }) => status === "invalid" && newIssues > 0,
    ).length,
    partsThroughValid: firstNot
      ? (playback.steps.find(({ step }) => step === firstNot.step - 1)?.placedParts ?? 0)
      : playback.placed.length,
  };
}

export function playbackHeadline(stage: PlaybackStage) {
  const primary = counts(primaryPlayback(stage));
  const exported = counts(stage.asExported);
  const bases = primaryPlayback(stage).frameBases;
  return {
    asExported: {
      validThrough: exported.validThrough,
      firstNonValid: exported.firstNonValid,
      partsThroughValid: exported.partsThroughValid,
    },
    corrections: stage.corrections.map(({ designId, source }) => `${designId} (${source})`),
    ...(stage.corrected ? { corrected: primary } : { full: primary }),
    frames: {
      registry: stage.registry.status,
      measured: bases.measured,
      declared: bases.declared,
      inferred: bases["inferred-top-of-body"],
      fallbackParametricRows: stage.fallbackCheck?.parametricRows ?? null,
      fallbackDisagreements: stage.fallbackCheck?.disagreements.length ?? null,
    },
  };
}

function firstIssueLine(label: string, playback: Playback): string[] {
  const invalid = playback.steps.find(({ status }) => status === "invalid");
  const first = invalid?.issues[0];
  if (!invalid) return [];
  return [
    `  ${label}: step ${invalid.step} (p${invalid.page}) ${first ? `${first.code} in ${first.assembly}: ${first.message}` : ""}`.slice(
      0,
      220,
    ),
  ];
}

function frameLines(stage: PlaybackStage): string[] {
  const playback = primaryPlayback(stage);
  const bases = playback.frameBases;
  const inferred = playback.frameFiles.filter(({ basis }) => basis === "inferred-top-of-body");
  const inferredNames = list(
    inferred.map(({ ldrawFile, parts }) => `${ldrawFile} x${parts}`),
    4,
  );
  if (stage.registry.status === "absent") {
    return [
      `  frames: REGISTRY ABSENT (${stage.registry.path}) — 0 parts from the registry, ${bases.declared} catalog-declared, ${bases["inferred-top-of-body"]} INFERRED in ${inferred.length} files (${inferredNames})`,
      `  inferred frames are guesses the registry contradicts for most parametric parts: restore it (BOOKLET_LDRAW_FRAMES) before trusting playback`,
    ];
  }
  const check = stage.fallbackCheck;
  return [
    `  frames: registry (${stage.registry.rows} rows) ${bases.measured} parts, catalog-declared ${bases.declared}, inferred ${bases["inferred-top-of-body"]}${inferred.length > 0 ? ` (${inferredNames})` : ""} · world shift [${playback.worldShiftLdu?.join(", ") ?? "none"}]`,
    ...(check
      ? [
          `  no-registry fallback vs registry: ${check.agree} of ${check.parametricRows} parametric rows agree, ${check.equivalentBySymmetry} equivalent by symmetry, ${check.disagreements.length} disagree${
            check.disagreements.length > 0
              ? ` (${list(
                  check.disagreements.map(
                    ({ ldrawFilename, registry, fallback }) =>
                      `${ldrawFilename} ${registry.orientationId}/${fallback.orientationId}`,
                  ),
                  3,
                )})`
              : ""
          }`.slice(0, 240),
        ]
      : []),
  ];
}

export function playbackLines(stage: PlaybackStage, ms: number): string[] {
  const playback = primaryPlayback(stage);
  const c = counts(playback);
  const exported = counts(stage.asExported);
  const lines = [
    `[playback] ${seconds(ms)} · ${stage.corrected ? `with ${stage.corrections.length} frame correction(s)` : "as exported"}: valid ${c.validSteps} / invalid ${c.invalidSteps} / catalog-blocked ${c.blockedSteps} of ${c.stepsReplayed} · valid through step ${c.validThrough} (${c.partsThroughValid} parts)`,
  ];
  if (stage.corrected) {
    const first = stage.asExported.steps.find(({ status }) => status !== "valid");
    const issue = first?.issues[0];
    lines.push(
      `  as exported (no corrections): valid through step ${exported.validThrough} (${exported.partsThroughValid} parts)${first ? `; step ${first.step} ${first.status}${issue ? ` ${issue.code}` : ""}` : ""}`,
    );
  }
  lines.push(
    ...firstIssueLine(stage.corrected ? "first invalid (corrected)" : "first invalid", playback),
  );
  const fresh = playback.steps
    .filter(({ status, newIssues }) => status === "invalid" && newIssues > 0)
    .map(({ step }) => step);
  lines.push(`  steps adding a new issue: ${fresh.length === 0 ? "none" : list(fresh, 12)}`);
  const blocked = playback.steps.find(({ status }) => status === "catalog-blocked");
  if (blocked) {
    lines.push(
      `  first catalog-blocked: step ${blocked.step} (p${blocked.page}) ${list(
        blocked.blocks.map(({ design, kind }) => `${design} ${kind}`),
        3,
      )}`.slice(0, 220),
    );
  }
  lines.push(
    ...frameLines(stage),
    `  committed selected-path frontier (a placement search, not official poses): valid through ${COMMITTED_FRONTIER.validThrough} (${COMMITTED_FRONTIER.partsThrough} parts), blocked at ${COMMITTED_FRONTIER.blockedAt}`,
  );
  return lines;
}
