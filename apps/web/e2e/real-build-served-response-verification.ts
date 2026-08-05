import { readContainedBoundedRegularFile } from "./bounded-file-read";
import {
  normalizeRealBuildRelativePath,
  type RealBuildSourceSnapshot,
} from "./real-build-replay-files";
import {
  assertNoSensitiveServedRequestHeaders,
  assertNoSensitiveServedResponseHeaders,
  MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES as MAXIMUM_BUNDLED_RESPONSE_BYTES,
  MAXIMUM_SERVED_RESPONSE_BODY_AGGREGATE_BYTES as MAXIMUM_RESPONSE_BODY_AGGREGATE_BYTES,
  MAXIMUM_SERVED_RESPONSE_BODY_BYTES as MAXIMUM_RESPONSE_BODY_BYTES,
  MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES as MAXIMUM_BODY_CHUNK_BYTES,
  MAXIMUM_SERVED_RESPONSE_HEADER_AGGREGATE_CHARACTERS as MAXIMUM_HEADER_AGGREGATE_CHARACTERS,
  MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES as MAXIMUM_MANIFEST_BYTES,
  MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_CHARACTERS as MAXIMUM_REQUEST_KEY_CHARACTERS,
  MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_LENGTH as MAXIMUM_REQUEST_KEY_LENGTH,
  MAXIMUM_SERVED_RESPONSE_REQUEST_URL_LENGTH as MAXIMUM_REQUEST_URL_LENGTH,
  MAXIMUM_SERVED_RESPONSE_REQUESTS as MAXIMUM_REQUESTS,
  MAXIMUM_SERVED_RESPONSES as MAXIMUM_RESPONSES,
  REAL_BUILD_SERVED_RESPONSE_MANIFEST,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS,
  REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS,
  REAL_BUILD_SERVED_RESPONSE_SCHEMA,
  SHA256_DIGEST_PATTERN as DIGEST_PATTERN,
  servedResponseChunkName as responseChunkName,
  servedResponseDigest as digest,
  servedResponseRequestKey,
  normalizedServedResponseSourceRoot,
  strictServedResponseHeaders as strictHeaders,
  type ServedResponseHeader as HeaderEntry,
} from "./real-build-served-response-policy";
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

function verifiedHeaderList(value: unknown, label: string): readonly HeaderEntry[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (entry) =>
        !isRecord(entry) ||
        !hasExactKeys(entry, ["name", "value"]) ||
        typeof entry.name !== "string" ||
        typeof entry.value !== "string",
    )
  ) {
    throw new TypeError(`${label} must be an array of string name/value headers.`);
  }
  const declared = value.map((entry) => ({
    name: (entry as Record<string, unknown>).name as string,
    value: (entry as Record<string, unknown>).value as string,
  }));
  const canonical = strictHeaders(
    Object.fromEntries(declared.map(({ name, value }) => [name, value])),
  );
  if (JSON.stringify(canonical) !== JSON.stringify(declared)) {
    throw new TypeError(`${label} must be uniquely sorted, lower-case, and canonical.`);
  }
  return canonical;
}

