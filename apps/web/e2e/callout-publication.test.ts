import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  CALLOUT_PUBLICATION_LIMITS,
  inspectPng,
  publishCalloutRun,
  type PreparedCrop,
  type PublishCalloutRunInput,
} from "./callout-publication";
import type { CalloutManifest, PublishedCallout, RecoveryBenchmark } from "./callout-types";

const roots: string[] = [];
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function hash(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function root(): string {
  const path = mkdtempSync(join(tmpdir(), "lego-callout-publication-"));
  roots.push(path);
  return path;
}

function benchmark(): RecoveryBenchmark {
  return {
    schemaVersion: "lego.callout-recovery-benchmark-result/1",
    fixtureSourceHash: "sha256:fixture",
    fixedFailureClassSize: 1,
    observedLegacyFailureIdentities: ["p11|q1|x1.000|y1.000"],
    scores: [],
    selected: "evidence-aware",
    winner: "evidence-aware",
    winningMargin: 1,
  };
}

function input(
  outDirectory: string,
  runId = "a".repeat(24),
  overrides: Partial<PublishedCallout> = {},
): PublishCalloutRunInput {
  const metadata: PublishedCallout = {
    identity: "p11|q1|x1.000|y1.000",
    fileName: "p11-q1-x1d000-y1d000.png",
    pageNumber: 11,
    stepNumber: 1,
    quantity: 1,
    xPt: 1,
    yPt: 1,
    heightPt: 8,
    boxMethod: "vector-smallest",
    box: { minXPt: 0, minYPt: 0, maxXPt: 10, maxYPt: 10 },
    evidenceKind: "part-art",
    regionKind: "isolated-component",
    cropStrategy: "ranked-component",
    masksApplied: ["all-pdf-text"],
    contamination: [],
    sha256: hash(PNG),
    byteLength: PNG.length,
    widthPx: 1,
    heightPx: 1,
    foregroundPixels: 1,
    sourceTextGlyphPixels: 0,
    sourceQuantityGlyphPixels: 0,
    textGlyphOverlapPixels: 0,
    quantityGlyphOverlapPixels: 0,
    quantityGlyphPixelsMasked: 0,
    cropRectPx: { left: 0, top: 0, right: 0, bottom: 0 },
    boundaryClearancePx: { left: 0, top: 0, right: 0, bottom: 0 },
    ...overrides,
  };
  const crops: PreparedCrop[] = [{ metadata, png: PNG }];
  const { fileName, ...manifestMetadata } = metadata;
  const manifest: CalloutManifest = {
    schemaVersion: "lego.callout-thumbnails/5",
    sourceHash: "sha256:source",
    pageSelection: [11],
    pagesCropped: 1,
    calloutCount: 1,
    accounting: {
      rawNxIdentityCount: 1,
      rawNxQuantityTotal: 1,
      physicalPartArtIdentityCount: 1,
      physicalPartArtQuantityTotal: 1,
      semanticIdentityCount: 0,
      semanticQuantityTotal: 0,
    },
    recoveryBenchmark: benchmark(),
    conservation: { expectedIdentityCount: 1, publishedIdentityCount: 1 },
    failures: [],
    callouts: [{ ...manifestMetadata, file: `runs/${runId}/${fileName}` }],
  };
  return { outDirectory, pointerFile: "manifest.json", runId, manifest, crops };
}

afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("callout publication", () => {
  it("validates PNG signature, IHDR, and exact IEND closure", () => {
    expect(inspectPng(PNG)).toEqual({ width: 1, height: 1 });
    expect(() => inspectPng(Buffer.concat([PNG, Buffer.from([0])]))).toThrow(/trailing bytes/);
    expect(() => inspectPng(Buffer.from(PNG.subarray(1)))).toThrow(/signature/);
  });

  it("reuses only a byte-identical closed run", () => {
    const directory = root();
    expect(publishCalloutRun(input(directory)).reused).toBe(false);
    expect(publishCalloutRun(input(directory)).reused).toBe(true);
  });

  it("rejects empty, oversized, or internally inconsistent candidates before pointer mutation", () => {
    const directory = root();
    const pointer = join(directory, "manifest.json");
    writeFileSync(pointer, "old-pointer\n", { flag: "wx" });
    const prepared = input(directory);
    const oversized = Buffer.alloc(CALLOUT_PUBLICATION_LIMITS.maxCropBytes + 1);
    expect(() =>
      publishCalloutRun({
        ...prepared,
        crops: [
          {
            metadata: {
              ...prepared.crops[0]!.metadata,
              byteLength: oversized.length,
              sha256: hash(oversized),
            },
            png: oversized,
          },
        ],
      }),
    ).toThrow(/each crop/);
    expect(() =>
      publishCalloutRun({
        ...prepared,
        manifest: {
          ...prepared.manifest,
          callouts: [{ ...prepared.manifest.callouts[0]!, widthPx: 2 }],
        },
      }),
    ).toThrow(/differs from its staged PNG record/);
    expect(() =>
      publishCalloutRun({
        ...prepared,
        manifest: { ...prepared.manifest, calloutCount: 0, callouts: [] },
        crops: [],
      }),
    ).toThrow(/cannot publish an empty/);
    expect(readFileSync(pointer, "utf8")).toBe("old-pointer\n");
  });

  it("leaves the pointer unchanged when an existing manifest is tampered", () => {
    const directory = root();
    const prepared = input(directory);
    publishCalloutRun(prepared);
    const pointer = join(directory, "manifest.json");
    writeFileSync(pointer, "old-pointer\n");
    appendFileSync(join(directory, "runs", prepared.runId, "manifest.json"), "tamper");
    expect(() => publishCalloutRun(prepared)).toThrow(/not byte-identical/);
    expect(readFileSync(pointer, "utf8")).toBe("old-pointer\n");
  });

  it("leaves the pointer unchanged when an existing PNG is missing or changed", () => {
    for (const mode of ["missing", "tampered"] as const) {
      const directory = root();
      const prepared = input(directory);
      publishCalloutRun(prepared);
      const pointer = join(directory, "manifest.json");
      writeFileSync(pointer, `old-${mode}\n`);
      const pngPath = join(directory, "runs", prepared.runId, prepared.crops[0]!.metadata.fileName);
      if (mode === "missing") unlinkSync(pngPath);
      else appendFileSync(pngPath, "tamper");
      expect(() => publishCalloutRun(prepared)).toThrow();
      expect(readFileSync(pointer, "utf8")).toBe(`old-${mode}\n`);
    }
  });

  it("leaves the pointer unchanged across an interrupted pointer swap", () => {
    const directory = root();
    const pointer = join(directory, "manifest.json");
    writeFileSync(pointer, "old-pointer\n", { flag: "wx" });
    const prepared = input(directory);
    expect(() =>
      publishCalloutRun({
        ...prepared,
        fault: (phase) => {
          if (phase === "before-pointer-swap") throw new Error("injected interruption");
        },
      }),
    ).toThrow(/injected interruption/);
    expect(readFileSync(pointer, "utf8")).toBe("old-pointer\n");
    expect(
      readdirSync(directory).filter((name) => name.startsWith(".stage-") || name.endsWith(".tmp")),
    ).toEqual([]);
    expect(publishCalloutRun(prepared).reused).toBe(true);
  });

  /**
   * The type size the booklet printed is the second, independent source for a
   * label's class, and it fails closed. Before it existed, `evidenceContract`
   * returned `part-art` for every identity nobody had preregistered, so four
   * multiplier labels were published as physical and put the piece total 8 above
   * the printed inventory. Each case below must refuse the whole publication and
   * leave the previous pointer and run set untouched.
   */
  describe("published quantity-label type size", () => {
    function refuses(overrides: Partial<PublishedCallout>, expected: RegExp): void {
      const directory = root();
      const pointer = join(directory, "manifest.json");
      writeFileSync(pointer, "old-pointer\n", { flag: "wx" });
      const prepared = input(directory, "b".repeat(24), overrides);
      expect(() => publishCalloutRun(prepared)).toThrow(expected);
      expect(readFileSync(pointer, "utf8")).toBe("old-pointer\n");
      expect(existsSync(join(directory, "runs", prepared.runId))).toBe(false);
    }

    it("refuses a multiplier-face label published as physical part art", () => {
      refuses(
        { heightPt: 16, evidenceKind: "part-art" },
        /multiplier type size but published as physical part art.*p11\|q1\|x1\.000\|y1\.000 at 16pt, published as "part-art"/su,
      );
      refuses({ heightPt: 40, evidenceKind: "part-art" }, /at 40pt, published as "part-art"/u);
    });

    it("refuses a parts-bin-face label published as semantic", () => {
      for (const evidenceKind of ["subassembly-repeat", "assembly-action"] as const) {
        refuses(
          { heightPt: 8, evidenceKind, regionKind: "vector-box-full" },
          new RegExp(
            `parts-bin type size but published as semantic.*at 8pt, published as "${evidenceKind}"`,
            "su",
          ),
        );
      }
    });

    it("refuses a type size the booklet has never been measured at", () => {
      // The gap between the 8pt parts bin and the 16pt multiplier is empty, and
      // 6pt is the back-matter inventory row, which is neither. A face in any of
      // those bands is a new case, so it must stop the run rather than default.
      for (const heightPt of [12, 6, 4, 15.9]) {
        refuses(
          { heightPt },
          new RegExp(`never been measured at.*at ${heightPt}pt, published as "part-art"`, "su"),
        );
      }
    });

    it("refuses a record that publishes no measured type size at all", () => {
      // The exact defect this check exists for: heightPt was extracted from the
      // PDF and then dropped before the manifest record was written.
      refuses(
        { heightPt: undefined as unknown as number },
        /publish no measured quantity-label type size.*published as "part-art".*Re-run the callout publication/su,
      );
    });
  });

  it("removes only confirmed obsolete root PNGs and never selected runs", () => {
    const directory = root();
    writeFileSync(join(directory, "p11-c0.png"), PNG, { flag: "wx" });
    writeFileSync(join(directory, "keep.png"), PNG, { flag: "wx" });
    const prepared = input(directory);
    const result = publishCalloutRun(prepared);
    expect(result.cleanup.removedFiles).toBe(1);
    expect(existsSync(join(directory, "p11-c0.png"))).toBe(false);
    expect(existsSync(join(directory, "keep.png"))).toBe(true);
    expect(existsSync(join(result.runDirectory, prepared.crops[0]!.metadata.fileName))).toBe(true);
  });
});
