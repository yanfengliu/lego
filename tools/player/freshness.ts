import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import type { PlayerSet } from "./sets.ts";

/**
 * Whether a set's player data is current: `npm run booklet` writes
 * stamp.json beside model.mpd and steps.json, last, and `npm start`
 * regenerates when the stamp is missing or differs from what the inputs and
 * the generating code are now.
 *
 * The booklet, the official model files and the Builder mesh pack are
 * hashed; the two LDraw library archives are identified by size and
 * modification time, since the generator refuses any archive but the pinned
 * one anyway. The code is every source file
 * under GENERATOR_SOURCES, tests excluded.
 *
 * Bound: a generator dependency outside GENERATOR_SOURCES changes nothing
 * here, so its edit leaves the data looking fresh; `npm run booklet`
 * regenerates regardless.
 */
export const PLAYER_STAMP_VERSION = "lego.player-stamp/1";

export const GENERATOR_SOURCES: readonly string[] = Object.freeze([
  "tools/booklet",
  "tools/player/sets.ts",
  "tools/player/freshness.ts",
  "apps/web/src/instructions",
  "apps/web/src/player/player-data.ts",
  "packages/catalog/src",
  "scripts/builder_ldraw_frame_pins.py",
  "scripts/derive-ldraw-catalog-frames.mjs",
  "scripts/part-identification-prefix50-ldraw-catalog-frames-archive.mjs",
  "package-lock.json",
]);

export interface PlayerInputPaths {
  readonly booklet: string;
  readonly lxfml: string;
  readonly ldraw: string;
  readonly library: string;
  readonly unofficialLibrary: string;
  readonly meshFallback: string;
}

export interface PlayerStamp {
  readonly version: typeof PLAYER_STAMP_VERSION;
  readonly set: string;
  readonly inputs: { readonly [Name in keyof PlayerInputPaths]: string };
  readonly code: string;
}

const INPUT_WORDS: { readonly [Name in keyof PlayerInputPaths]: string } = {
  booklet: "the booklet PDF",
  lxfml: "the official LXFML",
  ldraw: "the official LDraw export",
  library: "the LDraw library archive",
  unofficialLibrary: "the unofficial LDraw library archive",
  meshFallback: "the Builder mesh pack",
};

const sha256 = (bytes: Uint8Array | string) =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function fileIdentity(path: string, byContent: boolean): string {
  if (!existsSync(path)) return `absent:${path}`;
  if (!byContent) {
    const stat = statSync(path);
    return `${path}|${stat.size}|${stat.mtimeMs}`;
  }
  return sha256(readFileSync(path));
}

const isTest = (name: string) =>
  /\.(test|spec|score\.test)\.[cm]?[jt]sx?$/u.test(name) || name === "__fixtures__";

function sourceFiles(root: string, path: string, into: string[]): void {
  if (!existsSync(path)) return;
  if (statSync(path).isFile()) {
    into.push(relative(root, path).replaceAll("\\", "/"));
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (isTest(entry.name)) continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) sourceFiles(root, child, into);
    else if (entry.isFile()) into.push(relative(root, child).replaceAll("\\", "/"));
  }
}

/** One digest over the generating code's file names and bytes. */
export function generatorCodeDigest(repositoryRoot: string): string {
  const files: string[] = [];
  for (const source of GENERATOR_SOURCES)
    sourceFiles(repositoryRoot, resolve(repositoryRoot, source), files);
  const hash = createHash("sha256");
  for (const file of files.sort()) {
    // Line endings are checkout noise, not a code change.
    hash
      .update(`${file}\n`)
      .update(readFileSync(resolve(repositoryRoot, file), "utf8").replaceAll("\r\n", "\n"));
  }
  return `sha256:${hash.digest("hex")}`;
}

export function currentPlayerStamp(
  set: PlayerSet,
  inputs: PlayerInputPaths,
  repositoryRoot: string,
): PlayerStamp {
  return {
    version: PLAYER_STAMP_VERSION,
    set: sha256(JSON.stringify(set)),
    inputs: {
      booklet: fileIdentity(inputs.booklet, true),
      lxfml: fileIdentity(inputs.lxfml, true),
      ldraw: fileIdentity(inputs.ldraw, true),
      library: fileIdentity(inputs.library, false),
      unofficialLibrary: fileIdentity(inputs.unofficialLibrary, false),
      meshFallback: fileIdentity(inputs.meshFallback, true),
    },
    code: generatorCodeDigest(repositoryRoot),
  };
}

export const STAMP_FILE = "stamp.json";

/** The stamp a generator run left in `directory`, or null when there is none it can read. */
export function readPlayerStamp(directory: string): PlayerStamp | null {
  try {
    const stamp = JSON.parse(readFileSync(resolve(directory, STAMP_FILE), "utf8")) as PlayerStamp;
    return stamp.version === PLAYER_STAMP_VERSION ? stamp : null;
  } catch {
    return null;
  }
}

/** Why the data in `directory` is not current, or null when it is. */
export function stalenessOf(directory: string, current: PlayerStamp): string | null {
  for (const file of ["steps.json", "model.mpd"]) {
    if (!existsSync(resolve(directory, file))) return `${file} is missing`;
  }
  const recorded = readPlayerStamp(directory);
  if (!recorded) return `${STAMP_FILE} is missing or unreadable`;
  if (recorded.set !== current.set) return "the set's manifest entry changed";
  for (const name of Object.keys(INPUT_WORDS) as (keyof PlayerInputPaths)[]) {
    if (recorded.inputs[name] !== current.inputs[name]) return `${INPUT_WORDS[name]} changed`;
  }
  if (recorded.code !== current.code) return "the generating code changed";
  return null;
}
