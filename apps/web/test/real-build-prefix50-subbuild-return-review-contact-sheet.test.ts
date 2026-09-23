import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

import { canonicalDigest } from "@lego-studio/brick-kernel";
import { describe, expect, it } from "vitest";

import { realBuildPrefix50Step44BlindIoTestOnly } from "../e2e/real-build-prefix50-subbuild-return-review-blind-io";
import {
  realBuildPrefix50Step44BlindPixelsTestOnly,
  verifyRealBuildPrefix50Step44BlindShortlistPixels,
} from "../e2e/real-build-prefix50-subbuild-return-review-blind-pixels";
import type { RealBuildPrefix50Step44BlindReviewPacket } from "../e2e/real-build-prefix50-subbuild-return-review-blind-contract";
import { realBuildPrefix50Step44BlindPublicScanTestOnly } from "../e2e/real-build-prefix50-subbuild-return-review-blind-public-scan";
import {
  fitRealBuildPrefix50Step44ContainedRect,
  requireRealBuildPrefix50Step44SeparatedReviewRoots,
} from "../e2e/real-build-prefix50-subbuild-return-review-contact-sheet";
import {
  decodeRealBuildPrefix50Step44ReviewPng,
  encodeCanonicalRealBuildPrefix50Step44ReviewPng,
} from "../e2e/real-build-prefix50-subbuild-return-review-png";

const PNG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1)
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table[value] = crc >>> 0;
  }
  return table;
})();

function pngChunk(type: string, payload: Uint8Array): Buffer {
  const chunk = Buffer.alloc(12 + payload.byteLength);
  chunk.writeUInt32BE(payload.byteLength, 0);
  chunk.write(type, 4, "ascii");
  Buffer.from(payload).copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, 8 + payload.byteLength))
    crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 8 + payload.byteLength);
  return chunk;
}

function locateIdat(bytes: Buffer): { readonly offset: number; readonly payload: Buffer } {
  let offset = 8;
  while (offset < bytes.byteLength) {
    const length = bytes.readUInt32BE(offset);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "IDAT")
      return { offset, payload: bytes.subarray(offset + 8, offset + 8 + length) };
    offset += 12 + length;
  }
  throw new TypeError("Test PNG has no IDAT chunk.");
}

function replaceIdat(bytes: Buffer, replacement: readonly Buffer[]): Buffer {
  const idat = locateIdat(bytes);
  return Buffer.concat([
    bytes.subarray(0, idat.offset),
    ...replacement.map((payload) => pngChunk("IDAT", payload)),
    bytes.subarray(idat.offset + 12 + idat.payload.byteLength),
  ]);
}

function digest(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function png(fill: string): Buffer {
  if (!/^#[0-9a-f]{6}$/iu.test(fill)) throw new TypeError("Test fill must be #rrggbb.");
  const rgba = new Uint8Array(4 * 2 * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) {
    rgba[offset] = Number.parseInt(fill.slice(1, 3), 16);
    rgba[offset + 1] = Number.parseInt(fill.slice(3, 5), 16);
    rgba[offset + 2] = Number.parseInt(fill.slice(5, 7), 16);
    rgba[offset + 3] = 255;
  }
  return encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width: 4, height: 2, rgba });
}

function pngFromRgba(width: number, height: number, rgba: Uint8Array): Buffer {
  return encodeCanonicalRealBuildPrefix50Step44ReviewPng({ width, height, rgba });
}

function commit<T extends object>(body: T): T & { readonly commitment: `sha256:${string}` } {
  return { ...body, commitment: canonicalDigest(body) };
}

