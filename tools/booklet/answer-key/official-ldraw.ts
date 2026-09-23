import { AnswerKeyFormatError } from "./xml-tree.ts";
import { lxfmlPoseInLdrawConvention, type LxfmlBrick } from "./lxfml.ts";

/**
 * The same official model exported to LDraw (an MPD beside the LXFML).
 *
 * It supplies what the LXFML cannot: each brick's LDraw part file and its pose
 * in that file's frame, which is the frame the catalog's LDraw aliases are
 * declared in. The two files are paired row by row — single-part bricks with
 * part rows, multi-part bricks with sub-model rows, each in file order — and
 * the pairing is then checked rather than assumed: the transform taking a
 * brick's LXFML pose to its LDraw pose depends only on the design, so every
 * instance of a design must agree on it. A shifted pairing breaks that for
 * every row after the shift.
 *
 * Bound: the check needs two instances to compare. A design placed once, and
 * a multi-part brick (paired with a sub-model row by order alone), has nothing
 * to agree with, so its pairing is reported as unverified, never as checked.
 * The check also proves only that instances agree: an export that uses one
 * wrong frame for every instance of a design passes it (export-frames.ts
 * compares the frames themselves against the pinned ones).
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

/**
 * What the pairing check says about one brick's row: `verified` when every
 * instance of its design agrees on the LXFML-to-LDraw frame, `contradicted`
 * when they do not, and unverified (`single-instance`, `composite`) when
 * there is nothing to compare it with.
 */
export type PairingCheck = "verified" | "contradicted" | "single-instance" | "composite";

export interface OfficialLdrawBrick {
  readonly uuid: string;
  readonly filename: string;
  readonly colorCode: number;
  readonly composite: boolean;
  readonly matrix: readonly number[];
  readonly positionLdu: readonly number[];
  readonly pairing: PairingCheck;
}

/**
 * One design's LXFML-to-LDraw frame as the export applied it, in the
 * convention of scripts/builder_ldraw_frame.py: an LXFML-local point p (in
 * LDU, LDraw axes) lands at turn * p + originLdu in the LDraw file's frame, so
 * `originLdu` is where the LXFML origin sits in LDraw-local coordinates.
 */
export interface ExportDesignFrame {
  readonly designRevision: string;
  readonly designId: string;
  readonly filename: string;
  readonly instances: number;
  /** Row-major 3x3 with float noise rounded off; null when it is not a signed permutation. */
  readonly turn: readonly number[] | null;
  readonly originLdu: readonly number[];
  readonly pairing: PairingCheck;
}

export interface OfficialLdrawPairing {
  readonly byBrick: ReadonlyMap<string, OfficialLdrawBrick>;
  /** Single-part designs by LXFML design revision, with the frame their first instance shows. */
  readonly designFrames: ReadonlyMap<string, ExportDesignFrame>;
  /** Instances that disagree with their design's first instance: a broken pairing. */
  readonly invarianceFailures: readonly string[];
  /** LXFML materials that map to more than one LDraw colour. */
  readonly colorConflicts: readonly string[];
  /** Material id to LDraw colour code, as the export applied it. */
  readonly materialColors: ReadonlyMap<string, number>;
  readonly counts: {
    /** Designs with two or more single-part instances, all agreeing. */
    readonly verifiedDesigns: number;
    readonly verifiedBricks: number;
    /** Designs placed once: their pairing is unverified. */
    readonly singleInstanceDesigns: number;
    /** Multi-part bricks: paired with sub-model rows by order alone, unverified. */
    readonly compositeBricks: number;
    readonly contradictedDesigns: number;
  };
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

/** A value within `tolerance` of a whole number is that number. */
function whole(value: number, tolerance: number): number {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) <= tolerance ? rounded + 0 : value;
}

