import { Buffer } from "node:buffer";

import {
  normalizeRealBuildRelativePath,
  type RealBuildSourceSnapshot,
} from "./real-build-replay-files";
import {
  assertNoSensitiveServedRequestHeaders,
  assertNoSensitiveServedResponseHeaders,
  MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES,
  MAXIMUM_SERVED_RESPONSE_BODY_AGGREGATE_BYTES,
  MAXIMUM_SERVED_RESPONSE_BODY_BYTES,
  MAXIMUM_SERVED_RESPONSE_HEADER_AGGREGATE_CHARACTERS,
  MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_CHARACTERS,
  MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_LENGTH,
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS,
  SHA256_DIGEST_PATTERN,
  servedResponseDigest,
  servedResponseRequestKey,
  strictServedResponseHeaders,
  type ServedResponseHeader,
} from "./real-build-served-response-policy";
import { snapshotServedResponseVerificationInput } from "./real-build-served-response-input-snapshot";
import {
  validateServedChunk,
  validateServedManifestEnvelope,
  validateServedResponseEnvelope,
} from "./real-build-served-response-record-validation";
import {
  exactServedRequestUrl,
  sourcePathFromServedRequestUrl,
} from "./real-build-served-response-source-url";
import { parseFatalUtf8Json } from "./strict-json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    JSON.stringify(Object.keys(value).sort((left, right) => left.localeCompare(right))) ===
    JSON.stringify([...keys].sort((left, right) => left.localeCompare(right)))
  );
}

