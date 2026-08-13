import {
  MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES,
  MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_LENGTH,
  MAXIMUM_SERVED_RESPONSE_REQUEST_URL_LENGTH,
  MAXIMUM_SERVED_RESPONSE_REQUESTS,
  MAXIMUM_SERVED_RESPONSES,
  REAL_BUILD_SERVED_RESPONSE_SCHEMA,
  SHA256_DIGEST_PATTERN,
  normalizedServedResponseSourceRoot,
  servedResponseChunkName,
} from "./real-build-served-response-policy";

const MANIFEST_KEYS = ["schemaVersion", "sourceRoot", "events", "responses", "bodyChunks"];
const RESPONSE_KEYS = [
  "index",
  "requestKey",
  "requestUrl",
  "requestHeaders",
  "sourcePath",
  "status",
  "headers",
  "body",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function keys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort((left, right) => left.localeCompare(right));
}

function sameKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const observed = keys(value);
  const wanted = [...expected].sort((left, right) => left.localeCompare(right));
  return observed.length === wanted.length && observed.every((key, index) => key === wanted[index]);
}

const shown = (value: unknown): string => JSON.stringify(value) ?? String(value);

export interface ValidatedServedManifestEnvelope {
  readonly sourceRoot: string;
  readonly events: readonly unknown[];
  readonly responses: readonly unknown[];
  readonly bodyChunks: readonly unknown[];
}

export function validateServedManifestEnvelope(
  value: Record<string, unknown>,
  suppliedChunkCount: number,
): ValidatedServedManifestEnvelope {
  if (!sameKeys(value, MANIFEST_KEYS)) {
    throw new TypeError(
      `Served-response manifest keys were [${keys(value).join(", ")}]; expected exactly [${[...MANIFEST_KEYS].sort().join(", ")}].`,
    );
  }
  if (value.schemaVersion !== REAL_BUILD_SERVED_RESPONSE_SCHEMA) {
    throw new TypeError(
      `Served-response manifest schemaVersion was ${shown(value.schemaVersion)}; expected ${shown(REAL_BUILD_SERVED_RESPONSE_SCHEMA)}.`,
    );
  }
  if (typeof value.sourceRoot !== "string") {
    throw new TypeError(
      `Served-response manifest sourceRoot was ${typeof value.sourceRoot}; expected string.`,
    );
  }
  const normalizedRoot = normalizedServedResponseSourceRoot(value.sourceRoot);
  if (normalizedRoot !== value.sourceRoot) {
    throw new TypeError(
      `Served-response manifest sourceRoot was ${shown(value.sourceRoot)}; expected canonical ${shown(normalizedRoot)}.`,
    );
  }
  const events = boundedManifestArray(value.events, MAXIMUM_SERVED_RESPONSE_REQUESTS, "events");
  const responses = boundedManifestArray(value.responses, MAXIMUM_SERVED_RESPONSES, "responses");
  const bodyChunks = boundedManifestArray(value.bodyChunks, 4, "bodyChunks");
  if (suppliedChunkCount !== bodyChunks.length) {
    throw new TypeError(
      `Served-response bodyChunkBytes held ${suppliedChunkCount} chunks; manifest bodyChunks declared ${bodyChunks.length}.`,
    );
  }
  return { sourceRoot: value.sourceRoot, events, responses, bodyChunks };
}

