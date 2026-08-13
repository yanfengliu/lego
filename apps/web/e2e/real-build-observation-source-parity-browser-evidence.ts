import { packRealBuildCompiledBinaryMaskMsb } from "./real-build-compiled-observation-registration";
import {
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_BYTES,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_CAPTURE_ROWS,
  REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_ROWS,
} from "./real-build-observation-source-parity-contract";
import type {
  RealBuildSourceParityCapture,
  RealBuildSourceParityPackedEvidence,
} from "./real-build-observation-source-parity-types";

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const MAXIMUM_CAPTURE_BYTES = 512 * 1024;
const MAXIMUM_CAPTURE_DATA_URL_CHARACTERS = 700_000;
const MAXIMUM_AGGREGATE_CAPTURE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_AGGREGATE_CAPTURE_CHARACTERS = 90 * 1024 * 1024;
const MAXIMUM_PACKED_EVIDENCE_BYTES = 128 * 1024;
const MAXIMUM_AGGREGATE_PACKED_EVIDENCE_BYTES = REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_BYTES;

export interface RealBuildSourceParityBrowserEvidenceLimits {
  readonly maximumCaptureBytes: number;
  readonly maximumCaptureDataUrlCharacters: number;
  readonly maximumAggregateCaptureBytes: number;
  readonly maximumAggregateCaptureCharacters: number;
  readonly maximumPackedEvidenceBytes: number;
  readonly maximumAggregatePackedEvidenceBytes: number;
}

export const REAL_BUILD_SOURCE_PARITY_BROWSER_EVIDENCE_LIMITS = Object.freeze({
  maximumCaptureBytes: MAXIMUM_CAPTURE_BYTES,
  maximumCaptureDataUrlCharacters: MAXIMUM_CAPTURE_DATA_URL_CHARACTERS,
  maximumAggregateCaptureBytes: MAXIMUM_AGGREGATE_CAPTURE_BYTES,
  maximumAggregateCaptureCharacters: MAXIMUM_AGGREGATE_CAPTURE_CHARACTERS,
  maximumPackedEvidenceBytes: MAXIMUM_PACKED_EVIDENCE_BYTES,
  maximumAggregatePackedEvidenceBytes: MAXIMUM_AGGREGATE_PACKED_EVIDENCE_BYTES,
});

const bytesToBase64 = (bytes: Uint8Array): string => {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + 0x8000))),
    );
  }
  return btoa(chunks.join(""));
};

