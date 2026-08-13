import { Buffer } from "node:buffer";

import { sha256Digest } from "./real-build-artifacts";
import type { RealBuildSourceParityProvenanceRole } from "./real-build-observation-source-parity-types";
import { readRealBuildSourceFile, type RealBuildSourceMirror } from "./real-build-replay-files";
import { parseFatalUtf8Json } from "./strict-json";

export const REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_SCHEMA =
  "lego.real-build-source-parity-served-source-bundle/1" as const;
export const REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_MANIFEST_ROLE =
  "served-source-bundle-manifest" as const;
export const REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_ROLE = "served-source-bundle" as const;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_BYTES = 192 * 1024 * 1024;
export const REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAXIMUM_SOURCE_FILES = 10_000;

interface ServedSourceReference {
  readonly path: string;
  readonly digest: string;
  readonly bytes: number;
}

interface SourceContentRecord {
  readonly index: number;
  readonly digest: string;
  readonly bytes: number;
  readonly offset: number;
}

interface SourcePathRecord extends ServedSourceReference {
  readonly contentIndex: number;
}

export interface RealBuildSourceParitySourceBundle {
  readonly roles: readonly RealBuildSourceParityProvenanceRole[];
  readonly manifestDigest: string;
  readonly bundleDigest: string;
  readonly sourceFiles: number;
  readonly uniqueBytes: number;
}

function servedSourcePaths(manifestBytes: Uint8Array): readonly string[] {
  const manifest = parseFatalUtf8Json<Record<string, unknown>>(
    manifestBytes,
    "source-parity served-response manifest",
  );
  if (!Array.isArray(manifest.responses) || manifest.responses.length > MAXIMUM_SOURCE_FILES) {
    throw new TypeError("Served-response manifest has an invalid response count.");
  }
  const paths: string[] = [];
  for (const rawResponse of manifest.responses) {
    if (rawResponse === null || typeof rawResponse !== "object" || Array.isArray(rawResponse)) {
      throw new TypeError("Served-response manifest contains a malformed response.");
    }
    const sourcePath = (rawResponse as { readonly sourcePath?: unknown }).sourcePath;
    if (sourcePath === null) continue;
    if (typeof sourcePath !== "string" || sourcePath.length === 0) {
      throw new TypeError("Served-response sourcePath must be a non-empty string or null.");
    }
    paths.push(sourcePath);
  }
  paths.sort((left, right) => left.localeCompare(right));
  const unique = paths.filter((path, index) => paths[index - 1] !== path);
  if (unique.length === 0) {
    throw new TypeError("Served-response evidence contains no retained source-backed response.");
  }
  return unique;
}

export function createRealBuildSourceParitySourceBundle(input: {
  readonly servedManifestBytes: Uint8Array;
  readonly mirror: RealBuildSourceMirror;
}): RealBuildSourceParitySourceBundle {
  const paths = servedSourcePaths(input.servedManifestBytes);
  const mirrorByPath = new Map(input.mirror.files.map((file) => [file.path, file]));
  const references: ServedSourceReference[] = [];
  let declaredBytes = 0;
  for (const path of paths) {
    const snapshot = mirrorByPath.get(path);
    if (snapshot === undefined) {
      throw new TypeError(`Served source ${path} is absent from the locked execution mirror.`);
    }
    declaredBytes += snapshot.bytes;
    if (declaredBytes > REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_BYTES) {
      throw new RangeError(
        `Served source descriptors declare ${declaredBytes} bytes; maximum is ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_BYTES}.`,
      );
    }
    references.push(snapshot);
  }
  const bytesByDigest = new Map<string, Buffer>();
  for (const reference of references) {
    const snapshot = mirrorByPath.get(reference.path);
    const bytes = readRealBuildSourceFile(
      input.mirror.root,
      reference.path,
      `source-parity served source ${reference.path}`,
    );
    if (
      snapshot?.digest !== reference.digest ||
      snapshot.bytes !== reference.bytes ||
      bytes.length !== reference.bytes ||
      sha256Digest(bytes) !== reference.digest
    ) {
      throw new Error(`Served source ${reference.path} no longer reproduces its locked bytes.`);
    }
    const prior = bytesByDigest.get(reference.digest);
    if (prior !== undefined && !prior.equals(bytes)) {
      throw new Error(`Served source digest ${reference.digest} aliases unequal bytes.`);
    }
    bytesByDigest.set(reference.digest, bytes);
  }
  const uniqueContents = [...bytesByDigest.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const contents: SourceContentRecord[] = [];
  const contentIndexByDigest = new Map<string, number>();
  let offset = 0;
  uniqueContents.forEach(([digest, bytes], index) => {
    contents.push({ index, digest, bytes: bytes.length, offset });
    contentIndexByDigest.set(digest, index);
    offset += bytes.length;
    if (offset > REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_BYTES) {
      throw new RangeError(
        `Served source bundle has ${offset} unique bytes; maximum is ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_BYTES}.`,
      );
    }
  });
  const bundleBytes = Buffer.concat(
    uniqueContents.map(([, bytes]) => bytes),
    offset,
  );
  const sources: SourcePathRecord[] = references.map((reference) => ({
    ...reference,
    contentIndex: contentIndexByDigest.get(reference.digest)!,
  }));
  const manifestBytes = Buffer.from(
    `${JSON.stringify({
      schemaVersion: REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_SCHEMA,
      bundleDigest: sha256Digest(bundleBytes),
      sources,
      contents,
    })}\n`,
  );
  if (manifestBytes.length > REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_MANIFEST_BYTES) {
    throw new RangeError("Served source-bundle manifest exceeds its bounded byte budget.");
  }
  return {
    roles: [
      {
        role: REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_MANIFEST_ROLE,
        digest: sha256Digest(manifestBytes),
        bytes: manifestBytes,
      },
      {
        role: REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_ROLE,
        digest: sha256Digest(bundleBytes),
        bytes: bundleBytes,
      },
    ],
    manifestDigest: sha256Digest(manifestBytes),
    bundleDigest: sha256Digest(bundleBytes),
    sourceFiles: sources.length,
    uniqueBytes: bundleBytes.length,
  };
}