function headers(value: unknown, label: string): readonly ServedResponseHeader[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array of string name/value headers.`);
  }
  const declared: ServedResponseHeader[] = [];
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      !hasExactKeys(entry, ["name", "value"]) ||
      typeof entry.name !== "string" ||
      typeof entry.value !== "string"
    ) {
      throw new TypeError(`${label} must be an array of string name/value headers.`);
    }
    declared.push({ name: entry.name, value: entry.value });
  }
  const canonical = strictServedResponseHeaders(
    Object.fromEntries(declared.map(({ name, value }) => [name, value])),
  );
  if (JSON.stringify(canonical) !== JSON.stringify(declared)) {
    throw new TypeError(`${label} must be uniquely sorted, lower-case, and canonical.`);
  }
  return canonical;
}

function sourceMap(
  files: readonly RealBuildSourceSnapshot[],
): ReadonlyMap<string, RealBuildSourceSnapshot> {
  const result = new Map<string, RealBuildSourceSnapshot>();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    const path = `sourceFiles[${index}]`;
    if (typeof file.path !== "string") {
      throw new TypeError(`${path}.path was ${typeof file.path}; expected canonical string path.`);
    }
    if (
      normalizeRealBuildRelativePath(file.path, "served-response source snapshot") !== file.path
    ) {
      throw new TypeError(
        `${path}.path was ${JSON.stringify(file.path)}; expected canonical relative spelling.`,
      );
    }
    if (typeof file.digest !== "string" || !SHA256_DIGEST_PATTERN.test(file.digest)) {
      throw new TypeError(
        `${path}.digest was ${JSON.stringify(file.digest)}; expected canonical sha256 digest.`,
      );
    }
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) {
      throw new RangeError(
        `${path}.bytes was ${JSON.stringify(file.bytes)}; expected a nonnegative safe integer.`,
      );
    }
    if (result.has(file.path)) {
      throw new TypeError(
        `${path}.path duplicated ${JSON.stringify(file.path)}; expected unique source paths.`,
      );
    }
    result.set(file.path, {
      path: file.path,
      digest: file.digest,
      bytes: file.bytes,
    });
  }
  return result;
}

export interface VerifyRealBuildServedResponseEvidenceBytesInput {
  readonly manifestBytes: Uint8Array;
  readonly bodyChunkBytes: readonly Uint8Array[];
  readonly expectedManifestDigest: string;
  readonly sourceFiles: readonly RealBuildSourceSnapshot[];
  readonly requireRunner?: boolean;
  readonly expectedCheckoutRoot?: string;
  readonly frozenLegacyArtifactManifestV3RunId?: string;
}

/** Full inert verification of served bytes, request history, sources, and the synthetic runner. */
export function verifyRealBuildServedResponseEvidenceBytes(
  input: VerifyRealBuildServedResponseEvidenceBytesInput,
): readonly string[] {
  const detached = snapshotServedResponseVerificationInput(input);
  if (
    typeof detached.expectedManifestDigest !== "string" ||
    !SHA256_DIGEST_PATTERN.test(detached.expectedManifestDigest)
  ) {
    throw new TypeError("Served-response manifest binding is not one canonical sha256 digest.");
  }
  const manifestBytes = detached.manifestBytes;
  if (servedResponseDigest(manifestBytes) !== detached.expectedManifestDigest) {
    throw new TypeError("Served-response manifest differs from its execution binding.");
  }
  const manifest = validateServedManifestEnvelope(
    parseFatalUtf8Json<Record<string, unknown>>(manifestBytes, "served-response manifest"),
    detached.bodyChunkBytes.length,
  );
  const sources = sourceMap(detached.sourceFiles);
  const chunkFiles: string[] = [];
  const chunks: Buffer[] = [];
  let bundleBytes = 0;
  for (let index = 0; index < manifest.bodyChunks.length; index += 1) {
    const raw = validateServedChunk(manifest.bodyChunks[index], index);
    const file = raw.file;
    const bytes = detached.bodyChunkBytes[index]!;
    if (bytes.length !== raw.bytes) {
      throw new TypeError(
        `Served-response body chunk bodyChunkBytes[${index}] held ${bytes.length} bytes; manifest bodyChunks[${index}].bytes expected ${raw.bytes}.`,
      );
    }
    const observedChunkDigest = servedResponseDigest(bytes);
    if (observedChunkDigest !== raw.digest) {
      throw new TypeError(
        `Served-response body chunk bodyChunkBytes[${index}] digest was ${observedChunkDigest}; manifest bodyChunks[${index}].digest expected ${raw.digest}.`,
      );
    }
    bundleBytes += bytes.length;
    if (bundleBytes > MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES) {
      throw new RangeError("Served-response chunks exceed their aggregate byte bound.");
    }
    chunkFiles.push(file);
    chunks.push(bytes);
  }
  const bundle = Buffer.concat(chunks, bundleBytes);
  const responseKeys = new Map<string, number>();
  let expectedOffset = 0;
  let priorRequestKey = "";
  let headerCharacters = 0;
  let responseBodyBytes = 0;
  let runnerIndex: number | null = null;
  for (let index = 0; index < manifest.responses.length; index += 1) {
    const response = validateServedResponseEnvelope(
      manifest.responses[index],
      index,
      priorRequestKey,
    );
    exactServedRequestUrl(response.requestUrl as string);
    const requestHeaders = headers(response.requestHeaders, `Response ${index} request headers`);
    assertNoSensitiveServedRequestHeaders(requestHeaders);
    if (servedResponseRequestKey(response.requestUrl, requestHeaders) !== response.requestKey) {
      throw new TypeError(`Served-response record ${index} has a false request identity.`);
    }
    const responseHeaders = headers(response.headers, `Response ${index} response headers`);
    assertNoSensitiveServedResponseHeaders(responseHeaders);
    headerCharacters += [...requestHeaders, ...responseHeaders].reduce(
      (total, header) => total + header.name.length + header.value.length,
      0,
    );
    if (headerCharacters > MAXIMUM_SERVED_RESPONSE_HEADER_AGGREGATE_CHARACTERS) {
      throw new RangeError("Served-response headers exceed their aggregate character bound.");
    }
    if (response.requestUrl === REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH) {
      if (response.sourcePath !== null || runnerIndex !== null) {
        throw new TypeError("Served-response runner must appear once without a source claim.");
      }
      runnerIndex = index;
    } else if (typeof response.sourcePath !== "string") {
      throw new TypeError(`Served-response record ${index} is not bound to a locked source path.`);
    }
    if (response.sourcePath !== null) {
      const derived = sourcePathFromServedRequestUrl({
        requestUrl: response.requestUrl,
        sourceRoot: manifest.sourceRoot,
        sourceByPath: sources,
        ...(detached.expectedCheckoutRoot === undefined
          ? {}
          : { expectedCheckoutRoot: detached.expectedCheckoutRoot }),
        ...(detached.frozenLegacyArtifactManifestV3RunId === undefined
          ? {}
          : {
              frozenLegacyArtifactManifestV3RunId: detached.frozenLegacyArtifactManifestV3RunId,
            }),
      });
      if (derived !== response.sourcePath) {
        throw new TypeError(
          `Served-response record ${index} sourcePath does not match its authenticated request URL.`,
        );
      }
    }
    const body = response.body;
    if (
      !Number.isSafeInteger(body.bytes) ||
      (body.bytes as number) < 0 ||
      (body.bytes as number) > MAXIMUM_SERVED_RESPONSE_BODY_BYTES ||
      !SHA256_DIGEST_PATTERN.test(String(body.digest))
    ) {
      throw new TypeError(`Served-response record ${index} has an invalid body declaration.`);
    }
    responseBodyBytes += body.bytes as number;
    if (responseBodyBytes > MAXIMUM_SERVED_RESPONSE_BODY_AGGREGATE_BYTES) {
      throw new RangeError("Served-response bodies exceed their aggregate byte bound.");
    }
    let bundled: Buffer | null = null;
    if (body.kind === "source") {
      if (
        !hasExactKeys(body, ["kind", "path", "bytes", "digest"]) ||
        typeof body.path !== "string" ||
        response.sourcePath !== body.path
      ) {
        throw new TypeError(`Served-response record ${index} has an invalid source binding.`);
      }
      const source = sources.get(body.path);
      if (source === undefined || source.bytes !== body.bytes || source.digest !== body.digest) {
        throw new TypeError(`Served-response record ${index} does not bind an exact source.`);
      }
    } else if (body.kind === "bundle") {
      if (
        !hasExactKeys(body, ["kind", "offset", "bytes", "digest"]) ||
        body.offset !== expectedOffset
      ) {
        throw new TypeError(`Served-response record ${index} has a non-canonical bundle offset.`);
      }
      const end = expectedOffset + (body.bytes as number);
      bundled = bundle.subarray(expectedOffset, end);
      if (end > bundle.length || servedResponseDigest(bundled) !== body.digest) {
        throw new TypeError(`Served-response record ${index} failed its bundled-body digest.`);
      }
      expectedOffset = end;
    } else {
      throw new TypeError(`Served-response record ${index} has an unknown body storage kind.`);
    }
    if (
      response.requestUrl === REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH &&
      (response.status !== REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS ||
        JSON.stringify(responseHeaders) !==
          JSON.stringify(strictServedResponseHeaders(REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS)) ||
        bundled === null ||
        !bundled.equals(Buffer.from(REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY)))
    ) {
      throw new TypeError(
        "Served-response runner must have the exact synthetic status, headers, and body.",
      );
    }
    priorRequestKey = response.requestKey;
    responseKeys.set(response.requestKey, index);
  }
  if ((detached.requireRunner === true || manifest.responses.length > 0) && runnerIndex === null) {
    throw new TypeError("Served-response evidence has responses but no closed-route runner.");
  }
  if (expectedOffset !== bundle.length) {
    throw new TypeError("Served-response body bundle contains unreferenced trailing bytes.");
  }
  const referenced = new Set<number>();
  const firstSeen = new Set<number>();
  let requestCharacters = 0;
  for (let index = 0; index < manifest.events.length; index += 1) {
    const event = manifest.events[index];
    if (
      !isRecord(event) ||
      !hasExactKeys(
        event,
        event.outcome === "fulfilled"
          ? ["sequence", "outcome", "requestKey", "responseIndex", "cacheHit"]
          : ["sequence", "outcome", "requestKey", "reason"],
      ) ||
      event.sequence !== index ||
      typeof event.requestKey !== "string" ||
      event.requestKey.length < 1
    ) {
      throw new TypeError(`Served-response event ${index} is malformed or out of order.`);
    }
    requestCharacters += event.requestKey.length;
    if (
      event.requestKey.length > MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_LENGTH ||
      requestCharacters > MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_CHARACTERS
    ) {
      throw new RangeError("Served-response event request keys exceed their bounds.");
    }
    if (event.outcome === "fulfilled") {
      if (
        !Number.isInteger(event.responseIndex) ||
        responseKeys.get(event.requestKey) !== event.responseIndex
      ) {
        throw new TypeError(`Served-response event ${index} references the wrong response.`);
      }
      const responseIndex = event.responseIndex as number;
      if (
        index === 0 &&
        runnerIndex !== null &&
        (responseIndex !== runnerIndex || event.cacheHit !== false)
      ) {
        throw new TypeError(
          "Served-response runner must be the first fulfilled event and cannot be a cache hit.",
        );
      }
      if (event.cacheHit !== firstSeen.has(responseIndex)) {
        throw new TypeError(`Served-response event ${index} has a false cache-hit claim.`);
      }
      firstSeen.add(responseIndex);
      referenced.add(responseIndex);
    } else if (
      event.outcome !== "blocked" ||
      ![
        "invalid-url",
        "origin-before-runner",
        "cross-origin",
        "non-get",
        "outside-locked-source",
      ].includes(String(event.reason))
    ) {
      throw new TypeError(`Served-response event ${index} has an unknown outcome or reason.`);
    }
  }
  const firstEvent = manifest.events[0];
  if (
    runnerIndex !== null &&
    (!isRecord(firstEvent) ||
      firstEvent.outcome !== "fulfilled" ||
      firstEvent.responseIndex !== runnerIndex)
  ) {
    throw new TypeError("Served-response runner must be the first fulfilled event.");
  }
  if (referenced.size !== manifest.responses.length) {
    throw new TypeError("Served-response manifest contains an unreferenced response record.");
  }
  return [...chunkFiles, REAL_BUILD_SERVED_RESPONSE_MANIFEST];
}