/** The frame in the pins' convention: turn = transpose(rotation), origin = -turn * translation. */
function exportFrame(frame: { rotation: number[]; translation: number[] }): {
  turn: number[] | null;
  originLdu: number[];
} {
  const turn = transpose(frame.rotation);
  const exact = turn.map((value) =>
    whole(value, OFFICIAL_LDRAW_LIMITS.invarianceRotationTolerance),
  );
  return {
    turn: exact.every(Number.isInteger) ? exact : null,
    originLdu: rotate(turn, frame.translation).map((value) =>
      whole(-value, OFFICIAL_LDRAW_LIMITS.invarianceTranslationToleranceLdu),
    ),
  };
}

interface FirstInstance {
  readonly row: number;
  readonly filename: string;
  readonly rotation: number[];
  readonly translation: number[];
  readonly frame: { turn: number[] | null; originLdu: number[] };
  instances: number;
}

/**
 * Pairs LXFML bricks with the export's rows and checks the pairing. Refuses
 * (throws) only when the row counts cannot pair at all; a pairing that pairs
 * but disagrees is reported through `invarianceFailures`, and every brick
 * says which check its row passed (`pairing`).
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

  const invarianceFailures: string[] = [];
  const contradicted = new Set<string>();
  const firsts = new Map<string, FirstInstance>();
  single.forEach((brick, index) => {
    const row = partRows[index]!;
    const frame = localFrame(brick, row);
    const first = firsts.get(brick.designRevision);
    if (!first) {
      firsts.set(brick.designRevision, {
        row: brick.row,
        filename: row.filename,
        ...frame,
        frame: exportFrame(frame),
        instances: 1,
      });
      return;
    }
    first.instances += 1;
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
      contradicted.add(brick.designRevision);
      invarianceFailures.push(
        `LXFML brick row ${brick.row} (${brick.designRevision}) pairs with ${label} line ${row.line} (${row.filename}), but its LXFML-to-LDraw frame differs from row ${first.row} (${first.filename}) by ${rotationError.toExponential(2)} in rotation and ${translationError.toFixed(3)} LDU.`,
      );
    }
  });
  const checkOf = (design: string): PairingCheck =>
    contradicted.has(design)
      ? "contradicted"
      : firsts.get(design)!.instances > 1
        ? "verified"
        : "single-instance";

  const byBrick = new Map<string, OfficialLdrawBrick>();
  const pair = (brick: LxfmlBrick, row: LdrawRow, pairing: PairingCheck) =>
    byBrick.set(
      brick.uuid,
      Object.freeze({
        uuid: brick.uuid,
        filename: row.filename,
        colorCode: row.colorCode,
        composite: pairing === "composite",
        matrix: row.matrix,
        positionLdu: row.positionLdu,
        pairing,
      }),
    );
  single.forEach((brick, index) => pair(brick, partRows[index]!, checkOf(brick.designRevision)));
  composite.forEach((brick, index) => pair(brick, submodelRows[index]!, "composite"));

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
  const designFrames = new Map<string, ExportDesignFrame>();
  for (const brick of single) {
    if (designFrames.has(brick.designRevision)) continue;
    const first = firsts.get(brick.designRevision)!;
    designFrames.set(
      brick.designRevision,
      Object.freeze({
        designRevision: brick.designRevision,
        designId: brick.designId,
        filename: first.filename,
        instances: first.instances,
        turn: first.frame.turn,
        originLdu: first.frame.originLdu,
        pairing: checkOf(brick.designRevision),
      }),
    );
  }
  const designs = [...designFrames.values()];
  const verified = designs.filter(({ pairing }) => pairing === "verified");
  return Object.freeze({
    byBrick,
    designFrames,
    invarianceFailures: Object.freeze(invarianceFailures),
    colorConflicts: Object.freeze(colorConflicts),
    materialColors,
    counts: Object.freeze({
      verifiedDesigns: verified.length,
      verifiedBricks: verified.reduce((total, { instances }) => total + instances, 0),
      singleInstanceDesigns: designs.filter(({ pairing }) => pairing === "single-instance").length,
      compositeBricks: composite.length,
      contradictedDesigns: contradicted.size,
    }),
  });
}
