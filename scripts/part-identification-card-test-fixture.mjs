import { deflateSync, crc32 } from "node:zlib";

import { cardHeightForLayout, cardWidthFor, panelBox } from "./part-identification-handedness.mjs";

/**
 * A synthetic vision card carrying a chiral drawing, for suites that need one.
 *
 * Two suites need the same card: the handedness reader's own tests, and the
 * coverage closure's proof that the reader is actually wired into it. One
 * generator serves both, because two copies of a pixel layout drift silently —
 * a card drawn to the wrong rectangle does not throw, it comes back as a hand
 * that could not be read, which looks like a hard card rather than a broken
 * fixture. That is the same reason `CARD_LAYOUT` is declared once and read by
 * both the renderer and the reader.
 *
 * Kept out of any `*.test.mjs` name so vitest does not collect it as a suite.
 */

/** A minimal canonical RGBA PNG, in the exact shape the card guard admits. */
export function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    raw[row * (stride + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + row * stride, stride).copy(
      raw,
      row * (stride + 1) + 1,
    );
  }
  const chunk = (type, body) => {
    const out = Buffer.alloc(body.length + 12);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, "ascii");
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)) >>> 0, 8 + body.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const WHITE = [255, 255, 255];
const GROUND = [140, 148, 148];
const PART = [250, 250, 250];

/**
 * A card carrying one chiral drawing three times: query, its hand, and its mirror.
 *
 * The shape is a right triangle, which has no mirror symmetry at all, drawn at
 * one size in the query panel and a different size in the candidate panels. The
 * scale difference is deliberate: a comparison that only worked at equal print
 * sizes would be useless on real cards, where every panel is rescaled to its own
 * box.
 */
export function chiralCard({
  candidateCount = 2,
  hands = ["right", "left"],
  query = "right",
  symmetric = false,
  blank = false,
} = {}) {
  const width = cardWidthFor(candidateCount);
  const height = cardHeightForLayout();
  const rgba = new Uint8Array(width * height * 4);
  const put = (x, y, [r, g, b]) => {
    const at = (y * width + x) * 4;
    rgba[at] = r;
    rgba[at + 1] = g;
    rgba[at + 2] = b;
    rgba[at + 3] = 0xff;
  };
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) put(x, y, WHITE);
  if (blank) return encodePng(width, height, rgba);

  const draw = (box, tileWidth, tileHeight, hand) => {
    const left = box.left + Math.floor((box.width - tileWidth) / 2);
    const top = box.top + Math.floor((box.height - tileHeight) / 2);
    for (let y = 0; y < tileHeight; y += 1) {
      for (let x = 0; x < tileWidth; x += 1) put(left + x, top + y, GROUND);
    }
    // Inset so the ground stays the tile's commonest colour, which is what the
    // reader separates the part from.
    const shapeWidth = Math.floor(tileWidth * 0.7);
    const shapeHeight = Math.floor(tileHeight * 0.7);
    const shapeLeft = left + Math.floor((tileWidth - shapeWidth) / 2);
    const shapeTop = top + Math.floor((tileHeight - shapeHeight) / 2);
    for (let y = 0; y < shapeHeight; y += 1) {
      const run = symmetric
        ? Math.max(2, Math.round(shapeWidth * (1 - Math.abs(0.5 - y / shapeHeight))))
        : Math.max(2, Math.round(shapeWidth * (1 - y / shapeHeight)));
      const from = symmetric
        ? Math.floor((shapeWidth - run) / 2)
        : hand === "right"
          ? 0
          : shapeWidth - run;
      for (let x = from; x < from + run; x += 1) put(shapeLeft + x, shapeTop + y, PART);
    }
  };

  draw(panelBox(0, candidateCount), 210, 260, query);
  for (let index = 1; index <= candidateCount; index += 1) {
    draw(panelBox(index, candidateCount), 140, 176, hands[index - 1] ?? "right");
  }
  return encodePng(width, height, rgba);
}
