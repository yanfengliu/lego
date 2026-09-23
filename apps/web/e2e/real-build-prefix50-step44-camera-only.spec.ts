import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_DEFAULT_OUTPUT_NAME,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_GATE_ENV,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_OUTPUT_ENV,
  REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_QUALIFICATION_OUTPUT_ENV,
} from "./real-build-prefix50-step44-camera-only-gate-input";
import { runRealBuildPrefix50Step44CameraOnlyGate } from "./real-build-prefix50-step44-camera-only-gate-support";

const REQUIRED = process.env[REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_GATE_ENV] === "1";
const SOURCE_LOCK_REQUIRED = process.env.LEGO_REAL_BUILD_REQUIRED === "1";

test.describe.configure({ mode: "serial", timeout: 900_000 });
test.skip(
  !REQUIRED || !SOURCE_LOCK_REQUIRED,
  `set LEGO_REAL_BUILD_REQUIRED=1, ${REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_GATE_ENV}=1, and ${REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_QUALIFICATION_OUTPUT_ENV}=<existing-qualified-page44-output> to run the exact page-45/257-parent camera-only gate`,
);

test("resolves Step 44 from page 45 using only the shared Step-43 parent", async ({
  browserName,
}, testInfo) => {
  expect(browserName).toBe("chromium");
  expect(process.env.LEGO_REAL_BUILD_REQUIRED).toBe("1");
  const outputName =
    process.env[REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_OUTPUT_ENV] ??
    REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_DEFAULT_OUTPUT_NAME;
  const qualificationOutputPath =
    process.env[REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_QUALIFICATION_OUTPUT_ENV];
  if (qualificationOutputPath === undefined || qualificationOutputPath.length === 0)
    throw new TypeError(
      `Camera-only Step-44 v4 requires ${REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_QUALIFICATION_OUTPUT_ENV}.`,
    );
  const result = await runRealBuildPrefix50Step44CameraOnlyGate({
    repositoryRoot: resolve("."),
    outputName,
    qualificationOutputPath: resolve(qualificationOutputPath),
  });
  expect(result.outputPath).toBe(
    resolve("output/playwright/real-build-prefix50-step44-return-review", outputName),
  );
  expect(result.manifestCommitment).toMatch(/^sha256:[0-9a-f]{64}$/u);
  await testInfo.attach(REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE, {
    path: resolve(result.outputPath, REAL_BUILD_PREFIX50_STEP44_CAMERA_ONLY_MANIFEST_FILE),
    contentType: "application/json",
  });
  for (const artifactFile of [
    "real-build-prefix50-step44-page45-camera-source-crop.png",
    "real-build-prefix50-step44-page45-camera-parent-target-mask.png",
    "real-build-prefix50-step44-page45-camera-selected-parent.png",
  ])
    await testInfo.attach(artifactFile, {
      path: resolve(result.outputPath, artifactFile),
      contentType: "image/png",
    });
});
