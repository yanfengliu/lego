import { lstatSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { types as nodeTypes } from "node:util";

import {
  copyRealBuildSourceParityCalibrationCaptureArtifact,
  isRealBuildSourceParityCalibrationCaptureArtifact,
  parseRealBuildSourceParityCalibrationCapture,
} from "./real-build-observation-source-parity-calibration-capture-parser";
import { createRealBuildSourceParityCalibrationCaptureArtifact } from "./real-build-observation-source-parity-calibration-capture";
import type { RealBuildSourceParityCalibrationCaptureArtifact } from "./real-build-observation-source-parity-calibration-capture-types";
import {
  boundedDenseCaptureArray,
  exactCaptureRecord,
  snapshotCaptureBytes,
} from "./real-build-observation-source-parity-calibration-capture-structure";
import {
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_FULL_MANIFEST_BYTES,
  type RealBuildSourceParityCalibrationPublicationInput,
} from "./real-build-observation-source-parity-calibration-publication-types";
import {
  sourceParityDigest,
  sourceParityInteger,
} from "./real-build-observation-source-parity-output-primitives";
import type {
  RealBuildSourceParityProvenanceRole,
  RealBuildSourceParitySourceSnapshot,
} from "./real-build-observation-source-parity-types";

const SOURCE_SNAPSHOT_KEYS = [
  "state",
  "bootstrapManifestDigest",
  "bootstrapManifestEvidenceDigest",
  "sourceRootsPolicyDigest",
  "bootstrapLockManifestDigest",
  "bootstrapLockedFiles",
  "bootstrapLockedBytes",
  "bootstrapLockCoversInstructionPdf",
  "executionMirrorManifestDigest",
  "executionMirrorFiles",
  "executionMirrorBytes",
  "executionMirrorCoversInstructionPdf",
  "servedResponseManifestDigest",
  "servedResponseFiles",
  "servedResponseBytes",
  "servedSourceBundleManifestDigest",
  "servedSourceBundleDigest",
  "servedSourceFiles",
  "servedSourceUniqueBytes",
  "browserResultDigest",
  "browserResultBytes",
  "preparedPanelsDigest",
  "environmentDigest",
] as const;

export interface PreparedRealBuildSourceParityCalibrationPublicationInput {
  readonly repoRoot: string;
  readonly capture: RealBuildSourceParityCalibrationCaptureArtifact;
  readonly fullPreparedPanelsManifestBytes: Uint8Array;
  readonly sourceSnapshot: RealBuildSourceParitySourceSnapshot;
  readonly provenance: readonly RealBuildSourceParityProvenanceRole[];
}

export function snapshotRealBuildSourceParityCalibrationPublicationRepoRoot(
  value: unknown,
): string {
  if (typeof value !== "string" || !isAbsolute(value) || resolve(value) !== value) {
    throw new TypeError("Calibration publication repoRoot must be one resolved absolute path.");
  }
  const stat = lstatSync(value, { throwIfNoEntry: false });
  if (stat === undefined || !stat.isDirectory() || stat.isSymbolicLink()) {
    throw new TypeError("Calibration publication repoRoot must be an existing ordinary directory.");
  }
  return value;
}

export function snapshotRealBuildSourceParityCalibrationSourceSnapshot(
  value: unknown,
): RealBuildSourceParitySourceSnapshot {
  const row = exactCaptureRecord(
    value,
    SOURCE_SNAPSHOT_KEYS,
    "calibrationPublication.sourceSnapshot",
  );
  if (
    row.state !==
      "authenticated-bootstrap-and-execution-mirror-locks-held-before-and-after-measurement" ||
    row.bootstrapLockCoversInstructionPdf !== false ||
    row.executionMirrorCoversInstructionPdf !== true
  ) {
    throw new TypeError(
      "Calibration publication sourceSnapshot must state the exact bootstrap, execution-mirror, and PDF boundary.",
    );
  }
  const digestKeys = [
    "bootstrapManifestDigest",
    "bootstrapManifestEvidenceDigest",
    "sourceRootsPolicyDigest",
    "bootstrapLockManifestDigest",
    "executionMirrorManifestDigest",
    "servedResponseManifestDigest",
    "servedSourceBundleManifestDigest",
    "servedSourceBundleDigest",
    "browserResultDigest",
    "preparedPanelsDigest",
    "environmentDigest",
  ] as const;
  for (const key of digestKeys) sourceParityDigest(row[key], `Calibration sourceSnapshot.${key}`);
  const integerBounds = {
    bootstrapLockedFiles: [1, 10_000],
    bootstrapLockedBytes: [1, 512 * 1024 * 1024],
    executionMirrorFiles: [2, 10_020],
    executionMirrorBytes: [1, 512 * 1024 * 1024],
    servedResponseFiles: [1, 10],
    servedResponseBytes: [1, 384 * 1024 * 1024],
    servedSourceFiles: [1, 10_000],
    servedSourceUniqueBytes: [1, 192 * 1024 * 1024],
    browserResultBytes: [2, 384 * 1024 * 1024],
  } as const;
  for (const [key, [minimum, maximum]] of Object.entries(integerBounds)) {
    sourceParityInteger(row[key], minimum, maximum, `Calibration sourceSnapshot.${key}`);
  }
  return Object.freeze({ ...row }) as unknown as RealBuildSourceParitySourceSnapshot;
}

function closeCapture(value: unknown): RealBuildSourceParityCalibrationCaptureArtifact {
  if (isRealBuildSourceParityCalibrationCaptureArtifact(value)) {
    const attachments = copyRealBuildSourceParityCalibrationCaptureArtifact(value);
    return parseRealBuildSourceParityCalibrationCapture(
      attachments.manifestBytes,
      attachments.roles,
      attachments.pngs,
    );
  }
  if (
    value === null ||
    typeof value !== "object" ||
    nodeTypes.isProxy(value) ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      "calibrationPublication.capture must be a parser-branded artifact, exact inert attachments, or exact browser capture record.",
    );
  }
  let descriptors: Record<string, PropertyDescriptor>;
  let prototype: object | null;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value) as Record<string, PropertyDescriptor>;
    prototype = Object.getPrototypeOf(value);
  } catch {
    throw new TypeError(
      "calibrationPublication.capture refused non-invoking descriptor inspection.",
    );
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("calibrationPublication.capture must be a plain data record.");
  }
  const keys = Reflect.ownKeys(descriptors);
  if (
    keys.some((key) => typeof key !== "string") ||
    keys.some((key) => {
      const descriptor = descriptors[String(key)]!;
      return !("value" in descriptor) || descriptor.enumerable !== true;
    })
  ) {
    throw new TypeError(
      "calibrationPublication.capture must use only enumerable data properties without symbols or accessors.",
    );
  }
  const actual = (keys as string[]).sort().join("\0");
  const attachmentKeys = ["manifestBytes", "pngs", "roles"].sort().join("\0");
  const browserKeys = [
    "schemaVersion",
    "authority",
    "reviewState",
    "pdfDigest",
    "pdfBytes",
    "fullPreparedPanelsDigest",
    "calibrationPreparedPanelsDigest",
    "calibrationDigest",
    "roles",
    "panels",
  ]
    .sort()
    .join("\0");
  if (actual === attachmentKeys) {
    const row = exactCaptureRecord(
      value,
      ["manifestBytes", "roles", "pngs"],
      "calibrationPublication.captureAttachments",
    );
    return parseRealBuildSourceParityCalibrationCapture(row.manifestBytes, row.roles, row.pngs);
  }
  if (actual === browserKeys) {
    const artifact = createRealBuildSourceParityCalibrationCaptureArtifact({
      browserCapture: value,
    });
    const attachments = copyRealBuildSourceParityCalibrationCaptureArtifact(artifact);
    return parseRealBuildSourceParityCalibrationCapture(
      attachments.manifestBytes,
      attachments.roles,
      attachments.pngs,
    );
  }
  throw new TypeError(
    `calibrationPublication.capture keys did not match exact attachments or browser capture; observed [${(keys as string[]).sort().join(", ")}].`,
  );
}