function sourcePathFromRequestUrl(
  requestUrl: string,
  sourceRoot: string,
  sourceByPath: ReadonlyMap<string, RealBuildSourceSnapshot>,
): string {
  let url: URL;
  try {
    url = new URL(requestUrl, "http://real-build.invalid");
  } catch (error) {
    throw new TypeError(`Served-response source URL is invalid: ${requestUrl}.`, { cause: error });
  }
  if (!url.pathname.startsWith("/@fs/") || url.hash !== "") {
    throw new TypeError(
      `Served-response source URL must use the exact Vite /@fs/ route: ${requestUrl}.`,
    );
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(url.pathname.slice("/@fs/".length));
  } catch (error) {
    throw new TypeError(`Served-response source URL has malformed encoding: ${requestUrl}.`, {
      cause: error,
    });
  }
  if (/^\/[A-Za-z]:\//u.test(decoded)) decoded = decoded.slice(1);
  if (decoded.includes("\\") || decoded.includes("\0")) {
    throw new TypeError(`Served-response source URL has a non-canonical path: ${requestUrl}.`);
  }
  const prefix = `${sourceRoot}/`;
  if (!decoded.toLocaleLowerCase("en-US").startsWith(prefix.toLocaleLowerCase("en-US"))) {
    throw new TypeError(`Served-response source URL is outside its declared locked root.`);
  }
  const relative = decoded.slice(prefix.length);
  const normalized = normalizeRealBuildRelativePath(relative, "served-response URL source path");
  if (normalized !== relative || !sourceByPath.has(normalized)) {
    throw new TypeError(
      `Served-response source URL does not identify one exact replay source: ${requestUrl}.`,
    );
  }
  return normalized;
}

/** Verifies response evidence and its exact source/CAS-artifact bindings before publication. */
export function verifyRealBuildServedResponseEvidence(input: {
  readonly directory: string;
  readonly expectedManifestDigest: string;
  readonly sourceFiles: readonly RealBuildSourceSnapshot[];
  readonly requireRunner?: boolean;
}): readonly string[] {
  if (!DIGEST_PATTERN.test(input.expectedManifestDigest)) {
    throw new TypeError(
      `Served-response manifest binding ${JSON.stringify(input.expectedManifestDigest)} is not a canonical sha256 digest, so the replay environment does not name one exact expected manifest.`,
    );
  }
  const manifestBytes = readContainedBoundedRegularFile(
    input.directory,
    REAL_BUILD_SERVED_RESPONSE_MANIFEST,
    {
      label: "served-response manifest",
      minimumBytes: 2,
      maximumBytes: MAXIMUM_MANIFEST_BYTES,
      expectedSha256: input.expectedManifestDigest,
    },
  );
  if (digest(manifestBytes) !== input.expectedManifestDigest) {
    throw new TypeError("Served-response manifest differs from the replay environment binding.");
  }
  const manifest = parseFatalUtf8Json<Record<string, unknown>>(
    manifestBytes,
    "served-response manifest",
  );
  if (
    !hasExactKeys(manifest, ["schemaVersion", "sourceRoot", "events", "responses", "bodyChunks"]) ||
    manifest.schemaVersion !== REAL_BUILD_SERVED_RESPONSE_SCHEMA ||
    typeof manifest.sourceRoot !== "string" ||
    normalizedServedResponseSourceRoot(manifest.sourceRoot) !== manifest.sourceRoot ||
    !Array.isArray(manifest.events) ||
    !Array.isArray(manifest.responses) ||
    !Array.isArray(manifest.bodyChunks) ||
    manifest.events.length > MAXIMUM_REQUESTS ||
    manifest.responses.length > MAXIMUM_RESPONSES
  ) {
    throw new TypeError("Served-response manifest schema or declared counts are invalid.");
  }
  const sourceByPath = new Map(input.sourceFiles.map((source) => [source.path, source]));
  const sourceRoot = manifest.sourceRoot as string;
  const chunkFiles: string[] = [];
  const chunks: Buffer[] = [];
  let bundledBytes = 0;
  for (let index = 0; index < manifest.bodyChunks.length; index += 1) {
    const chunk = manifest.bodyChunks[index];
    const expectedFile = responseChunkName(index);
    if (
      !isRecord(chunk) ||
      !hasExactKeys(chunk, ["file", "bytes", "digest"]) ||
      chunk.file !== expectedFile ||
      !Number.isSafeInteger(chunk.bytes) ||
      (chunk.bytes as number) <= 0 ||
      (chunk.bytes as number) > MAXIMUM_BODY_CHUNK_BYTES ||
      !DIGEST_PATTERN.test(String(chunk.digest))
    ) {
      throw new TypeError(`Served-response body chunk ${index} is malformed or non-canonical.`);
    }
    const bytes = readContainedBoundedRegularFile(input.directory, expectedFile, {
      label: `served-response body chunk ${index}`,
      minimumBytes: 1,
      maximumBytes: MAXIMUM_BODY_CHUNK_BYTES,
      exactBytes: chunk.bytes as number,
      expectedSha256: String(chunk.digest),
    });
    if (digest(bytes) !== chunk.digest) {
      throw new TypeError(`Served-response body chunk ${index} failed its digest check.`);
    }
    bundledBytes += bytes.length;
    if (bundledBytes > MAXIMUM_BUNDLED_RESPONSE_BYTES) {
      throw new TypeError("Served-response body chunks exceed their aggregate byte bound.");
    }
    chunkFiles.push(expectedFile);
    chunks.push(bytes);
  }
  const bundle = Buffer.concat(chunks, bundledBytes);
  let expectedOffset = 0;
  let priorRequestKey = "";
  let verifiedHeaderCharacters = 0;
  let verifiedResponseBodyBytes = 0;
  let sawRunner = false;
  let runnerResponseIndex: number | null = null;
  const responseKeys = new Map<string, number>();
  for (let index = 0; index < manifest.responses.length; index += 1) {
    const response = manifest.responses[index];
    if (
      !isRecord(response) ||
      !hasExactKeys(response, [
        "index",
        "requestKey",
        "requestUrl",
        "requestHeaders",
        "sourcePath",
        "status",
        "headers",
        "body",
      ]) ||
      response.index !== index ||
      typeof response.requestKey !== "string" ||
      response.requestKey.length === 0 ||
      response.requestKey.length > MAXIMUM_REQUEST_KEY_LENGTH ||
      typeof response.requestUrl !== "string" ||
      !response.requestUrl.startsWith("/") ||
      response.requestUrl.length > MAXIMUM_REQUEST_URL_LENGTH ||
      (index > 0 && priorRequestKey.localeCompare(response.requestKey) >= 0) ||
      !Number.isInteger(response.status) ||
      (response.status as number) < 200 ||
      (response.status as number) >= 300 ||
      !Array.isArray(response.requestHeaders) ||
      !Array.isArray(response.headers) ||
      !isRecord(response.body)
    ) {
      throw new TypeError(`Served-response record ${index} is malformed or non-canonical.`);
    }
    const verifiedRequestHeaders = verifiedHeaderList(
      response.requestHeaders,
      `Served-response record ${index} request headers`,
    );
    assertNoSensitiveServedRequestHeaders(verifiedRequestHeaders);
    if (
      servedResponseRequestKey(response.requestUrl, verifiedRequestHeaders) !== response.requestKey
    ) {
      throw new TypeError(`Served-response record ${index} has a false request identity.`);
    }
    if (response.requestUrl === REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH) {
      if (response.sourcePath !== null || sawRunner) {
        throw new TypeError("Served-response runner must appear once without a source-file claim.");
      }
      sawRunner = true;
      runnerResponseIndex = index;
    } else if (typeof response.sourcePath !== "string") {
      throw new TypeError(`Served-response record ${index} is not bound to a locked source path.`);
    }
    priorRequestKey = response.requestKey;
    responseKeys.set(response.requestKey, index);
    const verifiedHeaders = verifiedHeaderList(
      response.headers,
      `Served-response record ${index} response headers`,
    );
    assertNoSensitiveServedResponseHeaders(verifiedHeaders);
    verifiedHeaderCharacters += [...verifiedRequestHeaders, ...verifiedHeaders].reduce(
      (total, header) => total + header.name.length + header.value.length,
      0,
    );
    if (verifiedHeaderCharacters > MAXIMUM_HEADER_AGGREGATE_CHARACTERS) {
      throw new TypeError("Served-response headers exceed their aggregate character bound.");
    }
    const body = response.body;
    if (
      !Number.isSafeInteger(body.bytes) ||
      (body.bytes as number) < 0 ||
      (body.bytes as number) > MAXIMUM_RESPONSE_BODY_BYTES ||
      !DIGEST_PATTERN.test(String(body.digest))
    ) {
      throw new TypeError(`Served-response record ${index} has an invalid body declaration.`);
    }
    verifiedResponseBodyBytes += body.bytes as number;
    if (verifiedResponseBodyBytes > MAXIMUM_RESPONSE_BODY_AGGREGATE_BYTES) {
      throw new TypeError("Served-response bodies exceed their aggregate byte bound.");
    }
    if (response.sourcePath !== null) {
      if (typeof response.sourcePath !== "string") {
        throw new TypeError(`Served-response record ${index} has an invalid source path.`);
      }
      const normalizedSourcePath = normalizeRealBuildRelativePath(
        response.sourcePath,
        "served-response source path",
      );
      if (normalizedSourcePath !== response.sourcePath || !sourceByPath.has(normalizedSourcePath)) {
        throw new TypeError(`Served-response record ${index} has an invalid source path.`);
      }
      const derivedSourcePath = sourcePathFromRequestUrl(
        response.requestUrl,
        sourceRoot,
        sourceByPath,
      );
      if (derivedSourcePath !== response.sourcePath) {
        throw new TypeError(
          `Served-response record ${index} sourcePath does not match its authenticated request URL.`,
        );
      }
    }
    let resolvedBundledBody: Buffer | null = null;
    if (body.kind === "source") {
      if (
        !hasExactKeys(body, ["kind", "path", "bytes", "digest"]) ||
        typeof body.path !== "string" ||
        response.sourcePath !== body.path
      ) {
        throw new TypeError(`Served-response record ${index} has an invalid source binding.`);
      }
      const normalized = normalizeRealBuildRelativePath(body.path, "served-response source");
      const source = sourceByPath.get(normalized);
      if (
        normalized !== body.path ||
        source === undefined ||
        source.bytes !== body.bytes ||
        source.digest !== body.digest
      ) {
        throw new TypeError(
          `Served-response record ${index} does not bind an exact replay source.`,
        );
      }
    } else if (body.kind === "bundle") {
      if (
        !hasExactKeys(body, ["kind", "offset", "bytes", "digest"]) ||
        body.offset !== expectedOffset
      ) {
        throw new TypeError(`Served-response record ${index} has a non-canonical bundle offset.`);
      }
      const end = expectedOffset + (body.bytes as number);
      resolvedBundledBody = bundle.subarray(expectedOffset, end);
      if (end > bundle.length || digest(resolvedBundledBody) !== body.digest) {
        throw new TypeError(
          `Served-response record ${index} failed its bundled body digest check.`,
        );
      }
      expectedOffset = end;
    } else {
      throw new TypeError(`Served-response record ${index} has an unknown body storage kind.`);
    }
    if (
      response.requestUrl === REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH &&
      (response.status !== REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS ||
        JSON.stringify(verifiedHeaders) !==
          JSON.stringify(strictHeaders(REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS)) ||
        resolvedBundledBody === null ||
        !resolvedBundledBody.equals(Buffer.from(REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY)))
    ) {
      throw new TypeError(
        "Served-response runner must have the exact synthetic status, headers, and body.",
      );
    }
  }
  if ((input.requireRunner === true || manifest.responses.length > 0) && !sawRunner) {
    throw new TypeError(
      "Served-response evidence has browser responses but no closed-route runner.",
    );
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
      event.requestKey.length === 0
    ) {
      throw new TypeError(`Served-response event ${index} is malformed or out of order.`);
    }
    requestCharacters += event.requestKey.length;
    if (
      event.requestKey.length > MAXIMUM_REQUEST_KEY_LENGTH ||
      requestCharacters > MAXIMUM_REQUEST_KEY_CHARACTERS
    ) {
      throw new TypeError("Served-response event request keys exceed their bounds.");
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
        runnerResponseIndex !== null &&
        (responseIndex !== runnerResponseIndex || event.cacheHit !== false)
      ) {
        throw new TypeError(
          "Served-response runner must be the first fulfilled event and cannot be a cache hit.",
        );
      }
      const expectedCacheHit = firstSeen.has(responseIndex);
      if (event.cacheHit !== expectedCacheHit) {
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
  if (runnerResponseIndex !== null) {
    const first = manifest.events[0];
    if (
      !isRecord(first) ||
      first.outcome !== "fulfilled" ||
      first.responseIndex !== runnerResponseIndex
    ) {
      throw new TypeError("Served-response runner must be the first fulfilled event.");
    }
  }
  if (referenced.size !== manifest.responses.length) {
    throw new TypeError("Served-response manifest contains an unreferenced response record.");
  }
  return [...chunkFiles, REAL_BUILD_SERVED_RESPONSE_MANIFEST];
}
