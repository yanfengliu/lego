import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundaries = vi.hoisted(() => ({
  sourceBytes: Buffer.from("%PDF synthetic crop boundary\n\0full stdin sentinel\xff", "latin1"),
  readArtifact: vi.fn(),
  hashArtifact: vi.fn(),
  runPoppler: vi.fn(),
  spawnSync: vi.fn(),
}));

vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal()),
  spawnSync: boundaries.spawnSync,
}));
vi.mock("../e2e/real-build-prefix50-subbuild-return-review-poppler.ts", () => ({
  runRealBuildPrefix50Step44Poppler: boundaries.runPoppler,
}));
vi.mock(
  "../e2e/real-build-prefix50-subbuild-return-review-artifact-io.ts",
  async (importOriginal) => ({
    ...(await importOriginal()),
    readRealBuildPrefix50Step44ReviewArtifact: boundaries.readArtifact,
    hashRealBuildPrefix50Step44ReviewArtifact: boundaries.hashArtifact,
  }),
);

import {
  rerenderRealBuildPrefix50Step44CalibrationSourceCrop,
  rerenderRealBuildPrefix50Step44CalibrationSourceCrops,
} from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-calibration-raster.ts";
import { rerenderRealBuildPrefix50Step44PdfCrop } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-pdf-crop.ts";
import { REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC } from "../e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-source-spec.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png.ts";
import {
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
  REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
} from "../e2e/real-build-prefix50-source-pdf-pins.ts";

type CropInput = Parameters<typeof rerenderRealBuildPrefix50Step44PdfCrop>[0];
type WrapperInput = Parameters<
  typeof import("../e2e/real-build-prefix50-subbuild-return-review-poppler.ts").runRealBuildPrefix50Step44Poppler
>[0];
type OutputMode =
  | "valid"
  | "missing"
  | "oversized"
  | "wrong-dimensions"
  | "malformed"
  | "wrapper-failure"
  | "partial-wrapper-failure";
const syntheticReceipt = Object.freeze({
  version: "synthetic-poppler-wrapper/1",
  toolchainCommitment: `sha256:${"a".repeat(64)}` as const,
  totalProcesses: 1,
  activeProcesses: 0,
});
const temporaryRoot = realpathSync(tmpdir());
const repositories: string[] = [];
const cropDirectories: string[] = [];
const expectedRetainedDirectories = new Set<string>();
const wrapperFailure = new TypeError(
  "Synthetic crop Poppler failed with status 1; 64 stderr bytes were withheld.",
);
let outputMode: OutputMode = "valid";
let generatedPng: Uint8Array | null = null;
const digest = (bytes: Uint8Array) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

function syntheticPixels(width: number, height: number): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) rgba.set([12, 34, 56, 255], offset);
  return rgba;
}

function removeOwnedDirectory(directory: string): void {
  if (
    dirname(directory) !== temporaryRoot ||
    !/^lego-(?:crop-harness|step44-pdf-crop)-[^/\\]+$/u.test(basename(directory))
  )
    throw new Error("Crop test refuses cleanup outside its owned temporary directories.");
  rmSync(directory, { recursive: true, force: true });
}

function request(index = 0): CropInput {
  const repositoryRoot = realpathSync(mkdtempSync(join(temporaryRoot, "lego-crop-harness-")));
  repositories.push(repositoryRoot);
  writeFileSync(join(repositoryRoot, "neighbor-sentinel.txt"), "preserve owned neighbor\n");
  const spec = REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases[index]!;
  return {
    repositoryRoot,
    sourcePdfArtifactPath: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
    sourcePdfDigest: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
    maximumSourceBytes: REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
    pageNumber: 44,
    densityDpi: 180,
    crop: spec.crop,
    label: "synthetic crop boundary",
    authorization: { kind: "sealed-calibration", spec },
  };
}

beforeEach(() => {
  outputMode = "valid";
  generatedPng = null;
  expectedRetainedDirectories.clear();
  boundaries.hashArtifact.mockReset().mockReturnValue(REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST);
  boundaries.readArtifact.mockReset().mockReturnValue(boundaries.sourceBytes);
  boundaries.spawnSync.mockReset().mockImplementation(() => {
    throw new Error("Synthetic crop harness forbids every native spawn.");
  });
  boundaries.runPoppler.mockReset().mockImplementation((input: WrapperInput) => {
    const prefix = input.arguments.at(-1)!;
    const directory = dirname(prefix);
    expect(dirname(directory)).toBe(temporaryRoot);
    expect(basename(directory)).toMatch(/^lego-step44-pdf-crop-/u);
    expect(basename(prefix)).toBe("physical-page44-bounded-crop");
    cropDirectories.push(directory);
    if (outputMode === "partial-wrapper-failure")
      writeFileSync(`${prefix}.png`, "synthetic partial output");
    if (outputMode === "wrapper-failure" || outputMode === "partial-wrapper-failure") {
      expectedRetainedDirectories.add(directory);
      throw wrapperFailure;
    }
    if (outputMode === "missing") return syntheticReceipt;
    const width = outputMode === "wrong-dimensions" ? 719 : 720;
    generatedPng =
      outputMode === "oversized"
        ? new Uint8Array(8 * 1024 * 1024 + 1)
        : outputMode === "malformed"
          ? Buffer.from("malformed synthetic PNG")
          : encodeCanonicalRealBuildPrefix50Step44ReviewPng({
              width,
              height: 470,
              rgba: syntheticPixels(width, 470),
            });
    writeFileSync(`${prefix}.png`, generatedPng);
    return syntheticReceipt;
  });
});

