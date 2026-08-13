import { canonicalStringify } from "@lego-studio/brick-kernel";

import { readContainedBoundedRegularFile } from "./bounded-file-read";
import { parseRealBuildSourceParityCalibrationCapture } from "./real-build-observation-source-parity-calibration-capture-parser";
import {
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES,
  type RealBuildSourceParityCalibrationCaptureRole,
} from "./real-build-observation-source-parity-calibration-capture-types";
import {
  exactCaptureRecord,
  parseCanonicalCaptureJson,
} from "./real-build-observation-source-parity-calibration-capture-structure";
import {
  snapshotRealBuildSourceParityCalibrationPublicationInput,
  snapshotRealBuildSourceParityCalibrationPublicationRepoRoot,
} from "./real-build-observation-source-parity-calibration-publication-input";
import { prepareRealBuildSourceParityCalibrationPublication } from "./real-build-observation-source-parity-calibration-publication-validation";
import { preflightRealBuildSourceParityCalibrationPublicationSummary } from "./real-build-observation-source-parity-calibration-publication-summary";
import {
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_FULL_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_BYTES,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
  type RealBuildSourceParityCalibrationPublicationArtifact,
  type RealBuildSourceParityCalibrationPublicationSummary,
} from "./real-build-observation-source-parity-calibration-publication-types";
import {
  sourceParityDigest,
  sourceParityInteger,
} from "./real-build-observation-source-parity-output-primitives";

interface RetainedPublication {
  readonly summaryBytes: Uint8Array;
  readonly captureManifestBytes: Uint8Array;
  readonly fullManifestBytes: Uint8Array;
  readonly roles: ReadonlyMap<string, Uint8Array>;
  readonly pngs: ReadonlyMap<string, Uint8Array>;
  readonly provenance: ReadonlyMap<string, Uint8Array>;
}

const retainedByArtifact = new WeakMap<object, RetainedPublication>();

function readPublishedFile(
  repoRoot: string,
  raw: unknown,
  label: string,
  maximumBytes: number,
): { readonly descriptor: Record<string, unknown>; readonly bytes: Uint8Array } {
  const descriptor = exactCaptureRecord(raw, ["file", "byteLength", "digest"], label);
  if (typeof descriptor.file !== "string") throw new TypeError(`${label}.file must be a string.`);
  const byteLength = sourceParityInteger(
    descriptor.byteLength,
    1,
    maximumBytes,
    `${label}.byteLength`,
  );
  const digest = sourceParityDigest(descriptor.digest, `${label}.digest`);
  return {
    descriptor,
    bytes: readContainedBoundedRegularFile(repoRoot, descriptor.file, {
      label,
      exactBytes: byteLength,
      maximumBytes,
      expectedSha256: digest,
    }),
  };
}

function createArtifact(
  summary: RealBuildSourceParityCalibrationPublicationSummary,
  retained: RetainedPublication,
): RealBuildSourceParityCalibrationPublicationArtifact {
  const artifact = Object.freeze({
    summary,
    executionIdentityDigest: summary.executionIdentityDigest,
    summaryPath: REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH,
    readSummaryBytes: () => new Uint8Array(retained.summaryBytes),
    readCaptureManifestBytes: () => new Uint8Array(retained.captureManifestBytes),
    readFullPreparedPanelsManifestBytes: () => new Uint8Array(retained.fullManifestBytes),
    readRole: (role: RealBuildSourceParityCalibrationCaptureRole) => {
      if (!REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.includes(role)) {
        throw new TypeError("Calibration publication role is not one of the exact five roles.");
      }
      return new Uint8Array(retained.roles.get(role)!);
    },
    readPng: (stepNumber: number, scale: "high" | "work") => {
      const bytes = retained.pngs.get(`${stepNumber}:${scale}`);
      if (bytes === undefined) {
        throw new TypeError(
          "Calibration publication PNG must name one exact-five high/work image.",
        );
      }
      return new Uint8Array(bytes);
    },
    readProvenance: (role: string) => {
      const bytes = retained.provenance.get(role);
      if (bytes === undefined) {
        throw new TypeError("Calibration publication provenance role was not retained.");
      }
      return new Uint8Array(bytes);
    },
  });
  retainedByArtifact.set(artifact, retained);
  return artifact;
}

