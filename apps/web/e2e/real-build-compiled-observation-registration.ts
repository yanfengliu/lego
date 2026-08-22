import { intrinsicRealBuildFreeze } from "./real-build-intrinsic-freeze";
import { MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS } from "./real-build-compiled-observation-closure-types";

export interface RealBuildCompiledRegistrationResult {
  readonly score: number;
  readonly shiftPx: readonly [number, number];
  readonly sourcePixels: number;
  readonly intersectionPixels: number;
  readonly denominatorPixels: number;
}

interface Centroid {
  readonly x: number;
  readonly y: number;
}

interface Comparison {
  readonly source: Uint8Array;
  readonly candidate: Uint8Array;
  readonly excluded: Uint8Array | null;
  readonly width: number;
  readonly height: number;
  readonly measure: "iou" | "containment";
  readonly path: string;
}

const REGISTRATION_SAMPLE_STRIDE = 4;
const REGISTRATION_SCALES = [8, 3, 1] as const;
const REGISTRATION_RADIUS = 4;

function exactMaskPixels(width: number, height: number, label: string): number {
  const pixels = width * height;
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    !Number.isSafeInteger(pixels) ||
    pixels > MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS
  ) {
    throw new RangeError(
      `${label} requires positive safe-integer dimensions covering at most ${MAXIMUM_REAL_BUILD_COMPILED_OBSERVATION_RASTER_PIXELS} pixels.`,
    );
  }
  return pixels;
}

function maskBit(bytes: Uint8Array, pixel: number): number {
  return (bytes[pixel >>> 3]! >>> (7 - (pixel & 7))) & 1;
}

export function packRealBuildCompiledBinaryMaskMsb(
  mask: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const pixels = exactMaskPixels(width, height, "Compiled binary mask packing");
  if (mask.length !== pixels) {
    throw new RangeError(
      `Compiled binary mask packing requires exactly ${pixels} unpacked pixels; received ${mask.length}.`,
    );
  }
  const packed = new Uint8Array(Math.ceil(pixels / 8));
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const value = mask[pixel]!;
    if (value !== 0 && value !== 1) {
      throw new TypeError(`Compiled binary mask pixel ${pixel} must be exactly 0 or 1.`);
    }
    if (value === 1) {
      const byte = pixel >>> 3;
      packed[byte] = packed[byte]! | (1 << (7 - (pixel & 7)));
    }
  }
  return packed;
}

export function unpackRealBuildCompiledBinaryMaskMsb(
  packed: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const pixels = exactMaskPixels(width, height, "Compiled binary mask unpacking");
  const expectedBytes = Math.ceil(pixels / 8);
  if (packed.length !== expectedBytes) {
    throw new RangeError(
      `Compiled binary mask unpacking requires exactly ${expectedBytes} packed bytes; received ${packed.length}.`,
    );
  }
  const remainder = pixels & 7;
  if (remainder !== 0 && (packed[packed.length - 1]! & ((1 << (8 - remainder)) - 1)) !== 0) {
    throw new TypeError("Compiled MSB-first binary mask has non-zero low padding bits.");
  }
  const unpacked = new Uint8Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel += 1) unpacked[pixel] = maskBit(packed, pixel);
  return unpacked;
}

/** Creates one bounded verifier so work is charged across the complete retained role. */
export function realBuildCompiledObservationRegistrationVisits(
  width: number,
  height: number,
): number {
  const pixels = exactMaskPixels(width, height, "Compiled observation registration");
  const sampled =
    Math.ceil(width / REGISTRATION_SAMPLE_STRIDE) * Math.ceil(height / REGISTRATION_SAMPLE_STRIDE);
  const evaluations = 1 + REGISTRATION_SCALES.length * (REGISTRATION_RADIUS * 2 + 1) ** 2;
  return pixels * 3 + sampled * evaluations;
}