afterEach(() => {
  try {
    const cleanup = {
      readerCalls: boundaries.readArtifact.mock.calls.length,
      wrapperCalls: boundaries.runPoppler.mock.calls.length,
      spawnCalls: boundaries.spawnSync.mock.calls.length,
      cropDirectories: cropDirectories.length,
      cropsRemoved: cropDirectories.every((directory) => !existsSync(directory)),
      retentionMatched: cropDirectories.every(
        (directory) => existsSync(directory) === expectedRetainedDirectories.has(directory),
      ),
      neighborsPreserved: repositories.every(
        (directory) =>
          readFileSync(join(directory, "neighbor-sentinel.txt"), "utf8") ===
          "preserve owned neighbor\n",
      ),
    };
    const evidence = process.env.LEGO_STEP44_CROP_TEST_OUTPUT;
    if (evidence !== undefined) {
      const root = resolve(evidence);
      if (!root.startsWith(`${resolve("output")}${sep}`))
        throw new Error("Crop evidence must stay under ignored output.");
      mkdirSync(root, { recursive: true });
      const name = expect.getState().currentTestName!.replace(/[^a-zA-Z0-9-]+/gu, "-");
      writeFileSync(join(root, `${name}.json`), `${JSON.stringify(cleanup, null, 2)}\n`, {
        flag: "wx",
      });
    }
    expect(cleanup).toMatchObject({
      spawnCalls: 0,
      retentionMatched: true,
      neighborsPreserved: true,
    });
  } finally {
    while (cropDirectories.length > 0) removeOwnedDirectory(cropDirectories.pop()!);
    while (repositories.length > 0) removeOwnedDirectory(repositories.pop()!);
  }
});

function expectNoSourceAccess(): void {
  expect(boundaries.readArtifact).toHaveBeenCalledTimes(0);
  expect(boundaries.runPoppler).toHaveBeenCalledTimes(0);
  expect(boundaries.spawnSync).toHaveBeenCalledTimes(0);
}

