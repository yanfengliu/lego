import { REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES } from "./real-build-observation-source-parity-contract";

const CONTENT_LENGTH = /^[0-9]+$/u;

async function cancelBeforeRefusal(response: Response, failure: Error): Promise<never> {
  if (response.body === null) throw failure;
  try {
    await response.body.cancel();
  } catch (cleanupError) {
    throw new AggregateError(
      [failure, cleanupError],
      `${failure.message} The rejected response body also failed cancellation.`,
      { cause: cleanupError },
    );
  }
  throw failure;
}

export async function fetchExactRealBuildSourceParityPdf(input: {
  readonly url: string;
  readonly expectedBytes: number;
}): Promise<Uint8Array> {
  if (
    !Number.isSafeInteger(input.expectedBytes) ||
    input.expectedBytes < 1 ||
    input.expectedBytes > REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES
  ) {
    throw new RangeError(
      `Source-parity PDF expected length must be 1 through ${REAL_BUILD_SOURCE_PARITY_MAXIMUM_PDF_BYTES}; received ${String(input.expectedBytes)}.`,
    );
  }
  const response = await fetch(input.url, { cache: "no-store" });
  if (!response.ok) {
    await cancelBeforeRefusal(
      response,
      new Error(`Source-parity PDF fetch ${input.url} returned HTTP ${response.status}.`),
    );
  }
  const declared = response.headers.get("content-length");
  if (
    declared !== null &&
    (!CONTENT_LENGTH.test(declared) || Number(declared) !== input.expectedBytes)
  ) {
    await cancelBeforeRefusal(
      response,
      new RangeError(
        `Source-parity PDF ${input.url} declares ${JSON.stringify(declared)} bytes; Node prepared exactly ${input.expectedBytes}.`,
      ),
    );
  }
  if (response.body === null) {
    throw new TypeError(`Source-parity PDF ${input.url} returned no readable byte stream.`);
  }
  const retained = new Uint8Array(input.expectedBytes);
  const reader = response.body.getReader();
  let offset = 0;
  let cleanEnd = false;
  let primaryFailure: unknown = null;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        cleanEnd = true;
        break;
      }
      if (value === undefined || value.byteLength === 0) continue;
      if (offset + value.byteLength > input.expectedBytes) {
        throw new RangeError(
          `Source-parity PDF ${input.url} exceeds Node's exact ${input.expectedBytes}-byte source before retention.`,
        );
      }
      retained.set(value, offset);
      offset += value.byteLength;
    }
  } catch (error) {
    primaryFailure = error;
  }
  let cleanupFailure: unknown = null;
  if (!cleanEnd) {
    try {
      await reader.cancel();
    } catch (error) {
      cleanupFailure = error;
    }
  }
  reader.releaseLock();
  if (primaryFailure !== null && cleanupFailure === null) throw primaryFailure;
  if (primaryFailure !== null || cleanupFailure !== null) {
    throw new AggregateError(
      [primaryFailure, cleanupFailure].filter((failure) => failure !== null),
      `Source-parity PDF ${input.url} stream read and cancellation failed.`,
      { cause: cleanupFailure },
    );
  }
  if (offset !== input.expectedBytes) {
    throw new RangeError(
      `Source-parity PDF ${input.url} ended at ${offset} bytes; Node prepared exactly ${input.expectedBytes}.`,
    );
  }
  return retained;
}
