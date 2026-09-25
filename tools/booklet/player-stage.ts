import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  PLAYER_STEPS_VERSION,
  type PlayerStepsFile,
  type StepAlignment,
} from "../../apps/web/src/player/player-data.ts";
import {
  currentPlayerStamp,
  STAMP_FILE,
  type PlayerInputPaths,
  type PlayerStamp,
} from "../player/freshness.ts";
import type { PlayerSet } from "../player/sets.ts";
import {
  lxfmlPoseInLdrawConvention,
  type AnswerKey,
  type OfficialLdrawModel,
} from "./answer-key/index.ts";
import type { AlignStage, StepVerdict } from "./align-stage.ts";
import { correctedPoses, type FrameCorrection } from "./export-frames.ts";
import { subBuildAttachSteps } from "./sub-build-attach.ts";
import { builderStandIns, openPlayerLibrary, PlayerLibraryError } from "./player-library.ts";
import {
  libraryCandidates,
  packPlayerModel,
  PlayerModelError,
  type LibraryReader,
  type ModelRow,
  type PackedPlayerModel,
} from "./player-model.ts";

/**
 * The build player's data, written by `npm run booklet` for one set of the
 * manifest (tools/player/sets.ts): model.mpd, steps.json and stamp.json in
 * the set's output folder (format: apps/web/src/player/player-data.ts).
 *
 * Every brick the alignment gives a printed step is a row of that step, in
 * official build order, at its official LDraw-space pose, except the designs
 * the labelled frame-correction layer (export-frames.ts) fixes, which take
 * their corrected pose. A multi-part brick is a row naming its export
 * sub-model, embedded as the export wrote it. A design no LDraw library holds
 * is a stand-in from the set's Builder mesh pack, posed from the LXFML
 * (player-library.ts). A brick no printed step places (the brick separator) is
 * left out and counted. Sub-builds are not split out: their parts appear in
 * final position at the step that builds them.
 */
export const PLAYER_STAGE_VERSION = "lego.booklet-player/1";

export class PlayerStageError extends Error {
  override readonly name = "PlayerStageError";
}

const ALIGNMENT: Readonly<Record<StepVerdict, StepAlignment>> = {
  identity: "identity",
  "count fallback": "count-fallback",
  counts: "counts",
  mismatch: "mismatch",
};

export const MODEL_SOURCE =
  "LEGO's official model of the set (a reference build), grouped into printed steps by the booklet harness's alignment";

export interface PlayerDataInput {
  readonly set: PlayerSet;
  readonly bookletPages: number;
  readonly key: AnswerKey;
  readonly official: OfficialLdrawModel;
  readonly align: AlignStage;
  readonly corrections: readonly FrameCorrection[];
  readonly library: LibraryReader;
  readonly colours: string;
  /** An LDraw part standing in for a design no library holds, or null. */
  readonly standInFor: (design: string) => string | null;
}

export interface PlayerData {
  readonly steps: PlayerStepsFile;
  readonly model: PackedPlayerModel;
  readonly correctedParts: number;
  /** Designs drawn from a stand-in, with how many parts each. */
  readonly standIns: ReadonlyMap<string, number>;
}

/**
 * Whether a brick is, after printed step s, still in a sub-build not yet
 * attached. Levels every aligned brick shares are the model itself: 21066's
 * LXFML wraps the whole build in one sub-build attached at its last unit, so
 * without this every step would count as building a sub-build.
 */
export function openSubBuildTest(
  key: AnswerKey,
  align: AlignStage,
): (uuid: string, step: number) => boolean {
  const attach = subBuildAttachSteps({
    steps: align.steps,
    windows: align.windows,
    placements: key.sequence.placements,
  });
  const chains = align.steps.flatMap(({ bricks }) =>
    bricks.map((uuid) => key.sequence.placements.get(uuid)?.levels ?? []),
  );
  let shared = Math.min(...chains.map((levels) => levels.length));
  for (const levels of chains) {
    while (shared > 0 && levels[shared - 1]!.key !== chains[0]![shared - 1]!.key) shared -= 1;
  }
  return (uuid, step) => {
    const levels = key.sequence.placements.get(uuid)?.levels ?? [];
    for (let depth = levels.length - 1; depth >= shared; depth -= 1) {
      const level = attach.get(levels[depth]!.key);
      if (!level || level.attachStep === null || level.attachStep > step) return true;
    }
    return false;
  };
}

const byName = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

