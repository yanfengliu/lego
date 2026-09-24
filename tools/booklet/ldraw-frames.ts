import { readFileSync, statSync } from "node:fs";

import { PROPER_ORIENTATIONS, type LduVector3 } from "@lego-studio/catalog";

/**
 * Measured LDraw-to-catalog frames, one per LDraw file, read from the frame
 * registry the retired first-50 chain published (building-system.md names it
 * by digest sha256:bcf97021…).
 *
 * The registry is no longer a playback input. Every part's frame is catalog
 * truth now: a parametric part's `ldrawFrame`, measured from the official
 * LDraw file by scripts/derive-ldraw-catalog-frames.mjs (a 2x4 plate is
 * upright-yaw-90 with [0,-4,0]), or a mesh part's `assetToCatalogFrame`. The
 * registry is an ignored file under output/ that a clean clone lacks, so
 * `npm run booklet` reads it only with LEGO_RUN_EVIDENCE=1, and only to
 * compare the catalog frames with it (`checkCatalogFramesAgainstRegistry` in
 * frame-checks.ts).
 */
export const DEFAULT_MEASURED_FRAMES_PATH =
  "output/real-build/history/prefix50-ldraw-catalog-frames-reviewed-move-bcf9702150b73cab1bd70d7ecd0bf33b3b3917522ce4f0ca892be56424b861a1.json";

export const MEASURED_FRAME_LIMITS = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxFrames: 5_000,
  maxOffsetLdu: 1_000,
});

export interface MeasuredFrame {
  readonly catalogPartId: string;
  readonly orientationId: string;
  readonly translationLdu: LduVector3;
}

/** Keyed by lower-case LDraw filename. */
export type MeasuredFrames = ReadonlyMap<string, MeasuredFrame>;

const ORIENTATION_IDS = new Set(PROPER_ORIENTATIONS.map(({ id }) => id));

export class MeasuredFramesError extends Error {
  override readonly name = "MeasuredFramesError";
}

/** Parses registry JSON text; `label` names the file in every error. */
export function parseMeasuredFrames(text: string, label: string): MeasuredFrames {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new MeasuredFramesError(
      `${label} is not JSON (${error instanceof Error ? error.message : String(error)}); point BOOKLET_LDRAW_FRAMES at a frame registry or unset it.`,
    );
  }
  const frames = (value as { frames?: unknown } | null)?.frames;
  if (!Array.isArray(frames) || frames.length > MEASURED_FRAME_LIMITS.maxFrames) {
    throw new MeasuredFramesError(
      `${label} has no "frames" array of at most ${MEASURED_FRAME_LIMITS.maxFrames} rows; it is not a frame registry.`,
    );
  }
  const result = new Map<string, MeasuredFrame>();
  frames.forEach((row: unknown, index) => {
    const entry = row as {
      ldrawFilename?: unknown;
      catalogPartId?: unknown;
      frame?: { orientationId?: unknown; translationLdu?: unknown };
    };
    const translation = entry.frame?.translationLdu;
    if (
      typeof entry.ldrawFilename !== "string" ||
      typeof entry.catalogPartId !== "string" ||
      typeof entry.frame?.orientationId !== "string" ||
      !ORIENTATION_IDS.has(entry.frame.orientationId) ||
      !Array.isArray(translation) ||
      translation.length !== 3 ||
      !translation.every(
        (term) =>
          Number.isSafeInteger(term) && Math.abs(term) <= MEASURED_FRAME_LIMITS.maxOffsetLdu,
      )
    ) {
      throw new MeasuredFramesError(
        `${label} frames[${index}] needs ldrawFilename, catalogPartId, a proper frame.orientationId and three whole-LDU frame.translationLdu terms within ±${MEASURED_FRAME_LIMITS.maxOffsetLdu}.`,
      );
    }
    const key = entry.ldrawFilename.toLowerCase();
    const frame = {
      catalogPartId: entry.catalogPartId,
      orientationId: entry.frame.orientationId,
      translationLdu: translation as unknown as LduVector3,
    };
    const previous = result.get(key);
    if (
      previous &&
      (previous.catalogPartId !== frame.catalogPartId ||
        previous.orientationId !== frame.orientationId ||
        previous.translationLdu.join() !== frame.translationLdu.join())
    ) {
      throw new MeasuredFramesError(
        `${label} gives ${entry.ldrawFilename} two different frames (rows disagree at frames[${index}]).`,
      );
    }
    result.set(key, frame);
  });
  return result;
}

export type FrameRegistry =
  | { readonly status: "loaded"; readonly path: string; readonly frames: MeasuredFrames }
  | { readonly status: "absent"; readonly path: string };

/**
 * Reads the registry at `path`: `absent` when nothing is there, and a
 * MeasuredFramesError when something is there that is not a registry.
 */
export function loadMeasuredFrames(path: string): FrameRegistry {
  let stat;
  try {
    stat = statSync(path);
  } catch {
    return { status: "absent", path };
  }
  if (!stat.isFile()) {
    throw new MeasuredFramesError(
      `Frame registry ${path} is not a file; point BOOKLET_LDRAW_FRAMES at the registry JSON or unset it.`,
    );
  }
  if (stat.size > MEASURED_FRAME_LIMITS.maxBytes) {
    throw new MeasuredFramesError(
      `Frame registry ${path} is ${stat.size} bytes, over the ${MEASURED_FRAME_LIMITS.maxBytes}-byte limit; point BOOKLET_LDRAW_FRAMES at the registry JSON.`,
    );
  }
  return {
    status: "loaded",
    path,
    frames: parseMeasuredFrames(readFileSync(path, "utf8"), `Frame registry ${path}`),
  };
}
