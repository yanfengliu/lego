import { deepFreeze, type Sha256Digest } from "@lego-studio/brick-kernel";

import {
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_HIGH_RGBA_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_W_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_WORK_RGBA_BYTES,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES,
} from "./real-build-observation-source-parity-calibration-capture-types";
import {
  boundedDenseCaptureArray,
  exactCaptureRecord,
} from "./real-build-observation-source-parity-calibration-capture-structure";
import { snapshotRealBuildSourceParityCalibrationSourceSnapshot } from "./real-build-observation-source-parity-calibration-publication-input";
import {
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_FULL_MANIFEST_BYTES,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SCHEMA,
  type RealBuildSourceParityCalibrationPublicationSummary,
} from "./real-build-observation-source-parity-calibration-publication-types";
import { REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES } from "./real-build-observation-source-parity-calibration-selection";
import {
  sourceParityDigest,
  sourceParityInteger,
} from "./real-build-observation-source-parity-output-primitives";

const ROLE_MAXIMUMS = Object.freeze({
  "calibration-high-rgba8": MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_HIGH_RGBA_BYTES,
  "calibration-work-rgba8": MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_WORK_RGBA_BYTES,
  "calibration-stage-manifest-json":
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_MANIFEST_BYTES,
  "calibration-stage-packed-msb": MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_STAGE_BYTES,
  "calibration-w-packed-msb": MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_W_BYTES,
});
const MAXIMUM_PROVENANCE_BYTES = 384 * 1024 * 1024;
const STRICT_PROVENANCE_ROLE = /^[A-Za-z0-9._@/-]{1,256}$/u;

function fileDescriptor(
  value: unknown,
  label: string,
  maximumBytes: number,
  expectedFile: (digest: Sha256Digest) => string,
) {
  const row = exactCaptureRecord(value, ["file", "byteLength", "digest"], label);
  const digest = sourceParityDigest(row.digest, `${label}.digest`) as Sha256Digest;
  const byteLength = sourceParityInteger(row.byteLength, 1, maximumBytes, `${label}.byteLength`);
  const file = expectedFile(digest);
  if (row.file !== file) {
    throw new TypeError(`${label}.file observed ${JSON.stringify(row.file)}; expected ${file}.`);
  }
  return Object.freeze({ file, byteLength, digest });
}

