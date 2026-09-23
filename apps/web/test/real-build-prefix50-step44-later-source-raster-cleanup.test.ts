import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ runPoppler: vi.fn(), spawn: vi.fn(), spawnSync: vi.fn() }));
vi.mock("node:child_process", async (importOriginal) => ({
  ...(await importOriginal()),
  spawn: boundary.spawn,
  spawnSync: boundary.spawnSync,
}));
vi.mock("../e2e/real-build-prefix50-subbuild-return-review-poppler.ts", () => ({
  runRealBuildPrefix50Step44Poppler: boundary.runPoppler,
}));

import { renderRealBuildPrefix50Step44LaterSourceRaster } from "../e2e/real-build-prefix50-step44-later-source-derived-raster.ts";
import { REAL_BUILD_PREFIX50_STEP44_DERIVED_OUTPUT_ROOT } from "../e2e/real-build-prefix50-step44-later-source-derived-contract.ts";
import { encodeCanonicalRealBuildPrefix50Step44ReviewPng } from "../e2e/real-build-prefix50-subbuild-return-review-png.ts";

// harness: actual raster function, contained directory/live-guard helpers and PNG decoder.
// Bound: wrapper is mocked, source and pixels are synthetic, and the direct function test
// does not exercise source authorization or native exit. Reverting its quiescence guard
// must make both failed-wrapper retention cases red before test-owned rescue cleanup.
const temporaryRoot = realpathSync(tmpdir());
const ownedRoots: string[] = [];
const sourceBytes = Buffer.from("synthetic caller-control stdin");
const wrapperFailure = new TypeError(
  "Synthetic raster Poppler failed with status 1; 64 stderr bytes were withheld.",
);
const receipt = Object.freeze({
  version: "synthetic-poppler-wrapper/1",
  toolchainCommitment: `sha256:${"a".repeat(64)}` as const,
  totalProcesses: 1,
  activeProcesses: 0,
});
type WrapperInput = Parameters<
  typeof import("../e2e/real-build-prefix50-subbuild-return-review-poppler.ts").runRealBuildPrefix50Step44Poppler
>[0];
type Mode = "success" | "malformed" | "empty-failure" | "partial-failure";
let mode: Mode = "success";
let observedPrefix: string | undefined;

function input() {
  const repositoryRoot = realpathSync(
    mkdtempSync(join(temporaryRoot, "lego-raster-cleanup-test-")),
  );
  ownedRoots.push(repositoryRoot);
  writeFileSync(join(repositoryRoot, "neighbor.txt"), "preserve synthetic neighbor");
  const outputCandidate = `${REAL_BUILD_PREFIX50_STEP44_DERIVED_OUTPUT_ROOT}/scope-synthetic`;
  return {
    output: { repositoryRoot, outputCandidate, requestSnapshot: undefined },
    request: {
      kind: "raster-page" as const,
      purpose: "page45-camera-raster" as const,
      densityDpi: 180,
      retainDecodedBytes: false,
    },
    directory: join(repositoryRoot, outputCandidate),
  };
}

beforeEach(() => {
  mode = "success";
  observedPrefix = undefined;
  const refuseSpawn = () => {
    throw new Error("Synthetic raster cleanup tests forbid native spawn.");
  };
  boundary.spawn.mockReset().mockImplementation(refuseSpawn);
  boundary.spawnSync.mockReset().mockImplementation(refuseSpawn);
  boundary.runPoppler.mockReset().mockImplementation((call: WrapperInput) => {
    observedPrefix = call.arguments.at(-1)!;
    expect(call.sourceBytes).toBe(sourceBytes);
    if (mode === "empty-failure") throw wrapperFailure;
    if (mode === "partial-failure") {
      writeFileSync(`${observedPrefix}.png`, "synthetic partial output");
      throw wrapperFailure;
    }
    const bytes =
      mode === "malformed"
        ? Buffer.from("synthetic malformed PNG")
        : encodeCanonicalRealBuildPrefix50Step44ReviewPng({
            width: 2,
            height: 2,
            rgba: Uint8Array.from([
              12, 34, 56, 255, 12, 34, 56, 255, 12, 34, 56, 255, 12, 34, 56, 255,
            ]),
          });
    writeFileSync(`${observedPrefix}.png`, bytes);
    return receipt;
  });
});

afterEach(() => {
  try {
    expect(boundary.spawn).not.toHaveBeenCalled();
    expect(boundary.spawnSync).not.toHaveBeenCalled();
    for (const root of ownedRoots)
      expect(readFileSync(join(root, "neighbor.txt"), "utf8")).toBe("preserve synthetic neighbor");
  } finally {
    for (const root of ownedRoots.splice(0)) {
      if (
        dirname(root) !== temporaryRoot ||
        !/^lego-raster-cleanup-test-[^/\\]+$/u.test(basename(root))
      )
        throw new Error(
          "Raster cleanup test refuses removal outside its exact minted temporary root.",
        );
      // Wrapper cannot launch a child; retention was asserted before this test-only rescue.
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("later-source raster output lifetime after a wrapper return", () => {
  it.each(["empty-failure", "partial-failure"] as const)(
    "retains the exact owned output after %s and propagates the same sanitized error",
    (failureMode) => {
      mode = failureMode;
      const { output, request, directory } = input();
      let caught: unknown;
      try {
        renderRealBuildPrefix50Step44LaterSourceRaster(sourceBytes, request, output);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBe(wrapperFailure);
      expect(boundary.runPoppler).toHaveBeenCalledTimes(1);
      expect(dirname(observedPrefix!)).toBe(directory);
      expect(existsSync(directory)).toBe(true);
      expect(
        readdirSync(directory).filter((name) => name.startsWith(".lego-contained-live-guard-")),
      ).toEqual([]);
      if (failureMode === "partial-failure")
        expect(readFileSync(`${observedPrefix}.png`, "utf8")).toBe("synthetic partial output");
    },
  );

  it("removes only its owned output after a successful wrapper and raster result", () => {
    const { output, request, directory } = input();
    expect(
      renderRealBuildPrefix50Step44LaterSourceRaster(sourceBytes, request, output),
    ).toMatchObject({
      kind: "raster-page",
      width: 2,
      height: 2,
      rendererVersion: receipt.version,
    });
    expect(boundary.runPoppler).toHaveBeenCalledTimes(1);
    expect(existsSync(directory)).toBe(false);
  });

  it("removes its owned output when PNG validation fails after confirmed quiescence", () => {
    mode = "malformed";
    const { output, request, directory } = input();
    expect(() =>
      renderRealBuildPrefix50Step44LaterSourceRaster(sourceBytes, request, output),
    ).toThrow(/PNG signature is absent or the file is truncated/u);
    expect(boundary.runPoppler).toHaveBeenCalledTimes(1);
    expect(existsSync(directory)).toBe(false);
  });
});
