import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAXIMUM_CALIBRATION_CAPTURE_PNG_CHUNKS = 1_024;
const MAXIMUM_CALIBRATION_CAPTURE_PNG_IDAT_CHUNKS = 1_020;

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

function decodeScanlines(
  compressed: Buffer,
  width: number,
  height: number,
  label: string,
): Uint8Array {
  const stride = width * 4;
  const expectedBytes = height * (stride + 1);
  let filtered: Buffer;
  try {
    filtered = inflateSync(compressed, { maxOutputLength: expectedBytes });
  } catch (error) {
    throw new TypeError(
      `${label} PNG IDAT is not a bounded RGBA8 zlib stream for ${width}x${height}.`,
      { cause: error },
    );
  }
  if (filtered.length !== expectedBytes) {
    throw new TypeError(
      `${label} PNG IDAT inflates to ${filtered.length} bytes; ${width}x${height} RGBA8 requires ${expectedBytes}.`,
    );
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filter = filtered[rowStart]!;
    if (filter > 4) {
      throw new TypeError(`${label} PNG row ${y} has invalid filter ${filter}.`);
    }
    for (let x = 0; x < stride; x += 1) {
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
      rgba[target] = (filtered[rowStart + 1 + x]! + predictor) & 0xff;
    }
  }
  return rgba;
}

/** Strictly decodes one lossless, noninterlaced RGBA8 PNG after caller byte preflight. */
export function decodeRealBuildSourceParityCalibrationCapturePng(
  bytes: Uint8Array,
  maximumPixels: number,
  label: string,
): { readonly width: number; readonly height: number; readonly rgba: Uint8Array } {
  const file = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (file.length < 57 || !file.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new TypeError(`${label} PNG signature is absent or the file is truncated.`);
  }
  let offset = 8;
  let chunkIndex = 0;
  let width = 0;
  let height = 0;
  let sawIdat = false;
  let idatClosed = false;
  let sawIend = false;
  const idat: Buffer[] = [];
  while (offset < file.length) {
    if (chunkIndex >= MAXIMUM_CALIBRATION_CAPTURE_PNG_CHUNKS) {
      throw new RangeError(
        `${label} PNG contains more than ${MAXIMUM_CALIBRATION_CAPTURE_PNG_CHUNKS} chunks; reject adversarial chunk splitting.`,
      );
    }
    if (offset + 12 > file.length) {
      throw new TypeError(`${label} PNG chunk at ${offset} is truncated.`);
    }
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    const next = crcOffset + 4;
    if (!/^[A-Za-z]{4}$/u.test(type) || !/[A-Z]/u.test(type[2] ?? "") || next > file.length) {
      throw new TypeError(`${label} PNG ${type} chunk at ${offset} is malformed or overruns.`);
    }
    if (file.readUInt32BE(crcOffset) !== crc32(file.subarray(offset + 4, crcOffset))) {
      throw new TypeError(`${label} PNG ${type} chunk at ${offset} has an invalid CRC.`);
    }
    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13) {
        throw new TypeError(`${label} PNG must begin with one 13-byte IHDR chunk.`);
      }
      width = file.readUInt32BE(dataStart);
      height = file.readUInt32BE(dataStart + 4);
      const pixels = width * height;
      if (
        width === 0 ||
        height === 0 ||
        !Number.isSafeInteger(pixels) ||
        pixels > maximumPixels ||
        file[dataStart + 8] !== 8 ||
        file[dataStart + 9] !== 6 ||
        file[dataStart + 10] !== 0 ||
        file[dataStart + 11] !== 0 ||
        file[dataStart + 12] !== 0
      ) {
        throw new TypeError(
          `${label} PNG IHDR ${width}x${height} must be at most ${maximumPixels} pixels of RGBA8, compression/filter 0, noninterlaced.`,
        );
      }
    } else if (type === "IHDR") {
      throw new TypeError(`${label} PNG contains a second or out-of-order IHDR chunk.`);
    }
    if (type === "IDAT") {
      if (idatClosed) throw new TypeError(`${label} PNG IDAT chunks must be consecutive.`);
      if (idat.length >= MAXIMUM_CALIBRATION_CAPTURE_PNG_IDAT_CHUNKS) {
        throw new RangeError(
          `${label} PNG contains more than ${MAXIMUM_CALIBRATION_CAPTURE_PNG_IDAT_CHUNKS} IDAT chunks; reject adversarial compressed-stream splitting.`,
        );
      }
      sawIdat = true;
      idat.push(file.subarray(dataStart, crcOffset));
    } else if (sawIdat && type !== "IEND") {
      idatClosed = true;
    }
    if (type === "IEND") {
      if (!sawIdat || length !== 0 || next !== file.length || sawIend) {
        throw new TypeError(`${label} PNG IEND is premature, duplicated, or non-terminal.`);
      }
      sawIend = true;
    } else if (/^[A-Z]/u.test(type) && type !== "IHDR" && type !== "IDAT") {
      throw new TypeError(`${label} PNG contains unsupported critical chunk ${type}.`);
    }
    offset = next;
    chunkIndex += 1;
  }
  if (!sawIend || idat.length === 0 || idat.every((chunk) => chunk.length === 0)) {
    throw new TypeError(`${label} PNG has no non-empty IDAT and terminal IEND closure.`);
  }
  return { width, height, rgba: decodeScanlines(Buffer.concat(idat), width, height, label) };
}