/** Re-reads every retained byte class and independently reproduces execution identity. */
export function parsePublishedRealBuildSourceParityCalibration(
  inputValue: unknown,
): RealBuildSourceParityCalibrationPublicationArtifact {
  const input = exactCaptureRecord(inputValue, ["repoRoot", "summaryPath"], "publishedCalibration");
  if (input.summaryPath !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH) {
    throw new TypeError(
      `Published calibration parser requires exact summary path ${REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_PATH}.`,
    );
  }
  const repoRoot = snapshotRealBuildSourceParityCalibrationPublicationRepoRoot(input.repoRoot);
  const summaryBytes = readContainedBoundedRegularFile(repoRoot, input.summaryPath, {
    label: "Calibration publication summary",
    minimumBytes: 2,
    maximumBytes: MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_BYTES,
  });
  const parsed = parseCanonicalCaptureJson(
    summaryBytes,
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SUMMARY_BYTES,
    "calibrationPublication.summaryBytes",
  );
  const summary = preflightRealBuildSourceParityCalibrationPublicationSummary(parsed.value);
  const captureManifest = readPublishedFile(
    repoRoot,
    summary.captureManifest,
    "Calibration published capture manifest",
    4 * 1024 * 1024,
  );
  const fullManifest = readPublishedFile(
    repoRoot,
    summary.fullPreparedPanelsManifest,
    "Calibration published full prepared-panels manifest",
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_FULL_MANIFEST_BYTES,
  );
  const roleAttachments = summary.roles.map((raw, index) => {
    const row = exactCaptureRecord(
      raw,
      ["role", "contentEncoding", "byteLength", "digest", "file"],
      `calibrationPublication.summary.roles[${index}]`,
    );
    const file = readPublishedFile(
      repoRoot,
      { file: row.file, byteLength: row.byteLength, digest: row.digest },
      `Calibration published role ${index}`,
      raw.byteLength,
    );
    return { role: row.role, bytes: file.bytes };
  });
  const pngAttachments = summary.pngs.map((raw, index) => {
    const row = exactCaptureRecord(
      raw,
      [
        "stepNumber",
        "scale",
        "mediaType",
        "byteLength",
        "digest",
        "width",
        "height",
        "rgbaDigest",
        "file",
      ],
      `calibrationPublication.summary.pngs[${index}]`,
    );
    const file = readPublishedFile(
      repoRoot,
      { file: row.file, byteLength: row.byteLength, digest: row.digest },
      `Calibration published PNG ${index}`,
      raw.byteLength,
    );
    return { stepNumber: row.stepNumber, scale: row.scale, bytes: file.bytes };
  });
  const provenance = summary.provenance.map((raw, index) => {
    const row = exactCaptureRecord(
      raw,
      ["role", "byteLength", "digest", "file"],
      `calibrationPublication.summary.provenance[${index}]`,
    );
    const file = readPublishedFile(
      repoRoot,
      { file: row.file, byteLength: row.byteLength, digest: row.digest },
      `Calibration published provenance ${String(row.role)}`,
      raw.byteLength,
    );
    return { role: row.role, digest: row.digest, bytes: file.bytes };
  });
  const capture = parseRealBuildSourceParityCalibrationCapture(
    captureManifest.bytes,
    roleAttachments,
    pngAttachments,
  );
  const preparedInput = snapshotRealBuildSourceParityCalibrationPublicationInput({
    repoRoot,
    capture,
    fullPreparedPanelsManifestBytes: fullManifest.bytes,
    sourceSnapshot: summary.sourceSnapshot,
    provenance,
  });
  const reproduced = prepareRealBuildSourceParityCalibrationPublication(preparedInput);
  if (canonicalStringify(reproduced.summary) !== canonicalStringify(summary)) {
    throw new TypeError(
      "Calibration publication summary does not reproduce its internally derived execution identity and retained descriptors.",
    );
  }
  return createArtifact(summary, {
    summaryBytes: parsed.bytes,
    captureManifestBytes: captureManifest.bytes,
    fullManifestBytes: fullManifest.bytes,
    roles: new Map(roleAttachments.map(({ role, bytes }) => [String(role), bytes])),
    pngs: new Map(
      pngAttachments.map(({ stepNumber, scale, bytes }) => [
        `${String(stepNumber)}:${String(scale)}`,
        bytes,
      ]),
    ),
    provenance: new Map(provenance.map(({ role, bytes }) => [String(role), bytes])),
  });
}

export function requirePublishedRealBuildSourceParityCalibration(
  value: unknown,
): RealBuildSourceParityCalibrationPublicationArtifact {
  if (value === null || typeof value !== "object" || !retainedByArtifact.has(value)) {
    throw new TypeError(
      "Calibration publication requires an artifact branded by the current retained-byte parser.",
    );
  }
  return value as RealBuildSourceParityCalibrationPublicationArtifact;
}
