import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import type { FullConfig } from "@playwright/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const checks = vi.hoisted(() => ({
  output: vi.fn(),
  manifest: vi.fn(),
  lock: vi.fn(),
  order: [] as string[],
}));

vi.mock("../e2e/real-build-step44-calibration-runner-output.ts", () => ({
  assertRealBuildStep44CalibrationResolvedConfig: checks.output,
}));

vi.mock("../e2e/real-build-bootstrap-source.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../e2e/real-build-bootstrap-source.ts")>()),
  readRequiredRealBuildBootstrapSourceManifest: checks.manifest,
  assertRealBuildBootstrapSourceLockHeld: checks.lock,
}));
vi.mock("vite", () => {
  throw new Error("Calibration setup must not import Vite.");
});
vi.mock("../e2e/sample-booklet.ts", () => {
  throw new Error("Calibration setup must not discover a booklet.");
});

import calibrationGlobalSetup from "../e2e/real-build-step44-calibration-global-setup.ts";

const temporaryRoots: string[] = [];
// The output assertion is mocked only for this setup-wiring boundary; no owner is claimed.
// Deliberately partial fixture: the mocked boundary observes this object without reading other FullConfig fields.
const config = {
  projects: [{ outputDir: resolve(tmpdir(), "lego-calibration-setup-test", "playwright") }],
  reporter: [["list"]],
} as unknown as FullConfig;

