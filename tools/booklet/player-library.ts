import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import {
  LDRAW_FRAME_ARCHIVE_PIN,
  readPinnedArchive,
} from "../../scripts/derive-ldraw-catalog-frames.mjs";
import { openExactLdrawArchive } from "../../scripts/part-identification-prefix50-ldraw-catalog-frames-archive.mjs";
import type { LibraryReader } from "./player-model.ts";

/**
 * Where the build player's geometry comes from, in order:
 *
 * 1. the official LDraw.org parts library, the pinned ldraw-complete-2026-07.zip
 *    (LEGO_LDRAW_OFFICIAL_ARCHIVE), which also supplies the colours;
 * 2. the LDraw Parts Tracker's unofficial parts, the pinned
 *    ldraw-unofficial-2026-08-02.zip (LEGO_LDRAW_UNOFFICIAL_ARCHIVE), for
 *    parts not yet released (21066 needs 6801, 7236 and 7302 from it);
 * 3. a stand-in built from LEGO Builder's own mesh for a design no LDraw file
 *    exists for (21066: 7562, 8172, 89680), from the set's local Builder mesh
 *    pack (the manifest's `meshFallback`, LEGO_BUILDER_NATIVE_PACK). It is
 *    written as `builder/<design>.dat` and labelled a stand-in in its header.
 *
 * All three are read locally and never committed; the packed model is served
 * only by the local dev server.
 */
export const UNOFFICIAL_ARCHIVE_PIN = Object.freeze({
  logicalName: "ldraw-unofficial-2026-08-02.zip",
  bytes: 87_377_883,
  sha256: "sha256:09ec08007203b66e79b1f857aa4804cbee26e1337e177a7c3a87adc1268e44d4",
});
const DEFAULT_UNOFFICIAL_ARCHIVE = "C:/tmp/ldraw-unofficial-2026-08-02.zip";

export function unofficialArchivePath(env: Readonly<Record<string, string | undefined>>): string {
  return env.LEGO_LDRAW_UNOFFICIAL_ARCHIVE ?? DEFAULT_UNOFFICIAL_ARCHIVE;
}

export class PlayerLibraryError extends Error {
  override readonly name = "PlayerLibraryError";
}

const sha256 = (bytes: Uint8Array) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function archiveReader(bytes: Uint8Array, prefix: string): LibraryReader {
  const archive = openExactLdrawArchive(bytes);
  return {
    read(member) {
      try {
        return archive.read(`${prefix}${member}`).toString("utf8");
      } catch (error) {
        if (error instanceof TypeError && error.message.includes("lacks exact member")) return null;
        throw error;
      }
    },
  };
}

export interface PlayerLibrary {
  readonly library: LibraryReader;
  readonly colours: string;
  /** Library paths the unofficial archive answered. */
  readonly unofficialFiles: ReadonlySet<string>;
}

/** The official archive, then the unofficial one when present, as one reader. */
export function openPlayerLibrary(paths: {
  readonly official: string;
  readonly unofficial: string;
}): PlayerLibrary {
  if (!existsSync(paths.official)) {
    throw new PlayerLibraryError(
      `no LDraw library archive at ${paths.official}; set LEGO_LDRAW_OFFICIAL_ARCHIVE to the pinned ${LDRAW_FRAME_ARCHIVE_PIN.logicalName} (${LDRAW_FRAME_ARCHIVE_PIN.bytes} bytes).`,
    );
  }
  let official: LibraryReader;
  try {
    official = archiveReader(readPinnedArchive(paths.official), "ldraw/");
  } catch (error) {
    throw new PlayerLibraryError(error instanceof Error ? error.message : String(error));
  }
  let unofficial: LibraryReader | null = null;
  if (existsSync(paths.unofficial)) {
    const bytes = readFileSync(paths.unofficial);
    const digest = sha256(bytes);
    if (bytes.length !== UNOFFICIAL_ARCHIVE_PIN.bytes || digest !== UNOFFICIAL_ARCHIVE_PIN.sha256) {
      throw new PlayerLibraryError(
        `${paths.unofficial} is ${bytes.length} bytes at ${digest}, not the pinned ${UNOFFICIAL_ARCHIVE_PIN.logicalName} (${UNOFFICIAL_ARCHIVE_PIN.bytes} bytes at ${UNOFFICIAL_ARCHIVE_PIN.sha256}).`,
      );
    }
    unofficial = archiveReader(bytes, "");
  }
  const unofficialFiles = new Set<string>();
  const colours = official.read("LDConfig.ldr");
  if (colours === null) {
    throw new PlayerLibraryError(
      `the LDraw library archive at ${paths.official} holds no ldraw/LDConfig.ldr.`,
    );
  }
  return {
    colours,
    unofficialFiles,
    library: {
      read(member) {
        const found = official.read(member);
        if (found !== null || unofficial === null) return found;
        const fallback = unofficial.read(member);
        if (fallback !== null) unofficialFiles.add(member);
        return fallback;
      },
    },
  };
}

