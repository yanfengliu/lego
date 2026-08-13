import { describe, expect, it } from "vitest";

import { createRealBuildSourceParityBrowserEvidenceRegistry } from "./real-build-observation-source-parity-browser-evidence";

const dataUrl = (value: string): string =>
  `data:image/png;base64,${Buffer.from(value).toString("base64")}`;

describe("source-parity browser evidence bounds", () => {
  it("deduplicates exact capture content before charging aggregate budgets", async () => {
    const registry = createRealBuildSourceParityBrowserEvidenceRegistry({
      maximumAggregateCaptureBytes: 3,
      maximumAggregateCaptureCharacters: 100,
    });
    const first = await registry.registerCapture(dataUrl("abc"), 4, 1);
    const second = await registry.registerCapture(dataUrl("abc"), 4, 1);
    expect(second).toBe(first);
    expect(registry.finish().captures).toHaveLength(1);
  });

  it("refuses unique capture bytes in the browser before retaining the next entry", async () => {
    const registry = createRealBuildSourceParityBrowserEvidenceRegistry({
      maximumAggregateCaptureBytes: 3,
      maximumAggregateCaptureCharacters: 100,
    });
    await registry.registerCapture(dataUrl("abc"), 4, 1);
    await expect(registry.registerCapture(dataUrl("d"), 4, 1)).rejects.toThrow(
      "would retain 4 bytes",
    );
    expect(registry.finish().captures).toHaveLength(1);
  });

  it("refuses NaN test limits instead of disabling the page-local hard cap", () => {
    expect(() =>
      createRealBuildSourceParityBrowserEvidenceRegistry({
        maximumAggregateCaptureBytes: Number.NaN,
      }),
    ).toThrow(/safe integer/);
  });
});
