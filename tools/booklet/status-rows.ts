import type { AnswerKey } from "./answer-key/index.ts";
import type { AlignStage } from "./align-stage.ts";
import type { CatalogStage } from "./catalog-coverage.ts";
import type { Playback } from "./playback.ts";
import { primaryPlayback, type PlaybackStage } from "./playback-stage.ts";
import type { BookletRead } from "./read.ts";

/**
 * The per-step rows of output/booklet/status.json and the reference build of
 * output/booklet/reference-playback.json. Both carry official-model data
 * (brick uuids, transforms), so main.ts writes them only where Git ignores
 * them.
 */
export function readRows(read: BookletRead) {
  return read.steps.map(({ step, page, callouts, pieces }) => ({ step, page, callouts, pieces }));
}

export function alignRows(align: AlignStage) {
  return align.steps.map(
    ({ step, page, matched, matchedBy, repaired, expected, actual, bricks }) => ({
      step,
      page,
      matched,
      matchedBy,
      repaired,
      bricks: bricks.length,
      ...(matched ? {} : { expected, actual }),
    }),
  );
}

export function catalogRows(catalog: CatalogStage, align: AlignStage | null) {
  return (align?.steps ?? []).map(({ step, bricks }) => {
    const covers = bricks.map((uuid) => catalog.byBrick[uuid]!);
    const missing = [
      ...new Set(
        covers.filter(({ coverage }) => coverage === "missing").map(({ design }) => design),
      ),
    ].sort();
    return {
      step,
      pieces: bricks.length,
      exact: covers.filter(({ coverage }) => coverage === "exact").length,
      interchangeable: covers.filter(({ coverage }) => coverage === "interchangeable").length,
      missing: covers.filter(({ coverage }) => coverage === "missing").length,
      ...(missing.length > 0 ? { missingDesigns: missing } : {}),
    };
  });
}

/** Which designs' pairing the invariance check could not verify, for the status rows. */
export function pairingRows(key: AnswerKey) {
  if (key.ldraw.status !== "paired" && key.ldraw.status !== "contradicted") return null;
  const { pairing } = key.ldraw;
  const frames = [...pairing.designFrames.values()];
  return {
    counts: pairing.counts,
    invarianceFailures: pairing.invarianceFailures,
    colorConflicts: pairing.colorConflicts,
    singleInstanceDesigns: frames
      .filter(({ pairing: check }) => check === "single-instance")
      .map(({ designRevision, filename }) => `${designRevision} ${filename}`),
    compositeBricks: [...pairing.byBrick.values()]
      .filter(({ composite }) => composite)
      .map(({ uuid, filename }) => `${uuid} ${filename}`),
  };
}

function playbackSummary(playback: Playback) {
  return {
    worldShiftLdu: playback.worldShiftLdu,
    frameBases: playback.frameBases,
    frameFiles: playback.frameFiles,
    stoppedEarly: playback.stoppedEarly,
  };
}

export function playbackSection(stage: PlaybackStage) {
  const primary = primaryPlayback(stage);
  return {
    status: "ran",
    rowsFrom: stage.corrected ? "corrected" : "as exported",
    corrections: stage.corrections,
    registryCheck: stage.registryCheck,
    asExported: {
      ...playbackSummary(stage.asExported),
      ...(stage.corrected ? { steps: stage.asExported.steps } : {}),
    },
    ...(stage.corrected ? { corrected: playbackSummary(stage.corrected) } : {}),
    steps: primary.steps,
  };
}

export function referencePlayback(stage: PlaybackStage) {
  const playback = primaryPlayback(stage);
  return {
    version: playback.version,
    note: "Reference build from LEGO's official model: scoring answer key, never a product input.",
    poses: stage.corrected
      ? "the export's rows, except the designs listed in corrections, which use their corrected frames"
      : "the export's rows",
    corrections: stage.corrections.map(({ designId, source, why }) => ({ designId, source, why })),
    worldShiftLdu: playback.worldShiftLdu,
    steps: playback.steps.map(({ step, page, status: verdict }) => ({
      step,
      page,
      status: verdict,
      added: playback.placed
        .filter((part) => part.step === step)
        .map(
          ({
            uuid,
            design,
            catalogPartId,
            colorId,
            ldrawColor,
            transform,
            frameBasis,
            poseSource,
            pairing,
          }) => ({
            uuid,
            design,
            catalogPartId,
            colorId,
            ldrawColor,
            transform,
            frameBasis,
            poseSource,
            pairing,
          }),
        ),
    })),
  };
}
