import { describe, expect, it, vi } from "vitest";

import { renderCalloutCrops } from "./callout-browser-crops";
import {
  assertBoundedCalloutCropRaster,
  boundedCalloutPngDataUrl,
  assertBoundedCalloutTextMasks,
  boundedCalloutPageRaster,
  createCalloutComponentCacheBudget,
  fetchExactCalloutPdfBytes,
  MAX_CALLOUT_CROP_BYTES,
  MAX_CALLOUT_PDF_BYTES,
  MAX_CALLOUT_TARGETS_PER_PAGE,
  snapshotBoundedCalloutTextItems,
  snapshotBoundedCalloutTargets,
} from "./callout-browser-resource-bounds";
import type { BrowserCropInput, CalloutTarget } from "./callout-types";

function responseWithReader(
  reads: readonly ReadableStreamReadResult<Uint8Array>[],
  contentLength?: string,
): {
  readonly response: Response;
  readonly getReader: ReturnType<typeof vi.fn>;
  readonly cancel: ReturnType<typeof vi.fn>;
  readonly cancelBody: ReturnType<typeof vi.fn>;
} {
  let index = 0;
  const cancel = vi.fn(async () => undefined);
  const cancelBody = vi.fn(async () => undefined);
  const releaseLock = vi.fn();
  const read = vi.fn(async () => reads[index++] ?? { done: true, value: undefined });
  const getReader = vi.fn(() => ({ cancel, read, releaseLock }));
  const headers = new Headers();
  if (contentLength !== undefined) headers.set("content-length", contentLength);
  return {
    response: {
      body: { cancel: cancelBody, getReader },
      headers,
      ok: true,
      status: 200,
      statusText: "OK",
    } as unknown as Response,
    getReader,
    cancel,
    cancelBody,
  };
}

