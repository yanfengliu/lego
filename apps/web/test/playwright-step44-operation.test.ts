import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  REAL_BUILD_PLAYWRIGHT_CALIBRATION_ENV,
  REAL_BUILD_PLAYWRIGHT_CALIBRATION_SPEC,
  REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_ENV,
  REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_SPEC,
  REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_ENV,
  REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_SPEC,
  createRealBuildPlaywrightConfig,
  selectRealBuildPlaywrightLifecycleHooks,
  selectRealBuildPlaywrightOperation,
} from "../e2e/playwright-config-support.ts";

// Inert config data only: this unit suite does not claim or create a runner directory.
const calibrationOutputDir = resolve(tmpdir(), "lego-calibration-config-test", "playwright");

describe("Step-44 Playwright operation isolation", () => {
  it.each([
    [
      { [REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_ENV]: "1" },
      "camera-only",
      REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_SPEC,
    ],
    [
      { [REAL_BUILD_PLAYWRIGHT_CALIBRATION_ENV]: "1" },
      "real-domain-calibration",
      REAL_BUILD_PLAYWRIGHT_CALIBRATION_SPEC,
    ],
    [
      { [REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_ENV]: "capture" },
      "source-locked-capture",
      REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_SPEC,
    ],
    [
      { [REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_ENV]: "finalize" },
      "source-locked-finalize",
      REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_SPEC,
    ],
  ] as const)("selects only the exact %s spec", (environment, mode, expectedSpec) => {
    const operation = selectRealBuildPlaywrightOperation(environment);
    expect(operation).toEqual({ mode, testMatch: expectedSpec });
    const config = createRealBuildPlaywrightConfig({
      port: 5_267,
      operation,
      calibrationOutputDir,
    });
    const expectedHooks = {
      globalSetup:
        mode === "real-domain-calibration"
          ? "./apps/web/e2e/real-build-step44-calibration-global-setup.ts"
          : "./apps/web/e2e/global-setup.ts",
      globalTeardown: "./apps/web/e2e/real-build-global-teardown.ts",
    };
    expect(selectRealBuildPlaywrightLifecycleHooks(operation)).toEqual(expectedHooks);
    expect(config).toMatchObject(expectedHooks);
    expect(config.testMatch).toBe(expectedSpec);
    expect(config.testIgnore).toBeUndefined();
    expect(config.globalSetup).toBe(
      mode === "real-domain-calibration"
        ? "./apps/web/e2e/real-build-step44-calibration-global-setup.ts"
        : "./apps/web/e2e/global-setup.ts",
    );
    expect(config.globalTeardown).toBe("./apps/web/e2e/real-build-global-teardown.ts");
    expect(config.outputDir).toBe(
      mode === "real-domain-calibration" ? calibrationOutputDir : "test-results/playwright",
    );
  });

  it.each([undefined, "", "test-results/playwright"])(
    "refuses calibration without an explicit absolute output path: %s",
    (outputDir) => {
      const operation = selectRealBuildPlaywrightOperation({
        [REAL_BUILD_PLAYWRIGHT_CALIBRATION_ENV]: "1",
      });
      expect(() =>
        createRealBuildPlaywrightConfig({
          port: 5_267,
          operation,
          ...(outputDir === undefined ? {} : { calibrationOutputDir: outputDir }),
        }),
      ).toThrow(/explicit absolute runner output directory/u);
    },
  );

  it.each([
    {
      [REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_ENV]: "1",
      [REAL_BUILD_PLAYWRIGHT_CALIBRATION_ENV]: "1",
    },
    {
      [REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_ENV]: "1",
      [REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_ENV]: "capture",
    },
    {
      [REAL_BUILD_PLAYWRIGHT_CALIBRATION_ENV]: "1",
      [REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_ENV]: "finalize",
    },
    {
      [REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_ENV]: "1",
      [REAL_BUILD_PLAYWRIGHT_CALIBRATION_ENV]: "1",
      [REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_ENV]: "capture",
    },
  ])("rejects conflicting modes before config construction", (environment) => {
    expect(() => selectRealBuildPlaywrightOperation(environment)).toThrow(/mutually exclusive/u);
  });

  it.each([
    [{ [REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_ENV]: "0" }, /exactly 1/u],
    [{ [REAL_BUILD_PLAYWRIGHT_CALIBRATION_ENV]: "true" }, /exactly 1/u],
    [{ [REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_ENV]: "other" }, /capture or finalize/u],
  ] as const)("rejects a malformed operation flag", (environment, message) => {
    expect(() => selectRealBuildPlaywrightOperation(environment)).toThrow(message);
  });

  it("keeps only the source-locked production spec out of the ordinary suite", () => {
    const operation = selectRealBuildPlaywrightOperation({});
    const config = createRealBuildPlaywrightConfig({ port: 5_267, operation });
    expect(operation).toEqual({ mode: "ordinary", testMatch: "**/*.spec.ts" });
    expect(config.testIgnore).toBe(REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_SPEC);
    expect(config.globalSetup).toBe("./apps/web/e2e/global-setup.ts");
    expect(config.globalTeardown).toBe("./apps/web/e2e/real-build-global-teardown.ts");
    expect(selectRealBuildPlaywrightLifecycleHooks(operation)).toEqual({
      globalSetup: "./apps/web/e2e/global-setup.ts",
      globalTeardown: "./apps/web/e2e/real-build-global-teardown.ts",
    });
    expect(config.outputDir).toBe("test-results/playwright");
  });
});
