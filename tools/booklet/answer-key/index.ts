import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

import { flattenBuildSequence, type BuildSequence } from "./build-units.ts";
import { LXFML_LIMITS, parseLxfml, type LxfmlBrick, type LxfmlModel } from "./lxfml.ts";
import {
  OFFICIAL_LDRAW_LIMITS,
  pairOfficialLdraw,
  parseOfficialLdraw,
  type OfficialLdrawPairing,
} from "./official-ldraw.ts";
import { AnswerKeyFormatError } from "./xml-tree.ts";

/**
 * The official model of the set, loaded as a scoring answer key.
 *
 * Boundary: only tools/booklet stages and tests import this. Product code
 * (packages/*\/src, apps/web/src) is barred by eslint.config.js from importing
 * tools/booklet at all and from naming output/official-model, because a
 * pipeline that could see the answer key could no longer be scored by it.
 */
export { assemblyKeyAt, flattenBuildSequence } from "./build-units.ts";
export type { AssemblyLevel, BrickPlacement, BuildSequence, BuildUnit } from "./build-units.ts";
export { lxfmlPoseInLdrawConvention, parseLxfml } from "./lxfml.ts";
export type { LxfmlBrick, LxfmlModel, LxfmlStep } from "./lxfml.ts";
export { pairOfficialLdraw, parseOfficialLdraw } from "./official-ldraw.ts";
export type { OfficialLdrawBrick, OfficialLdrawPairing } from "./official-ldraw.ts";
export { AnswerKeyFormatError } from "./xml-tree.ts";

/**
 * Where the answer key sits in a checkout, relative to its root. The files
 * are ignored by Git and never committed; the harness reads them from the
 * main checkout unless BOOKLET_LXFML / BOOKLET_OFFICIAL_LDRAW say otherwise.
 */
export const ANSWER_KEY_DEFAULT_PATHS = Object.freeze({
  lxfml: "output/official-model/vx1087034_21066_a.xml",
  ldraw: "output/official-model/vx1087034_21066_a.ldr",
});

export interface SourceFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export type LdrawState =
  | {
      readonly status: "paired";
      readonly source: SourceFile;
      readonly pairing: OfficialLdrawPairing;
    }
  | { readonly status: "absent" | "unpaired"; readonly reason: string };

export interface AnswerKey {
  readonly source: SourceFile;
  readonly model: LxfmlModel;
  readonly sequence: BuildSequence;
  readonly ldraw: LdrawState;
  readonly brickByUuid: ReadonlyMap<string, LxfmlBrick>;
}

export type AnswerKeyLoad =
  | { readonly status: "loaded"; readonly key: AnswerKey }
  | { readonly status: "absent"; readonly reason: string };

/**
 * The identity a booklet callout counts by: the element id when the model
 * carries one, otherwise design plus material, which is what an element id
 * denotes.
 */
export function elementKeyOf(brick: LxfmlBrick): string {
  return brick.itemNos.length > 0
    ? brick.itemNos.join(",")
    : `design:${brick.designId}/material:${brick.materialId}`;
}

function readBounded(
  path: string,
  maxBytes: number,
  label: string,
): { text: string; source: SourceFile } {
  const size = statSync(path).size;
  if (size > maxBytes) {
    throw new AnswerKeyFormatError(
      `${label} ${path} is ${size} bytes, over the ${maxBytes}-byte limit.`,
    );
  }
  const bytes = readFileSync(path);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new AnswerKeyFormatError(
      `${label} ${path} is not valid UTF-8; re-export it as UTF-8 text.`,
    );
  }
  return {
    text,
    source: {
      path,
      bytes: bytes.byteLength,
      sha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    },
  };
}

function exists(path: string | null): path is string {
  if (path === null) return false;
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * Loads the answer key. A missing LXFML is not an error — clean clones have
 * none — so it returns `absent` with the path it looked at. A present file
 * that cannot be read as an answer key throws, naming the file and the fault.
 */
export function loadAnswerKey(paths: {
  readonly lxfmlPath: string | null;
  readonly ldrawPath: string | null;
}): AnswerKeyLoad {
  if (!exists(paths.lxfmlPath)) {
    return {
      status: "absent",
      reason: `input absent: no official LXFML at ${paths.lxfmlPath ?? "(no path)"}; set BOOKLET_LXFML to its path`,
    };
  }
  const lxfml = readBounded(paths.lxfmlPath, LXFML_LIMITS.maxBytes, "LXFML answer key");
  const model = parseLxfml(lxfml.text, `LXFML ${paths.lxfmlPath}`);
  const sequence = flattenBuildSequence(model);
  let ldraw: LdrawState;
  if (!exists(paths.ldrawPath)) {
    ldraw = {
      status: "absent",
      reason: `input absent: no official LDraw export at ${paths.ldrawPath ?? "(no path)"}; set BOOKLET_OFFICIAL_LDRAW to its path`,
    };
  } else {
    const file = readBounded(
      paths.ldrawPath,
      OFFICIAL_LDRAW_LIMITS.maxBytes,
      "Official LDraw export",
    );
    try {
      const pairing = pairOfficialLdraw(
        model.bricks,
        parseOfficialLdraw(file.text, `LDraw ${paths.ldrawPath}`),
        `LDraw ${paths.ldrawPath}`,
      );
      ldraw = { status: "paired", source: file.source, pairing };
    } catch (error) {
      if (!(error instanceof AnswerKeyFormatError)) throw error;
      ldraw = { status: "unpaired", reason: error.message };
    }
  }
  return {
    status: "loaded",
    key: Object.freeze({
      source: lxfml.source,
      model,
      sequence,
      ldraw,
      brickByUuid: new Map(model.bricks.map((brick) => [brick.uuid, brick] as const)),
    }),
  };
}
