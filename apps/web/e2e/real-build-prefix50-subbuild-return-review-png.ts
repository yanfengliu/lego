import { Buffer } from "node:buffer";
import { constants, deflateSync, inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAXIMUM_CHUNKS = 2_048;
const MAXIMUM_IDAT_CHUNKS = 2_040;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table[value] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: "IHDR" | "IDAT" | "IEND", payload: Uint8Array): Buffer {
  const chunk = Buffer.alloc(12 + payload.byteLength);
  chunk.writeUInt32BE(payload.byteLength, 0);
  chunk.write(type, 4, "ascii");
  Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength).copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + payload.byteLength)), 8 + payload.byteLength);
  return chunk;
}

export function encodeCanonicalRealBuildPrefix50Step44ReviewPng(input: {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8Array;
}): Buffer {
  const pixels = input.width * input.height;
  if (
    !Number.isSafeInteger(input.width) ||
    !Number.isSafeInteger(input.height) ||
    input.width < 1 ||
    input.height < 1 ||
    !Number.isSafeInteger(pixels) ||
    input.rgba.byteLength !== pixels * 4
  )
    throw new TypeError("Step-44 canonical PNG requires exact positive RGBA8 dimensions.");
  const stride = input.width * 4;
  const scanlines = Buffer.alloc(input.height * (stride + 1));
  for (let y = 0; y < input.height; y += 1) {
    const target = y * (stride + 1);
    scanlines[target] = 0;
    Buffer.from(input.rgba.buffer, input.rgba.byteOffset + y * stride, stride).copy(
      scanlines,
      target + 1,
    );
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(input.width, 0);
  header.writeUInt32BE(input.height, 4);
  header[8] = 8;
  header[9] = 6;
  const compressed = deflateSync(scanlines, {
    level: 9,
    memLevel: 9,
    strategy: constants.Z_FIXED,
  });
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
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
  channels: 3 | 4,
  label: string,
): Uint8Array {
  const stride = width * channels;
  const expectedBytes = height * (stride + 1);
  let filtered: Buffer;
  let consumedCompressedBytes: number;
  try {
    const inflated = inflateSync(compressed, {
      info: true as const,
      maxOutputLength: expectedBytes,
    }) as unknown as {
      readonly buffer: Buffer;
      readonly engine: { readonly bytesWritten: number };
    };
    filtered = inflated.buffer;
    consumedCompressedBytes = inflated.engine.bytesWritten;
  } catch (error) {
    throw new TypeError(
      `${label} PNG IDAT is not a bounded RGB8/RGBA8 zlib stream for ${width}x${height}.`,
      { cause: error },
    );
  }
  if (consumedCompressedBytes !== compressed.byteLength)
    throw new TypeError(
      `${label} PNG IDAT zlib stream consumed ${consumedCompressedBytes} of ${compressed.byteLength} compressed bytes; trailing compressed payload is forbidden.`,
    );
  if (filtered.length !== expectedBytes)
    throw new TypeError(
      `${label} PNG IDAT inflates to ${filtered.length} bytes; ${width}x${height} requires ${expectedBytes}.`,
    );
  const decoded = new Uint8Array(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    const filter = filtered[rowStart]!;
    if (filter > 4) throw new TypeError(`${label} PNG row ${y} has invalid filter ${filter}.`);
    for (let x = 0; x < stride; x += 1) {
      const target = y * stride + x;
      const left = x < channels ? 0 : decoded[target - channels]!;
      const up = y === 0 ? 0 : decoded[target - stride]!;
      const upperLeft = x < channels || y === 0 ? 0 : decoded[target - stride - channels]!;
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
      decoded[target] = (filtered[rowStart + 1 + x]! + predictor) & 0xff;
    }
  }
  if (channels === 4) return decoded;
  const rgba = new Uint8Array(width * height * 4);
  for (let source = 0, target = 0; source < decoded.length; source += 3, target += 4) {
    rgba[target] = decoded[source]!;
    rgba[target + 1] = decoded[source + 1]!;
    rgba[target + 2] = decoded[source + 2]!;
    rgba[target + 3] = 255;
  }
  return rgba;
}

export function decodeCanonicalRealBuildPrefix50Step44ReviewPng(
  bytes: Uint8Array,
  maximumPixels: number,
  label: string,
): { readonly width: number; readonly height: number; readonly rgba: Uint8Array } {
  const decoded = decodeRealBuildPrefix50Step44ReviewPng(bytes, maximumPixels, label);
  const canonical = encodeCanonicalRealBuildPrefix50Step44ReviewPng(decoded);
  const supplied = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!supplied.equals(canonical))
    throw new TypeError(
      `${label} is not the exact canonical RGBA8 PNG encoding (IHDR, one IDAT, terminal IEND).`,
    );
  return decoded;
}