describe("callout browser resource bounds", () => {
  it("streams exactly the authenticated Node byte count into one bounded result", async () => {
    const source = responseWithReader(
      [
        { done: false, value: Uint8Array.from([1, 2]) },
        { done: false, value: Uint8Array.from([3]) },
        { done: true, value: undefined },
      ],
      "3",
    );
    await expect(
      fetchExactCalloutPdfBytes("/booklet.pdf", 3, async () => source.response),
    ).resolves.toEqual(Uint8Array.from([1, 2, 3]));
    expect(source.cancel).not.toHaveBeenCalled();
  });

  it("refuses a mismatched declared length before acquiring the response reader", async () => {
    const source = responseWithReader([], "4");
    await expect(
      fetchExactCalloutPdfBytes("/booklet.pdf", 3, async () => source.response),
    ).rejects.toThrow(/Content-Length 4 does not match.*3 bytes/u);
    expect(source.getReader).not.toHaveBeenCalled();
    expect(source.cancelBody).toHaveBeenCalledOnce();
  });

  it("cancels an HTTP-error response before refusing it", async () => {
    const source = responseWithReader([]);
    const response = {
      ...source.response,
      ok: false,
      status: 503,
      statusText: "Unavailable",
    } as Response;
    await expect(
      fetchExactCalloutPdfBytes("/booklet.pdf", 3, async () => response),
    ).rejects.toThrow(/HTTP 503 Unavailable/u);
    expect(source.getReader).not.toHaveBeenCalled();
    expect(source.cancelBody).toHaveBeenCalledOnce();
  });

  it("cancels a response whose declared length is not a decimal byte count", async () => {
    const source = responseWithReader([], "3x");
    await expect(
      fetchExactCalloutPdfBytes("/booklet.pdf", 3, async () => source.response),
    ).rejects.toThrow(/Content-Length.*not a decimal byte count/u);
    expect(source.getReader).not.toHaveBeenCalled();
    expect(source.cancelBody).toHaveBeenCalledOnce();
  });

  it("cancels a response that exceeds the exact byte count", async () => {
    const source = responseWithReader([{ done: false, value: Uint8Array.from([1, 2, 3, 4]) }]);
    await expect(
      fetchExactCalloutPdfBytes("/booklet.pdf", 3, async () => source.response),
    ).rejects.toThrow(/exceeded.*3 bytes/u);
    expect(source.cancel).toHaveBeenCalledOnce();
  });

  it("cancels a non-progressing streaming response", async () => {
    const source = responseWithReader([{ done: false, value: new Uint8Array() }]);
    await expect(
      fetchExactCalloutPdfBytes("/booklet.pdf", 3, async () => source.response),
    ).rejects.toThrow(/empty streaming chunk without progress/u);
    expect(source.cancel).toHaveBeenCalledOnce();
  });

  it("refuses a short response after bounded streaming", async () => {
    const source = responseWithReader([
      { done: false, value: Uint8Array.from([1, 2]) },
      { done: true, value: undefined },
    ]);
    await expect(
      fetchExactCalloutPdfBytes("/booklet.pdf", 3, async () => source.response),
    ).rejects.toThrow(/ended after 2 bytes.*3 bytes/u);
  });

  it("rejects an unbounded expected length without fetching", async () => {
    const fetchPdf = vi.fn();
    await expect(
      fetchExactCalloutPdfBytes("/booklet.pdf", MAX_CALLOUT_PDF_BYTES + 1, fetchPdf),
    ).rejects.toThrow(/safe integer in 1/u);
    expect(fetchPdf).not.toHaveBeenCalled();
  });

  it("bounds full-page canvas and text-mask dimensions", () => {
    expect(boundedCalloutPageRaster(6_122.1, 4_354.1)).toEqual({
      width: 6_123,
      height: 4_355,
    });
    expect(() => boundedCalloutPageRaster(8_000, 4_001)).toThrow(
      /1\.\.32000000 pixels before canvas or text-mask allocation/u,
    );
    expect(() => boundedCalloutPageRaster(40_000, 1)).toThrow(/16384 pixels per side/u);
    expect(() => boundedCalloutPageRaster(0, 100)).toThrow(/1\.\.32000000 pixels/u);
  });

  it("refuses an oversized per-page target set before importing or fetching the PDF", async () => {
    const fetchPdf = vi.fn();
    vi.stubGlobal("fetch", fetchPdf);
    const input = {
      pdfjsUrl: "/must-not-import.mjs",
      workerUrl: "/must-not-load.mjs",
      pdfUrl: "/must-not-fetch.pdf",
      pageNumber: 1,
      expectedSourceHash: `sha256:${"0".repeat(64)}`,
      expectedSourceBytes: 1,
      targets: Array.from(
        { length: MAX_CALLOUT_TARGETS_PER_PAGE + 1 },
        () => ({}) as CalloutTarget,
      ),
    } satisfies BrowserCropInput;
    try {
      await expect(renderCalloutCrops(input)).rejects.toThrow(/requires 1\.\.16 targets/u);
      expect(fetchPdf).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("captures a stateful target-array length only once", () => {
    let lengthReads = 0;
    const target = { identity: "bounded" };
    const targets = new Proxy([target], {
      get: (source, property, receiver) => {
        if (property === "length") {
          lengthReads += 1;
          return lengthReads === 1 ? 1 : 1_000_000_000;
        }
        return Reflect.get(source, property, receiver);
      },
    });
    expect(snapshotBoundedCalloutTargets(targets)).toEqual([target]);
    expect(lengthReads).toBe(1);
  });

  it("bounds extracted text and aggregate mask fill work", () => {
    expect(snapshotBoundedCalloutTextItems([{ str: "Nx" }, { str: "1" }])).toHaveLength(2);
    expect(() => snapshotBoundedCalloutTextItems([{ str: "x".repeat(20_001) }])).toThrow(
      /exceeds 20000 characters/u,
    );
    expect(() =>
      snapshotBoundedCalloutTextItems(Array.from({ length: 4_097 }, () => ({ str: "" }))),
    ).toThrow(/0\.\.4096 items/u);
    expect(() =>
      assertBoundedCalloutTextMasks([{ left: 0, top: 0, right: 8_000, bottom: 8_000 }]),
    ).toThrow(/more than 64000000 bounded fill pixels/u);
  });

  it("bounds crop rasters before canvas allocation", () => {
    expect(() => assertBoundedCalloutCropRaster(4_096, 4_096, "Crop")).not.toThrow();
    expect(() => assertBoundedCalloutCropRaster(4_097, 1, "Crop")).toThrow(/4096 pixels per side/u);
    expect(() => assertBoundedCalloutCropRaster(4_096, 4_097, "Crop")).toThrow(
      /crop-canvas allocation/u,
    );
  });

  it("bounds cumulative component caches across distinct source boxes", () => {
    const budget = createCalloutComponentCacheBudget();
    budget.charge({ left: 0, top: 0, right: 1_999, bottom: 1_999 });
    budget.charge({ left: 2_000, top: 0, right: 3_999, bottom: 1_999 });
    budget.charge({ left: 4_000, top: 0, right: 5_999, bottom: 1_999 });
    budget.charge({ left: 6_000, top: 0, right: 7_999, bottom: 1_999 });
    expect(() => budget.charge({ left: 8_000, top: 0, right: 8_000, bottom: 0 })).toThrow(
      /component caches exceed 16000000/u,
    );
  });

  it("bounds encoded PNG bytes before retaining base64", async () => {
    const exact = new Blob([new Uint8Array([1, 2])], { type: "image/png" });
    const canvas = {
      toBlob: (callback: BlobCallback) => callback(exact),
    } as HTMLCanvasElement;
    await expect(boundedCalloutPngDataUrl(canvas, "Crop")).resolves.toBe(
      "data:image/png;base64,AQI=",
    );

    const oversized = {
      type: "image/png",
      size: MAX_CALLOUT_CROP_BYTES + 1,
      arrayBuffer: vi.fn(),
    } as unknown as Blob;
    const oversizedCanvas = {
      toBlob: (callback: BlobCallback) => callback(oversized),
    } as HTMLCanvasElement;
    await expect(boundedCalloutPngDataUrl(oversizedCanvas, "Crop")).rejects.toThrow(
      /1\.\.2097152 bytes/u,
    );
    expect(oversized.arrayBuffer).not.toHaveBeenCalled();
  });
});
