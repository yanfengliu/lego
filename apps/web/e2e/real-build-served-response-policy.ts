import { createHash } from "node:crypto";

export const REAL_BUILD_SERVED_RESPONSE_SCHEMA = "lego.real-build-served-responses/1" as const;
export const REAL_BUILD_SERVED_RESPONSE_MANIFEST = "served-response-manifest.json" as const;
export const REAL_BUILD_SERVED_RESPONSE_RUNNER_PATH = "/__real_build_runner__" as const;
export const REAL_BUILD_SERVED_RESPONSE_RUNNER_STATUS = 200 as const;
export const REAL_BUILD_SERVED_RESPONSE_RUNNER_BODY =
  '<!doctype html><meta charset="utf-8"><title>Real build runner</title>\n' as const;
export const REAL_BUILD_SERVED_RESPONSE_RUNNER_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-type": "text/html; charset=utf-8",
});
export const MAXIMUM_SERVED_RESPONSE_REQUESTS = 20_000;
export const MAXIMUM_SERVED_RESPONSES = 10_000;
export const MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_CHARACTERS = 4 * 1024 * 1024;
export const MAXIMUM_SERVED_RESPONSE_BODY_BYTES = 96 * 1024 * 1024;
export const MAXIMUM_SERVED_RESPONSE_BODY_AGGREGATE_BYTES = 192 * 1024 * 1024;
export const MAXIMUM_BUNDLED_SERVED_RESPONSE_BYTES = 128 * 1024 * 1024;
export const MAXIMUM_SERVED_RESPONSE_BODY_CHUNK_BYTES = 32 * 1024 * 1024;
export const MAXIMUM_SERVED_RESPONSE_MANIFEST_BYTES = 16 * 1024 * 1024;
export const MAXIMUM_SERVED_RESPONSE_HEADERS = 128;
export const MAXIMUM_SERVED_RESPONSE_HEADER_CHARACTERS = 64 * 1024;
export const MAXIMUM_SERVED_RESPONSE_HEADER_AGGREGATE_CHARACTERS = 4 * 1024 * 1024;
export const MAXIMUM_SERVED_RESPONSE_REQUEST_URL_LENGTH = 4_096;
export const MAXIMUM_SERVED_RESPONSE_REQUEST_KEY_LENGTH = 4_192;
export const SHA256_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;

export interface ServedResponseHeader {
  readonly name: string;
  readonly value: string;
}

export const servedResponseDigest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

export function servedResponseChunkName(index: number): string {
  return `served-response-bodies-${String(index).padStart(3, "0")}.bin`;
}

export function servedResponseRequestKey(
  requestUrl: string,
  headers: readonly ServedResponseHeader[],
): string {
  return `${requestUrl}#headers=${servedResponseDigest(Buffer.from(JSON.stringify(headers)))}`;
}

export function normalizedServedResponseSourceRoot(root: string): string {
  const normalized = root.replaceAll("\\", "/").replace(/\/$/u, "");
  if (!/^[A-Za-z]:\/(?:[^/\0]+\/)*[^/\0]+$/u.test(normalized) || normalized.includes("/../")) {
    throw new TypeError(
      `Served-response source root must be a canonical absolute Windows path; received ${JSON.stringify(root)}.`,
    );
  }
  return normalized;
}

export function assertNoSensitiveServedRequestHeaders(
  headers: readonly ServedResponseHeader[],
): void {
  assertNoSensitiveServedHeaders(headers, "request");
}

export function assertNoSensitiveServedResponseHeaders(
  headers: readonly ServedResponseHeader[],
): void {
  assertNoSensitiveServedHeaders(headers, "response");
}

function assertNoSensitiveServedHeaders(
  headers: readonly ServedResponseHeader[],
  surface: "request" | "response",
): void {
  const sensitive = headers.find(
    ({ name }) =>
      /(?:^|[-_])(?:auth(?:entication|orization)?|bearer|cookie|credential|secret|session|token|api[-_]?key|csrf|xsrf)(?:$|[-_])/u.test(
        name,
      ) ||
      /^(?:www-authenticate|proxy-authenticate|authentication-info|proxy-authentication-info)$/u.test(
        name,
      ),
  );
  if (sensitive !== undefined) {
    throw new TypeError(
      `Browser ${surface} header ${sensitive.name} may contain session or credential material and cannot enter retained evidence.`,
    );
  }
}

export function strictServedResponseHeaders(
  headers: Readonly<Record<string, string>>,
): readonly ServedResponseHeader[] {
  const entries = Object.entries(headers)
    .map(([name, value]) => ({ name: name.toLowerCase(), value }))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (entries.length > MAXIMUM_SERVED_RESPONSE_HEADERS) {
    throw new TypeError(
      `Served response has ${entries.length} headers; maximum is ${MAXIMUM_SERVED_RESPONSE_HEADERS}.`,
    );
  }
  let characters = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index]!;
    characters += entry.name.length + entry.value.length;
    if (
      !/^[!#$%&'*+.^_`|~0-9a-z-]+$/u.test(entry.name) ||
      /[\r\n\0]/u.test(entry.value) ||
      (index > 0 && entries[index - 1]!.name === entry.name)
    ) {
      throw new TypeError(`Served response header ${JSON.stringify(entry.name)} is not canonical.`);
    }
  }
  if (characters > MAXIMUM_SERVED_RESPONSE_HEADER_CHARACTERS) {
    throw new TypeError(
      `Served response headers contain ${characters} characters; maximum is ${MAXIMUM_SERVED_RESPONSE_HEADER_CHARACTERS}.`,
    );
  }
  return entries;
}