/** Validates every summary leaf and aggregate cap before any referenced file is opened. */
export function preflightRealBuildSourceParityCalibrationPublicationSummary(
  value: unknown,
): RealBuildSourceParityCalibrationPublicationSummary {
  const root = exactCaptureRecord(
    value,
    [
      "schemaVersion",
      "authority",
      "reviewState",
      "executionIdentityDigest",
      "runDirectory",
      "captureManifest",
      "fullPreparedPanelsManifest",
      "sourceSnapshot",
      "roles",
      "pngs",
      "provenance",
    ],
    "calibrationPublication.summary",
  );
  if (
    root.schemaVersion !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SCHEMA ||
    root.reviewState !== "pending-unreviewed"
  ) {
    throw new TypeError(
      "Calibration publication summary must retain schema /1 and pending-unreviewed state.",
    );
  }
  const authority = exactCaptureRecord(
    root.authority,
    ["status", "authorized", "reason"],
    "calibrationPublication.summary.authority",
  );
  if (
    authority.status !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY.status ||
    authority.authorized !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY.authorized ||
    authority.reason !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY.reason
  ) {
    throw new TypeError(
      "Calibration publication summary authority must remain absent and pending human review.",
    );
  }
  const executionIdentityDigest = sourceParityDigest(
    root.executionIdentityDigest,
    "Calibration execution identity digest",
  ) as Sha256Digest;
  const runDirectory =
    `output/playwright/real-build-source-calibration/runs/${executionIdentityDigest.slice("sha256:".length)}` as const;
  if (root.runDirectory !== runDirectory) {
    throw new TypeError(
      `Calibration publication runDirectory observed ${JSON.stringify(root.runDirectory)}; expected ${runDirectory}.`,
    );
  }
  const captureManifest = fileDescriptor(
    root.captureManifest,
    "calibrationPublication.summary.captureManifest",
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_MANIFEST_BYTES,
    (digest) => `${runDirectory}/capture/${digest.slice("sha256:".length)}.json`,
  );
  const fullPreparedPanelsManifest = fileDescriptor(
    root.fullPreparedPanelsManifest,
    "calibrationPublication.summary.fullPreparedPanelsManifest",
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_FULL_MANIFEST_BYTES,
    (digest) => `${runDirectory}/prepared/${digest.slice("sha256:".length)}.json`,
  );
  const roleRows = boundedDenseCaptureArray(
    root.roles,
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.length,
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.length,
    "calibrationPublication.summary.roles",
  );
  let aggregateRoleBytes = 0;
  const roles = roleRows.map((value, index) => {
    const row = exactCaptureRecord(
      value,
      ["role", "contentEncoding", "byteLength", "digest", "file"],
      `calibrationPublication.summary.roles[${index}]`,
    );
    const role = REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES[index]!;
    if (
      row.role !== role ||
      row.contentEncoding !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS[role]
    ) {
      throw new TypeError(
        `Calibration published role ${index} must be ordered ${role} with its exact encoding.`,
      );
    }
    const digest = sourceParityDigest(
      row.digest,
      `Calibration published role ${role} digest`,
    ) as Sha256Digest;
    const byteLength = sourceParityInteger(
      row.byteLength,
      1,
      ROLE_MAXIMUMS[role],
      `Calibration published role ${role} byteLength`,
    );
    aggregateRoleBytes += byteLength;
    const file = `${runDirectory}/roles/${role}-${digest.slice("sha256:".length)}.bin`;
    if (row.file !== file)
      throw new TypeError(`Calibration published role ${role} path is not canonical.`);
    return Object.freeze({
      role,
      contentEncoding: REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLE_ENCODINGS[role],
      byteLength,
      digest,
      file,
    });
  });
  const maximumRoleAggregate = Object.values(ROLE_MAXIMUMS).reduce(
    (sum, maximum) => sum + maximum,
    0,
  );
  if (aggregateRoleBytes > maximumRoleAggregate) {
    throw new RangeError("Calibration published roles exceed their aggregate hard bound.");
  }
  const pngRows = boundedDenseCaptureArray(
    root.pngs,
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.length * 2,
    REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES.length * 2,
    "calibrationPublication.summary.pngs",
  );
  let aggregatePngBytes = 0;
  const pngs = pngRows.map((value, index) => {
    const row = exactCaptureRecord(
      value,
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
    const expectedStep =
      REAL_BUILD_SOURCE_PARITY_CALIBRATION_PANEL_PAGES[Math.floor(index / 2)]!.stepNumber;
    const scale = index % 2 === 0 ? "high" : "work";
    if (row.stepNumber !== expectedStep || row.scale !== scale || row.mediaType !== "image/png") {
      throw new TypeError(
        `Calibration published PNG ${index} must retain its exact step, scale, and media type.`,
      );
    }
    const byteLength = sourceParityInteger(
      row.byteLength,
      1,
      MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES,
      `Calibration published PNG ${index} byteLength`,
    );
    aggregatePngBytes += byteLength;
    const digest = sourceParityDigest(
      row.digest,
      `Calibration published PNG ${index} digest`,
    ) as Sha256Digest;
    const rgbaDigest = sourceParityDigest(
      row.rgbaDigest,
      `Calibration published PNG ${index} RGBA digest`,
    ) as Sha256Digest;
    const width = sourceParityInteger(
      row.width,
      1,
      4_194_304,
      `Calibration published PNG ${index} width`,
    );
    const height = sourceParityInteger(
      row.height,
      1,
      4_194_304,
      `Calibration published PNG ${index} height`,
    );
    const maximumPixels = scale === "high" ? 4_194_304 : 1_048_576;
    if (width * height > maximumPixels)
      throw new RangeError(
        `Calibration published PNG ${index} dimensions exceed ${maximumPixels} pixels.`,
      );
    const file = `${runDirectory}/pngs/${String(expectedStep).padStart(3, "0")}-${scale}-${digest.slice("sha256:".length)}.png`;
    if (row.file !== file)
      throw new TypeError(`Calibration published PNG ${index} path is not canonical.`);
    return Object.freeze({
      stepNumber: expectedStep,
      scale,
      mediaType: "image/png" as const,
      byteLength,
      digest,
      width,
      height,
      rgbaDigest,
      file,
    });
  });
  if (aggregatePngBytes > MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES) {
    throw new RangeError("Calibration published PNGs exceed their aggregate hard bound.");
  }
  const provenanceRows = boundedDenseCaptureArray(
    root.provenance,
    4,
    10,
    "calibrationPublication.summary.provenance",
  );
  let aggregateProvenanceBytes = 0;
  let priorRole = "";
  const provenance = provenanceRows.map((value, index) => {
    const row = exactCaptureRecord(
      value,
      ["role", "byteLength", "digest", "file"],
      `calibrationPublication.summary.provenance[${index}]`,
    );
    if (
      typeof row.role !== "string" ||
      !STRICT_PROVENANCE_ROLE.test(row.role) ||
      row.role.localeCompare(priorRole) <= 0
    ) {
      throw new TypeError(
        "Calibration publication provenance roles must be canonical, unique, and sorted.",
      );
    }
    priorRole = row.role;
    const digest = sourceParityDigest(
      row.digest,
      `Calibration provenance ${row.role} digest`,
    ) as Sha256Digest;
    const byteLength = sourceParityInteger(
      row.byteLength,
      1,
      MAXIMUM_PROVENANCE_BYTES,
      `Calibration provenance ${row.role} byteLength`,
    );
    aggregateProvenanceBytes += byteLength;
    const file = `${runDirectory}/provenance/${digest.slice("sha256:".length)}.bin`;
    if (row.file !== file)
      throw new TypeError(`Calibration provenance ${row.role} path is not canonical.`);
    return Object.freeze({ role: row.role, byteLength, digest, file });
  });
  if (aggregateProvenanceBytes > MAXIMUM_PROVENANCE_BYTES) {
    throw new RangeError("Calibration publication provenance exceeds its aggregate hard bound.");
  }
  return deepFreeze({
    schemaVersion: REAL_BUILD_SOURCE_PARITY_CALIBRATION_PUBLICATION_SCHEMA,
    authority: REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_AUTHORITY,
    reviewState: "pending-unreviewed" as const,
    executionIdentityDigest,
    runDirectory,
    captureManifest,
    fullPreparedPanelsManifest,
    sourceSnapshot: snapshotRealBuildSourceParityCalibrationSourceSnapshot(root.sourceSnapshot),
    roles,
    pngs,
    provenance,
  });
}
