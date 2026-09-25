/**
 * Packs the build player's model.mpd: the main model's part rows cut into
 * printed steps, plus every file those rows reach, embedded, so the player
 * loads one file and fetches nothing else (the format is
 * apps/web/src/player/player-data.ts).
 *
 * It does what three.js's utils/packLDrawModel.mjs does, from a library
 * archive instead of a folder: each referenced part, subpart and primitive is
 * embedded once as `0 FILE <library path>` (parts/3024.dat, parts/s/…,
 * p/…, p/48/…), every reference is rewritten to that path, and the colour
 * table is the library's LDConfig.ldr `0 !COLOUR` lines, placed in the main
 * model so every file inherits it. Library files keep their own header lines,
 * authors and licence included.
 *
 * Bound: a library file is resolved by the LDraw search order (parts/, then
 * p/; s/ under parts/, 48/ and 8/ under p/). A reference no file answers
 * fails the pack by name; nothing is dropped. A file that reaches itself,
 * directly or through others, fails it too, since an LDraw loader (three.js's
 * LDrawLoader) would expand it forever, and so does a chain of references
 * nested deeper than `maxDepth` files below the main model, counted along the
 * longest chain.
 */
export const PLAYER_MODEL_LIMITS = Object.freeze({
  maxFiles: 20_000,
  maxBytes: 128 * 1024 * 1024,
  maxDepth: 64,
});

/** A library archive's members, by path under its `ldraw/` root; null when there is no such member. */
export interface LibraryReader {
  read(path: string): string | null;
}

export interface ModelRow {
  readonly colorCode: number;
  readonly positionLdu: readonly number[];
  /** Row-major 3x3, as LDraw writes it. */
  readonly matrix: readonly number[];
  readonly filename: string;
}

export interface PlayerModelInput {
  /** The main model's name, written as its `0 FILE` line. */
  readonly name: string;
  /** Comment lines written under `0 FILE`, each starting with "0 ". */
  readonly header: readonly string[];
  /** The rows each printed step adds, in build order. */
  readonly steps: readonly (readonly ModelRow[])[];
  /** Models the rows may name besides library files (an export's multi-part bricks), by name. */
  readonly submodels: ReadonlyMap<string, readonly ModelRow[]>;
  /** The library's LDConfig.ldr. */
  readonly colours: string;
  readonly library: LibraryReader;
}

export interface PackedPlayerModel {
  readonly text: string;
  readonly bytes: number;
  readonly libraryFiles: number;
  readonly submodels: number;
  readonly colours: number;
}

export class PlayerModelError extends Error {
  override readonly name = "PlayerModelError";
}

const clean = (name: string) => name.trim().replaceAll("\\", "/").toLowerCase();

/** The library paths an LDraw reference may name, in search order. */
export function libraryCandidates(reference: string): string[] {
  const name = clean(reference);
  if (name.startsWith("s/")) return [`parts/${name}`];
  if (name.startsWith("48/") || name.startsWith("8/")) return [`p/${name}`];
  return [`parts/${name}`, `p/${name}`];
}

const number = (value: number) => {
  if (!Number.isFinite(value)) throw new PlayerModelError(`A model row holds ${value}.`);
  return String(value === 0 ? 0 : value);
};

export function formatRow(row: ModelRow, filename = row.filename): string {
  if (row.positionLdu.length !== 3 || row.matrix.length !== 9) {
    throw new PlayerModelError(
      `A model row for ${row.filename} is not 3 position and 9 matrix terms.`,
    );
  }
  return `1 ${row.colorCode} ${[...row.positionLdu, ...row.matrix].map(number).join(" ")} ${filename}`;
}

/** A reference chain for an error message: whole when short, else its ends. */
function describeChain(names: readonly string[]): string {
  const shown =
    names.length <= 8
      ? names
      : [...names.slice(0, 3), `… ${names.length - 6} more …`, ...names.slice(-3)];
  return shown.join(" -> ");
}

/**
 * Refuses a file that reaches itself and a chain nested past `maxDepth`.
 * `roots` are the files the main model names (depth 1); `references` holds
 * the embedded files each file names. Depth is measured along the longest
 * chain, since a loader expands every chain, not only the shortest path by
 * which packing first reached a file. Recursion stops at `maxDepth`.
 */
function checkNesting(
  roots: readonly string[],
  references: ReadonlyMap<string, readonly string[]>,
): void {
  const { maxDepth } = PLAYER_MODEL_LIMITS;
  /** Finished files: how many files the longest chain from each holds, itself included. */
  const height = new Map<string, number>();
  /** Finished files: the file named next on that longest chain. */
  const deepest = new Map<string, string>();
  const chain: string[] = [];
  const longestFrom = (name: string) => {
    const names = [name];
    for (let next = deepest.get(name); next !== undefined; next = deepest.get(next)) {
      names.push(next);
    }
    return names;
  };
  const tooDeep = (names: readonly string[]) =>
    new PlayerModelError(
      `The model nests files more than ${maxDepth} deep: ${describeChain(names)}; an LDraw loader expands every level, so flatten the sub-models or fix the library file that nests them.`,
    );
  const visit = (name: string): number => {
    const at = chain.indexOf(name);
    if (at >= 0) {
      throw new PlayerModelError(
        `The model's files form a reference cycle: ${describeChain([...chain.slice(at), name])}. An LDraw loader would expand it forever; fix the sub-model or library file that names ${name} again.`,
      );
    }
    let below = height.get(name);
    if (below === undefined) {
      if (chain.length >= maxDepth) throw tooDeep([...chain, name]);
      chain.push(name);
      below = 1;
      for (const target of new Set(references.get(name))) {
        const through = visit(target) + 1;
        if (through > below) {
          below = through;
          deepest.set(name, target);
        }
      }
      chain.pop();
      height.set(name, below);
    }
    if (chain.length + below > maxDepth) throw tooDeep([...chain, ...longestFrom(name)]);
    return below;
  };
  for (const root of new Set(roots)) visit(root);
}