interface MeshPackPart {
  readonly id: string;
  readonly name: string;
  readonly positionByteOffset: number;
  readonly positionCount: number;
  readonly indexByteOffset: number;
  readonly indexCount: number;
}

/**
 * A LEGO Builder mesh as an LDraw part: its triangles in the LXFML part frame
 * in LDU and LDraw axes (the pack's lego-builder-native-to-catalog-ldu/1
 * frame), plus an edge line wherever two triangles meet at more than
 * `EDGE_DEGREES` or a triangle has no neighbour, since three.js smooths every
 * face that no edge line separates.
 */
export const EDGE_DEGREES = 25;

export function builderMeshPart(part: MeshPackPart, binary: Buffer): string {
  const end = part.positionByteOffset + part.positionCount * 12;
  const indexEnd = part.indexByteOffset + part.indexCount * 4;
  if (part.indexCount % 3 !== 0 || end > binary.length || indexEnd > binary.length) {
    throw new PlayerLibraryError(`Builder mesh ${part.id} does not fit its pack's binary payload.`);
  }
  const point = (index: number) => {
    if (index >= part.positionCount)
      throw new PlayerLibraryError(`Builder mesh ${part.id} indexes past its vertices.`);
    const at = part.positionByteOffset + index * 12;
    return [
      binary.readFloatLE(at),
      binary.readFloatLE(at + 4),
      binary.readFloatLE(at + 8),
    ] as const;
  };
  const round = (value: number) => String(Math.round(value * 1000) / 1000 + 0);
  const key = (p: readonly number[]) => p.map(round).join(" ");
  const triangles: (readonly (readonly number[])[])[] = [];
  for (let at = part.indexByteOffset; at < indexEnd; at += 12) {
    triangles.push([
      point(binary.readUInt32LE(at)),
      point(binary.readUInt32LE(at + 4)),
      point(binary.readUInt32LE(at + 8)),
    ]);
  }
  const normal = (t: readonly (readonly number[])[]) => {
    const [a, b, c] = t as [readonly number[], readonly number[], readonly number[]];
    const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    const n = [
      u[1]! * v[2]! - u[2]! * v[1]!,
      u[2]! * v[0]! - u[0]! * v[2]!,
      u[0]! * v[1]! - u[1]! * v[0]!,
    ];
    const length = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
    return n.map((value) => value / length);
  };
  const edges = new Map<string, { ends: readonly (readonly number[])[]; normals: number[][] }>();
  for (const triangle of triangles) {
    const n = normal(triangle);
    for (let side = 0; side < 3; side += 1) {
      const ends = [triangle[side]!, triangle[(side + 1) % 3]!];
      const id = ends.map(key).sort().join("|");
      const edge = edges.get(id) ?? { ends, normals: [] };
      edge.normals.push(n);
      edges.set(id, edge);
    }
  }
  const sharp = Math.cos((EDGE_DEGREES * Math.PI) / 180);
  const lines = [...edges.values()].filter(
    ({ normals }) =>
      normals.length !== 2 ||
      normals[0]!.reduce((dot, value, axis) => dot + value * normals[1]![axis]!, 0) < sharp,
  );
  return [
    `0 ${part.name} (stand-in: LEGO Builder mesh, no LDraw file exists)`,
    `0 Name: builder/${part.id}.dat`,
    "0 Author: LEGO Builder native mesh, converted by tools/booklet/player-library.ts",
    "0 !LDRAW_ORG Unofficial_Part",
    "0 BFC NOCERTIFY",
    ...triangles.map((t) => `3 16 ${t.map(key).join(" ")}`),
    ...lines.map(({ ends }) => `2 24 ${ends.map(key).join(" ")}`),
  ].join("\n");
}

/** Stand-in parts from a set's Builder mesh pack, opened on first use; null when the pack lacks the design. */
export function builderStandIns(path: string): (design: string) => string | null {
  let parts: ReadonlyMap<string, MeshPackPart> | null = null;
  let binary: Buffer | null = null;
  return (design) => {
    if (parts === null) {
      if (!existsSync(path)) {
        throw new PlayerLibraryError(
          `design ${design} has no LDraw file, and its stand-in comes from the set's LEGO Builder mesh pack, which is not at ${path}; set LEGO_BUILDER_NATIVE_PACK or the manifest's meshFallback.`,
        );
      }
      const pack = JSON.parse(readFileSync(path, "utf8")) as {
        binaryBase64: string;
        binarySha256: string;
        parts: MeshPackPart[];
      };
      binary = Buffer.from(pack.binaryBase64, "base64");
      if (sha256(binary) !== `sha256:${pack.binarySha256}`) {
        throw new PlayerLibraryError(
          `the Builder mesh pack at ${path} does not match its own binarySha256.`,
        );
      }
      parts = new Map(pack.parts.map((part) => [part.id, part] as const));
    }
    const part = parts.get(design);
    return part ? builderMeshPart(part, binary!) : null;
  };
}
