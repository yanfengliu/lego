import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_SIGNATURE = 0x06054b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_ARCHIVE_ENTRIES = 50_000;
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_CLOSURE_FILES = 256;
const MAX_TRIANGLES = 100_000;

const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const normalizedPath = (value) => value.replaceAll("\\", "/").toLowerCase();

function findEocd(bytes) {
  const first = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= first; offset -= 1) {
    if (bytes.readUInt32LE(offset) === EOCD_SIGNATURE) return offset;
  }
  throw new TypeError("Pinned LDraw archive has no bounded ZIP end-of-central-directory record.");
}

export function openExactLdrawArchive(bytes) {
  const held = Buffer.from(bytes);
  const eocd = findEocd(held);
  const disk = held.readUInt16LE(eocd + 4);
  const centralDisk = held.readUInt16LE(eocd + 6);
  const diskEntries = held.readUInt16LE(eocd + 8);
  const entryCount = held.readUInt16LE(eocd + 10);
  const centralBytes = held.readUInt32LE(eocd + 12);
  const centralOffset = held.readUInt32LE(eocd + 16);
  const commentBytes = held.readUInt16LE(eocd + 20);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    diskEntries !== entryCount ||
    entryCount < 1 ||
    entryCount > MAX_ARCHIVE_ENTRIES ||
    eocd + 22 + commentBytes !== held.length ||
    centralOffset + centralBytes !== eocd
  ) {
    throw new TypeError(
      "Pinned LDraw archive must be one bounded, non-spanned, non-ZIP64 archive with an exact central directory.",
    );
  }
  const entries = new Map();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > eocd || held.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new TypeError(`Pinned LDraw archive central entry ${index} is truncated or malformed.`);
    }
    const flags = held.readUInt16LE(cursor + 8);
    const method = held.readUInt16LE(cursor + 10);
    const compressedBytes = held.readUInt32LE(cursor + 20);
    const uncompressedBytes = held.readUInt32LE(cursor + 24);
    const filenameBytes = held.readUInt16LE(cursor + 28);
    const extraBytes = held.readUInt16LE(cursor + 30);
    const entryCommentBytes = held.readUInt16LE(cursor + 32);
    const localOffset = held.readUInt32LE(cursor + 42);
    const end = cursor + 46 + filenameBytes + extraBytes + entryCommentBytes;
    if (
      end > eocd ||
      filenameBytes < 1 ||
      (flags & 1) !== 0 ||
      ![0, 8].includes(method) ||
      uncompressedBytes > MAX_FILE_BYTES
    ) {
      throw new TypeError(
        `Pinned LDraw archive central entry ${index} violates bounded ZIP policy.`,
      );
    }
    const filename = normalizedPath(
      held.subarray(cursor + 46, cursor + 46 + filenameBytes).toString("utf8"),
    );
    if (entries.has(filename)) {
      throw new TypeError(`Pinned LDraw archive repeats case-insensitive member ${filename}.`);
    }
    entries.set(filename, {
      compressedBytes,
      filename,
      flags,
      localOffset,
      method,
      uncompressedBytes,
    });
    cursor = end;
  }
  if (cursor !== eocd) {
    throw new TypeError("Pinned LDraw archive central directory has unparsed trailing bytes.");
  }
  const extracted = new Map();
  const read = (filename) => {
    const clean = normalizedPath(filename);
    if (extracted.has(clean)) return extracted.get(clean);
    const entry = entries.get(clean);
    if (entry === undefined)
      throw new TypeError(`Pinned LDraw archive lacks exact member ${clean}.`);
    const { localOffset } = entry;
    if (localOffset + 30 > centralOffset || held.readUInt32LE(localOffset) !== LOCAL_SIGNATURE) {
      throw new TypeError(`Pinned LDraw archive member ${clean} has a malformed local header.`);
    }
    const localFlags = held.readUInt16LE(localOffset + 6);
    const localMethod = held.readUInt16LE(localOffset + 8);
    const localNameBytes = held.readUInt16LE(localOffset + 26);
    const localExtraBytes = held.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameBytes + localExtraBytes;
    const dataEnd = dataOffset + entry.compressedBytes;
    if (localFlags !== entry.flags || localMethod !== entry.method || dataEnd > centralOffset) {
      throw new TypeError(`Pinned LDraw archive member ${clean} has inconsistent local metadata.`);
    }
    const localName = normalizedPath(
      held.subarray(localOffset + 30, localOffset + 30 + localNameBytes).toString("utf8"),
    );
    if (localName !== clean) {
      throw new TypeError(
        `Pinned LDraw archive member ${clean} disagrees with local name ${localName}.`,
      );
    }
    const compressed = held.subarray(dataOffset, dataEnd);
    const value = entry.method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed);
    if (value.length !== entry.uncompressedBytes) {
      throw new TypeError(
        `Pinned LDraw archive member ${clean} expands to ${value.length}, not ${entry.uncompressedBytes} bytes.`,
      );
    }
    extracted.set(clean, value);
    return value;
  };
  return Object.freeze({ entryCount, read });
}