export function createRealBuildCompiledObservationRegistrationVerifier(maximumPixelVisits: number) {
  if (!Number.isSafeInteger(maximumPixelVisits) || maximumPixelVisits < 1) {
    throw new RangeError(
      "Compiled observation registration verifier requires a positive safe-integer visit budget.",
    );
  }
  let pixelVisits = 0;
  const centroids = new WeakMap<Uint8Array, Centroid | null>();

  const charge = (width: number, height: number, stride: number, path: string): void => {
    pixelVisits += Math.ceil(width / stride) * Math.ceil(height / stride);
    if (pixelVisits > maximumPixelVisits) {
      throw new RangeError(
        `Compiled observation comparisons exceed ${maximumPixelVisits} bounded pixel visits at ${path}.`,
      );
    }
  };

  const centroid = (
    bytes: Uint8Array,
    width: number,
    height: number,
    path: string,
  ): Centroid | null => {
    const cached = centroids.get(bytes);
    if (cached !== undefined || centroids.has(bytes)) return cached ?? null;
    charge(width, height, 1, `${path} centroid`);
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (maskBit(bytes, y * width + x) === 0) continue;
        sumX += x;
        sumY += y;
        count += 1;
      }
    }
    const result =
      count === 0 ? null : intrinsicRealBuildFreeze({ x: sumX / count, y: sumY / count });
    centroids.set(bytes, result);
    return result;
  };

  const agreementAt = (
    input: Comparison,
    dx: number,
    dy: number,
    stride: number,
  ): Omit<RealBuildCompiledRegistrationResult, "shiftPx"> => {
    charge(input.width, input.height, stride, input.path);
    let sourcePixels = 0;
    let intersectionPixels = 0;
    let denominatorPixels = 0;
    for (let y = 0; y < input.height; y += stride) {
      const candidateY = y - dy;
      for (let x = 0; x < input.width; x += stride) {
        const targetPixel = y * input.width + x;
        if (input.excluded !== null && maskBit(input.excluded, targetPixel) === 1) continue;
        const sourceSet = maskBit(input.source, targetPixel) === 1;
        if (sourceSet) sourcePixels += 1;
        const candidateX = x - dx;
        const candidateSet =
          candidateX >= 0 &&
          candidateX < input.width &&
          candidateY >= 0 &&
          candidateY < input.height &&
          maskBit(input.candidate, candidateY * input.width + candidateX) === 1;
        if (candidateSet && sourceSet) intersectionPixels += 1;
        if (input.measure === "containment" ? candidateSet : candidateSet || sourceSet) {
          denominatorPixels += 1;
        }
      }
    }
    return intrinsicRealBuildFreeze({
      score: denominatorPixels === 0 ? 0 : intersectionPixels / denominatorPixels,
      sourcePixels,
      intersectionPixels,
      denominatorPixels,
    });
  };

  const register = (input: Comparison): RealBuildCompiledRegistrationResult => {
    const pixels = exactMaskPixels(input.width, input.height, input.path);
    const expectedBytes = Math.ceil(pixels / 8);
    if (
      input.source.length !== expectedBytes ||
      input.candidate.length !== expectedBytes ||
      (input.excluded !== null && input.excluded.length !== expectedBytes)
    ) {
      throw new RangeError(
        `${input.path} requires packed source, candidate, and exclusion masks of exactly ${expectedBytes} bytes.`,
      );
    }
    const sourceCenter = centroid(input.source, input.width, input.height, `${input.path}.source`);
    const candidateCenter = centroid(
      input.candidate,
      input.width,
      input.height,
      `${input.path}.candidate`,
    );
    let best = { dx: 0, dy: 0, score: 0 };
    if (sourceCenter !== null && candidateCenter !== null) {
      best = {
        dx: Math.round(sourceCenter.x - candidateCenter.x) || 0,
        dy: Math.round(sourceCenter.y - candidateCenter.y) || 0,
        score: 0,
      };
      best.score = agreementAt(input, best.dx, best.dy, REGISTRATION_SAMPLE_STRIDE).score;
      for (const scale of REGISTRATION_SCALES) {
        for (let dy = -REGISTRATION_RADIUS; dy <= REGISTRATION_RADIUS; dy += 1) {
          for (let dx = -REGISTRATION_RADIUS; dx <= REGISTRATION_RADIUS; dx += 1) {
            const candidate = { dx: best.dx + dx * scale, dy: best.dy + dy * scale };
            const score = agreementAt(
              input,
              candidate.dx,
              candidate.dy,
              REGISTRATION_SAMPLE_STRIDE,
            ).score;
            if (score > best.score) best = { ...candidate, score };
          }
        }
      }
    }
    const exact = agreementAt(input, best.dx, best.dy, 1);
    return intrinsicRealBuildFreeze({
      ...exact,
      shiftPx: intrinsicRealBuildFreeze([best.dx || 0, best.dy || 0]) as readonly [number, number],
    });
  };

  const countVisibleSource = (input: {
    readonly source: Uint8Array;
    readonly excluded: Uint8Array | null;
    readonly width: number;
    readonly height: number;
    readonly path: string;
  }): number => {
    charge(input.width, input.height, 1, input.path);
    let count = 0;
    for (let pixel = 0; pixel < input.width * input.height; pixel += 1) {
      if (
        maskBit(input.source, pixel) === 1 &&
        (input.excluded === null || maskBit(input.excluded, pixel) === 0)
      ) {
        count += 1;
      }
    }
    return count;
  };

  return intrinsicRealBuildFreeze({ register, countVisibleSource });
}
