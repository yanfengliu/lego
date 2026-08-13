import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchExactRealBuildSourceParityPdf } from "./real-build-observation-source-parity-browser-fetch";

afterEach(() => vi.unstubAllGlobals());

describe("source-parity streamed PDF fetch", () => {
  it("retains one exact-length stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(Uint8Array.of(1, 2, 3));
                controller.close();
              },
            }),
            { status: 200, headers: { "content-length": "3" } },
          ),
        ),
      ),
    );
    await expect(
      fetchExactRealBuildSourceParityPdf({
        url: "https://invalid.test/booklet.pdf",
        expectedBytes: 3,
      }),
    ).resolves.toEqual(Uint8Array.of(1, 2, 3));
  });

  it("cancels an exact-prefix stream when a later chunk exceeds the Node length", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(Uint8Array.of(1, 2, 3));
        controller.enqueue(Uint8Array.of(4));
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.resolve(new Response(stream))),
    );
    await expect(
      fetchExactRealBuildSourceParityPdf({
        url: "https://invalid.test/booklet.pdf",
        expectedBytes: 3,
      }),
    ).rejects.toThrow(/exceeds Node's exact 3-byte source/);
    expect(cancelled).toBe(true);
  });
});
