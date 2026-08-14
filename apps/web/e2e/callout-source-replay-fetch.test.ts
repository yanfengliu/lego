import { describe, expect, it, vi } from "vitest";

import { fetchBoundedReplayPdf } from "./callout-source-replay-fetch";

function streamedResponse(chunks: readonly Uint8Array[], headers?: HeadersInit): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    { ...(headers === undefined ? {} : { headers }), status: 200 },
  );
}

describe("independent source replay PDF fetch bound", () => {
  it("joins a response only after its streamed bytes fit the bound", async () => {
    const fetcher = vi.fn(async () =>
      streamedResponse([Uint8Array.from([1, 2]), Uint8Array.from([3])]),
    );
    await expect(
      fetchBoundedReplayPdf("https://example.invalid/booklet.pdf", 3, { fetcher }),
    ).resolves.toEqual(Uint8Array.from([1, 2, 3]));
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("refuses a declared oversized body before reading it", async () => {
    const fetcher = vi.fn(async () =>
      streamedResponse([Uint8Array.from([1])], { "content-length": "5" }),
    );
    await expect(
      fetchBoundedReplayPdf("https://example.invalid/booklet.pdf", 4, { fetcher }),
    ).rejects.toThrow(/declares 5 bytes, not exact expected length 4/u);
  });

  it("cancels and refuses when streamed bytes cross the bound", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.from([1, 2, 3]));
        controller.enqueue(Uint8Array.from([4, 5]));
      },
      cancel,
    });
    const fetcher = vi.fn(async () => new Response(body, { status: 200 }));
    await expect(
      fetchBoundedReplayPdf("https://example.invalid/booklet.pdf", 4, { fetcher }),
    ).rejects.toThrow(/exceeded exact expected length 4 while streaming/u);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("cancels and refuses a non-progressing streaming response", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array());
      },
      cancel,
    });
    const fetcher = vi.fn(async () => new Response(body, { status: 200 }));
    await expect(
      fetchBoundedReplayPdf("https://example.invalid/booklet.pdf", 4, { fetcher }),
    ).rejects.toThrow(/empty streaming chunk without progress/u);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("refuses a truncated body instead of hashing a zero-padded allocation", async () => {
    const fetcher = vi.fn(async () => streamedResponse([Uint8Array.from([1, 2, 3])]));
    await expect(
      fetchBoundedReplayPdf("https://example.invalid/booklet.pdf", 4, { fetcher }),
    ).rejects.toThrow(/ended at 3 bytes, not exact expected length 4/u);
  });

  it("refuses an invalid exact length before fetching", async () => {
    const fetcher = vi.fn(async () => streamedResponse([Uint8Array.from([1])]));
    await expect(
      fetchBoundedReplayPdf("https://example.invalid/booklet.pdf", 0, { fetcher }),
    ).rejects.toThrow(/expected PDF byte length 0 is invalid/u);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
