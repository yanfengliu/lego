import { createHash } from "node:crypto";
import { crc32, inflateSync } from "node:zlib";

import { assertBoundedPngDimensions } from "./part-thumbnail-image-guard.mjs";

const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_MULTI_PANEL_PNG_PIXELS = 8 * 1024 * 1024;
const PNG_CHANNELS = new Map([
  [0, 1],
  [2, 3],
  [3, 1],
  [4, 2],
  [6, 4],
]);

export const MAX_MULTI_PANEL_REQUEST_BYTES = 24 * 1024 * 1024;
export const DEFAULT_MULTI_PANEL_BUDGETS = Object.freeze({
  maxModelCalls: 8,
  maxFartherPanels: 7,
  maxImageBytes: 8 * 1024 * 1024,
  maxImagePixels: 64 * 1024 * 1024,
  maxRetainedBytes: 128 * 1024 * 1024,
  maxPromptBytes: 32 * 1024,
  maxBriefBytes: 64 * 1024,
  maxRawResponseBytes: 16 * 1024,
  maxTransportTraceBytes: 32 * 1024 * 1024,
  maxInputTokens: 200_000,
  maxOutputTokens: 2_000,
  maxCostMicrousd: 20_000_000,
  maxWallTimeMs: 15 * 60 * 1_000,
});

export class MultiPanelVisionError extends Error {
  constructor(message) {
    super(message);
    this.name = "MultiPanelVisionError";
  }
}

export const sha256 = (bytes) =>
  `sha256:${createHash("sha256").update(Buffer.from(bytes)).digest("hex")}`;

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => {
          if (value[key] === undefined) {
            throw new MultiPanelVisionError(`Canonical JSON cannot contain undefined at ${key}.`);
          }
          return [key, canonicalValue(value[key])];
        }),
    );
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new MultiPanelVisionError("Canonical JSON cannot contain a non-finite number.");
  }
  return value;
}

export const canonicalJsonBytes = (value) =>
  Buffer.from(JSON.stringify(canonicalValue(value)), "utf8");

export const assertId = (value, label) => {
  if (typeof value !== "string" || !ID.test(value)) {
    throw new MultiPanelVisionError(
      `${label} must be a 1..200 character stable identifier; received ${JSON.stringify(value)}.`,
    );
  }
  return value;
};

export const assertDigest = (value, label) => {
  if (typeof value !== "string" || !DIGEST.test(value)) {
    throw new MultiPanelVisionError(
      `${label} must be a lowercase sha256 digest; received ${JSON.stringify(value)}.`,
    );
  }
  return value;
};

export const assertWhole = (value, label, minimum = 0) => {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new MultiPanelVisionError(
      `${label} must be a safe whole number at least ${minimum}; received ${JSON.stringify(value)}.`,
    );
  }
  return value;
};

