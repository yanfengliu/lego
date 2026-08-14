export const MAX_SOURCE_REPLAY_PDF_BYTES = 96 * 1024 * 1024;

type ReplayFetcher = (url: string) => Promise<Response>;

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Preserve the bounded fetch refusal if cancellation itself fails.
  }
}

export async function fetchBoundedReplayPdf(
  url: string,
  expectedPdfBytes: number,
  options: {
    readonly fetcher?: ReplayFetcher;
  } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  if (
    !Number.isSafeInteger(expectedPdfBytes) ||
    expectedPdfBytes < 1 ||
    expectedPdfBytes > MAX_SOURCE_REPLAY_PDF_BYTES
  ) {
    throw new Error(
      `Independent source replay expected PDF byte length ${expectedPdfBytes} is invalid; expected 1..${MAX_SOURCE_REPLAY_PDF_BYTES}.`,
    );
  }
  const response = await (options.fetcher ?? globalThis.fetch)(url);
  if (!response.ok) {
    await cancelResponseBody(response);
    throw new Error(
      `Independent source replay could not fetch ${url}: HTTP ${response.status} ${response.statusText || "without a status message"}.`,
    );
  }
  const declaredText = response.headers.get("content-length");
  if (declaredText !== null) {
    const declaredBytes = Number(declaredText);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 0) {
      await cancelResponseBody(response);
      throw new Error(
        `Independent source replay fetched ${url} with invalid Content-Length ${JSON.stringify(declaredText)}.`,
      );
    }
    if (declaredBytes !== expectedPdfBytes) {
      await cancelResponseBody(response);
      throw new Error(
        `Independent source replay PDF ${url} declares ${declaredBytes} bytes, not exact expected length ${expectedPdfBytes}; refuse before body materialization.`,
      );
    }
  }
  if (response.body === null) {
    throw new Error(
      `Independent source replay PDF ${url} has no streaming response body, so its bytes cannot be bounded before materialization.`,
    );
  }

  const reader = response.body.getReader();
  const bytes = new Uint8Array(expectedPdfBytes);
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > expectedPdfBytes - byteLength) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the byte-bound refusal if cancellation itself fails.
        }
        throw new Error(
          `Independent source replay PDF ${url} exceeded exact expected length ${expectedPdfBytes} while streaming; refuse the overflow body.`,
        );
      }
      if (value.byteLength === 0) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the bounded non-progress refusal if cancellation itself fails.
        }
        throw new Error(
          `Independent source replay PDF ${url} produced an empty streaming chunk without progress.`,
        );
      }
      bytes.set(value, byteLength);
      byteLength += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  if (byteLength !== expectedPdfBytes) {
    throw new Error(
      `Independent source replay PDF ${url} ended at ${byteLength} bytes, not exact expected length ${expectedPdfBytes}; refuse the truncated body.`,
    );
  }
  return bytes;
}
