import { isAbsolute } from "node:path";

import type { PlaywrightTestConfig } from "@playwright/test";

export const REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_ENV =
  "LEGO_REAL_BUILD_STEP44_CAMERA_ONLY_REQUIRED" as const;
export const REAL_BUILD_PLAYWRIGHT_CALIBRATION_ENV =
  "LEGO_REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_REQUIRED" as const;
export const REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_ENV =
  "LEGO_REAL_BUILD_PREFIX50_STEP44_SOURCE_LOCKED_OPERATION" as const;
export const REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_SPEC =
  "real-build-prefix50-step44-camera-only.spec.ts" as const;
export const REAL_BUILD_PLAYWRIGHT_CALIBRATION_SPEC =
  "real-build-prefix50-step44-real-domain-calibration.spec.ts" as const;
export const REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_SPEC =
  "real-build-prefix50-subbuild-return-review-source-locked.spec.ts" as const;

export type RealBuildPlaywrightOperation =
  | Readonly<{ mode: "ordinary"; testMatch: "**/*.spec.ts" }>
  | Readonly<{
      mode: "camera-only";
      testMatch: typeof REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_SPEC;
    }>
  | Readonly<{
      mode: "real-domain-calibration";
      testMatch: typeof REAL_BUILD_PLAYWRIGHT_CALIBRATION_SPEC;
    }>
  | Readonly<{
      mode: "source-locked-capture" | "source-locked-finalize";
      testMatch: typeof REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_SPEC;
    }>;

function requireFlag(value: string | undefined, name: string): boolean {
  if (value === undefined) return false;
  if (value !== "1") throw new TypeError(`${name} must be exactly 1 when present.`);
  return true;
}

export function selectRealBuildPlaywrightOperation(
  environment: Readonly<Record<string, string | undefined>>,
): RealBuildPlaywrightOperation {
  const cameraOnly = requireFlag(
    environment[REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_ENV],
    REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_ENV,
  );
  const calibration = requireFlag(
    environment[REAL_BUILD_PLAYWRIGHT_CALIBRATION_ENV],
    REAL_BUILD_PLAYWRIGHT_CALIBRATION_ENV,
  );
  const sourceLocked = environment[REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_ENV];
  if (sourceLocked !== undefined && sourceLocked !== "capture" && sourceLocked !== "finalize")
    throw new TypeError(
      `${REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_ENV} must be capture or finalize when present.`,
    );
  if (Number(cameraOnly) + Number(calibration) + Number(sourceLocked !== undefined) > 1)
    throw new TypeError(
      "Step-44 camera-only, real-domain calibration, and source-locked Playwright operations are mutually exclusive.",
    );
  if (cameraOnly)
    return Object.freeze({
      mode: "camera-only",
      testMatch: REAL_BUILD_PLAYWRIGHT_CAMERA_ONLY_SPEC,
    });
  if (calibration)
    return Object.freeze({
      mode: "real-domain-calibration",
      testMatch: REAL_BUILD_PLAYWRIGHT_CALIBRATION_SPEC,
    });
  if (sourceLocked !== undefined)
    return Object.freeze({
      mode: sourceLocked === "capture" ? "source-locked-capture" : "source-locked-finalize",
      testMatch: REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_SPEC,
    });
  return Object.freeze({ mode: "ordinary", testMatch: "**/*.spec.ts" });
}

export function selectRealBuildPlaywrightLifecycleHooks(
  operation: RealBuildPlaywrightOperation,
): Readonly<{
  globalSetup:
    | "./apps/web/e2e/real-build-step44-calibration-global-setup.ts"
    | "./apps/web/e2e/global-setup.ts";
  globalTeardown: "./apps/web/e2e/real-build-global-teardown.ts";
}> {
  return Object.freeze({
    globalSetup:
      operation.mode === "real-domain-calibration"
        ? "./apps/web/e2e/real-build-step44-calibration-global-setup.ts"
        : "./apps/web/e2e/global-setup.ts",
    globalTeardown: "./apps/web/e2e/real-build-global-teardown.ts",
  });
}

export function createRealBuildPlaywrightConfig(input: {
  readonly port: number;
  readonly operation: RealBuildPlaywrightOperation;
  readonly calibrationOutputDir?: string;
}): PlaywrightTestConfig {
  let outputDir = "test-results/playwright";
  if (input.operation.mode === "real-domain-calibration") {
    if (typeof input.calibrationOutputDir !== "string" || !isAbsolute(input.calibrationOutputDir))
      throw new TypeError(
        "Step-44 calibration config requires an explicit absolute runner output directory.",
      );
    outputDir = input.calibrationOutputDir;
  }
  return {
    testDir: "./apps/web/e2e",
    testMatch: input.operation.testMatch,
    ...(input.operation.mode === "ordinary"
      ? { testIgnore: REAL_BUILD_PLAYWRIGHT_SOURCE_LOCKED_SPEC }
      : {}),
    fullyParallel: false,
    forbidOnly: true,
    retries: 0,
    workers: 1,
    ...selectRealBuildPlaywrightLifecycleHooks(input.operation),
    outputDir,
    reporter: "list",
    use: {
      baseURL: `http://127.0.0.1:${input.port}`,
      headless: true,
      serviceWorkers: "block",
      screenshot: "only-on-failure",
      trace: "retain-on-failure",
      viewport: { width: 1440, height: 1000 },
    },
  };
}
