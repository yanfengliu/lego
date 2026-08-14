import { describe, expect, it } from "vitest";

import { replayStepSourceComponents } from "./callout-source-replay-proof";
import type { SourceReplayInput } from "./callout-source-replay-types";

describe("independent source replay input bound", () => {
  it("refuses a non-two target list before resolving browser modules or fetching bytes", async () => {
    const input: SourceReplayInput = {
      pdfjsUrl: "this-module-must-not-be-imported",
      workerUrl: "this-worker-must-not-be-read",
      pdfUrl: "this-pdf-must-not-be-fetched",
      expectedPdfSha256: `sha256:${"0".repeat(64)}`,
      expectedPdfBytes: 1,
      pageNumber: 1,
      scale: 8,
      box: { minXPt: 0, minYPt: 0, maxXPt: 1, maxYPt: 1 },
      targets: [],
    };
    await expect(replayStepSourceComponents(input)).rejects.toThrow(
      /received 0 targets; this bounded proof requires exactly 2 before imports, fetches, or raster work/u,
    );
  });
});
