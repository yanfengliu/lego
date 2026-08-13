import { canonicalStringify } from "@lego-studio/brick-kernel";

import {
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_MANIFEST_BYTES,
  MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES,
  REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA,
  type RealBuildSourceParityCalibrationBrowserCaptureWire,
  type RealBuildSourceParityCalibrationCaptureArtifact,
  type RealBuildSourceParityCalibrationCaptureFinalizationInput,
  type RealBuildSourceParityCalibrationCaptureManifest,
  type RealBuildSourceParityCalibrationCaptureRole,
} from "./real-build-observation-source-parity-calibration-capture-types";
import { parseRealBuildSourceParityCalibrationCaptureManifest } from "./real-build-observation-source-parity-calibration-capture-manifest";
import { parseRealBuildSourceParityCalibrationCapture } from "./real-build-observation-source-parity-calibration-capture-parser";
import {
  captureDigest,
  decodeCaptureBase64,
  decodeCapturePngDataUrl,
  denseCaptureArray,
  describeCaptureValue,
  exactCaptureRecord,
} from "./real-build-observation-source-parity-calibration-capture-structure";
import { reconstructRealBuildSourceParityCalibrationBrowserCaptureEvidence } from "./real-build-observation-source-parity-calibration-capture-browser-evidence";
import { validateRealBuildSourceParityCalibrationCapture } from "./real-build-observation-source-parity-calibration-capture-validation";

const PANEL_KEYS = [
  "stepNumber",
  "pageNumber",
  "minXPt",
  "maxXPt",
  "minYPt",
  "maxYPt",
  "calloutBoxes",
  "panelEvidenceDigest",
  "highWidth",
  "highHeight",
  "highPixelCount",
  "workWidth",
  "workHeight",
  "workPixelCount",
  "workFactor",
  "highRgba",
  "workRgba",
  "stageTracePanelIndex",
  "pMask",
  "dMask",
  "wMask",
  "candidatePolicyDigest",
  "candidateDerivationDigest",
  "pairwisePdw",
  "highPng",
  "workPng",
] as const;

interface WireTransport {
  readonly base64: readonly unknown[];
  readonly pngDataUrls: readonly unknown[];
}

export interface RealBuildSourceParityCalibrationBrowserCapturePreflight {
  readonly browserCapture: RealBuildSourceParityCalibrationBrowserCaptureWire;
  readonly browserCaptureBytes: Uint8Array;
  readonly browserCaptureDigest: ReturnType<typeof captureDigest>;
}

function preflightWireRole(
  value: unknown,
  index: number,
): {
  readonly descriptor: Record<string, unknown>;
  readonly base64: unknown;
} {
  const path = `calibrationBrowserCapture.roles[${index}]`;
  const row = exactCaptureRecord(
    value,
    ["role", "contentEncoding", "byteLength", "digest", "transportEncoding", "base64"],
    path,
  );
  if (row.transportEncoding !== "base64/1") {
    throw new TypeError(
      `${path}.transportEncoding observed ${describeCaptureValue(row.transportEncoding)}; expected base64/1.`,
    );
  }
  return {
    descriptor: {
      role: row.role,
      contentEncoding: row.contentEncoding,
      byteLength: row.byteLength,
      digest: row.digest,
    },
    base64: row.base64,
  };
}

function preflightWirePng(
  value: unknown,
  path: string,
): {
  readonly descriptor: Record<string, unknown>;
  readonly dataUrl: unknown;
} {
  const row = exactCaptureRecord(
    value,
    [
      "mediaType",
      "byteLength",
      "digest",
      "width",
      "height",
      "rgbaDigest",
      "transportEncoding",
      "dataUrl",
    ],
    path,
  );
  if (row.transportEncoding !== "data-url-base64/1") {
    throw new TypeError(
      `${path}.transportEncoding observed ${describeCaptureValue(row.transportEncoding)}; expected data-url-base64/1.`,
    );
  }
  return {
    descriptor: {
      mediaType: row.mediaType,
      byteLength: row.byteLength,
      digest: row.digest,
      width: row.width,
      height: row.height,
      rgbaDigest: row.rgbaDigest,
    },
    dataUrl: row.dataUrl,
  };
}

