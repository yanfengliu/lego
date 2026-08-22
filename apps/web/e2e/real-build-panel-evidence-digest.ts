import { sha256Hex } from "@lego-studio/brick-kernel";

export interface RealBuildPanelEvidenceDigestInput {
  readonly pdfDigest: string;
  readonly stepNumber: number;
  readonly pageNumber: number;
  readonly bounds: {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  };
  readonly calloutBoxes: readonly {
    readonly minXPt: number;
    readonly maxXPt: number;
    readonly minYPt: number;
    readonly maxYPt: number;
  }[];
}

/** Browser-safe reproduction of the ordered panel commitment used by the action ledger. */
export function stepPanelEvidenceDigest(input: RealBuildPanelEvidenceDigestInput): string {
  return `sha256:${sha256Hex(
    JSON.stringify({
      pdfDigest: input.pdfDigest,
      stepNumber: input.stepNumber,
      pageNumber: input.pageNumber,
      bounds: {
        minXPt: input.bounds.minXPt,
        maxXPt: input.bounds.maxXPt,
        maxYPt: input.bounds.maxYPt,
        minYPt: input.bounds.minYPt,
      },
      calloutBoxes: input.calloutBoxes.map((box) => ({
        minXPt: box.minXPt,
        minYPt: box.minYPt,
        maxXPt: box.maxXPt,
        maxYPt: box.maxYPt,
      })),
    }),
  )}`;
}
