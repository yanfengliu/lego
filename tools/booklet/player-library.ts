import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

import {
  LDRAW_FRAME_ARCHIVE_PIN,
  readPinnedArchive,
} from "../../scripts/derive-ldraw-catalog-frames.mjs";
import { openExactLdrawArchive } from "../../scripts/part-identification-prefix50-ldraw-catalog-frames-archive.mjs";
import type { LibraryReader } from "./player-model.ts";

/**
 * Where the build player's geometry comes from:
 *
 * 1. the official LDraw.org parts library, the pinned ldraw-complete-2026-07.zip
 *    (LEGO_LDRAW_OFFICIAL_ARCHIVE), which also supplies the colours;
 * 2. for a design that library lacks, a stand-in built from LEGO Builder's own
 *    mesh, from the set's local Builder mesh pack (the manifest's
 *    `meshFallback`, LEGO_BUILDER_NATIVE_PACK), written as
 *    `parts/builder/<design>.dat` and labelled a stand-in in its header. For
 *    21066 that is 6801, 7236, 7302, 7562, 8172 and 89680.
 *
 * The LDraw Parts Tracker's unofficial files for 6801, 7236 and 7302 are not
 * used: they are drawn in another frame than the one the official export
 * posed those designs in, and 7236 stood 240 LDU out of the back of the model.
 * A Builder mesh is in the LXFML part frame, so the LXFML pose places it.
 *
 * Both sources are read locally and never committed; the packed model is
 * served only by the local dev server.
 *
 * A source that is not there throws a PlayerLibraryError marked `absent`, which
 * `npm run booklet` reports as a skipped stage; one that is there but unusable
 * (not the pinned archive, a pack that is not JSON or does not match its own
 * digest) throws an unmarked one, which fails the stage and the run.
 */

export class PlayerLibraryError extends Error {
  override readonly name = "PlayerLibraryError";
  /** True when the input is missing, not bad: the stage is skipped rather than failed. */
  readonly absent: boolean;
  constructor(message: string, options: { readonly absent?: boolean } = {}) {
    super(message);
    this.absent = options.absent ?? false;
  }
}

const sha256 = (bytes: Uint8Array) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

/** Whether nothing is at `path`; a path that is there but unreadable is not missing. */
function missing(path: string): boolean {
  try {
    statSync(path);
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR";
  }
}

export interface PlayerLibrary {
  readonly library: LibraryReader;
  readonly colours: string;
}

/** The pinned official archive as a reader, and its colour table. */
export function openPlayerLibrary(path: string): PlayerLibrary {
  if (missing(path)) {
    throw new PlayerLibraryError(
      `no LDraw library archive at ${path}; set LEGO_LDRAW_OFFICIAL_ARCHIVE to the pinned ${LDRAW_FRAME_ARCHIVE_PIN.logicalName} (${LDRAW_FRAME_ARCHIVE_PIN.bytes} bytes).`,
      { absent: true },
    );
  }
  let archive: ReturnType<typeof openExactLdrawArchive>;
  try {
    archive = openExactLdrawArchive(readPinnedArchive(path));
  } catch (error) {
    throw new PlayerLibraryError(error instanceof Error ? error.message : String(error));
  }
  const library: LibraryReader = {
    read(member) {
      try {
        return archive.read(`ldraw/${member}`).toString("utf8");
      } catch (error) {
        if (error instanceof TypeError && error.message.includes("lacks exact member")) return null;
        throw error;
      }
    },
  };
  const colours = library.read("LDConfig.ldr");
  if (colours === null) {
    throw new PlayerLibraryError(
      `the LDraw library archive at ${path} holds no ldraw/LDConfig.ldr.`,
    );
  }
  return { library, colours };
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
  const counts = [
    part.positionByteOffset,
    part.positionCount,
    part.indexByteOffset,
    part.indexCount,
  ];
  if (
    !counts.every((value) => Number.isSafeInteger(value) && value >= 0) ||
    part.indexCount % 3 !== 0 ||
    end > binary.length ||
    indexEnd > binary.length
  ) {
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
    `0 ${part.name} (stand-in: LEGO Builder mesh; the official LDraw library has no file for it)`,
    `0 Name: builder/${part.id}.dat`,
    "0 Author: LEGO Builder native mesh, converted by tools/booklet/player-library.ts",
    "0 !LDRAW_ORG Unofficial_Part",
    "0 BFC NOCERTIFY",
    ...triangles.map((t) => `3 16 ${t.map(key).join(" ")}`),
    ...lines.map(({ ends }) => `2 24 ${ends.map(key).join(" ")}`),
  ].join("\n");
}

/** A Builder mesh pack is read whole; 21066's is about 2 MB. */
export const MESH_PACK_MAX_BYTES = 64 * 1024 * 1024;

interface MeshPack {
  readonly parts: ReadonlyMap<string, MeshPackPart>;
  readonly binary: Buffer;
}

function readMeshPack(path: string, design: string): MeshPack {
  if (missing(path)) {
    throw new PlayerLibraryError(
      `no LEGO Builder mesh pack at ${path}; design ${design} has no LDraw file, so its stand-in comes from the set's pack. Set LEGO_BUILDER_NATIVE_PACK to the pack, or fix the manifest's meshFallback.`,
      { absent: true },
    );
  }
  const unusable = (why: string) =>
    new PlayerLibraryError(
      `the Builder mesh pack at ${path} ${why}; point LEGO_BUILDER_NATIVE_PACK at the set's pack.`,
    );
  let pack: unknown;
  try {
    const stat = statSync(path);
    if (!stat.isFile()) throw unusable("is not a file");
    if (stat.size > MESH_PACK_MAX_BYTES) {
      throw unusable(`is ${stat.size} bytes, over the ${MESH_PACK_MAX_BYTES}-byte limit`);
    }
    pack = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof PlayerLibraryError) throw error;
    throw unusable(
      `cannot be read as JSON (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  const { binaryBase64, binarySha256, parts } = (pack ?? {}) as Record<string, unknown>;
  const isPart = (part: unknown): part is MeshPackPart =>
    typeof part === "object" &&
    part !== null &&
    typeof (part as MeshPackPart).id === "string" &&
    typeof (part as MeshPackPart).name === "string";
  if (
    typeof binaryBase64 !== "string" ||
    typeof binarySha256 !== "string" ||
    !Array.isArray(parts) ||
    !parts.every(isPart)
  ) {
    throw unusable(
      "is not a mesh pack: it needs binaryBase64, binarySha256, and parts each with an id and a name",
    );
  }
  const binary = Buffer.from(binaryBase64, "base64");
  if (sha256(binary) !== `sha256:${binarySha256}`) {
    throw unusable("does not match its own binarySha256");
  }
  return { parts: new Map(parts.map((part) => [part.id, part] as const)), binary };
}

/** Stand-in parts from a set's Builder mesh pack, opened on first use; null when the pack lacks the design. */
export function builderStandIns(path: string): (design: string) => string | null {
  let pack: MeshPack | null = null;
  return (design) => {
    pack ??= readMeshPack(path, design);
    const part = pack.parts.get(design);
    return part ? builderMeshPart(part, pack.binary) : null;
  };
}
