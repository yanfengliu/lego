export interface DecodedRgba {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

export interface CanonicalOpaqueGroundRgba {
  readonly backgroundRgba: readonly [number, number, number, number];
  readonly boundsHalfOpen: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly canonicalHeight: number;
  readonly canonicalRgba: Uint8Array;
  readonly canonicalRgbaSha256: `sha256:${string}`;
  readonly canonicalWidth: number;
  readonly framedSha256: `sha256:${string}`;
  readonly originalHeight: number;
  readonly originalWidth: number;
}

export function canonicalizeOpaqueGroundRgba(
  decoded: DecodedRgba,
  label?: string,
): CanonicalOpaqueGroundRgba;

export function canonicalizeCalloutPng(
  bytes: Uint8Array,
  label?: string,
): CanonicalOpaqueGroundRgba;

export function measureExactBottomBackgroundRecut(
  legacy: DecodedRgba,
  current: DecodedRgba,
  label?: string,
): {
  readonly backgroundRgba: readonly [number, number, number, number];
  readonly currentPrefixBytes: number;
  readonly currentPrefixSha256: `sha256:${string}`;
  readonly removedBytes: number;
  readonly removedRows: number;
  readonly removedRgbaSha256: `sha256:${string}`;
};
