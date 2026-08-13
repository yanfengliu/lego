import { Buffer } from "node:buffer";

import { sha256Digest } from "./real-build-artifacts";
import {
  boundedDenseSourceParityArray,
  exactSourceParityKeys,
  sourceParityDigest,
  sourceParityInteger,
} from "./real-build-observation-source-parity-output-primitives";
import {
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_BYTES,
  REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_MANIFEST_ROLE,
  REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_ROLE,
  REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_SCHEMA,
} from "./real-build-observation-source-parity-source-bundle";
import type { RealBuildSourceParitySourceSnapshot } from "./real-build-observation-source-parity-types";
import { parseFatalUtf8Json } from "./strict-json";

interface PreparedRole {
  readonly role: string;
  readonly digest: string;
  readonly bytes: Buffer;
}

interface MirrorFile {
  readonly path: string;
  readonly digest: string;
  readonly bytes: number;
}

function role(
  roles: ReadonlyMap<string, PreparedRole>,
  name: string,
  digest: string,
): PreparedRole {
  const found = roles.get(name);
  if (found === undefined || found.digest !== digest) {
    throw new TypeError(`Source-parity provenance role ${name} does not match ${digest}.`);
  }
  return found;
}

function exactServedSourcePaths(manifestBytes: Buffer): readonly string[] {
  const manifest = parseFatalUtf8Json<Record<string, unknown>>(
    manifestBytes,
    "served-response manifest source bindings",
  );
  boundedDenseSourceParityArray(manifest.responses, 1, 10_000, "Served responses");
  const paths: string[] = [];
  for (const rawResponse of manifest.responses) {
    exactSourceParityKeys(
      rawResponse,
      [
        "index",
        "requestKey",
        "requestUrl",
        "requestHeaders",
        "sourcePath",
        "status",
        "headers",
        "body",
      ],
      "Served response",
    );
    const sourcePath = (rawResponse as Record<string, unknown>).sourcePath;
    if (sourcePath === null) continue;
    if (typeof sourcePath !== "string" || sourcePath.length === 0) {
      throw new TypeError("Served response sourcePath must be a string or null.");
    }
    paths.push(sourcePath);
  }
  paths.sort((left, right) => left.localeCompare(right));
  return paths.filter((path, index) => paths[index - 1] !== path);
}

export function validateRealBuildSourceParitySourceBundle(input: {
  readonly roles: ReadonlyMap<string, PreparedRole>;
  readonly snapshot: RealBuildSourceParitySourceSnapshot;
  readonly pdfDigest: string;
  readonly pdfBytes: number;
  readonly mirrorFiles: ReadonlyMap<string, MirrorFile>;
  readonly servedManifestBytes: Buffer;
}): void {
  const manifestRole = role(
    input.roles,
    REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_MANIFEST_ROLE,
    input.snapshot.servedSourceBundleManifestDigest,
  );
  const bundleRole = role(
    input.roles,
    REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_ROLE,
    input.snapshot.servedSourceBundleDigest,
  );
  const manifest = parseFatalUtf8Json<Record<string, unknown>>(
    manifestRole.bytes,
    "served source-bundle manifest",
  );
  exactSourceParityKeys(
    manifest,
    ["schemaVersion", "bundleDigest", "sources", "contents"],
    "Served source-bundle manifest",
  );
  if (
    manifest.schemaVersion !== REAL_BUILD_SOURCE_PARITY_SOURCE_BUNDLE_SCHEMA ||
    manifest.bundleDigest !== bundleRole.digest
  ) {
    throw new TypeError("Served source-bundle manifest has an invalid schema or bundle binding.");
  }
  boundedDenseSourceParityArray(manifest.contents, 1, 10_000, "Served source contents");
  boundedDenseSourceParityArray(manifest.sources, 1, 10_000, "Served source paths");
  let offset = 0;
  let previousDigest = "";
  const contents = manifest.contents.map((rawContent, index) => {
    exactSourceParityKeys(rawContent, ["index", "digest", "bytes", "offset"], "Source content");
    const content = rawContent as Record<string, unknown>;
    const digest = sourceParityDigest(content.digest, `Source content ${index} digest`);
    const bytes = sourceParityInteger(
      content.bytes,
      0,
      REAL_BUILD_SOURCE_PARITY_MAXIMUM_SOURCE_BUNDLE_BYTES,
      `Source content ${index} bytes`,
    );
    if (
      content.index !== index ||
      content.offset !== offset ||
      digest.localeCompare(previousDigest) <= 0
    ) {
      throw new TypeError(
        `Served source content ${index} has a non-canonical index, offset, or digest order.`,
      );
    }
    const slice = bundleRole.bytes.subarray(offset, offset + bytes);
    if (slice.length !== bytes || sha256Digest(slice) !== digest) {
      throw new TypeError(`Served source content ${index} does not reproduce its bundle bytes.`);
    }
    previousDigest = digest;
    offset += bytes;
    return { digest, bytes };
  });
  if (offset !== bundleRole.bytes.length || offset !== input.snapshot.servedSourceUniqueBytes) {
    throw new TypeError("Served source-bundle length does not reproduce its content descriptors.");
  }
  let previousPath = "";
  let pdfFound = false;
  const referencedContent = new Set<number>();
  const sources = manifest.sources.map((rawSource) => {
    exactSourceParityKeys(
      rawSource,
      ["path", "digest", "bytes", "contentIndex"],
      "Served source path",
    );
    const source = rawSource as Record<string, unknown>;
    if (
      typeof source.path !== "string" ||
      source.path.length === 0 ||
      source.path.localeCompare(previousPath) <= 0
    ) {
      throw new TypeError("Served source paths must be unique and canonical.");
    }
    previousPath = source.path;
    const contentIndex = sourceParityInteger(
      source.contentIndex,
      0,
      contents.length - 1,
      `Served source ${source.path} content index`,
    );
    referencedContent.add(contentIndex);
    const content = contents[contentIndex]!;
    if (source.digest !== content.digest || source.bytes !== content.bytes) {
      throw new TypeError(`Served source ${source.path} does not bind its content record.`);
    }
    const mirrored = input.mirrorFiles.get(source.path);
    if (mirrored?.digest !== source.digest || mirrored.bytes !== source.bytes) {
      throw new TypeError(`Served source ${source.path} does not bind an execution-mirror file.`);
    }
    if (
      source.path === "inputs/booklet.pdf" &&
      source.digest === input.pdfDigest &&
      source.bytes === input.pdfBytes
    ) {
      pdfFound = true;
    }
    return { path: source.path, digest: source.digest, bytes: source.bytes };
  });
  if (referencedContent.size !== contents.length) {
    throw new TypeError("Served source-bundle contains orphaned unique content records.");
  }
  if (!pdfFound || sources.length !== input.snapshot.servedSourceFiles) {
    throw new TypeError("Served source bundle does not reproduce its PDF and source count.");
  }
  const expectedPaths = exactServedSourcePaths(input.servedManifestBytes);
  if (JSON.stringify(expectedPaths) !== JSON.stringify(sources.map(({ path }) => path))) {
    throw new TypeError("Served source bundle paths do not match all served sourcePath claims.");
  }
}
