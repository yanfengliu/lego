import { Buffer } from "node:buffer";

import { canonicalStringify, deepFreeze } from "@lego-studio/brick-kernel";

import {
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA,
  type RealBuildSourceParityCalibrationBrowserCaptureWire,
  type RealBuildSourceParityCalibrationCaptureManifest,
} from "./real-build-observation-source-parity-calibration-capture-types";
import { captureDigest } from "./real-build-observation-source-parity-calibration-capture-structure";
import type {
  CalibrationCapturePngBytes,
  CalibrationCaptureRoleBytes,
} from "./real-build-observation-source-parity-calibration-capture-validation";

export interface RealBuildSourceParityCalibrationBrowserCaptureEvidence {
  readonly wire: RealBuildSourceParityCalibrationBrowserCaptureWire;
  readonly bytes: Uint8Array;
  readonly digest: ReturnType<typeof captureDigest>;
}

const base64 = (bytes: Uint8Array): string =>
  Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("base64");

/** Reconstructs the exact canonical transient wire from closed retained attachments. */
export function reconstructRealBuildSourceParityCalibrationBrowserCaptureEvidence(
  manifest: RealBuildSourceParityCalibrationCaptureManifest,
  roles: CalibrationCaptureRoleBytes,
  pngs: CalibrationCapturePngBytes,
): RealBuildSourceParityCalibrationBrowserCaptureEvidence {
  const wire = deepFreeze({
    schemaVersion: REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA,
    authority: manifest.authority,
    reviewState: manifest.reviewState,
    pdfDigest: manifest.pdfDigest,
    pdfBytes: manifest.pdfBytes,
    fullPreparedPanelsDigest: manifest.fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest: manifest.calibrationPreparedPanelsDigest,
    calibrationDigest: manifest.calibrationDigest,
    roles: manifest.roles.map((descriptor) => {
      const bytes = roles.get(descriptor.role);
      if (bytes === undefined) {
        throw new TypeError(
          `Cannot reconstruct browser capture: role ${descriptor.role} is absent.`,
        );
      }
      return {
        ...descriptor,
        transportEncoding: "base64/1" as const,
        base64: base64(bytes),
      };
    }),
    panels: manifest.panels.map((panel) => {
      const high = pngs.get(`${panel.stepNumber}:high`);
      const work = pngs.get(`${panel.stepNumber}:work`);
      if (high === undefined || work === undefined) {
        throw new TypeError(
          `Cannot reconstruct browser capture: step ${panel.stepNumber} high/work PNG attachment is absent.`,
        );
      }
      return {
        ...panel,
        highPng: {
          ...panel.highPng,
          transportEncoding: "data-url-base64/1" as const,
          dataUrl: `data:image/png;base64,${base64(high)}`,
        },
        workPng: {
          ...panel.workPng,
          transportEncoding: "data-url-base64/1" as const,
          dataUrl: `data:image/png;base64,${base64(work)}`,
        },
      };
    }),
  }) as RealBuildSourceParityCalibrationBrowserCaptureWire;
  const bytes = new TextEncoder().encode(canonicalStringify(wire));
  return Object.freeze({ wire, bytes, digest: captureDigest(bytes) });
}