describe("prefix-50 Step-44 promotion-safe contact-sheet boundaries", () => {
  it("preserves comparison geometry with centered letterboxing", () => {
    expect(
      fitRealBuildPrefix50Step44ContainedRect({
        sourceWidth: 720,
        sourceHeight: 470,
        x: 320,
        y: 6,
        width: 144,
        height: 108,
      }),
    ).toEqual({ x: 320, y: 13, width: 144, height: 94 });
    expect(
      fitRealBuildPrefix50Step44ContainedRect({
        sourceWidth: 640,
        sourceHeight: 480,
        x: 320,
        y: 6,
        width: 144,
        height: 108,
      }),
    ).toEqual({ x: 320, y: 6, width: 144, height: 108 });
  });

  it("requires physically separate public and withheld sibling trees", async () => {
    const root = await mkdtemp(join(tmpdir(), "lego-step44-review-tree-"));
    try {
      const publicOutputPath = resolve(root, "public");
      const withheldOutputPath = resolve(root, "withheld");
      await mkdir(publicOutputPath);
      await mkdir(withheldOutputPath);
      await expect(
        requireRealBuildPrefix50Step44SeparatedReviewRoots({
          publicOutputPath,
          withheldOutputPath,
        }),
      ).resolves.toBeUndefined();
      await expect(
        requireRealBuildPrefix50Step44SeparatedReviewRoots({
          publicOutputPath,
          withheldOutputPath: publicOutputPath,
        }),
      ).rejects.toThrow(/distinct sibling public\/ and withheld\/ roots/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reopens public PNG bytes and rejects a valid replacement with different pixels", async () => {
    const root = await mkdtemp(join(tmpdir(), "lego-step44-public-png-"));
    try {
      const artifactPath = "B001/canonical-isometric.png";
      await mkdir(resolve(root, "B001"));
      const original = png("#112233");
      const decoded = decodeRealBuildPrefix50Step44ReviewPng(
        original,
        8,
        "synthetic Step-44 public PNG",
      );
      await writeFile(resolve(root, artifactPath), original);
      const expectation = {
        publicRoot: root,
        artifactPath,
        expectedPngDigest: digest(original),
        expectedPixelDigest: digest(decoded.rgba),
        expectedWidth: 4,
        expectedHeight: 2,
        label: "synthetic Step-44 public PNG",
      };
      expect(() =>
        realBuildPrefix50Step44BlindIoTestOnly.verifyPublicPng(expectation),
      ).not.toThrow();
      await writeFile(resolve(root, artifactPath), png("#445566"));
      expect(() => realBuildPrefix50Step44BlindIoTestOnly.verifyPublicPng(expectation)).toThrow(
        /bytes, decoded pixels, or dimensions drifted/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects CRC-valid trailing IDAT payloads and noncanonical metadata/chunk layouts", () => {
    const original = png("#123456");
    expect(() =>
      realBuildPrefix50Step44BlindPublicScanTestOnly.requireSafePngChunks(original),
    ).not.toThrow();
    const idat = locateIdat(original);
    const trailingPayload = replaceIdat(original, [
      Buffer.concat([idat.payload, deflateSync(Buffer.from("forbidden-trailer"))]),
    ]);
    expect(() =>
      decodeRealBuildPrefix50Step44ReviewPng(trailingPayload, 8, "trailing-IDAT test PNG"),
    ).toThrow(/trailing compressed payload is forbidden/u);
    expect(() =>
      realBuildPrefix50Step44BlindPublicScanTestOnly.requireSafePngChunks(trailingPayload),
    ).toThrow(/trailing compressed payload is forbidden/u);

    const split = Math.max(1, Math.floor(idat.payload.byteLength / 2));
    const splitIdat = replaceIdat(original, [
      idat.payload.subarray(0, split),
      idat.payload.subarray(split),
    ]);
    expect(() =>
      decodeRealBuildPrefix50Step44ReviewPng(splitIdat, 8, "split-IDAT test PNG"),
    ).not.toThrow();
    expect(() =>
      realBuildPrefix50Step44BlindPublicScanTestOnly.requireSafePngChunks(splitIdat),
    ).toThrow(/not the exact canonical RGBA8 PNG encoding/u);

    const textChunk = pngChunk("tEXt", Buffer.from("Comment\0opaque-identity"));
    const withMetadata = Buffer.concat([
      original.subarray(0, original.byteLength - 12),
      textChunk,
      original.subarray(original.byteLength - 12),
    ]);
    expect(() =>
      realBuildPrefix50Step44BlindPublicScanTestOnly.requireSafePngChunks(withMetadata),
    ).toThrow(/not the exact canonical RGBA8 PNG encoding/u);
  });

  it("reopens the shared baseline, after, and delta and recomputes exact delta pixels", async () => {
    const root = await mkdtemp(join(tmpdir(), "lego-step44-public-delta-"));
    try {
      const width = 720;
      const height = 470;
      const rgbaBytes = width * height * 4;
      const baselineRgba = new Uint8Array(rgbaBytes);
      for (let offset = 0; offset < rgbaBytes; offset += 4) {
        baselineRgba[offset] = 0x20;
        baselineRgba[offset + 1] = 0x30;
        baselineRgba[offset + 2] = 0x40;
        baselineRgba[offset + 3] = 0xff;
      }
      const afterRgba = baselineRgba.slice();
      afterRgba[0] = 0x21;
      const measured = realBuildPrefix50Step44BlindPixelsTestOnly.recomputeDelta(
        baselineRgba,
        afterRgba,
      );
      const baselineBytes = pngFromRgba(width, height, baselineRgba);
      const afterBytes = pngFromRgba(width, height, afterRgba);
      const deltaBytes = pngFromRgba(width, height, measured.rgba);
      await mkdir(resolve(root, "B001"));
      const baselinePath = "real-build-prefix50-step43-page45-fixed-camera-baseline.png";
      const afterPath = "B001/page45-matched-after.png";
      const deltaPath = "B001/page45-fixed-camera-delta.png";
      await writeFile(resolve(root, baselinePath), baselineBytes);
      await writeFile(resolve(root, afterPath), afterBytes);
      await writeFile(resolve(root, deltaPath), deltaBytes);
      const baseline = commit({
        schemaVersion: "lego.real-build-prefix50-step43-blind-fixed-camera-baseline/1" as const,
        authority: "none" as const,
        sourceSetId: "6651557" as const,
        scene: "model-only" as const,
        completedPrintedStep: 43 as const,
        artifactPath: baselinePath as "real-build-prefix50-step43-page45-fixed-camera-baseline.png",
        page45CameraReceiptCommitment: digest(Buffer.from("receipt")),
        cameraCommitment: digest(Buffer.from("camera")),
        fixedCameraBaselineCommitment: digest(Buffer.from("baseline-frame")),
        fixedCameraBaselineArtifactCommitment: digest(Buffer.from("baseline-artifact")),
        width: 720 as const,
        height: 470 as const,
        pngByteLength: baselineBytes.byteLength,
        pngDigest: digest(baselineBytes),
        pixelDigest: digest(baselineRgba),
      });
      const afterCell = commit({
        blindId: "B001" as const,
        fixtureKey: "page45MatchedAfter",
        canonicalViewName: "page45-matched-after",
        artifactPath: afterPath,
        sourcePngDigest: digest(afterBytes),
        sourcePixelDigest: digest(afterRgba),
        sourceWidth: 720,
        sourceHeight: 470,
        cameraCommitment: baseline.cameraCommitment,
        sourceBindingCommitment: digest(Buffer.from("after-binding")),
      });
      const fixedBody = {
        page45CameraReceiptCommitment: baseline.page45CameraReceiptCommitment,
        fixedCameraBaselineCommitment: baseline.fixedCameraBaselineCommitment,
        baselinePngDigest: baseline.pngDigest,
        baselinePixelDigest: baseline.pixelDigest,
        fixedCameraAfterCommitment: digest(Buffer.from("after-frame")),
        afterPngDigest: afterCell.sourcePngDigest,
        afterPixelDigest: afterCell.sourcePixelDigest,
        fixedCameraDeltaCommitment: digest(Buffer.from("delta-measurement")),
        fixedCameraDeltaArtifactCommitment: digest(Buffer.from("delta-artifact")),
        deltaArtifactPath: deltaPath,
        deltaPngDigest: digest(deltaBytes),
        deltaPixelDigest: digest(measured.rgba),
        deltaWidth: 720 as const,
        deltaHeight: 470 as const,
        changedPixelCount: measured.changedPixelCount,
        changedPixelBounds: measured.changedPixelBounds,
      };
      const fixedCameraEvidence = commit(fixedBody);
      const packet = {
        commitment: digest(Buffer.from("packet")),
        fixedCameraBaseline: baseline,
        pages: [
          {
            rows: [{ blindId: "B001", cells: [afterCell], fixedCameraEvidence }],
          },
        ],
      } as unknown as RealBuildPrefix50Step44BlindReviewPacket;
      expect(
        verifyRealBuildPrefix50Step44BlindShortlistPixels({
          publicRoot: root,
          packet,
          blindIds: ["B001"],
        }).rows[0],
      ).toMatchObject({ changedPixelCount: 1, changedPixelBounds: { minX: 0, minY: 0 } });

      const replacedBaseline = baselineRgba.slice();
      replacedBaseline[4] = 0x99;
      await writeFile(resolve(root, baselinePath), pngFromRgba(width, height, replacedBaseline));
      expect(() =>
        verifyRealBuildPrefix50Step44BlindShortlistPixels({
          publicRoot: root,
          packet,
          blindIds: ["B001"],
        }),
      ).toThrow(/baseline bytes or pixels drifted/u);
      await writeFile(resolve(root, baselinePath), baselineBytes);

      const wrongDeltaRgba = measured.rgba.slice();
      wrongDeltaRgba[0] = 0x35;
      const wrongDeltaBytes = pngFromRgba(width, height, wrongDeltaRgba);
      await writeFile(resolve(root, deltaPath), wrongDeltaBytes);
      const wrongFixedEvidence = commit({
        ...fixedBody,
        deltaPngDigest: digest(wrongDeltaBytes),
        deltaPixelDigest: digest(wrongDeltaRgba),
      });
      const wrongPacket = {
        ...packet,
        pages: [
          {
            rows: [
              {
                blindId: "B001",
                cells: [afterCell],
                fixedCameraEvidence: wrongFixedEvidence,
              },
            ],
          },
        ],
      } as unknown as RealBuildPrefix50Step44BlindReviewPacket;
      expect(() =>
        verifyRealBuildPrefix50Step44BlindShortlistPixels({
          publicRoot: root,
          packet: wrongPacket,
          blindIds: ["B001"],
        }),
      ).toThrow(/was not recomputed/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
});
