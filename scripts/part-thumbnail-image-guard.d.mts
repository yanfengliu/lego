export const MAX_THUMBNAIL_DIMENSION: number;
export const MAX_THUMBNAIL_PIXELS: number;
export const MAX_AGGREGATE_PNG_DECODE_PIXELS: number;

export function assertBoundedPngDimensions(
  bytes: Uint8Array,
  label?: string,
  limits?: { readonly maxDimension?: number; readonly maxPixels?: number },
): { readonly width: number; readonly height: number };

export function createPngDecodeBudget(
  label?: string,
  maxPixels?: number,
): {
  charge(
    bytes: Uint8Array,
    imageLabel?: string,
    limits?: { readonly maxDimension?: number; readonly maxPixels?: number },
  ): { readonly width: number; readonly height: number };
  readonly usedPixels: number;
};

export function assertCanonicalCardPng(
  bytes: Uint8Array,
  label?: string,
): { readonly width: number; readonly height: number };

export function decodeCanonicalCardRgba(
  bytes: Uint8Array,
  label?: string,
): { readonly width: number; readonly height: number; readonly data: Uint8Array };
