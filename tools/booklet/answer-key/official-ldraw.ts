import { AnswerKeyFormatError } from "./xml-tree.ts";
import { lxfmlPoseInLdrawConvention, type LxfmlBrick } from "./lxfml.ts";

/**
 * The same official model exported to LDraw (an MPD beside the LXFML).
 *
 * It supplies what the LXFML cannot: each brick's LDraw part file and its pose
 * in that file's frame, which is the frame the catalog's LDraw aliases are
 * declared in. The two files are paired row by row — single-part bricks with
 * part rows, multi-part bricks with sub-model rows, each in file order — and
 * the pairing is then proved rather than assumed: the transform taking a
 * brick's LXFML pose to its LDraw pose depends only on the design, so every
 * instance of a design must agree on it. A shifted pairing breaks that for
 * every row after the shift.
 */
export const OFFICIAL_LDRAW_LIMITS = Object.freeze({
  maxBytes: 8 * 1024 * 1024,
  maxLines: 200_000,
  maxFiles: 256,
  /** Rotation terms and LDU that two instances of one design may differ by. */
  invarianceRotationTolerance: 1e-6,
  invarianceTranslationToleranceLdu: 1e-3,
});

export interface LdrawRow {
  readonly line: number;
  readonly colorCode: number;
  readonly positionLdu: readonly number[];
  /** Row-major 3x3 acting on column vectors, as LDraw writes it. */
  readonly matrix: readonly number[];
  readonly filename: string;
}

export interface OfficialLdrawModel {
  readonly mainFile: string;
  readonly files: ReadonlyMap<string, readonly LdrawRow[]>;
  readonly ignoredLines: number;
}

export interface OfficialLdrawBrick {
  readonly uuid: string;
  readonly filename: string;
  readonly colorCode: number;
  readonly composite: boolean;
  readonly matrix: readonly number[];
  readonly positionLdu: readonly number[];
}

export interface OfficialLdrawPairing {
  readonly byBrick: ReadonlyMap<string, OfficialLdrawBrick>;
  /** Designs whose instances disagree on the LXFML-to-LDraw frame: a broken pairing. */
  readonly invarianceFailures: readonly string[];
  /** LXFML materials that map to more than one LDraw colour. */
  readonly colorConflicts: readonly string[];
  /** Material id to LDraw colour code, as the export applied it. */
  readonly materialColors: ReadonlyMap<string, number>;
}

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;

export function parseOfficialLdraw(
  source: string,
  label = "official LDraw export",
): OfficialLdrawModel {
  if (source.length > OFFICIAL_LDRAW_LIMITS.maxBytes) {
    throw new AnswerKeyFormatError(
      `${label} is over the ${OFFICIAL_LDRAW_LIMITS.maxBytes}-character limit.`,
    );
  }
  const lines = source.split(/\r?\n/u);
  if (lines.length > OFFICIAL_LDRAW_LIMITS.maxLines) {
    throw new AnswerKeyFormatError(
      `${label} has ${lines.length} lines, over the ${OFFICIAL_LDRAW_LIMITS.maxLines}-line limit.`,
    );
  }
  const files = new Map<string, LdrawRow[]>();
  let current: LdrawRow[] | null = null;
  let mainFile: string | null = null;
  let ignoredLines = 0;
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (line === "") continue;
    const lineNumber = index + 1;
    const file = /^0\s+FILE\s+(.+)$/u.exec(line);
    if (file) {
      const name = file[1]!.trim().toLowerCase();
      if (files.has(name))
        throw new AnswerKeyFormatError(`${label} line ${lineNumber} repeats FILE ${name}.`);
      if (files.size >= OFFICIAL_LDRAW_LIMITS.maxFiles) {
        throw new AnswerKeyFormatError(
          `${label} has more than ${OFFICIAL_LDRAW_LIMITS.maxFiles} FILE sections.`,
        );
      }
      current = [];
      files.set(name, current);
      mainFile ??= name;
      continue;
    }
    if (!line.startsWith("1 ")) {
      ignoredLines += 1;
      continue;
    }
    if (!current) {
      throw new AnswerKeyFormatError(
        `${label} line ${lineNumber} places a part before any "0 FILE" header.`,
      );
    }
    const tokens = line.split(/\s+/u);
    if (
      tokens.length !== 15 ||
      !/^\d{1,6}$/u.test(tokens[1]!) ||
      tokens.slice(2, 14).some((token) => !NUMBER.test(token))
    ) {
      throw new AnswerKeyFormatError(
        `${label} line ${lineNumber} is not a type-1 row "1 colour x y z a b c d e f g h i file"; received ${JSON.stringify(line.slice(0, 80))}.`,
      );
    }
    const values = tokens.slice(2, 14).map(Number);
    current.push(
      Object.freeze({
        line: lineNumber,
        colorCode: Number(tokens[1]),
        positionLdu: Object.freeze(values.slice(0, 3)),
        matrix: Object.freeze(values.slice(3)),
        filename: tokens[14]!.toLowerCase(),
      }),
    );
  }
  if (!mainFile) throw new AnswerKeyFormatError(`${label} has no "0 FILE" section.`);
  return Object.freeze({ mainFile, files, ignoredLines });
}