export function buildPlayerData(input: PlayerDataInput): PlayerData {
  const { set, key, align, official } = input;
  if (key.ldraw.status !== "paired") {
    throw new PlayerStageError(
      `needs the official LDraw export paired with the LXFML; it is ${key.ldraw.status}.`,
    );
  }
  const applied = [...new Set(input.corrections.map(({ designId }) => designId))].sort(byName);
  const expected = [...set.frameCorrections].sort(byName);
  if (applied.join(",") !== expected.join(",")) {
    throw new PlayerStageError(
      `the frame corrections applied (${applied.join(", ") || "none"}) differ from set ${set.id}'s frameCorrections (${expected.join(", ") || "none"}) in tools/player/sets.ts; review tools/booklet/export-frames.ts, then update the manifest.`,
    );
  }
  const submodels = new Map([...official.files].filter(([name]) => name !== official.mainFile));
  const resolvable = new Map<string, boolean>();
  const inLibrary = (filename: string) => {
    let found = resolvable.get(filename);
    if (found === undefined) {
      found =
        submodels.has(filename) ||
        libraryCandidates(filename).some((path) => input.library.read(path) !== null);
      resolvable.set(filename, found);
    }
    return found;
  };
  const standInText = new Map<string, string>();
  const standIns = new Map<string, number>();
  const pairing = key.ldraw.pairing.byBrick;
  const corrected = correctedPoses(key, input.corrections);
  let correctedParts = 0;
  const seen = new Set<string>();
  const rowsByStep = align.steps.map((step) =>
    step.bricks.map((uuid): ModelRow => {
      if (seen.has(uuid))
        throw new PlayerStageError(`brick ${uuid} is aligned to two printed steps.`);
      seen.add(uuid);
      const row = pairing.get(uuid);
      if (!row) {
        throw new PlayerStageError(
          `brick ${uuid} of printed step ${step.step} has no row in the official LDraw export.`,
        );
      }
      if (!inLibrary(row.filename)) {
        const design = row.filename.replace(/\.dat$/iu, "");
        const path = `parts/builder/${design}.dat`;
        if (!standInText.has(path)) {
          const text = input.standInFor(design);
          if (text === null) {
            throw new PlayerStageError(
              `${row.filename} (printed step ${step.step}) is in no LDraw library and the set's Builder mesh pack has no design ${design}.`,
            );
          }
          standInText.set(path, text);
        }
        standIns.set(design, (standIns.get(design) ?? 0) + 1);
        const brick = key.brickByUuid.get(uuid)!;
        return {
          colorCode: row.colorCode,
          ...lxfmlPoseInLdrawConvention(brick.parts[0]!),
          filename: `builder/${design}.dat`,
        };
      }
      const pose = corrected.get(uuid);
      if (pose) correctedParts += 1;
      return {
        colorCode: row.colorCode,
        positionLdu: (pose ?? row).positionLdu,
        matrix: (pose ?? row).matrix,
        filename: row.filename,
      };
    }),
  );
  const inOpenSubBuild = openSubBuildTest(key, align);
  const steps: PlayerStepsFile = {
    version: PLAYER_STEPS_VERSION,
    set: {
      id: set.id,
      name: set.name,
      bookletPages: input.bookletPages,
      modelSource: MODEL_SOURCE,
      partCount: seen.size,
      unplacedParts: key.model.bricks.length - seen.size,
    },
    steps: align.steps.map((step, index) => {
      if (step.step !== index + 1) {
        throw new PlayerStageError(
          `printed steps must run 1..N; position ${index + 1} holds step ${step.step}.`,
        );
      }
      return {
        step: step.step,
        page: step.page,
        partsAdded: step.bricks.length,
        alignment: ALIGNMENT[step.verdict],
        subBuild: step.bricks.some((uuid) => inOpenSubBuild(uuid, step.step)),
      };
    }),
  };
  const model = packPlayerModel({
    name: `${set.id}.ldr`,
    header: [
      `0 ${set.name}: reference build, one 0 STEP per printed step`,
      `0 Name: ${set.id}.ldr`,
      "0 Author: npm run booklet (tools/booklet/player-stage.ts)",
      `0 // Parts from ${MODEL_SOURCE}.`,
      "0 // Geometry and colours from the LDraw.org parts library (official, then unofficial), each file keeping its own author and licence lines; parts/builder/ files are stand-ins from LEGO Builder meshes.",
    ],
    steps: rowsByStep,
    submodels,
    colours: input.colours,
    library: { read: (path) => standInText.get(path) ?? input.library.read(path) },
  });
  return { steps, model, correctedParts, standIns };
}