/** Snapshots hostile outer input and closes capture bytes before any filesystem mutation. */
export function snapshotRealBuildSourceParityCalibrationPublicationInput(
  value: unknown,
): PreparedRealBuildSourceParityCalibrationPublicationInput {
  const row = exactCaptureRecord(
    value,
    ["repoRoot", "capture", "fullPreparedPanelsManifestBytes", "sourceSnapshot", "provenance"],
    "calibrationPublication",
  );
  const provenance = boundedDenseCaptureArray(
    row.provenance,
    4,
    10,
    "calibrationPublication.provenance",
  );
  return Object.freeze({
    repoRoot: snapshotRealBuildSourceParityCalibrationPublicationRepoRoot(row.repoRoot),
    capture: closeCapture(row.capture),
    fullPreparedPanelsManifestBytes: snapshotCaptureBytes(
      row.fullPreparedPanelsManifestBytes,
      MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_FULL_MANIFEST_BYTES,
      "calibrationPublication.fullPreparedPanelsManifestBytes",
    ),
    sourceSnapshot: snapshotRealBuildSourceParityCalibrationSourceSnapshot(row.sourceSnapshot),
    provenance: Object.freeze([...provenance]) as readonly RealBuildSourceParityProvenanceRole[],
  });
}

export type { RealBuildSourceParityCalibrationPublicationInput };
