/**
 * The build player's input: two files per set, and nothing else.
 *
 * - `model.mpd`: one LDraw multi-part document holding the whole build. Its
 *   main (first) model lists every part as a type-1 row in build order, and
 *   closes each printed step with one `0 STEP` line, so printed step k is the
 *   rows between the (k-1)th and kth `0 STEP`; a step that adds no part is a
 *   bare `0 STEP`. Every file a row reaches (sub-models, library parts,
 *   subparts, primitives) is embedded as a `0 FILE` section, and the colours
 *   are `0 !COLOUR` lines in the main model, so the player fetches nothing
 *   else.
 * - `steps.json`: a `PlayerStepsFile`, one entry per printed step: its
 *   booklet page and how many rows it adds, which must equal the rows the
 *   model gives that step.
 *
 * The contract does not say where the steps came from. Today
 * `npm run booklet` writes both from LEGO's official model export and the
 * harness's alignment of it to the printed steps; a booklet reader that
 * places the parts itself would write the same two files. The player reads
 * only these, never the official model or the harness.
 */
export const PLAYER_STEPS_VERSION = "lego.player-steps/1";
export const PLAYER_SETS_VERSION = "lego.player-sets/1";

/** How a step's parts were chosen, as the source reports it; the player only displays it. */
export type StepAlignment = "identity" | "count-fallback" | "counts" | "mismatch";

export interface PlayerStep {
  /** The printed step number: 1..N, contiguous. */
  readonly step: number;
  /** The booklet page (1-based PDF page) that prints this step. */
  readonly page: number;
  /** Part rows this step adds to the main model. */
  readonly partsAdded: number;
  readonly alignment: StepAlignment;
  /** True when the step adds parts the model builds as a separate sub-build; v1 shows them in final position. */
  readonly subBuild: boolean;
}

export interface PlayerSetInfo {
  readonly id: string;
  readonly name: string;
  /** Pages in the booklet PDF. */
  readonly bookletPages: number;
  /** Where the parts and their grouping came from, in words. */
  readonly modelSource: string;
  /** Part rows in the main model: the sum of every step's partsAdded. */
  readonly partCount: number;
  /** Parts of the source model that no printed step places, left out of model.mpd. */
  readonly unplacedParts: number;
}

export interface PlayerStepsFile {
  readonly version: typeof PLAYER_STEPS_VERSION;
  readonly set: PlayerSetInfo;
  readonly steps: readonly PlayerStep[];
}

/** The sets the dev server offers: `/player-data/sets.json`. */
export interface PlayerSetsIndex {
  readonly version: typeof PLAYER_SETS_VERSION;
  readonly sets: readonly { readonly id: string; readonly name: string }[];
}

export class PlayerDataError extends Error {
  override readonly name = "PlayerDataError";
}

const ALIGNMENTS: readonly StepAlignment[] = ["identity", "count-fallback", "counts", "mismatch"];
const MAX_STEPS = 10_000;
const MAX_PARTS = 100_000;

function record(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new PlayerDataError(`${what} is not a JSON object.`);
  }
  return value as Record<string, unknown>;
}

function whole(value: unknown, what: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new PlayerDataError(
      `${what} is ${JSON.stringify(value)}; expected a whole number from ${min} to ${max}.`,
    );
  }
  return value;
}

function text(value: unknown, what: string): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > 200) {
    throw new PlayerDataError(`${what} is ${JSON.stringify(value)}; expected a non-empty string.`);
  }
  return value;
}

