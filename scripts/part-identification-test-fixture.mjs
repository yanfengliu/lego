import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

import {
  PART_DISTANCES_SCHEMA,
  PART_FEATURES_SCHEMA,
  PART_MATCH_SCHEMA,
  jsonArtifactFromBytes,
  sha256Digest,
} from "./part-identification-artifacts.mjs";
import { claimsFor } from "./part-identification-score.mjs";
import { clusterCallouts } from "./part-identification.mjs";

/**
 * Shared synthetic evidence for the part-identification suites.
 *
 * Kept out of any `*.test.mjs` name on purpose: vitest only collects
 * `scripts/**\/*.test.mjs`, so this file is a fixture library rather than a
 * suite that would run its own describes once per importer.
 */

export const RUN_ID = "0123456789abcdef01234567";
export const digest = (label) => sha256Digest(label);

/** A bare 33-byte PNG prefix: enough for a header check, never a decodable image. */
export function pngHeader(width = 1, height = 1) {
  const header = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write("IHDR", 12, "ascii");
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header[24] = 8;
  header[25] = 6;
  header[26] = 0;
  header[27] = 0;
  header[28] = 0;
  header.writeUInt32BE(crc32(header.subarray(12, 29)) >>> 0, 29);
  return header;
}

export function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])) >>> 0, 8 + data.length);
  return chunk;
}

export function canonicalPng(width = 1, height = 1, fill = 0) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height, fill);
  for (let row = 0; row < height; row += 1) rows[row * (width * 4 + 1)] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** An image with actual ink, so crop-to-content and card rendering have something to find. */
export function twoTonePng(width = 4, height = 4) {
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    for (let x = 0; x < width; x += 1) {
      const at = row + 1 + x * 4;
      const foreground = x >= 1 && x <= 2 && y >= 1 && y <= 2;
      rows[at] = foreground ? 0 : 255;
      rows[at + 1] = foreground ? 0 : 255;
      rows[at + 2] = foreground ? 0 : 255;
      rows[at + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(rows)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function descriptor(seed, pixels) {
  const grid = Array(28 * 28).fill(0);
  const detail = Array(28 * 28).fill(0);
  grid[seed] = 255;
  detail[seed] = seed === 0 ? 10 : 240;
  const boxWidth = 2;
  const boxHeight = seed === 0 ? 2 : 1;
  const boundedPixels = Math.max(1, Math.min(pixels, boxWidth * boxHeight));
  return {
    grid,
    detail,
    aspect: boxWidth / boxHeight,
    ink: boundedPixels / (boxWidth * boxHeight),
    pixels: boundedPixels,
    boxWidth,
    boxHeight,
    mean: seed === 0 ? [10, 10, 10] : [240, 240, 240],
    lightFace: seed === 0 ? 20 : 250,
    colours: [{ rgb: seed === 0 ? [8, 8, 8] : [248, 248, 248], share: 1 }],
  };
}

export function physical(identity, seed, pixels) {
  return {
    identity,
    file: `${identity}.png`,
    quantity: 1,
    evidenceKind: "part-art",
    descriptor: descriptor(seed, pixels),
  };
}

export function assignmentByIdentity(callouts) {
  const clusters = clusterCallouts(callouts).map((cluster, clusterIndex) => ({
    ...cluster,
    clusterIndex,
    candidates: [{ elementId: String(300_501 + clusterIndex), total: 0 }],
  }));
  const claims = claimsFor({ clusters }, { elementIds: [], rows: [] }, "deterministic", null, {
    assign: "nearest",
  });
  return Object.fromEntries(
    [...claims].map(([index, claim]) => [callouts[index].identity, claim.elementId]).sort(),
  );
}

export function boundCallout() {
  return {
    identity: "p11|q1|x43.074|y486.271",
    file: `runs/${RUN_ID}/p11-q1-x43d074-y486d271.png`,
    pageNumber: 11,
    stepNumber: 1,
    quantity: 1,
    xPt: 43.074,
    yPt: 486.271,
    evidenceKind: "part-art",
    sha256: digest("crop"),
    descriptor: descriptor(0, 1),
  };
}

export function writeArtifact(path, value) {
  const artifact = jsonArtifactFromBytes(Buffer.from(JSON.stringify(value)), `fixture ${path}`);
  writeFileSync(path, artifact.bytes);
  return artifact;
}

/** One callout, one element, one cluster: the smallest closure the readers accept. */
export function writeIdentificationClosure(directory) {
  const callout = boundCallout();
  const featuresArtifact = writeArtifact(join(directory, "features.json"), {
    schemaVersion: PART_FEATURES_SCHEMA,
    inputDigests: { pdf: digest("pdf"), calloutManifest: digest("manifest") },
    manifestCalloutCount: 1,
    calloutCount: 1,
    nonClusteredCalloutCount: 0,
    nonClusteredCallouts: [],
    inventory: { 300501: descriptor(0, 1) },
    inventorySourceDigests: { 300501: digest("inventory") },
    callouts: [callout],
  });
  const matchArtifact = writeArtifact(join(directory, "match.json"), {
    schemaVersion: PART_MATCH_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    calloutCount: 1,
    clusterCount: 1,
    clusters: [
      {
        clusterIndex: 0,
        lead: callout.file,
        members: [0],
        pieces: 1,
        candidates: [{ elementId: "300501", total: 0.1 }],
      },
    ],
  });
  writeArtifact(join(directory, "distances.json"), {
    schemaVersion: PART_DISTANCES_SCHEMA,
    featuresDigest: featuresArtifact.digest,
    elementIds: ["300501"],
    rows: [[0.1]],
  });
  return { featuresArtifact, matchArtifact };
}

export function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
