import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  HIGHLIGHT_EXCLUSIVITY_COMPATIBILITY_SCHEMA,
  HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY,
  HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION,
  HIGHLIGHT_EXCLUSIVITY_LIMITS,
  HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA,
  HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS,
  compileHighlightExclusivityCompatibility,
  parseHighlightExclusivityRenderCases,
  verifyHighlightExclusivityCompatibility,
} from "../e2e/real-build-highlight-compatibility";

const PIXELS =
  HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.width * HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.height;

interface MutablePackedMask {
  encoding: string;
  byteLength: number;
  digest: string;
  data: string;
}

interface MutableCase {
  caseId: string;
  width: number;
  height: number;
  pieceKeys: string[];
  highlightMask: MutablePackedMask;
  pieceMasks: MutablePackedMask[];
  [key: string]: unknown;
}

interface MutableBundle {
  schemaVersion: string;
  registryVersion: string;
  render: Record<string, unknown>;
  cases: MutableCase[];
  [key: string]: unknown;
}

const digest = (value: Uint8Array): string =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const canonical = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value)}\n`);

function mask(...ranges: readonly [number, number][]): Uint8Array {
  const output = new Uint8Array(PIXELS);
  for (const [from, to] of ranges) {
    for (let index = from; index < to; index += 1) output[index] = 1;
  }
  return output;
}

function pack(pixels: Uint8Array): MutablePackedMask {
  const packed = Buffer.alloc(Math.ceil(pixels.length / 8));
  for (let index = 0; index < pixels.length; index += 1) {
    if (pixels[index] === 1) {
      const packedIndex = index >> 3;
      packed[packedIndex] = packed[packedIndex]! | (1 << (index & 7));
    }
  }
  return {
    encoding: "base64-lsb0-bitset/1",
    byteLength: packed.length,
    digest: digest(packed),
    data: packed.toString("base64"),
  };
}

function fixtureValue(): MutableBundle {
  const masks = [
    {
      highlight: mask([0, 96]),
      pieces: [mask([0, 32]), mask([32, 64])],
    },
    {
      highlight: mask([256, 352]),
      pieces: [mask([256, 288]), mask([288, 320])],
    },
  ];
  return {
    schemaVersion: HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA,
    registryVersion: HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY_VERSION,
    render: { ...HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS },
    cases: HIGHLIGHT_EXCLUSIVITY_CASE_REGISTRY.map((entry, index) => ({
      caseId: entry.caseId,
      width: HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.width,
      height: HIGHLIGHT_EXCLUSIVITY_RENDER_SETTINGS.height,
      pieceKeys: [...entry.pieceKeys],
      highlightMask: pack(masks[index]!.highlight),
      pieceMasks: masks[index]!.pieces.map(pack),
    })),
  };
}

const fixtureBytes = (): Buffer => canonical(fixtureValue());

function cloneFixture(): MutableBundle {
  return structuredClone(fixtureValue());
}

function replacePackedBytes(maskValue: MutablePackedMask, bytes: Uint8Array): void {
  const packed = Buffer.from(bytes);
  maskValue.byteLength = packed.length;
  maskValue.digest = digest(packed);
  maskValue.data = packed.toString("base64");
}

function decoded(maskValue: MutablePackedMask): Buffer {
  return Buffer.from(maskValue.data, "base64");
}

function verification(bytes = fixtureBytes()) {
  const compiled = compileHighlightExclusivityCompatibility(bytes);
  return {
    renderCasesBytes: bytes,
    summaryBytes: compiled.summaryBytes,
    expectedRenderCasesDigest: digest(bytes),
    expectedCompatibilityDigest: digest(compiled.summaryBytes),
  };
}

function expectCompileFailure(mutator: (bundle: MutableBundle) => void, pattern: RegExp): void {
  const value = cloneFixture();
  mutator(value);
  expect(() => compileHighlightExclusivityCompatibility(canonical(value))).toThrow(pattern);
}

describe("real-build highlight exclusivity renderer compatibility", () => {
  it("records policy compatibility only from canonical raw mask bits", () => {
    const input = verification();
    const summary = verifyHighlightExclusivityCompatibility(input);

    expect(summary).toMatchObject({
      schemaVersion: HIGHLIGHT_EXCLUSIVITY_COMPATIBILITY_SCHEMA,
      renderCasesDigest: input.expectedRenderCasesDigest,
      observedMinimumExclusivePixels: 32,
      policyMinimumExclusiveHighlightPixelsPerPiece: 8,
    });
    expect(summary.cases.map((entry) => entry.exclusiveHighlightPixelsByPiece)).toEqual([
      [32, 32],
      [32, 32],
    ]);
    expect(parseHighlightExclusivityRenderCases(input.renderCasesBytes).cases).toHaveLength(2);
  });

  it("rejects an edited and locally rehashed derived summary", () => {
    const input = verification();
    const edited = JSON.parse(Buffer.from(input.summaryBytes).toString("utf8")) as {
      policyMinimumExclusiveHighlightPixelsPerPiece: number;
      cases: { unionHighlightPixels: number }[];
    };
    edited.policyMinimumExclusiveHighlightPixelsPerPiece = 7;
    edited.cases[0]!.unionHighlightPixels = 999;
    const editedBytes = Buffer.from(`${JSON.stringify(edited, null, 1)}\n`);

    expect(() =>
      verifyHighlightExclusivityCompatibility({
        ...input,
        summaryBytes: editedBytes,
        expectedCompatibilityDigest: digest(editedBytes),
      }),
    ).toThrow(/exact byte-for-byte compiler output/u);
  });

  it("binds a raw-bit edit even after its mask and summary are rehashed", () => {
    const original = verification();
    const forged = cloneFixture();
    const maskBytes = decoded(forged.cases[0]!.pieceMasks[0]!);
    maskBytes[0] = maskBytes[0]! ^ 1;
    replacePackedBytes(forged.cases[0]!.pieceMasks[0]!, maskBytes);
    const forgedRaw = canonical(forged);
    const forgedCompilation = compileHighlightExclusivityCompatibility(forgedRaw);

    expect(() =>
      verifyHighlightExclusivityCompatibility({
        renderCasesBytes: forgedRaw,
        summaryBytes: forgedCompilation.summaryBytes,
        expectedRenderCasesDigest: original.expectedRenderCasesDigest,
        expectedCompatibilityDigest: digest(forgedCompilation.summaryBytes),
      }),
    ).toThrow(/bound raw role/u);
  });

  it("binds mask order and identity even when a swapped bundle is internally recompiled", () => {
    const original = verification();
    const forged = cloneFixture();
    forged.cases[0]!.pieceMasks.reverse();
    const forgedRaw = canonical(forged);
    const forgedCompilation = compileHighlightExclusivityCompatibility(forgedRaw);

    expect(() =>
      verifyHighlightExclusivityCompatibility({
        renderCasesBytes: forgedRaw,
        summaryBytes: forgedCompilation.summaryBytes,
        expectedRenderCasesDigest: original.expectedRenderCasesDigest,
        expectedCompatibilityDigest: digest(forgedCompilation.summaryBytes),
      }),
    ).toThrow(/bound raw role/u);
  });

  it("requires the exact fixed case registry and exact piece registry", () => {
    const caseMutations: readonly ((bundle: MutableBundle) => void)[] = [
      (bundle) => void bundle.cases.pop(),
      (bundle) => bundle.cases.push(structuredClone(bundle.cases[0]!)),
      (bundle) => bundle.cases.reverse(),
      (bundle) => {
        bundle.cases[1] = structuredClone(bundle.cases[0]!);
      },
    ];
    for (const mutate of caseMutations) {
      expectCompileFailure(mutate, /exactly 2 fixed cases|registry position/u);
    }

    expectCompileFailure((bundle) => void bundle.cases[0]!.pieceKeys.pop(), /bind piece keys/u);
    expectCompileFailure((bundle) => bundle.cases[0]!.pieceKeys.reverse(), /bind piece keys/u);
    expectCompileFailure(
      (bundle) =>
        bundle.cases[0]!.pieceMasks.push(
          ...bundle.cases[0]!.pieceMasks,
          structuredClone(bundle.cases[0]!.pieceMasks[0]!),
        ),
      /exactly 2 piece masks/u,
    );
    expectCompileFailure((bundle) => {
      bundle.cases[0]!.pieceMasks = [structuredClone(bundle.cases[0]!.pieceMasks[0]!)];
    }, /exactly 2 piece masks/u);
  });

  it("rejects duplicate, empty, and below-policy positive evidence", () => {
    expectCompileFailure((bundle) => {
      bundle.cases[0]!.pieceMasks[1] = structuredClone(bundle.cases[0]!.pieceMasks[0]!);
    }, /do not support the explicit 8px exclusivity policy/u);
    expectCompileFailure(
      (bundle) =>
        replacePackedBytes(bundle.cases[0]!.pieceMasks[1]!, Buffer.alloc(Math.ceil(PIXELS / 8))),
      /do not support the explicit 8px exclusivity policy/u,
    );
    expectCompileFailure(
      (bundle) =>
        replacePackedBytes(bundle.cases[0]!.pieceMasks[1]!, decoded(pack(mask([32, 39])))),
      /observed per-piece minimum is 7/u,
    );
  });

  it("rejects malformed base64, stale hashes, nonzero trailing bits, and wrong byte counts", () => {
    expectCompileFailure((bundle) => {
      bundle.cases[0]!.highlightMask.data = "A===";
    }, /canonical padded base64/u);
    expectCompileFailure((bundle) => {
      bundle.cases[0]!.highlightMask.data = bundle.cases[0]!.highlightMask.data.replace(/=$/u, "");
    }, /canonical padded base64/u);
    expectCompileFailure((bundle) => {
      const bytes = decoded(bundle.cases[0]!.highlightMask);
      bytes[0] = bytes[0]! ^ 1;
      bundle.cases[0]!.highlightMask.data = bytes.toString("base64");
    }, /do not match/u);
    expectCompileFailure((bundle) => {
      const bytes = decoded(bundle.cases[0]!.highlightMask);
      bytes[bytes.length - 1] = bytes[bytes.length - 1]! | 0x80;
      replacePackedBytes(bundle.cases[0]!.highlightMask, bytes);
    }, /padding bits/u);
    expectCompileFailure((bundle) => {
      bundle.cases[0]!.highlightMask.byteLength -= 1;
    }, /decode to exactly/u);
  });

  it("rejects unsafe dimensions, unexpected keys, noncanonical JSON, and invalid UTF-8", () => {
    expectCompileFailure((bundle) => {
      bundle.render.width = Number.MAX_SAFE_INTEGER;
      bundle.render.height = 2;
    }, /dimension multiplication/u);
    expectCompileFailure((bundle) => {
      bundle.cases[0]!.unexpected = true;
    }, /must contain exactly/u);
    const pretty = Buffer.from(`${JSON.stringify(fixtureValue(), null, 2)}\n`);
    expect(() => compileHighlightExclusivityCompatibility(pretty)).toThrow(/canonical JSON bytes/u);
    const canonicalText = fixtureBytes().toString("utf8");
    const duplicateKey = Buffer.from(
      canonicalText.replace(
        `"schemaVersion":"${HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA}"`,
        `"schemaVersion":"${HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA}","schemaVersion":"${HIGHLIGHT_EXCLUSIVITY_RENDER_CASES_SCHEMA}"`,
      ),
    );
    expect(() => compileHighlightExclusivityCompatibility(duplicateKey)).toThrow(
      /canonical JSON bytes/u,
    );
    expect(() => compileHighlightExclusivityCompatibility(Uint8Array.of(0xff))).toThrow(
      /strict UTF-8 JSON/u,
    );
  });

  it("enforces raw and decoded byte budgets before accepting hostile masks", () => {
    const tooLarge = Buffer.alloc(HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumRawBytes + 1, 0x20);
    expect(() => compileHighlightExclusivityCompatibility(tooLarge)).toThrow(/must contain 1../u);

    const decodedOverflow = cloneFixture();
    replacePackedBytes(
      decodedOverflow.cases[0]!.highlightMask,
      Buffer.alloc(HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumDecodedMaskBytes + 1),
    );
    expect(() => compileHighlightExclusivityCompatibility(canonical(decodedOverflow))).toThrow(
      /decoded masks exceed/u,
    );
  });

  it("requires both externally bound role digests and bounds the retained summary", () => {
    const input = verification();
    expect(() =>
      verifyHighlightExclusivityCompatibility({
        ...input,
        expectedRenderCasesDigest: "sha256:not-a-digest",
      }),
    ).toThrow(/render-cases role digest/u);
    expect(() =>
      verifyHighlightExclusivityCompatibility({
        ...input,
        expectedCompatibilityDigest: `sha256:${"0".repeat(64)}`,
      }),
    ).toThrow(/bound summary role/u);
    const oversizedSummary = Buffer.alloc(
      HIGHLIGHT_EXCLUSIVITY_LIMITS.maximumSummaryBytes + 1,
      0x20,
    );
    expect(() =>
      verifyHighlightExclusivityCompatibility({
        ...input,
        summaryBytes: oversizedSummary,
        expectedCompatibilityDigest: digest(oversizedSummary),
      }),
    ).toThrow(/must contain 1../u);
  });
});