function referencedCandidates(name) {
  const clean = normalizedPath(name);
  if (clean.startsWith("s/")) return [`ldraw/parts/${clean}`];
  if (clean.startsWith("48/")) return [`ldraw/p/${clean}`];
  return [`ldraw/p/${clean}`, `ldraw/parts/${clean}`, `ldraw/p/48/${clean}`];
}

const IDENTITY = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);

function compose(parent, child) {
  const [a, b, c, d, e, f, g, h, i, x, y, z] = parent;
  const [A, B, C, D, E, F, G, H, I, X, Y, Z] = child;
  return [
    a * A + b * D + c * G,
    a * B + b * E + c * H,
    a * C + b * F + c * I,
    d * A + e * D + f * G,
    d * B + e * E + f * H,
    d * C + e * F + f * I,
    g * A + h * D + i * G,
    g * B + h * E + i * H,
    g * C + h * F + i * I,
    a * X + b * Y + c * Z + x,
    d * X + e * Y + f * Z + y,
    g * X + h * Y + i * Z + z,
  ];
}

const apply = (matrix, point) => [
  matrix[0] * point[0] + matrix[1] * point[1] + matrix[2] * point[2] + matrix[9],
  matrix[3] * point[0] + matrix[4] * point[1] + matrix[5] * point[2] + matrix[10],
  matrix[6] * point[0] + matrix[7] * point[1] + matrix[8] * point[2] + matrix[11],
];

const finiteNumbers = (tokens, label) => {
  const values = tokens.map(Number);
  if (values.some((value) => !Number.isFinite(value) || Math.abs(value) > 1_000_000)) {
    throw new TypeError(`${label} contains non-finite or unbounded numeric geometry.`);
  }
  return values;
};

export function expandExactLdrawPart(archive, filename) {
  const rootPath = `ldraw/parts/${normalizedPath(filename)}`;
  const closure = new Map();
  const triangles = [];
  const resolve = (name) => {
    const candidates = referencedCandidates(name);
    for (const candidate of candidates) {
      try {
        return { bytes: archive.read(candidate), path: candidate };
      } catch (error) {
        if (!(error instanceof TypeError) || !error.message.includes("lacks exact member"))
          throw error;
      }
    }
    throw new TypeError(`Pinned LDraw archive cannot resolve ${name} in ${candidates.join(", ")}.`);
  };
  const walk = (path, bytes, matrix, depth) => {
    if (depth > 32) throw new TypeError(`LDraw closure exceeds depth 32 at ${path}.`);
    closure.set(path, bytes);
    if (closure.size > MAX_CLOSURE_FILES) throw new TypeError("LDraw closure exceeds 256 files.");
    for (const [lineNumber, raw] of bytes.toString("utf8").split(/\r?\n/u).entries()) {
      const tokens = raw.trim().split(/\s+/u);
      if (tokens[0] === "" || tokens[0] === "0" || tokens[0] === "2" || tokens[0] === "5") continue;
      if (tokens[0] === "1") {
        if (tokens.length < 15)
          throw new TypeError(`${path}:${lineNumber + 1} has a short type-1 row.`);
        const values = finiteNumbers(tokens.slice(2, 14), `${path}:${lineNumber + 1}`);
        const child = [
          values[3],
          values[4],
          values[5],
          values[6],
          values[7],
          values[8],
          values[9],
          values[10],
          values[11],
          values[0],
          values[1],
          values[2],
        ];
        const reference = tokens.slice(14).join(" ");
        const resolved = resolve(reference);
        walk(resolved.path, resolved.bytes, compose(matrix, child), depth + 1);
        continue;
      }
      if (tokens[0] !== "3" && tokens[0] !== "4") continue;
      const corners = tokens[0] === "3" ? 3 : 4;
      if (tokens.length < 2 + corners * 3) {
        throw new TypeError(`${path}:${lineNumber + 1} has a short type-${tokens[0]} row.`);
      }
      const values = finiteNumbers(tokens.slice(2, 2 + corners * 3), `${path}:${lineNumber + 1}`);
      const points = Array.from({ length: corners }, (_, corner) =>
        apply(matrix, values.slice(corner * 3, corner * 3 + 3)),
      );
      triangles.push([points[0], points[1], points[2]]);
      if (corners === 4) triangles.push([points[0], points[2], points[3]]);
      if (triangles.length > MAX_TRIANGLES)
        throw new TypeError("LDraw part exceeds 100,000 triangles.");
    }
  };
  const rootBytes = archive.read(rootPath);
  walk(rootPath, rootBytes, IDENTITY, 0);
  if (triangles.length === 0) throw new TypeError(`${rootPath} expands to no triangles.`);
  const points = triangles.flat();
  const bounds = {
    min: [0, 1, 2].map((axis) => Math.min(...points.map((point) => point[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...points.map((point) => point[axis]))),
  };
  const closureRows = [...closure]
    .map(([path, value]) => ({ path, bytes: value.length, digest: sha256(value) }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return Object.freeze({
    bounds: Object.freeze({ min: Object.freeze(bounds.min), max: Object.freeze(bounds.max) }),
    closureDigest: sha256(Buffer.from(JSON.stringify(closureRows))),
    closureFileCount: closureRows.length,
    expandedTriangleCount: triangles.length,
    root: Object.freeze({ path: rootPath, bytes: rootBytes.length, digest: sha256(rootBytes) }),
    triangles,
  });
}
