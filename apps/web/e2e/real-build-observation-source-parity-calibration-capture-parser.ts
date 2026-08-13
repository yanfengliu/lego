import {
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_MANIFEST_BYTES,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES,
  type RealBuildSourceParityCalibrationCaptureArtifact,
  type RealBuildSourceParityCalibrationCaptureAttachments,
  type RealBuildSourceParityCalibrationCaptureRole,
} from "./real-build-observation-source-parity-calibration-capture-types";
import { parseRealBuildSourceParityCalibrationCaptureManifest } from "./real-build-observation-source-parity-calibration-capture-manifest";
import { reconstructRealBuildSourceParityCalibrationBrowserCaptureEvidence } from "./real-build-observation-source-parity-calibration-capture-browser-evidence";
import {
  captureDigest,
  denseCaptureArray,
  describeCaptureValue,
  exactCaptureRecord,
  parseCanonicalCaptureJson,
  snapshotCaptureBytes,
} from "./real-build-observation-source-parity-calibration-capture-structure";
import {
  type CalibrationCapturePngBytes,
  type CalibrationCaptureRoleBytes,
  validateRealBuildSourceParityCalibrationCapture,
} from "./real-build-observation-source-parity-calibration-capture-validation";

interface RetainedCaptureBytes {
  readonly manifestBytes: Uint8Array;
  readonly roles: CalibrationCaptureRoleBytes;
  readonly pngs: CalibrationCapturePngBytes;
}

const retainedByArtifact = new WeakMap<object, RetainedCaptureBytes>();

function snapshotRoles(
  value: unknown,
  manifest: ReturnType<typeof parseRealBuildSourceParityCalibrationCaptureManifest>,
): CalibrationCaptureRoleBytes {
  const rows = denseCaptureArray(
    value,
    manifest.roles.length,
    "calibrationCapture.roleAttachments",
  );
  const rawBytes: unknown[] = [];
  rows.forEach((value, index) => {
    const path = `calibrationCapture.roleAttachments[${index}]`;
    const row = exactCaptureRecord(value, ["role", "bytes"], path);
    const expected = manifest.roles[index]!;
    if (row.role !== expected.role) {
      throw new TypeError(
        `${path}.role observed ${describeCaptureValue(row.role)}; expected ${expected.role}.`,
      );
    }
    rawBytes.push(row.bytes);
  });
  const result = new Map<RealBuildSourceParityCalibrationCaptureRole, Uint8Array>();
  rawBytes.forEach((value, index) => {
    const descriptor = manifest.roles[index]!;
    const bytes = snapshotCaptureBytes(
      value,
      descriptor.byteLength,
      `calibrationCapture.roleAttachments[${index}].bytes`,
    );
    if (bytes.length !== descriptor.byteLength) {
      throw new RangeError(
        `calibrationCapture.roleAttachments[${index}].bytes has ${bytes.length} bytes; ${descriptor.role} declares exactly ${descriptor.byteLength}.`,
      );
    }
    result.set(descriptor.role, bytes);
  });
  return result;
}

function snapshotPngs(
  value: unknown,
  manifest: ReturnType<typeof parseRealBuildSourceParityCalibrationCaptureManifest>,
): CalibrationCapturePngBytes {
  const rows = denseCaptureArray(
    value,
    manifest.panels.length * 2,
    "calibrationCapture.pngAttachments",
  );
  const rawBytes: unknown[] = [];
  rows.forEach((value, index) => {
    const path = `calibrationCapture.pngAttachments[${index}]`;
    const row = exactCaptureRecord(value, ["stepNumber", "scale", "bytes"], path);
    const panel = manifest.panels[Math.floor(index / 2)]!;
    const scale = index % 2 === 0 ? "high" : "work";
    if (row.stepNumber !== panel.stepNumber || row.scale !== scale) {
      throw new TypeError(
        `${path} observed step/scale ${describeCaptureValue(row.stepNumber)}/${describeCaptureValue(row.scale)}; expected ${panel.stepNumber}/${scale}.`,
      );
    }
    rawBytes.push(row.bytes);
  });
  const result = new Map<string, Uint8Array>();
  rawBytes.forEach((value, index) => {
    const panel = manifest.panels[Math.floor(index / 2)]!;
    const scale = index % 2 === 0 ? "high" : "work";
    const reference = scale === "high" ? panel.highPng : panel.workPng;
    const bytes = snapshotCaptureBytes(
      value,
      reference.byteLength,
      `calibrationCapture.pngAttachments[${index}].bytes`,
    );
    if (bytes.length !== reference.byteLength) {
      throw new RangeError(
        `calibrationCapture.pngAttachments[${index}].bytes has ${bytes.length} bytes; step ${panel.stepNumber} ${scale} PNG declares exactly ${reference.byteLength}.`,
      );
    }
    result.set(`${panel.stepNumber}:${scale}`, bytes);
  });
  return result;
}

