import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAXIMUM_DIAGNOSTIC_PIXELS = 512 * 128;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function decodeRgbaScanlines(compressed: Buffer, width: number, height: number): Uint8Array {
  const stride = width * 4;
  const expectedBytes = height * (stride + 1);
  let filtered: Buffer;
  try {
    filtered = inflateSync(compressed, { maxOutputLength: expectedBytes });
  } catch (error) {
    throw new TypeError(
      `Source-parity PNG IDAT is not a bounded decodable RGBA8 zlib stream for ${width}x${height}.`,
      { cause: error },
    );
  }
  if (filtered.length !== expectedBytes) {
    throw new TypeError(
      `Source-parity PNG IDAT inflates to ${filtered.length} bytes; ${width}x${height} RGBA8 requires exactly ${expectedBytes}.`,
    );
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filter = filtered[rowStart]!;
    if (filter > 4) throw new TypeError(`Source-parity PNG row ${y} has invalid filter ${filter}.`);
    for (let x = 0; x < stride; x += 1) {
      const raw = filtered[rowStart + 1 + x]!;
      const target = y * stride + x;
      const left = x < 4 ? 0 : rgba[target - 4]!;
      const up = y === 0 ? 0 : rgba[target - stride]!;
      const upperLeft = x < 4 || y === 0 ? 0 : rgba[target - stride - 4]!;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? up
              : filter === 3
                ? Math.floor((left + up) / 2)
                : paeth(left, up, upperLeft);
      rgba[target] = (raw + predictor) & 0xff;
    }
  }
  return rgba;
}

export function inspectRealBuildSourceParityPng(bytes: Buffer): {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
} {
  if (bytes.length < 57 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new TypeError("Source-parity PNG signature is absent or the file is truncated.");
  }
  let offset = 8;
  let chunkIndex = 0;
  let width = 0;
  let height = 0;
  let sawIdat = false;
  let idatClosed = false;
  let sawIend = false;
  const idat: Buffer[] = [];
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      throw new TypeError(`Source-parity PNG chunk at ${offset} is truncated.`);
    }
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    const next = crcOffset + 4;
    if (!/^[A-Za-z]{4}$/u.test(type) || !/[A-Z]/u.test(type[2] ?? "") || next > bytes.length) {
      throw new TypeError(
        `Source-parity PNG ${type} chunk at ${offset} is malformed, reserved-bit invalid, or overruns the file.`,
      );
    }
    if (bytes.readUInt32BE(crcOffset) !== crc32(bytes.subarray(offset + 4, crcOffset))) {
      throw new TypeError(`Source-parity PNG ${type} chunk at ${offset} has an invalid CRC.`);
    }
    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13) {
        throw new TypeError("Source-parity PNG must begin with one 13-byte IHDR chunk.");
      }
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      const pixels = width * height;
      if (
        width === 0 ||
        height === 0 ||
        !Number.isSafeInteger(pixels) ||
        pixels > MAXIMUM_DIAGNOSTIC_PIXELS ||
        bytes[dataStart + 8] !== 8 ||
        bytes[dataStart + 9] !== 6 ||
        bytes[dataStart + 10] !== 0 ||
        bytes[dataStart + 11] !== 0 ||
        bytes[dataStart + 12] !== 0
      ) {
        throw new TypeError(
          `Source-parity PNG IHDR ${width}x${height} must be bounded RGBA8, compression/filter 0, noninterlaced.`,
        );
      }
    } else if (type === "IHDR") {
      throw new TypeError("Source-parity PNG contains a second or out-of-order IHDR chunk.");
    }
    if (type === "IDAT") {
      if (idatClosed) throw new TypeError("Source-parity PNG IDAT chunks must be consecutive.");
      sawIdat = true;
      idat.push(bytes.subarray(dataStart, crcOffset));
    } else if (sawIdat && type !== "IEND") {
      idatClosed = true;
    }
    if (type === "IEND") {
      if (!sawIdat || length !== 0 || next !== bytes.length || sawIend) {
        throw new TypeError(
          "Source-parity PNG IEND is premature, duplicated, malformed, or non-terminal.",
        );
      }
      sawIend = true;
    } else if (
      type.charCodeAt(0) >= 65 &&
      type.charCodeAt(0) <= 90 &&
      type !== "IHDR" &&
      type !== "IDAT"
    ) {
      throw new TypeError(`Source-parity PNG contains unsupported critical chunk ${type}.`);
    }
    offset = next;
    chunkIndex += 1;
  }
  if (!sawIend || idat.length === 0 || idat.every((chunk) => chunk.length === 0)) {
    throw new TypeError("Source-parity PNG has no non-empty IDAT and terminal IEND closure.");
  }
  return { width, height, rgba: decodeRgbaScanlines(Buffer.concat(idat), width, height) };
}