describe("bounded page-44 crop with a synthetic wrapper", () => {
  // Bound: the real crop authorization/PNG decoder with mocked artifact bytes and wrapper.
  // No runtime factory/native process, protected payload, or genuine held-out positive runs.
  // Failed wrapper returns must retain the owned crop; reverting the quiescence guard makes these controls red.
  it.each([
    { index: 0, step: 41, y: 180 },
    { index: 1, step: 42, y: 810 },
  ])(
    "releases only the exact synthetic Step-$step rectangle after one authorized read",
    async ({ index, y }) => {
      const input = request(index);
      const result = await rerenderRealBuildPrefix50Step44PdfCrop(input);
      expect(boundaries.readArtifact).toHaveBeenCalledExactlyOnceWith(
        input.repositoryRoot,
        REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_ARTIFACT_PATH,
        REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_MAXIMUM_BYTES,
        "synthetic crop boundary source PDF",
        REAL_BUILD_PREFIX50_STEP44_SOURCE_PDF_DIGEST,
      );
      expect(boundaries.runPoppler).toHaveBeenCalledTimes(1);
      const call = boundaries.runPoppler.mock.calls[0]![0] as WrapperInput;
      expect(call).toEqual({
        arguments: [
          "-f",
          "44",
          "-l",
          "44",
          "-r",
          "180",
          "-x",
          "120",
          "-y",
          String(y),
          "-W",
          "720",
          "-H",
          "470",
          "-png",
          "-singlefile",
          "-",
          join(cropDirectories[0]!, "physical-page44-bounded-crop"),
        ],
        sourceBytes: boundaries.sourceBytes,
        label: "synthetic crop boundary Poppler crop",
      });
      expect(call.sourceBytes).toBe(boundaries.sourceBytes);
      expect(Buffer.from(call.sourceBytes)).toEqual(
        Buffer.from("%PDF synthetic crop boundary\n\0full stdin sentinel\xff", "latin1"),
      );
      expect(call.arguments).not.toContain(join(input.repositoryRoot, input.sourcePdfArtifactPath));
      const pixels = syntheticPixels(720, 470);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.keys(result).sort()).toEqual([
        "height",
        "pixelDigest",
        "pngDigest",
        "popplerToolchainCommitment",
        "rendererVersion",
        "rgba",
        "width",
      ]);
      expect({ ...result, rgba: undefined }).toEqual({
        rendererVersion: syntheticReceipt.version,
        popplerToolchainCommitment: syntheticReceipt.toolchainCommitment,
        pngDigest: digest(generatedPng!),
        pixelDigest: digest(pixels),
        width: 720,
        height: 470,
        rgba: undefined,
      });
      expect(result.width * result.height).toBeLessThanOrEqual(1_000_000);
      expect(result.rgba.byteLength).toBe(720 * 470 * 4);
      expect(Buffer.from(result.rgba).equals(Buffer.from(pixels))).toBe(true);
    },
  );

  it.each(["wrapper-failure", "partial-wrapper-failure"] as const)(
    "retains its owned directory and the same sanitized error after %s",
    async (mode) => {
      outputMode = mode;
      await expect(rerenderRealBuildPrefix50Step44PdfCrop(request())).rejects.toBe(wrapperFailure);
      expect(cropDirectories).toHaveLength(1);
      expect(existsSync(cropDirectories[0]!)).toBe(true);
      expect(boundaries.runPoppler).toHaveBeenCalledTimes(1);
      if (mode === "partial-wrapper-failure")
        expect(
          readFileSync(join(cropDirectories[0]!, "physical-page44-bounded-crop.png"), "utf8"),
        ).toBe("synthetic partial output");
    },
  );

  it("stops the real calibration crop set before a second source read or wrapper launch", async () => {
    outputMode = "partial-wrapper-failure";
    const input = request();
    await expect(
      rerenderRealBuildPrefix50Step44CalibrationSourceCrops({
        repositoryRoot: input.repositoryRoot,
      }),
    ).rejects.toBe(wrapperFailure);
    expect(boundaries.hashArtifact).toHaveBeenCalledTimes(1);
    expect(boundaries.readArtifact).toHaveBeenCalledTimes(1);
    expect(boundaries.runPoppler).toHaveBeenCalledTimes(1);
    expect(cropDirectories).toHaveLength(1);
    expect(existsSync(cropDirectories[0]!)).toBe(true);
  });

  it("refuses page 45 before any source read", async () => {
    await expect(
      rerenderRealBuildPrefix50Step44PdfCrop({ ...request(), pageNumber: 45 as 44 }),
    ).rejects.toThrow("only physical page 44");
    expectNoSourceAccess();
  });

  it("refuses an altered crop before any source read", async () => {
    const input = request();
    await expect(
      rerenderRealBuildPrefix50Step44PdfCrop({
        ...input,
        crop: { ...input.crop, x: input.crop.x + 1 },
      }),
    ).rejects.toThrow("only the exact sealed Step-41/42 calibration request");
    expectNoSourceAccess();
  });

  it("refuses a forged Step43 calibration spec before any source read", async () => {
    const input = request();
    const forged = {
      ...REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_SOURCE_SPEC.cases[0]!,
      panelStep: 43,
      splitRole: "held-out-validation",
    } as never;
    await expect(
      rerenderRealBuildPrefix50Step44PdfCrop({
        ...input,
        authorization: { kind: "sealed-calibration", spec: forged },
      }),
    ).rejects.toThrow("only the exact sealed Step-41/42 calibration request");
    expectNoSourceAccess();
    await expect(
      rerenderRealBuildPrefix50Step44CalibrationSourceCrop({
        repositoryRoot: input.repositoryRoot,
        spec: forged,
      }),
    ).rejects.toThrow("only exact sealed Step-41/42 crops");
    expectNoSourceAccess();
  });

  it("refuses an invalid held-out request before any source read", async () => {
    // This wrong rectangle stops at request commitment; it does not reach the genuine
    // capability validator, whose separate accepted tests cover structural forgeries.
    await expect(
      rerenderRealBuildPrefix50Step44PdfCrop({
        ...request(),
        authorization: { kind: "held-out-one-shot", capability: Object.freeze({}) as never },
      }),
    ).rejects.toThrow("only the exact sealed Step-43 request");
    expectNoSourceAccess();
  });

  it.each([
    ["missing", /ENOENT/u],
    ["oversized", /regular 1\.\.8388608-byte crop PNG/u],
    ["wrong-dimensions", /crop is 719x470, not 720x470/u],
    ["malformed", /PNG signature is absent or the file is truncated/u],
  ] as const)(
    "refuses %s output and removes only its owned crop directory",
    async (mode, message) => {
      outputMode = mode;
      await expect(rerenderRealBuildPrefix50Step44PdfCrop(request())).rejects.toThrow(message);
      expect(boundaries.readArtifact).toHaveBeenCalledTimes(1);
      expect(boundaries.runPoppler).toHaveBeenCalledTimes(1);
      expect(cropDirectories).toHaveLength(1);
      expect(existsSync(cropDirectories[0]!)).toBe(false);
      expect(boundaries.spawnSync).toHaveBeenCalledTimes(0);
    },
  );
});