function transpose(m: readonly number[]): number[] {
  return [m[0]!, m[3]!, m[6]!, m[1]!, m[4]!, m[7]!, m[2]!, m[5]!, m[8]!];
}

function multiply(left: readonly number[], right: readonly number[]): number[] {
  return Array.from({ length: 9 }, (_, index) => {
    const row = Math.floor(index / 3);
    const column = index % 3;
    return (
      left[row * 3]! * right[column]! +
      left[row * 3 + 1]! * right[3 + column]! +
      left[row * 3 + 2]! * right[6 + column]!
    );
  });
}

function rotate(m: readonly number[], v: readonly number[]): number[] {
  return [0, 1, 2].map(
    (row) => m[row * 3]! * v[0]! + m[row * 3 + 1]! * v[1]! + m[row * 3 + 2]! * v[2]!,
  );
}

/** The design-local transform from a brick's LXFML frame to its LDraw frame. */
function localFrame(
  brick: LxfmlBrick,
  row: LdrawRow,
): { rotation: number[]; translation: number[] } {
  const xml = lxfmlPoseInLdrawConvention(brick.parts[0]!);
  const inverse = transpose(xml.matrix);
  return {
    rotation: multiply(inverse, row.matrix),
    translation: rotate(
      inverse,
      row.positionLdu.map((value, axis) => value - xml.positionLdu[axis]!),
    ),
  };
}

/**
 * Pairs LXFML bricks with the export's rows and proves the pairing. Refuses
 * (throws) only when the row counts cannot pair at all; a pairing that pairs
 * but disagrees is reported through `invarianceFailures`.
 */
export function pairOfficialLdraw(
  bricks: readonly LxfmlBrick[],
  model: OfficialLdrawModel,
  label = "official LDraw export",
): OfficialLdrawPairing {
  const rows = model.files.get(model.mainFile)!;
  const partRows = rows.filter((row) => !model.files.has(row.filename));
  const submodelRows = rows.filter((row) => model.files.has(row.filename));
  const single = bricks.filter((brick) => brick.parts.length === 1);
  const composite = bricks.filter((brick) => brick.parts.length > 1);
  if (partRows.length !== single.length || submodelRows.length !== composite.length) {
    throw new AnswerKeyFormatError(
      `${label} main file ${model.mainFile} has ${partRows.length} part rows and ${submodelRows.length} sub-model rows, but the LXFML has ${single.length} single-part and ${composite.length} multi-part bricks; re-export the LDraw file from this LXFML.`,
    );
  }
  const byBrick = new Map<string, OfficialLdrawBrick>();
  const pair = (brick: LxfmlBrick, row: LdrawRow, isComposite: boolean) =>
    byBrick.set(
      brick.uuid,
      Object.freeze({
        uuid: brick.uuid,
        filename: row.filename,
        colorCode: row.colorCode,
        composite: isComposite,
        matrix: row.matrix,
        positionLdu: row.positionLdu,
      }),
    );
  single.forEach((brick, index) => pair(brick, partRows[index]!, false));
  composite.forEach((brick, index) => pair(brick, submodelRows[index]!, true));

  const invarianceFailures: string[] = [];
  const reference = new Map<
    string,
    { row: number; rotation: number[]; translation: number[]; filename: string }
  >();
  single.forEach((brick, index) => {
    const row = partRows[index]!;
    const frame = localFrame(brick, row);
    const first = reference.get(brick.designRevision);
    if (!first) {
      reference.set(brick.designRevision, { row: brick.row, ...frame, filename: row.filename });
      return;
    }
    const rotationError = Math.max(
      ...frame.rotation.map((value, i) => Math.abs(value - first.rotation[i]!)),
    );
    const translationError = Math.max(
      ...frame.translation.map((value, i) => Math.abs(value - first.translation[i]!)),
    );
    if (
      first.filename !== row.filename ||
      rotationError > OFFICIAL_LDRAW_LIMITS.invarianceRotationTolerance ||
      translationError > OFFICIAL_LDRAW_LIMITS.invarianceTranslationToleranceLdu
    ) {
      invarianceFailures.push(
        `LXFML brick row ${brick.row} (${brick.designRevision}) pairs with ${label} line ${row.line} (${row.filename}), but its LXFML-to-LDraw frame differs from row ${first.row} (${first.filename}) by ${rotationError.toExponential(2)} in rotation and ${translationError.toFixed(3)} LDU.`,
      );
    }
  });

  const materialColors = new Map<string, number>();
  const colorConflicts: string[] = [];
  // A sub-model row carries colour 16 ("inherit"), so only part rows say what a material exports as.
  for (const brick of single) {
    const color = byBrick.get(brick.uuid)!.colorCode;
    const known = materialColors.get(brick.materialId);
    if (known === undefined) materialColors.set(brick.materialId, color);
    else if (known !== color) {
      colorConflicts.push(
        `LXFML material ${brick.materialId} exports as LDraw colour ${known} and ${color} (brick row ${brick.row}).`,
      );
    }
  }
  return Object.freeze({
    byBrick,
    invarianceFailures: Object.freeze(invarianceFailures),
    colorConflicts: Object.freeze(colorConflicts),
    materialColors,
  });
}