function preflightWirePanel(
  value: unknown,
  index: number,
): {
  readonly retained: Record<string, unknown>;
  readonly pngDataUrls: readonly [unknown, unknown];
} {
  const path = `calibrationBrowserCapture.panels[${index}]`;
  const row = exactCaptureRecord(value, PANEL_KEYS, path);
  const high = preflightWirePng(row.highPng, `${path}.highPng`);
  const work = preflightWirePng(row.workPng, `${path}.workPng`);
  const retained: Record<string, unknown> = Object.create(null);
  for (const key of PANEL_KEYS) retained[key] = row[key];
  retained.highPng = high.descriptor;
  retained.workPng = work.descriptor;
  return { retained, pngDataUrls: [high.dataUrl, work.dataUrl] };
}

function preflightBrowserWire(value: unknown): {
  readonly manifest: RealBuildSourceParityCalibrationCaptureManifest;
  readonly transport: WireTransport;
} {
  const root = exactCaptureRecord(
    value,
    [
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
    ],
    "calibrationBrowserCapture",
  );
  if (root.schemaVersion !== REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA) {
    throw new TypeError(
      `calibrationBrowserCapture.schemaVersion observed ${describeCaptureValue(root.schemaVersion)}; expected ${REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_SCHEMA}.`,
    );
  }
  const wireRoles = denseCaptureArray(root.roles, 5, "calibrationBrowserCapture.roles").map(
    preflightWireRole,
  );
  const wirePanels = denseCaptureArray(root.panels, 5, "calibrationBrowserCapture.panels").map(
    preflightWirePanel,
  );
  const provisional = parseRealBuildSourceParityCalibrationCaptureManifest({
    schemaVersion: "lego.real-build-observation-source-parity-calibration-capture/1",
    authority: root.authority,
    reviewState: root.reviewState,
    pdfDigest: root.pdfDigest,
    pdfBytes: root.pdfBytes,
    fullPreparedPanelsDigest: root.fullPreparedPanelsDigest,
    calibrationPreparedPanelsDigest: root.calibrationPreparedPanelsDigest,
    calibrationDigest: root.calibrationDigest,
    browserCaptureDigest: `sha256:${"0".repeat(64)}`,
    browserCaptureBytes: 2,
    roles: wireRoles.map(({ descriptor }) => descriptor),
    panels: wirePanels.map(({ retained }) => retained),
  });
  return {
    manifest: provisional,
    transport: {
      base64: wireRoles.map(({ base64 }) => base64),
      pngDataUrls: wirePanels.flatMap(({ pngDataUrls }) => pngDataUrls),
    },
  };
}

function transportCharacterPreflight(
  transport: WireTransport,
  manifest: RealBuildSourceParityCalibrationCaptureManifest,
): void {
  let characters = 0;
  transport.base64.forEach((value, index) => {
    const descriptor = manifest.roles[index]!;
    const maximum = Math.ceil(descriptor.byteLength / 3) * 4;
    if (typeof value !== "string" || value.length !== maximum) {
      throw new RangeError(
        `calibrationBrowserCapture.roles[${index}].base64 has ${typeof value === "string" ? value.length : describeCaptureValue(value)} characters; ${descriptor.byteLength} bytes require exactly ${maximum}.`,
      );
    }
    characters += value.length;
  });
  transport.pngDataUrls.forEach((value, index) => {
    const panel = manifest.panels[Math.floor(index / 2)]!;
    const reference = index % 2 === 0 ? panel.highPng : panel.workPng;
    const maximum = "data:image/png;base64,".length + Math.ceil(reference.byteLength / 3) * 4;
    if (typeof value !== "string" || value.length !== maximum) {
      throw new RangeError(
        `calibrationBrowserCapture PNG transport ${index} has ${typeof value === "string" ? value.length : describeCaptureValue(value)} characters; ${reference.byteLength} bytes require exactly ${maximum}.`,
      );
    }
    characters += value.length;
  });
  if (characters > MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_BYTES) {
    throw new RangeError(
      `Calibration browser capture transports declare ${characters} base64/data-URL characters; expected at most ${MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_BYTES}.`,
    );
  }
}