export function decodeRealBuildPrefix50Step44ReviewPng(
  bytes: Uint8Array,
  maximumPixels: number,
  label: string,
): { readonly width: number; readonly height: number; readonly rgba: Uint8Array } {
  const file = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (file.length < 57 || !file.subarray(0, 8).equals(PNG_SIGNATURE))
    throw new TypeError(`${label} PNG signature is absent or the file is truncated.`);
  let offset = 8;
  let chunkIndex = 0;
  let width = 0;
  let height = 0;
  let channels: 3 | 4 = 4;
  let sawIdat = false;
  let idatClosed = false;
  let sawIend = false;
  const idat: Buffer[] = [];
  while (offset < file.length) {
    if (chunkIndex >= MAXIMUM_CHUNKS)
      throw new RangeError(`${label} PNG exceeds the ${MAXIMUM_CHUNKS}-chunk limit.`);
    if (offset + 12 > file.length) throw new TypeError(`${label} PNG chunk is truncated.`);
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    const next = crcOffset + 4;
    if (!/^[A-Za-z]{4}$/u.test(type) || next > file.length)
      throw new TypeError(`${label} PNG ${type} chunk is malformed or overruns.`);
    if (file.readUInt32BE(crcOffset) !== crc32(file.subarray(offset + 4, crcOffset)))
      throw new TypeError(`${label} PNG ${type} chunk has an invalid CRC.`);
    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13)
        throw new TypeError(`${label} PNG must begin with one 13-byte IHDR chunk.`);
      width = file.readUInt32BE(dataStart);
      height = file.readUInt32BE(dataStart + 4);
      const pixels = width * height;
      const colorType = file[dataStart + 9];
      channels = colorType === 2 ? 3 : 4;
      if (
        width === 0 ||
        height === 0 ||
        !Number.isSafeInteger(pixels) ||
        pixels > maximumPixels ||
        file[dataStart + 8] !== 8 ||
        (colorType !== 2 && colorType !== 6) ||
        file[dataStart + 10] !== 0 ||
        file[dataStart + 11] !== 0 ||
        file[dataStart + 12] !== 0
      )
        throw new TypeError(
          `${label} PNG IHDR ${width}x${height} must be bounded RGB8/RGBA8, compression/filter 0, noninterlaced.`,
        );
    } else if (type === "IHDR") {
      throw new TypeError(`${label} PNG contains a second IHDR chunk.`);
    }
    if (type === "IDAT") {
      if (idatClosed) throw new TypeError(`${label} PNG IDAT chunks must be consecutive.`);
      if (idat.length >= MAXIMUM_IDAT_CHUNKS)
        throw new RangeError(`${label} PNG exceeds the ${MAXIMUM_IDAT_CHUNKS}-IDAT limit.`);
      sawIdat = true;
      idat.push(file.subarray(dataStart, crcOffset));
    } else if (sawIdat && type !== "IEND") {
      idatClosed = true;
    }
    if (type === "IEND") {
      if (!sawIdat || length !== 0 || next !== file.length || sawIend)
        throw new TypeError(`${label} PNG IEND is premature, duplicated, or non-terminal.`);
      sawIend = true;
    } else if (/^[A-Z]/u.test(type) && type !== "IHDR" && type !== "IDAT") {
      throw new TypeError(`${label} PNG contains unsupported critical chunk ${type}.`);
    }
    offset = next;
    chunkIndex += 1;
  }
  if (!sawIend || idat.length === 0 || idat.every((chunk) => chunk.length === 0))
    throw new TypeError(`${label} PNG has no non-empty IDAT and terminal IEND closure.`);
  return {
    width,
    height,
    rgba: decodeScanlines(Buffer.concat(idat), width, height, channels, label),
  };
}

export function requireExactRealBuildPrefix50Step44ReviewCrop(
  page: { width: number; height: number; rgba: Uint8Array },
  crop: { width: number; height: number; rgba: Uint8Array },
  x: number,
  y: number,
): void {
  if (x < 0 || y < 0 || x + crop.width > page.width || y + crop.height > page.height)
    throw new TypeError("Step-44 panel crop exceeds the retained source-page raster.");
  for (let row = 0; row < crop.height; row += 1) {
    const pageStart = ((y + row) * page.width + x) * 4;
    const cropStart = row * crop.width * 4;
    for (let column = 0; column < crop.width * 4; column += 1)
      if (page.rgba[pageStart + column] !== crop.rgba[cropStart + column])
        throw new TypeError(
          `Step-44 panel crop pixel differs from its source-page raster at row ${row}, byte ${column}.`,
        );
  }
}