function boundedManifestArray(value: unknown, maximum: number, path: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Served-response manifest ${path} was ${typeof value}; expected Array.`);
  }
  if (value.length > maximum) {
    throw new RangeError(
      `Served-response manifest ${path} held ${value.length} rows; expected at most ${maximum}.`,
    );
  }
  return value;
}

export interface ValidatedServedChunk {
  readonly file: string;
  readonly bytes: number;
  readonly digest: string;
}

export function validateServedChunk(value: unknown, index: number): ValidatedServedChunk {
  const path = `Served-response bodyChunks[${index}]`;
  if (!isRecord(value)) throw new TypeError(`${path} was not a record; expected one data record.`);
  if (!sameKeys(value, ["file", "bytes", "digest"])) {
    throw new TypeError(
      `${path} keys were [${keys(value).join(", ")}]; expected exactly [bytes, digest, file].`,
    );
  }
  const expectedFile = servedResponseChunkName(index);
  if (value.file !== expectedFile) {
    throw new TypeError(`${path}.file was ${shown(value.file)}; expected ${shown(expectedFile)}.`);
  }
  if (!Number.isSafeInteger(value.bytes)) {
    throw new TypeError(`${path}.bytes was ${shown(value.bytes)}; expected one safe integer.`);
  }
  if (
    (value.bytes as number) < 1 ||
    (value.bytes as number) > MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES
  ) {
    throw new RangeError(
      `${path}.bytes was ${value.bytes as number}; expected 1 through ${MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES}.`,
    );
  }
  if (typeof value.digest !== "string" || !SHA256_DIGEST_PATTERN.test(value.digest)) {
    throw new TypeError(
      `${path}.digest was ${shown(value.digest)}; expected canonical sha256 digest.`,
    );
  }
  return { file: value.file as string, bytes: value.bytes as number, digest: value.digest };
}

export interface ValidatedServedResponse extends Record<string, unknown> {
  readonly index: number;
  readonly requestKey: string;
  readonly requestUrl: string;
  readonly requestHeaders: unknown;
  readonly sourcePath: unknown;
  readonly status: number;
  readonly headers: unknown;
  readonly body: Record<string, unknown>;
}

export function validateServedResponseEnvelope(
  value: unknown,
  index: number,
  priorRequestKey: string,
): ValidatedServedResponse {
  const path = `Served-response responses[${index}]`;
  if (!isRecord(value)) throw new TypeError(`${path} was not a record; expected one data record.`);
  if (!sameKeys(value, RESPONSE_KEYS)) {
    throw new TypeError(
      `${path} keys were [${keys(value).join(", ")}]; expected exactly [${[...RESPONSE_KEYS].sort().join(", ")}].`,
    );
  }
  if (value.index !== index) {
    throw new TypeError(`${path}.index was ${shown(value.index)}; expected dense index ${index}.`);
  }
  if (typeof value.requestKey !== "string") {
    throw new TypeError(`${path}.requestKey was ${typeof value.requestKey}; expected string.`);
  }
  if (
    value.requestKey.length < 1 ||
    value.requestKey.length > MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_LENGTH
  ) {
    throw new RangeError(
      `${path}.requestKey held ${value.requestKey.length} characters; expected 1 through ${MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_LENGTH}.`,
    );
  }
  if (index > 0 && priorRequestKey.localeCompare(value.requestKey) >= 0) {
    throw new TypeError(
      `${path}.requestKey was ${shown(value.requestKey)} after ${shown(priorRequestKey)}; expected strict lexical increase.`,
    );
  }
  if (typeof value.requestUrl !== "string") {
    throw new TypeError(`${path}.requestUrl was ${typeof value.requestUrl}; expected string.`);
  }
  if (value.requestUrl.length > MAXIMUM_SERVED_RESPONSE_REQUEST_URL_LENGTH) {
    throw new RangeError(
      `${path}.requestUrl held ${value.requestUrl.length} characters; expected at most ${MAXIMUM_SERVED_RESPONSE_REQUEST_URL_LENGTH}.`,
    );
  }
  if (!Number.isInteger(value.status)) {
    throw new TypeError(`${path}.status was ${shown(value.status)}; expected integer HTTP status.`);
  }
  if ((value.status as number) < 200 || (value.status as number) >= 300) {
    throw new RangeError(`${path}.status was ${value.status as number}; expected 200 through 299.`);
  }
  if (!isRecord(value.body)) {
    throw new TypeError(`${path}.body was not a record; expected one body declaration.`);
  }
  return value as ValidatedServedResponse;
}
