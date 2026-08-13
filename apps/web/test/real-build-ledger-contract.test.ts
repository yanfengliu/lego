import { describe, expect, it } from "vitest";

import { sha256Digest } from "../e2e/real-build-artifacts";
import { stepPanelEvidenceDigest } from "../e2e/real-build-ledger";

describe("step panel evidence digest", () => {
  it("canonicalizes field order while preserving the historical ledger bytes", () => {
    const ordered = stepPanelEvidenceDigest({
      pdfDigest: sha256Digest("fixture-pdf"),
      stepNumber: 90,
      pageNumber: 79,
      bounds: { minXPt: 0, maxXPt: 100, minYPt: 10, maxYPt: 90 },
      calloutBoxes: [{ minXPt: 4, maxXPt: 24, minYPt: 30, maxYPt: 50 }],
    });
    const reordered = stepPanelEvidenceDigest({
      pageNumber: 79,
      stepNumber: 90,
      pdfDigest: sha256Digest("fixture-pdf"),
      bounds: { maxYPt: 90, minYPt: 10, maxXPt: 100, minXPt: 0 },
      calloutBoxes: [{ maxYPt: 50, minYPt: 30, maxXPt: 24, minXPt: 4 }],
    });

    expect(reordered).toBe(ordered);
    expect(ordered).toBe("sha256:116ce0e4453b861d2cd17fcb7620aa12d443040d464e422e18453157e057f072");
  });
});