/** Writes the three files; stamp.json goes last, so an interrupted write never looks current. */
export function writePlayerData(directory: string, data: PlayerData, stamp: PlayerStamp): void {
  mkdirSync(directory, { recursive: true });
  rmSync(resolve(directory, STAMP_FILE), { force: true });
  writeFileSync(resolve(directory, "model.mpd"), data.model.text, "utf8");
  writeFileSync(
    resolve(directory, "steps.json"),
    `${JSON.stringify(data.steps, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(resolve(directory, STAMP_FILE), `${JSON.stringify(stamp, null, 2)}\n`, "utf8");
}

export interface PlayerStage {
  readonly version: typeof PLAYER_STAGE_VERSION;
  readonly set: string;
  readonly directory: string;
  readonly steps: number;
  readonly parts: number;
  readonly unplacedParts: number;
  readonly emptySteps: number;
  readonly subBuildSteps: number;
  readonly countFallbackSteps: number;
  readonly corrections: readonly string[];
  readonly correctedParts: number;
  readonly libraryFiles: number;
  readonly unofficialFiles: readonly string[];
  readonly standIns: Readonly<Record<string, number>>;
  readonly modelBytes: number;
}

/** Builds and writes one set's player data; a missing or refused input fails it with a PlayerStageError naming it. */
export function runPlayerStage(input: {
  readonly set: PlayerSet;
  readonly directory: string;
  readonly repositoryRoot: string;
  readonly inputs: PlayerInputPaths;
  readonly bookletPages: number;
  readonly key: AnswerKey;
  readonly official: OfficialLdrawModel;
  readonly align: AlignStage;
  readonly corrections: readonly FrameCorrection[];
}): PlayerStage {
  let data: PlayerData;
  let unofficialFiles: ReadonlySet<string>;
  try {
    const opened = openPlayerLibrary({
      official: input.inputs.library,
      unofficial: input.inputs.unofficialLibrary,
    });
    unofficialFiles = opened.unofficialFiles;
    data = buildPlayerData({
      ...input,
      ...opened,
      standInFor: builderStandIns(input.inputs.meshFallback),
    });
  } catch (error) {
    if (error instanceof PlayerLibraryError || error instanceof PlayerModelError) {
      throw new PlayerStageError(error.message);
    }
    throw error;
  }
  writePlayerData(
    input.directory,
    data,
    currentPlayerStamp(input.set, input.inputs, input.repositoryRoot),
  );
  const steps = data.steps.steps;
  return {
    version: PLAYER_STAGE_VERSION,
    set: input.set.id,
    directory: input.directory,
    steps: steps.length,
    parts: data.steps.set.partCount,
    unplacedParts: data.steps.set.unplacedParts,
    emptySteps: steps.filter(({ partsAdded }) => partsAdded === 0).length,
    subBuildSteps: steps.filter(({ subBuild }) => subBuild).length,
    countFallbackSteps: steps.filter(({ alignment }) => alignment !== "identity").length,
    corrections: [...new Set(input.corrections.map(({ designId }) => designId))].sort(byName),
    correctedParts: data.correctedParts,
    libraryFiles: data.model.libraryFiles,
    unofficialFiles: [...unofficialFiles].sort(byName),
    standIns: Object.fromEntries(data.standIns),
    modelBytes: data.model.bytes,
  };
}

export function playerLine(stage: {
  readonly status: string;
  readonly reason?: string;
  readonly value?: PlayerStage;
}): string {
  if (!stage.value) {
    return `[player] ${stage.status === "failed" ? "FAILED" : "not written"}: ${stage.reason}`;
  }
  const v = stage.value;
  const standIns = Object.entries(v.standIns).map(([design, parts]) => `${design} x${parts}`);
  return `[player] set ${v.set}: ${v.steps} printed steps, ${v.parts} parts (${v.unplacedParts} placed by no step, left out), ${v.emptySteps} steps add none, ${v.subBuildSteps} build sub-builds (shown in final position), ${v.countFallbackSteps} not aligned by identity · frame corrections ${v.corrections.join(", ") || "none"} on ${v.correctedParts} parts · ${v.libraryFiles} library files (${v.unofficialFiles.length} unofficial), Builder-mesh stand-ins ${standIns.join(", ") || "none"}, ${(v.modelBytes / 1024 / 1024).toFixed(1)} MB → ${v.directory}; play it with npm start`;
}