/** Validates a parsed steps.json, naming the first field that breaks the contract. */
export function parsePlayerSteps(json: unknown): PlayerStepsFile {
  const file = record(json, "steps.json");
  if (file.version !== PLAYER_STEPS_VERSION) {
    throw new PlayerDataError(
      `steps.json has version ${JSON.stringify(file.version)}; this player reads ${PLAYER_STEPS_VERSION}. Regenerate it with npm start.`,
    );
  }
  const set = record(file.set, "steps.json set");
  const bookletPages = whole(set.bookletPages, "set.bookletPages", 1, MAX_STEPS);
  const info: PlayerSetInfo = {
    id: text(set.id, "set.id"),
    name: text(set.name, "set.name"),
    bookletPages,
    modelSource: text(set.modelSource, "set.modelSource"),
    partCount: whole(set.partCount, "set.partCount", 0, MAX_PARTS),
    unplacedParts: whole(set.unplacedParts, "set.unplacedParts", 0, MAX_PARTS),
  };
  if (!Array.isArray(file.steps) || file.steps.length === 0 || file.steps.length > MAX_STEPS) {
    throw new PlayerDataError(`steps.json steps must list 1 to ${MAX_STEPS} printed steps.`);
  }
  const steps = file.steps.map((raw, index): PlayerStep => {
    const at = `steps[${index}]`;
    const entry = record(raw, at);
    const step = whole(entry.step, `${at}.step`, 1, MAX_STEPS);
    if (step !== index + 1) {
      throw new PlayerDataError(`${at}.step is ${step}; printed steps must run 1..N in order.`);
    }
    const alignment = entry.alignment as StepAlignment;
    if (!ALIGNMENTS.includes(alignment)) {
      throw new PlayerDataError(
        `${at}.alignment is ${JSON.stringify(entry.alignment)}; expected one of ${ALIGNMENTS.join(", ")}.`,
      );
    }
    if (typeof entry.subBuild !== "boolean") {
      throw new PlayerDataError(
        `${at}.subBuild is ${JSON.stringify(entry.subBuild)}; expected true or false.`,
      );
    }
    return {
      step,
      page: whole(entry.page, `${at}.page`, 1, bookletPages),
      partsAdded: whole(entry.partsAdded, `${at}.partsAdded`, 0, MAX_PARTS),
      alignment,
      subBuild: entry.subBuild,
    };
  });
  const total = steps.reduce((sum, { partsAdded }) => sum + partsAdded, 0);
  if (total !== info.partCount) {
    throw new PlayerDataError(
      `steps.json steps add ${total} parts but set.partCount is ${info.partCount}; regenerate it with npm start.`,
    );
  }
  return { version: PLAYER_STEPS_VERSION, set: info, steps };
}

/** Validates `/player-data/sets.json`. */
export function parsePlayerSetsIndex(json: unknown): PlayerSetsIndex {
  const file = record(json, "sets.json");
  if (file.version !== PLAYER_SETS_VERSION || !Array.isArray(file.sets)) {
    throw new PlayerDataError(`sets.json is not a ${PLAYER_SETS_VERSION} set list.`);
  }
  return {
    version: PLAYER_SETS_VERSION,
    sets: file.sets.map((raw, index) => {
      const entry = record(raw, `sets[${index}]`);
      return {
        id: text(entry.id, `sets[${index}].id`),
        name: text(entry.name, `sets[${index}].name`),
      };
    }),
  };
}

/**
 * The part rows each printed step adds, read from the main model of an MPD:
 * the type-1 rows before the first `0 FILE` after line one, cut at each
 * `0 STEP`. A trailing section after the last `0 STEP` holding rows is an
 * error, since no printed step closes it.
 */
export function mainModelStepRows(mpd: string): number[] {
  const counts: number[] = [];
  let rows = 0;
  const lines = mpd.split(/\r?\n/u);
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (/^0\s+FILE\b/u.test(line)) {
      if (index === 0) continue;
      break;
    }
    if (/^0\s+STEP\s*$/u.test(line)) {
      counts.push(rows);
      rows = 0;
    } else if (/^1\s/u.test(line)) rows += 1;
  }
  if (rows > 0) {
    throw new PlayerDataError(
      `model.mpd's main model ends with ${rows} part rows after its last 0 STEP; every printed step must end with 0 STEP.`,
    );
  }
  return counts;
}

/** Checks that model.mpd's step sections are the steps steps.json lists; returns each row's printed step. */
export function stepOfEachPart(mpd: string, steps: PlayerStepsFile): number[] {
  const rows = mainModelStepRows(mpd);
  if (rows.length !== steps.steps.length) {
    throw new PlayerDataError(
      `model.mpd has ${rows.length} printed steps but steps.json lists ${steps.steps.length}; regenerate both with npm start.`,
    );
  }
  const stepOf: number[] = [];
  steps.steps.forEach(({ step, partsAdded }, index) => {
    if (rows[index] !== partsAdded) {
      throw new PlayerDataError(
        `model.mpd adds ${rows[index]} parts at step ${step} but steps.json says ${partsAdded}; regenerate both with npm start.`,
      );
    }
    for (let part = 0; part < partsAdded; part += 1) stepOf.push(step);
  });
  return stepOf;
}
