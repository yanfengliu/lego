import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_DEFAULT_OUTPUT,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_ENV,
  REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_OUTPUT_ENV,
  requireRealBuildPrefix50Step44RealDomainCalibrationOutputName,
} from "./real-build-prefix50-step44-real-domain-calibration-operation.ts";
import { runRealBuildPrefix50Step44RealDomainCalibrationPublication } from "./real-build-prefix50-step44-real-domain-calibration-publication.ts";
import { completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication } from "./real-build-prefix50-step44-calibration-directory-transaction.ts";
import { REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT } from "./real-build-prefix50-subbuild-return-review-harness-input.ts";
import { assertRealBuildStep44CalibrationTestOutput } from "./real-build-step44-calibration-runner-output.ts";

const REQUIRED = process.env[REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_ENV] === "1";
const SOURCE_LOCK_REQUIRED = process.env.LEGO_REAL_BUILD_REQUIRED === "1";

test.describe.configure({ mode: "serial", timeout: 900_000 });
test.skip(
  !REQUIRED || !SOURCE_LOCK_REQUIRED,
  `set LEGO_REAL_BUILD_REQUIRED=1 and ${REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_ENV}=1 to run page44-only Steps 41/42 calibration and the one-shot Step43 holdout`,
);

test("persists page44 Steps 41/42 qualification and only then opens Step43", async ({
  browserName,
}, testInfo) => {
  assertRealBuildStep44CalibrationTestOutput(testInfo);
  expect(browserName).toBe("chromium");
  const repositoryRoot = resolve(".");
  const outputName = requireRealBuildPrefix50Step44RealDomainCalibrationOutputName(
    process.env[REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_OUTPUT_ENV] ??
      REAL_BUILD_PREFIX50_STEP44_REAL_DOMAIN_CALIBRATION_DEFAULT_OUTPUT,
  );
  const outputPath = resolve(REAL_BUILD_PREFIX50_STEP44_REVIEW_OUTPUT_ROOT, outputName);
  const result = await runRealBuildPrefix50Step44RealDomainCalibrationPublication({
    repositoryRoot,
    outputPath,
  });
  try {
    expect(result.outputPath).toBe(outputPath);
    expect(result.manifest.status).toBe("qualified-and-validated");
    assertRealBuildStep44CalibrationTestOutput(testInfo);
    await testInfo.attach("real-domain-camera-gate.json", {
      path: resolve(outputPath, "real-domain-camera-gate.json"),
      contentType: "application/json",
    });
    assertRealBuildStep44CalibrationTestOutput(testInfo);
  } finally {
    await completeRealBuildPrefix50Step44CommittedCalibrationDirectoryPublication(
      result.committedPublication,
    );
  }
});
