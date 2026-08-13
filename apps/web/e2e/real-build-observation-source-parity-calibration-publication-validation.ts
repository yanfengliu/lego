import { canonicalDigest, canonicalStringify, type Sha256Digest } from "@lego-studio/brick-kernel";

import { copyRealBuildSourceParityCalibrationCaptureArtifact } from "./real-build-observation-source-parity-calibration-capture-parser";
import {
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY,
  type RealBuildSourceParityCalibrationCaptureAttachments,
  type RealBuildSourceParityCalibrationCaptureManifest,
} from "./real-build-observation-source-parity-calibration-capture-types";
import { parseRealBuildSourceParityCalibrationFullPreparedPanelsManifest } from "./real-build-observation-source-parity-calibration-publication-manifest";
import {
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_BYTES,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_EXECUTION_IDENTITY_SCHEMA,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SCHEMA,
  type RealBuildSourceParityCalibrationPublicationSummary,
} from "./real-build-observation-source-parity-calibration-publication-types";
import type { PreparedRealBuildSourceParityCalibrationPublicationInput } from "./real-build-observation-source-parity-calibration-publication-input";
import {
  prepareRealBuildSourceParityProvenance,
  type PreparedRealBuildSourceParityProvenanceRole,
} from "./real-build-observation-source-parity-provenance";

export interface PreparedRealBuildSourceParityCalibrationPublication {
  readonly summary: RealBuildSourceParityCalibrationPublicationSummary;
  readonly summaryBytes: Uint8Array;
  readonly capture: RealBuildSourceParityCalibrationCaptureAttachments;
  readonly fullPreparedPanelsManifestBytes: Uint8Array;
  readonly provenance: readonly PreparedRealBuildSourceParityProvenanceRole[];
}

function pngDescriptors(manifest: RealBuildSourceParityCalibrationCaptureManifest) {
  return manifest.panels.flatMap((panel) =>
    (["high", "work"] as const).map((scale) => ({
      stepNumber: panel.stepNumber,
      scale,
      ...(scale === "high" ? panel.highPng : panel.workPng),
    })),
  );
}

/** Reproduces every source, capture, and prepared-panel binding before publication may write. */
export function prepareRealBuildSourceParityCalibrationPublication(
  input: PreparedRealBuildSourceParityCalibrationPublicationInput,
): PreparedRealBuildSourceParityCalibrationPublication {
  const capture = copyRealBuildSourceParityCalibrationCaptureArtifact(input.capture);
  const captureManifest = input.capture.manifest;
  const full = parseRealBuildSourceParityCalibrationFullPreparedPanelsManifest(
    input.fullPreparedPanelsManifestBytes,
  );
  if (
    full.digest !== captureManifest.fullPreparedPanelsDigest ||
    full.digest !== input.sourceSnapshot.preparedPanelsDigest
  ) {
    throw new TypeError(
      `Calibration full prepared-panels digest ${full.digest} must match capture ${captureManifest.fullPreparedPanelsDigest} and source snapshot ${input.sourceSnapshot.preparedPanelsDigest}.`,
    );
  }
  if (
    full.pdfDigest !== captureManifest.pdfDigest ||
    full.contract.calibrationPreparedPanelsDigest !==
      captureManifest.calibrationPreparedPanelsDigest ||
    full.contract.calibrationDigest !== captureManifest.calibrationDigest
  ) {
    throw new TypeError(
      "Calibration full prepared-panels contract does not reproduce the capture PDF, exact-five subset, and calibration digest.",
    );
  }
  if (
    input.sourceSnapshot.browserResultDigest !== captureManifest.browserCaptureDigest ||
    input.sourceSnapshot.browserResultBytes !== captureManifest.browserCaptureBytes
  ) {
    throw new TypeError(
      `Calibration source snapshot browser result ${input.sourceSnapshot.browserResultBytes}/${input.sourceSnapshot.browserResultDigest} must match exact capture ${captureManifest.browserCaptureBytes}/${captureManifest.browserCaptureDigest}.`,
    );
  }
  const provenance = prepareRealBuildSourceParityProvenance({
    roles: input.provenance,
    snapshot: input.sourceSnapshot,
    pdfDigest: captureManifest.pdfDigest,
    pdfBytes: captureManifest.pdfBytes,
    repoRoot: input.repoRoot,
  });
  const roleDescriptors = captureManifest.roles.map((role) => ({ ...role }));
  const pngs = pngDescriptors(captureManifest);
  const provenanceDescriptors = provenance.map(({ role, digest, bytes }) => ({
    role,
    digest: digest as Sha256Digest,
    byteLength: bytes.length,
  }));
  const executionIdentityDigest = canonicalDigest({
    schemaVersion: REAL_BUILD_SOURCE_PARITY_CALIBRATION_EXECUTION_IDENTITY_SCHEMA,
    captureManifestDigest: input.capture.manifestDigest,
    captureManifestBytes: capture.manifestBytes.length,
    sourceSnapshot: input.sourceSnapshot,
    provenance: provenanceDescriptors,
    fullPreparedPanelsManifestDigest: full.digest,
    fullPreparedPanelsManifestBytes: full.bytes.length,
    roles: roleDescriptors,
    pngs,
  }) as Sha256Digest;
  const identityHash = executionIdentityDigest.slice("sha256:".length);
  const runDirectory = `output/playwright/real-build-source-calibration/runs/${identityHash}`;
  const captureManifestFile = `${runDirectory}/capture/${input.capture.manifestDigest.slice("sha256:".length)}.json`;
  const fullManifestFile = `${runDirectory}/prepared/${full.digest.slice("sha256:".length)}.json`;
  const publishedRoles = roleDescriptors.map((role) => ({
    ...role,
    file: `${runDirectory}/roles/${role.role}-${role.digest.slice("sha256:".length)}.bin`,
  }));
  const publishedPngs = pngs.map((png) => ({
    ...png,
    file: `${runDirectory}/pngs/${String(png.stepNumber).padStart(3, "0")}-${png.scale}-${String(png.digest).slice("sha256:".length)}.png`,
  }));
  const publishedProvenance = provenanceDescriptors.map((role) => ({
    ...role,
    file: `${runDirectory}/provenance/${role.digest.slice("sha256:".length)}.bin`,
  }));
  const summary: RealBuildSourceParityCalibrationPublicationSummary = {
    schemaVersion: REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SCHEMA,
    authority: REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY,
    reviewState: "pending-unreviewed",
    executionIdentityDigest,
    runDirectory,
    captureManifest: {
      file: captureManifestFile,
      byteLength: capture.manifestBytes.length,
      digest: input.capture.manifestDigest,
    },
    fullPreparedPanelsManifest: {
      file: fullManifestFile,
      byteLength: full.bytes.length,
      digest: full.digest,
    },
    sourceSnapshot: input.sourceSnapshot,
    roles: publishedRoles,
    pngs: publishedPngs,
    provenance: publishedProvenance,
  };
  const summaryBytes = new TextEncoder().encode(canonicalStringify(summary));
  if (
    summaryBytes.length > MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_BYTES
  ) {
    throw new RangeError(
      `Calibration publication summary has ${summaryBytes.length} bytes; expected at most ${MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_BYTES}.`,
    );
  }
  return Object.freeze({
    summary,
    summaryBytes,
    capture,
    fullPreparedPanelsManifestBytes: new Uint8Array(full.bytes),
    provenance,
  });
}