export function packPlayerModel(input: PlayerModelInput): PackedPlayerModel {
  const submodels = new Map([...input.submodels].map(([name, rows]) => [clean(name), rows]));
  if (submodels.has(clean(input.name))) {
    throw new PlayerModelError(
      `A sub-model is named ${input.name}, like the main model, so a reference to it would reach the main model; rename the sub-model.`,
    );
  }
  /** Embedded files by name, in the order they were first reached. */
  const embedded = new Map<string, string>();
  const pending: string[] = [];
  let bytes = 0;

  const embed = (name: string, body: string) => {
    if (embedded.size >= PLAYER_MODEL_LIMITS.maxFiles) {
      throw new PlayerModelError(
        `The model reaches more than ${PLAYER_MODEL_LIMITS.maxFiles} files.`,
      );
    }
    embedded.set(name, body);
    bytes += body.length;
    if (bytes > PLAYER_MODEL_LIMITS.maxBytes) {
      throw new PlayerModelError(`The packed model passes ${PLAYER_MODEL_LIMITS.maxBytes} bytes.`);
    }
    pending.push(name);
  };

  /** The embedded name a reference resolves to, embedding the file on first sight. */
  const resolveReference = (reference: string, from: string): string => {
    const name = clean(reference);
    if (submodels.has(name)) {
      if (!embedded.has(name)) embed(name, "");
      return name;
    }
    for (const candidate of libraryCandidates(name)) {
      if (embedded.has(candidate)) return candidate;
      const text = input.library.read(candidate);
      if (text === null) continue;
      embed(candidate, text);
      return candidate;
    }
    throw new PlayerModelError(
      `${from} names ${reference}, which the LDraw library does not hold (looked in ${libraryCandidates(name).join(", ")}); use the pinned library archive, or fix the model row.`,
    );
  };

  /** The embedded files the main model names, then those each embedded file names. */
  const roots: string[] = [];
  const references = new Map<string, string[]>();

  const mainRows = input.steps.map((rows, index) =>
    rows.map((row) => {
      const target = resolveReference(row.filename, `Printed step ${index + 1}`);
      roots.push(target);
      return formatRow(row, target);
    }),
  );

  /** Rewrites a file's type-1 references to embedded names, noting each in `targets`; the rest of each line is kept. */
  const rewrite = (name: string, text: string, targets: string[]): string => {
    const lines: string[] = [];
    for (const raw of text.split(/\r?\n/u)) {
      const line = raw.trim();
      if (/^0\s+(FILE|NOFILE)\b/u.test(line)) {
        throw new PlayerModelError(
          `${name} holds a "${line.slice(0, 40)}" line; a library file must be one file.`,
        );
      }
      const tokens = line.split(/\s+/u);
      if (tokens[0] !== "1") {
        lines.push(line);
        continue;
      }
      if (tokens.length < 15)
        throw new PlayerModelError(`${name} has a short type-1 row: ${line.slice(0, 80)}`);
      const target = resolveReference(tokens.slice(14).join(" "), name);
      targets.push(target);
      lines.push([...tokens.slice(0, 14), target].join(" "));
    }
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  };

  const bodies = new Map<string, string>();
  for (let index = 0; index < pending.length; index += 1) {
    const name = pending[index]!;
    const targets: string[] = [];
    const rows = submodels.get(name);
    bodies.set(
      name,
      rows
        ? rows
            .map((row) => {
              const target = resolveReference(row.filename, name);
              targets.push(target);
              return formatRow(row, target);
            })
            .join("\n")
        : rewrite(name, embedded.get(name)!, targets),
    );
    references.set(name, targets);
  }
  checkNesting(roots, references);

  const colourLines = input.colours
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => /^0\s+!COLOUR\s/u.test(line));
  if (colourLines.length === 0) {
    throw new PlayerModelError(
      "LDConfig.ldr holds no 0 !COLOUR lines; the model would have no colours.",
    );
  }
  for (const line of input.header) {
    if (!line.startsWith("0 ") || /^0\s+(FILE|NOFILE|STEP)\b/u.test(line)) {
      throw new PlayerModelError(`Header line ${JSON.stringify(line)} is not a plain comment.`);
    }
  }
  const main = [
    `0 FILE ${input.name}`,
    ...input.header,
    ...colourLines,
    ...mainRows.flatMap((rows) => [...rows, "0 STEP"]),
  ];
  const sections = [...bodies].map(([name, body]) => `0 FILE ${name}\n${body}`);
  const text = `${[main.join("\n"), ...sections].join("\n\n")}\n`;
  return {
    text,
    bytes: Buffer.byteLength(text, "utf8"),
    libraryFiles: [...bodies.keys()].filter((name) => !submodels.has(name)).length,
    submodels: [...bodies.keys()].filter((name) => submodels.has(name)).length,
    colours: colourLines.length,
  };
}
