import type { RealBuildPanelCameraMeasurementEvidence } from "./real-build-panel-camera-evidence-types";
import {
  createEvidenceInputBudget,
  denseEvidenceArray,
  describeEvidenceValue,
  evidenceFiniteNumber,
  evidenceIntegerPair,
  evidenceSafeInteger,
  exactEvidenceRecord,
} from "./real-build-panel-camera-evidence-parse-boundary";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const MEASUREMENT_KEYS = [
  "metric",
  "pdfDigest",
  "pageNumber",
  "cropPt",
  "sourcePanelPngDigest",
  "candidateBuildPngDigest",
  "panelFace",
  "camera",
  "widthPx",
  "heightPx",
  "builtMaskDigest",
  "excludedMaskDigest",
  "recomputation",
] as const;
const CAMERA_KEYS = [
  "azimuthDegrees",
  "elevationDegrees",
  "pixelsPerUnit",
  "residualPx",
  "coherence",
  "centerXPx",
  "centerYPx",
  "anchorIou",
  "anchorShiftPx",
  "anchorTurnDegrees",
] as const;

function digest(value: unknown, path: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw new TypeError(
      `${path} must be ${nullable ? "null or " : ""}a lowercase sha256 digest; received ${describeEvidenceValue(value)}.`,
    );
  }
  return value;
}

function nullableFinite(value: unknown, path: string): number | null {
  return value === null ? null : evidenceFiniteNumber(value, path);
}

export function parsePanelCameraMeasurement(
  value: unknown,
): RealBuildPanelCameraMeasurementEvidence | null {
  if (value === null) return null;
  const row = exactEvidenceRecord(value, "panelCamera.measurement", MEASUREMENT_KEYS);
  const crop = denseEvidenceArray(
    row.cropPt,
    "panelCamera.measurement.cropPt",
    createEvidenceInputBudget(4),
  );
  if (crop.length !== 4) {
    throw new RangeError(
      `panelCamera.measurement.cropPt must contain four finite PDF points; received ${crop.length}.`,
    );
  }
  const camera = exactEvidenceRecord(row.camera, "panelCamera.measurement.camera", CAMERA_KEYS);
  const recomputation = exactEvidenceRecord(
    row.recomputation,
    "panelCamera.measurement.recomputation",
    ["status", "reason"],
  );
  if (
    row.metric !== "binary-silhouette-iou/1" ||
    (row.panelFace !== "studs-up" && row.panelFace !== "underside") ||
    recomputation.status !== "unavailable" ||
    recomputation.reason !== "exact-mask-bytes-not-retained"
  ) {
    throw new TypeError(
      "panelCamera.measurement must name binary-silhouette-iou/1, a known panel face, and honest unavailable recomputation.",
    );
  }
  return {
    metric: "binary-silhouette-iou/1",
    pdfDigest: digest(row.pdfDigest, "panelCamera.measurement.pdfDigest")!,
    pageNumber: evidenceSafeInteger(row.pageNumber, "panelCamera.measurement.pageNumber", 1),
    cropPt: [
      evidenceFiniteNumber(crop[0], "panelCamera.measurement.cropPt[0]"),
      evidenceFiniteNumber(crop[1], "panelCamera.measurement.cropPt[1]"),
      evidenceFiniteNumber(crop[2], "panelCamera.measurement.cropPt[2]"),
      evidenceFiniteNumber(crop[3], "panelCamera.measurement.cropPt[3]"),
    ],
    sourcePanelPngDigest: digest(
      row.sourcePanelPngDigest,
      "panelCamera.measurement.sourcePanelPngDigest",
      true,
    ),
    candidateBuildPngDigest: digest(
      row.candidateBuildPngDigest,
      "panelCamera.measurement.candidateBuildPngDigest",
      true,
    ),
    panelFace: row.panelFace,
    camera: {
      azimuthDegrees: evidenceFiniteNumber(
        camera.azimuthDegrees,
        "panelCamera.measurement.camera.azimuthDegrees",
      ),
      elevationDegrees: evidenceFiniteNumber(
        camera.elevationDegrees,
        "panelCamera.measurement.camera.elevationDegrees",
      ),
      pixelsPerUnit: evidenceFiniteNumber(
        camera.pixelsPerUnit,
        "panelCamera.measurement.camera.pixelsPerUnit",
      ),
      residualPx: evidenceFiniteNumber(
        camera.residualPx,
        "panelCamera.measurement.camera.residualPx",
      ),
      coherence: evidenceFiniteNumber(camera.coherence, "panelCamera.measurement.camera.coherence"),
      centerXPx: evidenceFiniteNumber(camera.centerXPx, "panelCamera.measurement.camera.centerXPx"),
      centerYPx: evidenceFiniteNumber(camera.centerYPx, "panelCamera.measurement.camera.centerYPx"),
      anchorIou: nullableFinite(camera.anchorIou, "panelCamera.measurement.camera.anchorIou"),
      anchorShiftPx:
        camera.anchorShiftPx === null
          ? null
          : evidenceIntegerPair(
              camera.anchorShiftPx,
              "panelCamera.measurement.camera.anchorShiftPx",
            ),
      anchorTurnDegrees: nullableFinite(
        camera.anchorTurnDegrees,
        "panelCamera.measurement.camera.anchorTurnDegrees",
      ),
    },
    widthPx: evidenceSafeInteger(row.widthPx, "panelCamera.measurement.widthPx", 1),
    heightPx: evidenceSafeInteger(row.heightPx, "panelCamera.measurement.heightPx", 1),
    builtMaskDigest: digest(row.builtMaskDigest, "panelCamera.measurement.builtMaskDigest")!,
    excludedMaskDigest: digest(
      row.excludedMaskDigest,
      "panelCamera.measurement.excludedMaskDigest",
      true,
    ),
    recomputation: {
      status: "unavailable",
      reason: "exact-mask-bytes-not-retained",
    },
  };
}
