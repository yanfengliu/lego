import type { FullConfig } from "@playwright/test";

import {
  assertRealBuildBootstrapSourceLockHeld,
  readRequiredRealBuildBootstrapSourceManifest,
} from "./real-build-bootstrap-source.ts";
import { assertRealBuildStep44CalibrationResolvedConfig } from "./real-build-step44-calibration-runner-output.ts";

/** Check runner ownership before the optional source bootstrap; no server is started here. */
export default function calibrationGlobalSetup(config: FullConfig): void {
  assertRealBuildStep44CalibrationResolvedConfig(config);
  if (process.env.LEGO_REAL_BUILD_REQUIRED !== "1") return;
  readRequiredRealBuildBootstrapSourceManifest();
  assertRealBuildBootstrapSourceLockHeld();
}
