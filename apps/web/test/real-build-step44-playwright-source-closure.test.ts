import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  REAL_BUILD_PLAYWRIGHT_CALIBRATION_SPEC,
  REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_SPEC,
  selectRealBuildPlaywrightLifecycleHooks,
  selectRealBuildPlaywrightOperation,
} from "../e2e/playwright-config-support.ts";
import { captureRealBuildStep44PreUnlockSourceSnapshots } from "../e2e/real-build-step44-playwright-source-closure.ts";

const FORBIDDEN_BASENAMES = new Set([
  "real-build-prefix50-subbuild-return-review-camera.ts",
  "real-build-prefix50-subbuild-return-review-camera-source.ts",
  "real-build-prefix50-subbuild-return-review-camera-source-commitments.ts",
  "real-build-prefix50-subbuild-return-review-camera-real-domain-heldout.ts",
]);
const FORBIDDEN_PATH = /(?:^|\/)[^/]*(?:page45|step45|heldout)[^/]*$/iu;

function removeOwnedClosureFixture(repositoryRoot: string, temporaryRoot: string): void {
  if (dirname(resolve(repositoryRoot)) !== temporaryRoot)
    throw new Error("Refusing cleanup outside the owned temporary parent.");
  rmSync(repositoryRoot, { recursive: true, force: false });
}

function capture(mode: "camera-only" | "real-domain-calibration") {
  const operation = selectRealBuildPlaywrightOperation(
    mode === "camera-only"
      ? { LEGO_REAL_BUILD_STEP44_CAMERA_ONLY_REQUIRED: "1" }
      : { LEGO_REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_REQUIRED: "1" },
  );
  if (operation.mode !== mode) throw new TypeError(`Expected ${mode}, received ${operation.mode}.`);
  const exactReads: string[] = [];
  const snapshots = captureRealBuildStep44PreUnlockSourceSnapshots({
    repositoryRoot: resolve("."),
    operation,
    beforeExactFileRead: (path) => {
      exactReads.push(path);
      if (FORBIDDEN_BASENAMES.has(path.split("/").at(-1)!) || FORBIDDEN_PATH.test(path))
        throw new TypeError(`Denied pre-unlock read of ${path}.`);
    },
  });
  return { exactReads, paths: snapshots.map(({ path }) => path) };
}