function createArtifact(
  manifest: ReturnType<typeof parseRealBuildSourceParityCalibrationCaptureManifest>,
  retained: RetainedCaptureBytes,
): RealBuildSourceParityCalibrationCaptureArtifact {
  const artifact = Object.freeze({
    manifest,
    manifestDigest: captureDigest(retained.manifestBytes),
    readManifestBytes: (): Uint8Array => new Uint8Array(retained.manifestBytes),
    readRole: (role: RealBuildSourceParityCalibrationCaptureRole): Uint8Array => {
      if (
        typeof role !== "string" ||
        !REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.includes(role)
      ) {
        throw new TypeError(
          `Calibration capture role observed ${describeCaptureValue(role)}; expected one of ${REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.join(", ")}.`,
        );
      }
      return new Uint8Array(retained.roles.get(role)!);
    },
    readPng: (stepNumber: number, scale: "high" | "work"): Uint8Array => {
      if (
        !Number.isSafeInteger(stepNumber) ||
        !manifest.panels.some((panel) => panel.stepNumber === stepNumber) ||
        (scale !== "high" && scale !== "work")
      ) {
        throw new TypeError(
          `Calibration capture PNG observed step/scale ${describeCaptureValue(stepNumber)}/${describeCaptureValue(scale)}; expected one retained exact-five high/work PNG.`,
        );
      }
      const bytes = retained.pngs.get(`${stepNumber}:${scale}`);
      if (bytes === undefined) throw new Error("Validated calibration PNG attachment is absent.");
      return new Uint8Array(bytes);
    },
  });
  retainedByArtifact.set(artifact, retained);
  return artifact;
}

/** Public hostile seam for bytes a publisher has written and independently read back. */
export function parseRealBuildSourceParityCalibrationCapture(
  manifestValue: unknown,
  roleAttachmentsValue: unknown,
  pngAttachmentsValue: unknown,
): RealBuildSourceParityCalibrationCaptureArtifact {
  const parsed = parseCanonicalCaptureJson(
    manifestValue,
    MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_MANIFEST_BYTES,
    "calibrationCapture.manifestBytes",
  );
  const manifest = parseRealBuildSourceParityCalibrationCaptureManifest(parsed.value);
  const roles = snapshotRoles(roleAttachmentsValue, manifest);
  const pngs = snapshotPngs(pngAttachmentsValue, manifest);
  validateRealBuildSourceParityCalibrationCapture(manifest, roles, pngs);
  const browser = reconstructRealBuildSourceParityCalibrationBrowserCaptureEvidence(
    manifest,
    roles,
    pngs,
  );
  if (
    browser.bytes.length !== manifest.browserCaptureBytes ||
    browser.digest !== manifest.browserCaptureDigest
  ) {
    throw new TypeError(
      `Calibration capture retained attachments reconstruct browser evidence ${browser.bytes.length}/${browser.digest}; manifest binds ${manifest.browserCaptureBytes}/${manifest.browserCaptureDigest}.`,
    );
  }
  return createArtifact(manifest, { manifestBytes: parsed.bytes, roles, pngs });
}

/** Exports fresh inert attachments; the brand confers no adjudication or document authority. */
export function copyRealBuildSourceParityCalibrationCaptureArtifact(
  value: unknown,
): RealBuildSourceParityCalibrationCaptureAttachments {
  if (value === null || typeof value !== "object") {
    throw new TypeError(
      "Calibration capture export requires one artifact from the current parser.",
    );
  }
  const retained = retainedByArtifact.get(value);
  if (retained === undefined) {
    throw new TypeError(
      "Calibration capture export requires one artifact admitted by the current parser, not a detached lookalike.",
    );
  }
  const artifact = value as RealBuildSourceParityCalibrationCaptureArtifact;
  return Object.freeze({
    manifestBytes: new Uint8Array(retained.manifestBytes),
    roles: Object.freeze(
      REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_ROLES.map((role) =>
        Object.freeze({ role, bytes: new Uint8Array(retained.roles.get(role)!) }),
      ),
    ),
    pngs: Object.freeze(
      artifact.manifest.panels.flatMap(({ stepNumber }) =>
        (["high", "work"] as const).map((scale) =>
          Object.freeze({
            stepNumber,
            scale,
            bytes: new Uint8Array(retained.pngs.get(`${stepNumber}:${scale}`)!),
          }),
        ),
      ),
    ),
  });
}
