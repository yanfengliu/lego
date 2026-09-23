import { COLOR_DEFINITIONS } from "@lego-studio/catalog";

import { assemblyKeyAt, type AnswerKey } from "./answer-key/index.ts";
import type { AlignStage } from "./align-stage.ts";
import type { CatalogStage } from "./catalog-coverage.ts";
import { correctedPoses, type FrameCorrection } from "./export-frames.ts";
import { checkFallbackAgainstRegistry, type FallbackCheck } from "./frame-checks.ts";
import type { FrameRegistry } from "./ldraw-frames.ts";
import { playBack, type Playback, type PlaybackStepInput } from "./playback.ts";
import type { OfficialPose } from "./playback-pose.ts";

/**
 * Stage 4 assembled: reference playback as exported and with the frame
 * corrections, and what the frames it used rest on.
 *
 * Two replays, so the correction layer is never mistaken for the export:
 * `asExported` places every brick at the export's own row, `corrected` places
 * the corrected designs at their corrected frames and everything else as
 * exported. With corrections, the as-exported replay stops at its first step
 * that is not valid, which is all its headline (valid through) needs; without
 * any, it is the one full replay.
 */
export interface PlaybackStage {
  readonly corrections: readonly FrameCorrection[];
  readonly asExported: Playback;
  /** Null when there is nothing to correct. */
  readonly corrected: Playback | null;
  readonly registry: {
    readonly status: FrameRegistry["status"];
    readonly path: string;
    readonly rows: number;
  };
  /** The no-registry fallback measured against the registry; null without a registry. */
  readonly fallbackCheck: FallbackCheck | null;
}

/** The replay whose per-step rows the run reports: corrected when there are corrections. */
export const primaryPlayback = (stage: PlaybackStage): Playback =>
  stage.corrected ?? stage.asExported;

function playbackInputs(
  key: AnswerKey,
  align: AlignStage,
  catalog: CatalogStage,
  corrections: readonly FrameCorrection[],
): PlaybackStepInput[] {
  if (key.ldraw.status !== "paired") return [];
  const official = key.ldraw.pairing.byBrick;
  const colorByCode = new Map(
    COLOR_DEFINITIONS.map((color) => [color.ldrawCode, color.id] as const),
  );
  const poses: ReadonlyMap<string, OfficialPose> = correctedPoses(key, corrections);
  const sourceOf = new Map(
    corrections.map(({ designRevision, source }) => [designRevision, source] as const),
  );
  return align.steps.map((step) => ({
    step: step.step,
    page: step.page,
    lastUnit: step.unitEnd - 1,
    bricks: step.bricks.map((uuid) => {
      const row = official.get(uuid)!;
      const cover = catalog.byBrick[uuid]!;
      const placement = key.sequence.placements.get(uuid)!;
      const corrected = poses.get(uuid);
      return {
        uuid,
        design: cover.design,
        catalogPartId: cover.coverage === "missing" ? null : cover.catalogPartId,
        ldrawColor: row.colorCode,
        colorId: colorByCode.get(row.colorCode) ?? null,
        pose: corrected ?? { matrix: row.matrix, positionLdu: row.positionLdu },
        poseSource: corrected
          ? (sourceOf.get(key.brickByUuid.get(uuid)!.designRevision) ?? "export")
          : "export",
        pairing: row.pairing,
        assemblyAt: (lastUnit: number) => assemblyKeyAt(placement, lastUnit),
      };
    }),
  }));
}

export function runPlaybackStage(input: {
  readonly key: AnswerKey;
  readonly align: AlignStage;
  readonly catalog: CatalogStage;
  readonly registry: FrameRegistry;
  readonly corrections: readonly FrameCorrection[];
}): PlaybackStage {
  const { key, align, catalog, registry, corrections } = input;
  const measured = registry.status === "loaded" ? registry.frames : null;
  const asExported = playBack(playbackInputs(key, align, catalog, []), measured, {
    stopAtFirstNonValid: corrections.length > 0,
  });
  const corrected =
    corrections.length > 0
      ? playBack(playbackInputs(key, align, catalog, corrections), measured)
      : null;
  return {
    corrections,
    asExported,
    corrected,
    registry: {
      status: registry.status,
      path: registry.path,
      rows: registry.status === "loaded" ? registry.frames.size : 0,
    },
    fallbackCheck: measured ? checkFallbackAgainstRegistry(measured) : null,
  };
}
