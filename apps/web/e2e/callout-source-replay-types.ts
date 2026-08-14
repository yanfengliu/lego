import type { ReplayBounds } from "./callout-source-replay-digest";

export interface SourceReplayInput {
  readonly pdfjsUrl: string;
  readonly workerUrl: string;
  readonly pdfUrl: string;
  readonly expectedPdfSha256: string;
  readonly expectedPdfBytes: number;
  readonly pageNumber: number;
  readonly scale: 8;
  readonly box: {
    readonly minXPt: number;
    readonly minYPt: number;
    readonly maxXPt: number;
    readonly maxYPt: number;
  };
  readonly targets: readonly {
    readonly key: string;
    readonly expectedLabel: string;
    readonly xPt: number;
    readonly yPt: number;
    readonly heightPt: number;
  }[];
}

export interface SourceReplayResult {
  readonly observedPdfSha256: string;
  readonly pageNumber: number;
  readonly scale: 8;
  readonly pageWidthPx: number;
  readonly pageHeightPx: number;
  readonly pagePixels: number;
  readonly sourceBoxPx: ReplayBounds;
  readonly sourceBoxPixels: number;
  readonly clipRenderBoxPx: ReplayBounds;
  readonly clipRenderPixels: number;
  readonly rawComponentCount: number;
  readonly coalescedComponentCount: number;
  readonly sourceBoxRgbaBytes: number;
  readonly clippedRgbaSha256: string;
  readonly fullPageSliceRgbaSha256: string;
  readonly exactRgbaParity: boolean;
  readonly rgbaMismatch: null | {
    readonly mismatchedBytes: number;
    readonly mismatchedPixels: number;
    readonly maximumChannelDelta: number;
    readonly firstByte: number;
    readonly firstPixel: number;
    readonly absoluteX: number;
    readonly absoluteY: number;
    readonly channel: number;
    readonly clippedValue: number;
    readonly fullPageValue: number;
    readonly mismatchBoundsPx: ReplayBounds;
  };
  readonly components: readonly {
    readonly targetKey: string;
    readonly label: string;
    readonly labelTransformPt: readonly [number, number];
    readonly boundsPx: ReplayBounds;
    readonly foregroundPixels: number;
    readonly recordBytes: number;
    readonly coalescedRawComponents: number;
    readonly rgbaMismatchedPixelsInComponent: number;
    readonly absoluteForegroundSha256: string;
  }[];
}