export const assertExactKeys = (value, keys, label) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MultiPanelVisionError(`${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.join(",") !== expected.join(",")) {
    throw new MultiPanelVisionError(
      `${label} must contain exactly ${expected.join(", ")}; received ${actual.join(", ") || "no fields"}.`,
    );
  }
};

function pngDimensions(bytes, label) {
  const held = Buffer.from(bytes);
  let dimensions;
  try {
    dimensions = assertBoundedPngDimensions(held, label, {
      maxPixels: MAX_MULTI_PANEL_PNG_PIXELS,
    });
  } catch (cause) {
    throw new MultiPanelVisionError(
      `${label} failed its bounded PNG header: ${cause instanceof Error ? cause.message : String(cause)}.`,
    );
  }
  let offset = PNG_SIGNATURE.length;
  let sawHeader = false;
  let sawPalette = false;
  let sawData = false;
  let dataBytes = 0;
  const dataChunks = [];
  let dataEnded = false;
  let sawEnd = false;
  while (offset < held.length) {
    if (offset + 12 > held.length) {
      throw new MultiPanelVisionError(`${label} ends inside a PNG chunk header at byte ${offset}.`);
    }
    const length = held.readUInt32BE(offset);
    const type = held.toString("ascii", offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (!/^[A-Za-z]{4}$/u.test(type) || end > held.length || end < offset) {
      throw new MultiPanelVisionError(
        `${label} has invalid PNG chunk ${JSON.stringify(type)} length ${length} at byte ${offset}.`,
      );
    }
    const expectedCrc = crc32(held.subarray(offset + 4, offset + 8 + length)) >>> 0;
    if (held.readUInt32BE(offset + 8 + length) !== expectedCrc) {
      throw new MultiPanelVisionError(`${label} ${type} chunk at byte ${offset} failed its CRC.`);
    }
    if (type === "IHDR") {
      if (sawHeader || offset !== PNG_SIGNATURE.length || length !== 13) {
        throw new MultiPanelVisionError(`${label} must begin with exactly one 13-byte IHDR.`);
      }
      sawHeader = true;
    } else if (type === "PLTE") {
      if (!sawHeader || sawPalette || sawData || length === 0 || length % 3 !== 0 || length > 768) {
        throw new MultiPanelVisionError(`${label} has a malformed or out-of-order PLTE chunk.`);
      }
      sawPalette = true;
    } else if (type === "IDAT") {
      if (!sawHeader || dataEnded || sawEnd) {
        throw new MultiPanelVisionError(`${label} IDAT chunks must be consecutive before IEND.`);
      }
      sawData = true;
      dataBytes += length;
      dataChunks.push(held.subarray(offset + 8, offset + 8 + length));
    } else if (type === "IEND") {
      if (!sawData || sawEnd || length !== 0 || end !== held.length) {
        throw new MultiPanelVisionError(
          `${label} must end exactly once with zero-byte IEND after image data and no trailing bytes.`,
        );
      }
      sawEnd = true;
    } else {
      if (!sawHeader || sawEnd || /^[A-Z]/u.test(type)) {
        throw new MultiPanelVisionError(
          `${label} contains unsupported critical or out-of-order PNG chunk ${JSON.stringify(type)}.`,
        );
      }
      if (sawData) dataEnded = true;
    }
    offset = end;
  }
  const colourType = held[25];
  if (!sawHeader || !sawData || dataBytes === 0 || !sawEnd) {
    throw new MultiPanelVisionError(`${label} is incomplete; IHDR, IDAT, and IEND are required.`);
  }
  if (colourType === 3 && !sawPalette) {
    throw new MultiPanelVisionError(
      `${label} declares indexed colour type 3 without the required PLTE palette.`,
    );
  }
  if ((colourType === 0 || colourType === 4) && sawPalette) {
    throw new MultiPanelVisionError(
      `${label} declares grayscale colour type ${colourType}, which forbids a PLTE palette.`,
    );
  }
  const bitDepth = held[24];
  const channels = PNG_CHANNELS.get(colourType);
  if (bitDepth !== 8 || channels === undefined || held[28] !== 0) {
    throw new MultiPanelVisionError(
      `${label} must be an 8-bit non-interlaced PNG in supported colour type 0, 2, 3, 4, or 6; received bit depth ${bitDepth}, colour type ${colourType}, interlace ${held[28]}.`,
    );
  }
  const rowBytes = dimensions.width * channels;
  const expectedInflatedBytes = (rowBytes + 1) * dimensions.height;
  let scanlines;
  try {
    scanlines = inflateSync(Buffer.concat(dataChunks), {
      maxOutputLength: expectedInflatedBytes,
    });
  } catch (cause) {
    throw new MultiPanelVisionError(
      `${label} IDAT data does not decode within its authenticated ${dimensions.width}x${dimensions.height} raster: ${cause instanceof Error ? cause.message : String(cause)}.`,
    );
  }
  if (
    scanlines.length !== expectedInflatedBytes ||
    Array.from({ length: dimensions.height }, (_, row) => scanlines[row * (rowBytes + 1)]).some(
      (filter) => filter > 4,
    )
  ) {
    throw new MultiPanelVisionError(
      `${label} decodes to ${scanlines.length} scanline bytes or an invalid row filter; required ${expectedInflatedBytes} bytes with filters 0..4.`,
    );
  }
  return dimensions;
}

export function boundBytes(bytes, mediaType, label) {
  const held = Buffer.from(bytes);
  if (held.length === 0) throw new MultiPanelVisionError(`${label} contains zero bytes.`);
  const dimensions = mediaType === "image/png" ? pngDimensions(held, label) : null;
  return Object.freeze({
    mediaType,
    byteLength: held.length,
    digest: sha256(held),
    base64: held.toString("base64"),
    ...(dimensions === null ? {} : dimensions),
  });
}

export function verifiedBytes(blob, label) {
  assertExactKeys(
    blob,
    blob?.mediaType === "image/png"
      ? ["mediaType", "byteLength", "digest", "base64", "width", "height"]
      : ["mediaType", "byteLength", "digest", "base64"],
    label,
  );
  if (blob.mediaType !== "image/png" && blob.mediaType !== "text/plain; charset=utf-8") {
    throw new MultiPanelVisionError(
      `${label} has unsupported media type ${JSON.stringify(blob.mediaType)}.`,
    );
  }
  assertWhole(blob.byteLength, `${label}.byteLength`, 1);
  assertDigest(blob.digest, `${label}.digest`);
  if (typeof blob.base64 !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/u.test(blob.base64)) {
    throw new MultiPanelVisionError(`${label}.base64 is not canonical base64 text.`);
  }
  const bytes = Buffer.from(blob.base64, "base64");
  if (bytes.toString("base64") !== blob.base64) {
    throw new MultiPanelVisionError(`${label}.base64 is not a canonical encoding.`);
  }
  if (bytes.length !== blob.byteLength || sha256(bytes) !== blob.digest) {
    throw new MultiPanelVisionError(
      `${label} bytes do not reproduce byteLength ${blob.byteLength} and digest ${blob.digest}.`,
    );
  }
  if (blob.mediaType === "image/png") {
    const dimensions = pngDimensions(bytes, label);
    if (dimensions.width !== blob.width || dimensions.height !== blob.height) {
      throw new MultiPanelVisionError(
        `${label} IHDR dimensions do not match its bound dimensions.`,
      );
    }
  }
  return bytes;
}
