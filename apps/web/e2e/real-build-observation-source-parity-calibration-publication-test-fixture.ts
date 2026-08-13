import type {
  RealBuildSourceParityProbeResult,
  RealBuildSourceParityProvenanceRole,
} from "./real-build-observation-source-parity-types";
import {
  createRealBuildSourceParityTestFixture,
  createRealBuildSourceParityTestProvenance,
  sourceParityTestDigest,
} from "./real-build-observation-source-parity-test-fixture";

interface CalibrationSourceBinding {
  readonly browserResultDigest: string;
  readonly browserResultBytes: number;
  readonly preparedPanelsDigest: string;
}

function calibrationEnvironmentBytes(
  repoRoot: string,
  binding: CalibrationSourceBinding,
  sourceSnapshot: RealBuildSourceParityProbeResult["sourceSnapshot"],
): Buffer {
  return Buffer.from(
    `${JSON.stringify({
      schemaVersion: "lego.real-build-source-parity-environment/1",
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      versions: process.versions,
      browser: { name: "chromium", version: "test" },
      playwright:
        "@playwright/test (bootstrap and execution-mirror manifests bind package paths/digests)",
      bootstrapSourceManifestDigest: sourceSnapshot.bootstrapManifestDigest,
      executionSourceMirrorManifestDigest: sourceSnapshot.executionMirrorManifestDigest,
      servedResponseManifestDigest: sourceSnapshot.servedResponseManifestDigest,
      servedSourceBundleManifestDigest: sourceSnapshot.servedSourceBundleManifestDigest,
      servedSourceBundleDigest: sourceSnapshot.servedSourceBundleDigest,
      checkoutRoot: repoRoot,
      ...binding,
    })}\n`,
  );
}

export function createRealBuildSourceParityCalibrationTestSourceClosure(
  repoRoot: string,
  binding: CalibrationSourceBinding,
): {
  readonly sourceSnapshot: RealBuildSourceParityProbeResult["sourceSnapshot"];
  readonly provenance: readonly RealBuildSourceParityProvenanceRole[];
} {
  const fixture = createRealBuildSourceParityTestFixture(repoRoot);
  const environment = calibrationEnvironmentBytes(repoRoot, binding, fixture.sourceSnapshot);
  const provenance = createRealBuildSourceParityTestProvenance(repoRoot).map((entry) =>
    entry.role === "execution-environment"
      ? {
          role: entry.role,
          digest: sourceParityTestDigest(environment),
          bytes: environment,
        }
      : entry,
  );
  return {
    sourceSnapshot: {
      ...fixture.sourceSnapshot,
      ...binding,
      environmentDigest: sourceParityTestDigest(environment),
    },
    provenance,
  };
}
