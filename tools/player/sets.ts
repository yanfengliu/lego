import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * The set manifest: the sets the build player plays.
 *
 * Everything set-specific lives here, so adding a set is a new entry plus
 * that set's local data (its booklet PDF and model source), not new code:
 * `npm run booklet` takes its inputs and output folder from an entry,
 * `npm start` checks each entry's player data, the dev server serves each
 * entry under `/player-data/<id>/`, and the player page lists them from
 * there. The player data format itself is apps/web/src/player/player-data.ts.
 *
 * Input paths are relative to the main checkout: a git worktree has no
 * `recipes/` or `output/official-model/` of its own. `output` and `baseline`
 * are relative to the checkout that runs the generator.
 */
export interface PlayerSet {
  /** The set number printed on the booklet cover; also its URL segment. */
  readonly id: string;
  readonly name: string;
  /** The instruction booklet PDF. */
  readonly booklet: string;
  /** Where the parts, their poses and their printed steps come from. */
  readonly model: {
    readonly source: "official-model";
    /** LEGO's official LXFML: the bricks and the official build sequence. */
    readonly lxfml: string;
    /** The same model exported to LDraw: each brick's part file and pose. */
    readonly ldraw: string;
  };
  /**
   * LDraw design ids whose export frame the harness's labelled correction
   * layer (tools/booklet/export-frames.ts) fixes. The generator refuses to
   * write player data when the corrections it applied differ from this list.
   */
  readonly frameCorrections: readonly string[];
  /**
   * LEGO Builder meshes for the designs no LDraw library holds (a local file,
   * never committed); LEGO_BUILDER_NATIVE_PACK overrides it.
   */
  readonly meshFallback: string;
  /** Where the generator writes model.mpd, steps.json and stamp.json. */
  readonly output: string;
  /** The committed headline counts `npm run booklet` compares against. */
  readonly baseline: string;
}

export const PLAYER_SETS: readonly PlayerSet[] = Object.freeze([
  Object.freeze({
    id: "21066",
    name: "LEGO 21066",
    booklet: "recipes/6651557.pdf",
    model: Object.freeze({
      source: "official-model" as const,
      lxfml: "output/official-model/vx1087034_21066_a.xml",
      ldraw: "output/official-model/vx1087034_21066_a.ldr",
    }),
    frameCorrections: Object.freeze(["41682", "77844", "80015"]),
    meshFallback: "C:/tmp/lego-21066-builder-native-part-pack.json",
    output: "output/booklet/player/21066",
    baseline: "status/booklet-baseline.json",
  }),
]);

/** The set a command runs when none is named: the manifest's first entry. */
export const DEFAULT_PLAYER_SET: PlayerSet = PLAYER_SETS[0]!;

/** The entry for `id`, or an error naming the ids there are. */
export function playerSet(id: string | undefined): PlayerSet {
  if (id === undefined) return DEFAULT_PLAYER_SET;
  const set = PLAYER_SETS.find((entry) => entry.id === id);
  if (!set) {
    throw new Error(
      `No set ${JSON.stringify(id)} in tools/player/sets.ts; the sets are ${PLAYER_SETS.map((entry) => entry.id).join(", ")}.`,
    );
  }
  return set;
}

type Env = Readonly<Record<string, string | undefined>>;

/** The inputs `npm run booklet` reads for a set: the manifest's, unless BOOKLET_PDF, BOOKLET_LXFML, BOOKLET_OFFICIAL_LDRAW or LEGO_BUILDER_NATIVE_PACK name others. */
export function setInputPaths(
  set: PlayerSet,
  inputRoot: string,
  env: Env,
): {
  readonly booklet: string;
  readonly lxfml: string;
  readonly ldraw: string;
  readonly meshFallback: string;
} {
  const path = (variable: string, fallback: string) =>
    resolve(env[variable] ?? resolve(inputRoot, fallback));
  return {
    booklet: path("BOOKLET_PDF", set.booklet),
    lxfml: path("BOOKLET_LXFML", set.model.lxfml),
    ldraw: path("BOOKLET_OFFICIAL_LDRAW", set.model.ldraw),
    meshFallback: path("LEGO_BUILDER_NATIVE_PACK", set.meshFallback),
  };
}

/** Where a set's player data lives: `<BOOKLET_OUT>/player/<id>` when BOOKLET_OUT is set, else the manifest's `output`. */
export function playerOutputDir(set: PlayerSet, repositoryRoot: string, env: Env): string {
  return env.BOOKLET_OUT
    ? resolve(env.BOOKLET_OUT, "player", set.id)
    : resolve(repositoryRoot, set.output);
}

/** Deep enough to climb out of `.claude/worktrees/<name>/apps/web`. */
const SEARCH_DEPTH = 12;

/**
 * Where a manifest input path lives: the first ancestor of `from` (itself
 * included) that holds it, else the path under `from`. A worktree finds the
 * main checkout's ignored `recipes/` and `output/official-model/` this way.
 */
export function findInput(from: string, relativePath: string): string {
  let directory = resolve(from);
  for (let depth = 0; depth < SEARCH_DEPTH; depth += 1) {
    const candidate = resolve(directory, relativePath);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return resolve(from, relativePath);
}