function decodeBrowserCapture(value: unknown) {
  const { manifest: provisional, transport } = preflightBrowserWire(value);
  transportCharacterPreflight(transport, provisional);
  const roleAttachments = provisional.roles.map((descriptor, index) => ({
    role: descriptor.role,
    bytes: decodeCaptureBase64(
      transport.base64[index],
      descriptor.byteLength,
      descriptor.byteLength,
      `calibrationBrowserCapture.roles[${index}].base64`,
    ),
  }));
  let aggregatePngBytes = 0;
  const pngAttachments = provisional.panels.flatMap((panel, panelIndex) =>
    (["high", "work"] as const).map((scale, scaleIndex) => {
      const reference = scale === "high" ? panel.highPng : panel.workPng;
      aggregatePngBytes += reference.byteLength;
      if (aggregatePngBytes > MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES) {
        throw new RangeError(
          `Calibration PNG transport reaches ${aggregatePngBytes} decoded bytes at step ${panel.stepNumber}; expected at most ${MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_PNG_BYTES}.`,
        );
      }
      return {
        stepNumber: panel.stepNumber,
        scale,
        bytes: decodeCapturePngDataUrl(
          transport.pngDataUrls[panelIndex * 2 + scaleIndex],
          reference.byteLength,
          reference.byteLength,
          `calibrationBrowserCapture.panels[${panelIndex}].${scale}Png.dataUrl`,
        ),
      };
    }),
  );
  const roles = new Map(roleAttachments.map(({ role, bytes }) => [role, bytes]));
  const pngs = new Map(
    pngAttachments.map(({ stepNumber, scale, bytes }) => [`${stepNumber}:${scale}`, bytes]),
  );
  validateRealBuildSourceParityCalibrationCapture(provisional, roles, pngs);
  const browser = reconstructRealBuildSourceParityCalibrationBrowserCaptureEvidence(
    provisional,
    roles,
    pngs,
  );
  if (browser.bytes.length > MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_BYTES) {
    throw new RangeError(
      `Canonical calibration browser capture has ${browser.bytes.length} bytes; expected at most ${MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_BROWSER_CAPTURE_BYTES}.`,
    );
  }
  return { provisional, roleAttachments, pngAttachments, browser };
}

/** Validates and names exact browser evidence before an execution identity can exist. */
export function preflightRealBuildSourceParityCalibrationBrowserCaptureEvidence(
  value: unknown,
): RealBuildSourceParityCalibrationBrowserCapturePreflight {
  const { browser } = decodeBrowserCapture(value);
  return Object.freeze({
    browserCapture: browser.wire,
    browserCaptureBytes: new Uint8Array(browser.bytes),
    browserCaptureDigest: browser.digest,
  });
}

/** Decodes transient browser transport, closes exact evidence, and returns no authority. */
export function createRealBuildSourceParityCalibrationCaptureArtifact(
  inputValue: unknown,
): RealBuildSourceParityCalibrationCaptureArtifact {
  const input = exactCaptureRecord(
    inputValue,
    ["browserCapture"],
    "calibrationCaptureFinalization",
  );
  const { provisional, roleAttachments, pngAttachments, browser } = decodeBrowserCapture(
    input.browserCapture,
  );
  const manifest: RealBuildSourceParityCalibrationCaptureManifest = {
    ...provisional,
    browserCaptureDigest: browser.digest,
    browserCaptureBytes: browser.bytes.length,
  };
  const manifestBytes = new TextEncoder().encode(canonicalStringify(manifest));
  if (manifestBytes.length > MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_MANIFEST_BYTES) {
    throw new RangeError(
      `Canonical calibration capture manifest has ${manifestBytes.length} bytes; expected at most ${MAXIMUM_REAL_BUILD_SOURCE_PARITY_CALIBRATION_CAPTURE_MANIFEST_BYTES}.`,
    );
  }
  return parseRealBuildSourceParityCalibrationCapture(
    manifestBytes,
    roleAttachments,
    pngAttachments,
  );
}

export type {
  RealBuildSourceParityCalibrationCaptureFinalizationInput,
  RealBuildSourceParityCalibrationCaptureRole,
};