export async function sourceParityBrowserDigest(bytes: Uint8Array): Promise<string> {
  const snapshot = Uint8Array.from(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", snapshot.buffer));
  return `sha256:${[...digest].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function decodeCanonicalPngDataUrl(value: string): Uint8Array {
  if (
    !value.startsWith(PNG_DATA_URL_PREFIX) ||
    value.length > MAXIMUM_CAPTURE_DATA_URL_CHARACTERS
  ) {
    throw new RangeError(
      `Source-parity diagnostic PNG must be a data URL of at most ${MAXIMUM_CAPTURE_DATA_URL_CHARACTERS} characters.`,
    );
  }
  const encoded = value.slice(PNG_DATA_URL_PREFIX.length);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded)) {
    throw new TypeError("Source-parity diagnostic PNG must contain canonical base64.");
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (bytesToBase64(bytes) !== encoded) {
    throw new TypeError("Source-parity diagnostic PNG base64 does not round-trip canonically.");
  }
  return bytes;
}

/** @internal Page-local producer seam. Inputs are snapshotted before hashing or retention. */
export function createRealBuildSourceParityBrowserEvidenceRegistry(
  suppliedLimits: Partial<RealBuildSourceParityBrowserEvidenceLimits> = {},
): {
  readonly registerCapture: (png: string, width: number, height: number) => Promise<string>;
  readonly registerPackedMask: (mask: Uint8Array, width: number, height: number) => Promise<string>;
  readonly finish: () => {
    readonly captures: readonly RealBuildSourceParityCapture[];
    readonly packedEvidence: readonly RealBuildSourceParityPackedEvidence[];
  };
} {
  const hard = REAL_BUILD_SOURCE_PARITY_BROWSER_EVIDENCE_LIMITS;
  const limits = Object.fromEntries(
    Object.entries(hard).map(([key, maximum]) => {
      const supplied = suppliedLimits[key as keyof typeof hard];
      if (
        supplied !== undefined &&
        (!Number.isSafeInteger(supplied) || supplied < 0 || supplied > maximum)
      ) {
        throw new RangeError(
          `Source-parity browser evidence limit ${key} must be a safe integer from 0 through ${maximum}.`,
        );
      }
      return [key, supplied ?? maximum];
    }),
  ) as unknown as RealBuildSourceParityBrowserEvidenceLimits;
  const captures = new Map<string, RealBuildSourceParityCapture>();
  const packedEvidence = new Map<string, RealBuildSourceParityPackedEvidence>();
  let captureBytes = 0;
  let captureCharacters = 0;
  let packedBytes = 0;

  return {
    registerCapture: async (png, width, height) => {
      const bytes = decodeCanonicalPngDataUrl(png);
      if (bytes.length > limits.maximumCaptureBytes) {
        throw new RangeError(
          `Source-parity diagnostic PNG has ${bytes.length} bytes, exceeding ${limits.maximumCaptureBytes}.`,
        );
      }
      const digest = await sourceParityBrowserDigest(bytes);
      const existing = captures.get(digest);
      if (existing !== undefined) {
        if (existing.png !== png || existing.width !== width || existing.height !== height) {
          throw new TypeError(
            `Source-parity diagnostic digest ${digest} was reused for different bytes or dimensions.`,
          );
        }
        return digest;
      }
      const nextBytes = captureBytes + bytes.length;
      const nextCharacters = captureCharacters + png.length;
      if (
        nextBytes > limits.maximumAggregateCaptureBytes ||
        nextCharacters > limits.maximumAggregateCaptureCharacters ||
        captures.size >= REAL_BUILD_SOURCE_PARITY_MAXIMUM_CAPTURE_ROWS
      ) {
        throw new RangeError(
          `Unique source-parity diagnostics would retain ${nextBytes} bytes/${nextCharacters} data-URL characters/${captures.size + 1} rows, exceeding ${limits.maximumAggregateCaptureBytes}/${limits.maximumAggregateCaptureCharacters}/${REAL_BUILD_SOURCE_PARITY_MAXIMUM_CAPTURE_ROWS}.`,
        );
      }
      captureBytes = nextBytes;
      captureCharacters = nextCharacters;
      captures.set(digest, { digest, width, height, png });
      return digest;
    },
    registerPackedMask: async (mask, width, height) => {
      const packed = packRealBuildCompiledBinaryMaskMsb(Uint8Array.from(mask), width, height);
      if (packed.length > limits.maximumPackedEvidenceBytes) {
        throw new RangeError(
          `Source-parity packed evidence has ${packed.length} bytes, exceeding ${limits.maximumPackedEvidenceBytes}.`,
        );
      }
      const packedDigest = await sourceParityBrowserDigest(packed);
      const base64 = bytesToBase64(packed);
      const pixelCount = width * height;
      const lowPaddingBits = (8 - (pixelCount & 7)) & 7;
      const existing = packedEvidence.get(packedDigest);
      if (existing !== undefined) {
        if (
          existing.base64 !== base64 ||
          existing.byteLength !== packed.length ||
          existing.pixelCount !== pixelCount ||
          existing.lowPaddingBits !== lowPaddingBits
        ) {
          throw new TypeError(
            `Source-parity packed digest ${packedDigest} was reused for different bytes.`,
          );
        }
        return packedDigest;
      }
      const nextBytes = packedBytes + packed.length;
      if (
        nextBytes > limits.maximumAggregatePackedEvidenceBytes ||
        packedEvidence.size >= REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_ROWS
      ) {
        throw new RangeError(
          `Unique source-parity packed evidence would retain ${nextBytes} bytes/${packedEvidence.size + 1} rows, exceeding ${limits.maximumAggregatePackedEvidenceBytes}/${REAL_BUILD_SOURCE_PARITY_MAXIMUM_PACKED_ROWS}.`,
        );
      }
      packedBytes = nextBytes;
      packedEvidence.set(packedDigest, {
        packedDigest,
        pixelCount,
        byteLength: packed.length,
        lowPaddingBits,
        base64,
      });
      return packedDigest;
    },
    finish: () => ({
      captures: [...captures.values()].sort((left, right) =>
        left.digest.localeCompare(right.digest),
      ),
      packedEvidence: [...packedEvidence.values()].sort((left, right) =>
        left.packedDigest.localeCompare(right.packedDigest),
      ),
    }),
  };
}