describe("Step-44 mode-specific Playwright source closure", () => {
  // Bound: both live entry-point closures, including lazy capability checks, while all
  // held-out/page45 source modules remain unread before qualification. Exact admitted PDF
  // and material payloads are read only for identity hashing, never decoded or rendered.
  it("reads and hashes only the exact page44-safe calibration closure", () => {
    const { exactReads, paths } = capture("real-domain-calibration");
    expect(paths).toContain("playwright.config.ts");
    expect(paths).toContain("apps/web/e2e/real-build-step44-calibration-global-setup.ts");
    expect(paths).toContain("apps/web/e2e/real-build-bootstrap-source.ts");
    expect(paths).not.toContain("apps/web/e2e/global-setup.ts");
    expect(paths).not.toContain("apps/web/e2e/sample-booklet.ts");
    expect(paths).not.toContain("apps/web/e2e/vite-server-lifecycle.ts");
    expect(paths).not.toContain("apps/web/vite.config.ts");
    expect(paths).not.toContain("apps/web/src/main.tsx");
    expect(paths).toContain("apps/web/e2e/real-build-global-teardown.ts");
    expect(paths).toContain(`apps/web/e2e/${REAL_BUILD_PLAYWRIGHT_CALIBRATION_SPEC}`);
    expect(paths).toContain("apps/web/e2e/real-build-prefix50-step44-runtime-materials.ts");
    expect(paths).toContain(
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-session.ts",
    );
    expect(paths).toContain(
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts",
    );
    expect(paths).not.toContain(`apps/web/e2e/${REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_SPEC}`);
    expect(exactReads.length).toBeGreaterThan(paths.length);
    expect(exactReads.every((path) => paths.includes(path))).toBe(true);
  }, 60_000);

  it("keeps v4 on the persisted-qualification closure before deliberate page45 imports", () => {
    const { exactReads, paths } = capture("camera-only");
    expect(paths).toContain("apps/web/e2e/global-setup.ts");
    expect(paths).toContain("apps/web/e2e/sample-booklet.ts");
    expect(paths).toContain("apps/web/vite.config.ts");
    expect(paths).toContain("apps/web/src/main.tsx");
    expect(paths).not.toContain("apps/web/e2e/real-build-step44-calibration-global-setup.ts");
    expect(paths).toContain(`apps/web/e2e/${REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_SPEC}`);
    expect(paths).toContain(
      "apps/web/e2e/real-build-prefix50-step44-calibration-persisted-binding.ts",
    );
    expect(paths).toContain(
      "apps/web/e2e/real-build-prefix50-subbuild-return-review-camera-real-domain-persisted-qualification.ts",
    );
    expect(paths).not.toContain(`apps/web/e2e/${REAL_BUILD_PLAYWRIGHT_CALIBRATION_SPEC}`);
    expect(exactReads.some((path) => FORBIDDEN_PATH.test(path))).toBe(false);
    expect(exactReads.some((path) => FORBIDDEN_BASENAMES.has(path.split("/").at(-1)!))).toBe(false);
  }, 60_000);

  // Bound: static and literal dynamic local import edges before any synthetic material
  // inputs exist. This proves traversal/refusal, not OS isolation or source qualification.
  it.each([
    ['import "vite";', /Vite import vite/u],
    ['await import("vite/module-runner");', /Vite import vite\/module-runner/u],
    ['import "./sample-booklet.ts";', /booklet-discovery path .*sample-booklet/u],
    ['import "./global-setup.ts";', /development-server .*global-setup/u],
  ])("rejects a transitive calibration server import: %s", (forbiddenImport, message) => {
    const temporaryRoot = resolve(tmpdir());
    const repositoryRoot = mkdtempSync(join(temporaryRoot, "lego-calibration-closure-test-"));
    const exactReads: string[] = [];
    try {
      const operation = selectRealBuildPlaywrightOperation({
        LEGO_REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_REQUIRED: "1",
      });
      if (operation.mode !== "real-domain-calibration") throw new Error("Wrong test operation.");
      const setup = "./apps/web/e2e/real-build-step44-calibration-global-setup.ts";
      expect(selectRealBuildPlaywrightLifecycleHooks(operation)).toEqual({
        globalSetup: setup,
        globalTeardown: "./apps/web/e2e/real-build-global-teardown.ts",
      });
      for (const [path, source] of [
        ["playwright.config.ts", ""],
        ["apps/web/e2e/real-build-global-teardown.ts", ""],
        [setup, 'import "./calibration-transitive.ts";'],
        ["apps/web/e2e/calibration-transitive.ts", forbiddenImport],
        ["apps/web/e2e/sample-booklet.ts", 'throw new Error("must not be read");'],
        ["apps/web/e2e/global-setup.ts", 'throw new Error("must not be read");'],
      ]) {
        const target = resolve(repositoryRoot, path!);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, source!, { flag: "wx" });
      }
      expect(() =>
        captureRealBuildStep44PreUnlockSourceSnapshots({
          repositoryRoot,
          operation,
          beforeExactFileRead: (path) => exactReads.push(path),
        }),
      ).toThrow(message);
      expect(exactReads).toContain("apps/web/e2e/calibration-transitive.ts");
      expect(exactReads).not.toContain("apps/web/e2e/sample-booklet.ts");
      expect(exactReads).not.toContain("apps/web/e2e/global-setup.ts");
      expect(exactReads.some((path) => path.startsWith("recipes/"))).toBe(false);
    } finally {
      removeOwnedClosureFixture(repositoryRoot, temporaryRoot);
    }
  });
});
