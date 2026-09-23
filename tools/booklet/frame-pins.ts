import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

/**
 * The pinned Builder-to-LDraw frames of scripts/builder_ldraw_frame_pins.py,
 * read by the booklet harness so it can check the official export's frames
 * against them.
 *
 * The Python file stays the one source of truth: this reads its `_PINS`
 * table and recomputes every pin's digest from the fields it read, exactly as
 * scripts/builder_ldraw_frame.py's `canonical_text` does. A pin whose digest
 * does not reproduce is reported and never used, so a change to the file's
 * layout, or a pin edited without re-deriving it, cannot pass as a pin.
 */
export const FRAME_PINS_DEFAULT_PATH = "scripts/builder_ldraw_frame_pins.py";
const FRAME_SCHEMA_VERSION = "lego.builder-ldraw-frame/1";
const BUILDER_NATIVE_FRAME_ID = "lego-builder-native-to-catalog-ldu/1";
const MAX_PIN_FILE_BYTES = 256 * 1024;

/** (a, b), (c, d) of scripts/builder_ldraw_frame.py TURNS: x' = a x + b z, z' = c x + d z. */
const TURNS: Readonly<Record<string, readonly [number, number, number, number]>> = {
  turn0: [1, 0, 0, 1],
  turn90: [0, -1, 1, 0],
  turn180: [-1, 0, 0, -1],
  turn270: [0, 1, -1, 0],
};

export interface FramePin {
  readonly designId: string;
  readonly revision: string;
  readonly recordSha256: string;
  readonly turnName: string;
  /** Row-major 3x3 in LDraw axes: an LXFML-local point p lands at turn * p + originLdu. */
  readonly turn: readonly number[];
  readonly originLdu: readonly number[];
  readonly derivation: string;
  readonly digest: string;
  /** False when the digest does not reproduce from the fields read; such a pin is never used. */
  readonly digestVerified: boolean;
}

export type FramePinsLoad =
  | { readonly status: "loaded"; readonly path: string; readonly pins: readonly FramePin[] }
  | { readonly status: "absent"; readonly path: string };

/** The 3x3 turn a pin names, in LDraw axes; null for a mirror or an unknown name. */
export function turnMatrix(name: string): number[] | null {
  const turn = TURNS[name];
  if (!turn) return null;
  const [a, b, c, d] = turn;
  return [a, 0, b, 0, 1, 0, c, 0, d];
}

function digestOf(pin: Omit<FramePin, "digest" | "digestVerified">): string {
  const [a, b, c, d] = TURNS[pin.turnName]!;
  const linear = [a * 25, 0, -b * 25, 0, -25, 0, c * 25, 0, -d * 25].map((value) => value + 0);
  const text = [
    FRAME_SCHEMA_VERSION,
    `designId=${pin.designId}`,
    `revision=${pin.revision}`,
    `recordSha256=${pin.recordSha256}`,
    `builderNativeFrameId=${BUILDER_NATIVE_FRAME_ID}`,
    `turn=${pin.turnName}`,
    `linearLdu=${linear.join(",")}`,
    `translationLdu=${pin.originLdu.join(",")}`,
    `derivation=${pin.derivation}`,
    "",
  ].join("\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

const PIN_ROW =
  /\(\s*"(\d{1,9})",\s*"([A-Za-z0-9]{1,8})",\s*"([0-9a-f]{64})",\s*"([A-Za-z0-9-]{1,24})",\s*\((-?\d{1,6}),\s*(-?\d{1,6}),\s*(-?\d{1,6})\),\s*([A-Z_]{1,32}),\s*"([0-9a-f]{64})",?\s*\)/gu;

/** Parses the pins file's text; `label` names the file in every error. */
export function parseFramePins(text: string, label: string): FramePin[] {
  const constants = new Map(
    [...text.matchAll(/^([A-Z_]{1,32}) = "([a-z-]{1,64})"$/gmu)].map(
      ([, name, value]) => [name!, value!] as const,
    ),
  );
  const start = text.indexOf("_PINS:");
  const end = start < 0 ? -1 : text.indexOf("\n)\n", start);
  if (start < 0 || end < 0) {
    throw new Error(
      `${label} has no "_PINS: ... = (" table ending in a line ")"; the harness reads the pins from that table, so re-check the file's layout.`,
    );
  }
  const table = text.slice(start, end);
  const pins: FramePin[] = [];
  for (const match of table.matchAll(PIN_ROW)) {
    const [, designId, revision, record, turnName, x, y, z, derivationName, digest] = match;
    const derivation = constants.get(derivationName!);
    if (derivation === undefined || turnMatrix(turnName!) === null) {
      throw new Error(
        `${label} pins design ${designId} with ${turnMatrix(turnName!) === null ? `turn ${turnName}, which is not a proper quarter turn` : `derivation ${derivationName}, which the file does not define`}.`,
      );
    }
    const fields = {
      designId: designId!,
      revision: revision!,
      recordSha256: record!,
      turnName: turnName!,
      turn: turnMatrix(turnName!)!,
      originLdu: [Number(x), Number(y), Number(z)],
      derivation,
    };
    pins.push({ ...fields, digest: digest!, digestVerified: digestOf(fields) === digest });
  }
  const rows = table.split("\n").filter((line) => /^\s{4}\($/u.test(line)).length;
  if (pins.length === 0 || pins.length !== rows) {
    throw new Error(
      `${label} lists ${rows} pin rows but ${pins.length} read as (design, revision, record, turn, (x, y, z), derivation, digest); re-check the file's layout.`,
    );
  }
  return pins;
}

export function loadFramePins(path: string): FramePinsLoad {
  let size: number;
  try {
    size = statSync(path).size;
  } catch {
    return { status: "absent", path };
  }
  if (size > MAX_PIN_FILE_BYTES) {
    throw new Error(
      `Frame pins ${path} is ${size} bytes, over the ${MAX_PIN_FILE_BYTES}-byte limit for a pins table.`,
    );
  }
  return {
    status: "loaded",
    path,
    pins: parseFramePins(readFileSync(path, "utf8"), `Frame pins ${path}`),
  };
}