beforeEach(() => {
  vi.stubEnv("LEGO_REAL_BUILD_REQUIRED", "1");
  checks.order.length = 0;
  checks.output.mockReset().mockImplementation(() => checks.order.push("output"));
  checks.manifest.mockReset().mockImplementation(() => checks.order.push("manifest"));
  checks.lock.mockReset().mockImplementation(() => checks.order.push("lock"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of temporaryRoots.splice(0)) {
    if (dirname(resolve(root)) !== resolve(tmpdir()))
      throw new Error("Refusing cleanup outside the owned temporary parent.");
    rmSync(root, { recursive: true, force: false });
  }
  expect(checks.output).toHaveBeenCalledExactlyOnceWith(config);
});

async function syntheticBootstrap() {
  const actual = await vi.importActual<typeof import("../e2e/real-build-bootstrap-source.ts")>(
    "../e2e/real-build-bootstrap-source.ts",
  );
  const directory = mkdtempSync(join(tmpdir(), actual.REAL_BUILD_BOOTSTRAP_DIRECTORY_PREFIX));
  temporaryRoots.push(directory);
  const policyDigest = `sha256:${createHash("sha256").update("synthetic policy").digest("hex")}`;
  const manifest = actual.createRealBuildBootstrapSourceManifest({
    sourceRootsPolicyDigest: policyDigest,
    files: [{ path: actual.REAL_BUILD_SOURCE_ROOT_POLICY_PATH, digest: policyDigest, bytes: 16 }],
  });
  const manifestPath = join(directory, actual.REAL_BUILD_BOOTSTRAP_MANIFEST_FILE);
  writeFileSync(manifestPath, JSON.stringify(manifest), { flag: "wx" });
  vi.stubEnv("LEGO_REAL_BUILD_BOOTSTRAP_DIRECTORY", directory);
  vi.stubEnv("LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST", manifestPath);
  vi.stubEnv("LEGO_REAL_BUILD_BOOTSTRAP_MANIFEST_DIGEST", manifest.manifestDigest);
  return { actual, manifestPath };
}

describe("Step-44 calibration bootstrap without a development server", () => {
  // Bound: output validation precedes both existing source checks in all flag states. Actual synthetic
  // manifest and missing-lock refusals below exercise the real validators without a helper,
  // browser, server, source payload, or claim of OS source isolation.
  it("checks the manifest and held source lock in order without returning a server teardown", () => {
    expect(calibrationGlobalSetup(config)).toBeUndefined();
    expect(checks.order).toEqual(["output", "manifest", "lock"]);
    expect(checks.manifest).toHaveBeenCalledExactlyOnceWith();
    expect(checks.lock).toHaveBeenCalledExactlyOnceWith();
  });

  it.each([undefined, "0"])("preserves the non-required bootstrap behavior for %s", (value) => {
    vi.stubEnv("LEGO_REAL_BUILD_REQUIRED", value);
    expect(calibrationGlobalSetup(config)).toBeUndefined();
    expect(checks.order).toEqual(["output"]);
    expect(checks.manifest).not.toHaveBeenCalled();
    expect(checks.lock).not.toHaveBeenCalled();
  });

  it("propagates the exact manifest refusal before checking a source lock", () => {
    const failure = new Error("synthetic manifest refusal");
    checks.manifest.mockImplementation(() => {
      checks.order.push("manifest");
      throw failure;
    });
    expect(() => calibrationGlobalSetup(config)).toThrow(failure);
    expect(checks.order).toEqual(["output", "manifest"]);
    expect(checks.manifest).toHaveBeenCalledExactlyOnceWith();
    expect(checks.lock).not.toHaveBeenCalled();
  });

  it("propagates the exact held-lock refusal after checking the manifest", () => {
    const failure = new Error("synthetic held-lock refusal");
    checks.lock.mockImplementation(() => {
      checks.order.push("lock");
      throw failure;
    });
    expect(() => calibrationGlobalSetup(config)).toThrow(failure);
    expect(checks.order).toEqual(["output", "manifest", "lock"]);
    expect(checks.manifest).toHaveBeenCalledExactlyOnceWith();
    expect(checks.lock).toHaveBeenCalledExactlyOnceWith();
  });

  it("retains the real malformed-manifest refusal on synthetic bootstrap bytes", async () => {
    const { actual, manifestPath } = await syntheticBootstrap();
    writeFileSync(manifestPath, "not json");
    checks.manifest.mockImplementation(() => {
      checks.order.push("manifest");
      return actual.readRequiredRealBuildBootstrapSourceManifest();
    });
    expect(() => calibrationGlobalSetup(config)).toThrow(/bootstrap source manifest is not JSON/u);
    expect(checks.order).toEqual(["output", "manifest"]);
    expect(checks.manifest).toHaveBeenCalledExactlyOnceWith();
    expect(checks.lock).not.toHaveBeenCalled();
  });

  it("retains the real missing-lock refusal after parsing a valid synthetic manifest", async () => {
    const { actual } = await syntheticBootstrap();
    checks.manifest.mockImplementation(() => {
      checks.order.push("manifest");
      return actual.readRequiredRealBuildBootstrapSourceManifest();
    });
    checks.lock.mockImplementation(() => {
      checks.order.push("lock");
      return actual.assertRealBuildBootstrapSourceLockHeld();
    });
    vi.stubEnv("LEGO_REAL_BUILD_BOOTSTRAP_LOCK_PID", "0");
    expect(() => calibrationGlobalSetup(config)).toThrow(
      /source-lock PID must be a positive integer/u,
    );
    expect(checks.order).toEqual(["output", "manifest", "lock"]);
    expect(checks.manifest).toHaveBeenCalledExactlyOnceWith();
    expect(checks.lock).toHaveBeenCalledExactlyOnceWith();
  });

  it.each(["1", undefined, "0"])(
    "refuses output before any source check when the generic bootstrap flag is %s",
    (value) => {
      vi.stubEnv("LEGO_REAL_BUILD_REQUIRED", value);
      const failure = new Error("synthetic runner output refusal");
      checks.output.mockImplementation(() => {
        checks.order.push("output");
        throw failure;
      });
      checks.manifest.mockImplementation(() => {
        throw new Error("Manifest check reached after output refusal.");
      });
      checks.lock.mockImplementation(() => {
        throw new Error("Lock check reached after output refusal.");
      });
      expect(() => calibrationGlobalSetup(config)).toThrow(failure);
      expect(checks.order).toEqual(["output"]);
      expect(checks.manifest).not.toHaveBeenCalled();
      expect(checks.lock).not.toHaveBeenCalled();
    },
  );
});
