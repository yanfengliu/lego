import { ensureContainedDirectoryTree } from "./contained-directory";
import { writeContainedRegularFileAtomic } from "./contained-atomic-write";
import { snapshotRealBuildSourceParityCalibrationPublicationInput } from "./real-build-observation-source-parity-calibration-publication-input";
import { parsePublishedRealBuildSourceParityCalibration } from "./real-build-observation-source-parity-calibration-publication-parser";
import {
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
  type RealBuildSourceParityCalibrationPublicationArtifact,
} from "./real-build-observation-source-parity-calibration-publication-types";
import { prepareRealBuildSourceParityCalibrationPublication } from "./real-build-observation-source-parity-calibration-publication-validation";

/**
 * Publishes a source-bound exact-five calibration closure.
 *
 * The execution identity is audit data derived inside the verifier; it is never
 * caller-supplied authority. Content-addressed bytes land first and the one
 * discoverable summary is replaced atomically only after every role succeeds.
 */
export function publishRealBuildSourceParityCalibration(
  rawInput: unknown,
): RealBuildSourceParityCalibrationPublicationArtifact {
  const input = snapshotRealBuildSourceParityCalibrationPublicationInput(rawInput);
  const prepared = prepareRealBuildSourceParityCalibrationPublication(input);
  const { summary } = prepared;
  for (const directory of ["capture", "prepared", "roles", "pngs", "provenance"] as const) {
    ensureContainedDirectoryTree(
      input.repoRoot,
      `${summary.runDirectory}/${directory}`,
      `Calibration publication ${directory} directory`,
    );
  }
  writeContainedRegularFileAtomic(
    input.repoRoot,
    summary.captureManifest.file,
    prepared.capture.manifestBytes,
    { label: "Calibration publication capture manifest", replace: true },
  );
  writeContainedRegularFileAtomic(
    input.repoRoot,
    summary.fullPreparedPanelsManifest.file,
    prepared.fullPreparedPanelsManifestBytes,
    { label: "Calibration publication full prepared-panels manifest", replace: true },
  );
  prepared.capture.roles.forEach((attachment, index) => {
    const descriptor = summary.roles[index]!;
    writeContainedRegularFileAtomic(input.repoRoot, descriptor.file, attachment.bytes, {
      label: `Calibration publication role ${descriptor.role}`,
      replace: true,
    });
  });
  prepared.capture.pngs.forEach((attachment, index) => {
    const descriptor = summary.pngs[index]!;
    writeContainedRegularFileAtomic(input.repoRoot, descriptor.file, attachment.bytes, {
      label: `Calibration publication step ${descriptor.stepNumber} ${descriptor.scale} PNG`,
      replace: true,
    });
  });
  const writtenProvenance = new Set<string>();
  prepared.provenance.forEach((attachment, index) => {
    const descriptor = summary.provenance[index]!;
    if (writtenProvenance.has(descriptor.digest)) return;
    writeContainedRegularFileAtomic(input.repoRoot, descriptor.file, attachment.bytes, {
      label: `Calibration publication provenance ${descriptor.role}`,
      replace: true,
    });
    writtenProvenance.add(descriptor.digest);
  });
  writeContainedRegularFileAtomic(
    input.repoRoot,
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
    prepared.summaryBytes,
    { label: "Calibration publication discoverable summary", replace: true },
  );
  return parsePublishedRealBuildSourceParityCalibration({
    repoRoot: input.repoRoot,
    summaryPath: REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
  });
}

export { parsePublishedRealBuildSourceParityCalibration } from "./real-build-observation-source-parity-calibration-publication-parser";
export type { RealBuildSourceParityCalibrationPublicationArtifact } from "./real-build-observation-source-parity-calibration-publication-types";
